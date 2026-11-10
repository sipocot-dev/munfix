import type { PoolClient } from "pg";
import { isUniqueViolation, isUuid, query, withTx } from "./db";
import { HttpError } from "./errors";
import { generatePassword, hashPassword } from "./passwords";
import { isRole, type Role } from "./permissions";
import { revokeUserSessions, type Session } from "./session";

export interface UserRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  reportCount: number;
  categoryIds: number[];
  providers: string[];
}

export interface UserList {
  users: UserRow[];
  total: number;
}

export async function listUsers(opts: { q?: string; role?: string; limit?: number; offset?: number } = {}): Promise<UserList> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const offset = Math.max(opts.offset ?? 0, 0);
  const q = opts.q?.trim() ? `%${opts.q.trim().replace(/[%_\\]/g, "\\$&")}%` : null;
  const role = opts.role && isRole(opts.role) ? opts.role : null;

  const where = `u.deleted_at IS NULL AND ($1::text IS NULL OR u.name ILIKE $1 OR u.email ILIKE $1) AND ($2::text IS NULL OR u.role = $2)`;
  const rows = await query<{
    id: string;
    name: string;
    email: string;
    role: Role;
    is_active: boolean;
    must_change_password: boolean;
    created_at: Date;
    last_login_at: Date | null;
    report_count: string;
    category_ids: number[] | null;
    providers: string[] | null;
  }>(
    `SELECT u.id, u.name, u.email, u.role, u.is_active, u.must_change_password, u.created_at, u.last_login_at,
            (SELECT count(*) FROM reports r WHERE r.user_id = u.id) AS report_count,
            (SELECT array_agg(uc.category_id ORDER BY uc.category_id) FROM user_categories uc WHERE uc.user_id = u.id) AS category_ids,
            (SELECT array_agg(o.provider ORDER BY o.provider) FROM oauth_accounts o WHERE o.user_id = u.id) AS providers
       FROM users u
      WHERE ${where}
      ORDER BY (u.role = 'admin') DESC, u.role, u.created_at DESC
      LIMIT $3 OFFSET $4`,
    [q, role, limit, offset],
  );
  const [{ count }] = await query<{ count: string }>(`SELECT count(*) FROM users u WHERE ${where}`, [q, role]);

  return {
    total: Number(count),
    users: rows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      role: r.role,
      isActive: r.is_active,
      mustChangePassword: r.must_change_password,
      createdAt: r.created_at.toISOString(),
      lastLoginAt: r.last_login_at ? r.last_login_at.toISOString() : null,
      reportCount: Number(r.report_count),
      categoryIds: (r.category_ids ?? []).map(Number),
      providers: r.providers ?? [],
    })),
  };
}

async function logAction(client: PoolClient, actorId: string, targetId: string, action: string, detail?: Record<string, unknown>) {
  await client.query("INSERT INTO admin_actions (actor_id, target_user_id, action, detail) VALUES ($1, $2, $3, $4)", [
    actorId,
    targetId,
    action,
    detail ? JSON.stringify(detail) : null,
  ]);
}

async function otherActiveAdmins(client: PoolClient, excludeId: string): Promise<number> {
  const res = await client.query<{ n: string }>(
    "SELECT count(*) AS n FROM users WHERE role = 'admin' AND is_active AND deleted_at IS NULL AND id <> $1",
    [excludeId],
  );
  return Number(res.rows[0].n);
}

async function setCategories(client: PoolClient, userId: string, ids: number[]) {
  await client.query("DELETE FROM user_categories WHERE user_id = $1", [userId]);
  if (ids.length === 0) return;
  const found = await client.query<{ id: number }>("SELECT id FROM categories WHERE id = ANY($1::int[])", [ids]);
  if (found.rowCount !== new Set(ids).size) throw new HttpError(400, "Unknown category");
  await client.query("INSERT INTO user_categories (user_id, category_id) SELECT $1, unnest($2::int[])", [userId, [...new Set(ids)]]);
}

export interface NewUser {
  name: string;
  email: string;
  role: Role;
  categoryIds?: number[];
}

/** Creates an account with a one-time temporary password the admin passes on securely. */
export async function createUser(actor: Session, input: NewUser): Promise<{ id: string; temporaryPassword: string }> {
  const temporaryPassword = generatePassword();
  const passwordHash = await hashPassword(temporaryPassword);
  try {
    const id = await withTx(async (client) => {
      const res = await client.query<{ id: string }>(
        `INSERT INTO users (email, name, password_hash, role, must_change_password) VALUES ($1, $2, $3, $4, true) RETURNING id`,
        [input.email, input.name, passwordHash, input.role],
      );
      const userId = res.rows[0].id;
      if (input.role === "staff") await setCategories(client, userId, input.categoryIds ?? []);
      await logAction(client, actor.userId, userId, "user_created", { role: input.role });
      return userId;
    });
    return { id, temporaryPassword };
  } catch (err) {
    if (isUniqueViolation(err)) throw new HttpError(409, "An account with this email already exists");
    throw err;
  }
}

export interface UserPatch {
  name?: string;
  role?: Role;
  isActive?: boolean;
  categoryIds?: number[];
  resetPassword?: boolean;
}

/**
 * Applies admin changes to one account. Guards: you cannot change your own role or
 * deactivate yourself, and the last active administrator can never be demoted or disabled.
 * Role/active/password changes sign the user out everywhere so they take effect at once.
 */
export async function updateUser(actor: Session, id: string, patch: UserPatch): Promise<{ temporaryPassword?: string }> {
  if (!isUuid(id)) throw new HttpError(404, "User not found");
  let temporaryPassword: string | undefined;
  let revoke = false;

  await withTx(async (client) => {
    const res = await client.query<{ id: string; role: Role; is_active: boolean; name: string }>(
      "SELECT id, role, is_active, name FROM users WHERE id = $1 AND deleted_at IS NULL FOR UPDATE",
      [id],
    );
    const target = res.rows[0];
    if (!target) throw new HttpError(404, "User not found");
    const self = target.id === actor.userId;

    if (patch.role !== undefined && patch.role !== target.role) {
      if (self) throw new HttpError(400, "You cannot change your own role");
      if (target.role === "admin" && (await otherActiveAdmins(client, id)) === 0) {
        throw new HttpError(409, "At least one active administrator is required");
      }
      await client.query("UPDATE users SET role = $2 WHERE id = $1", [id, patch.role]);
      if (patch.role !== "staff") await client.query("DELETE FROM user_categories WHERE user_id = $1", [id]);
      await logAction(client, actor.userId, id, "role_changed", { from: target.role, to: patch.role });
      revoke = true;
    }

    if (patch.isActive !== undefined && patch.isActive !== target.is_active) {
      if (!patch.isActive) {
        if (self) throw new HttpError(400, "You cannot deactivate your own account");
        if (target.role === "admin" && (await otherActiveAdmins(client, id)) === 0) {
          throw new HttpError(409, "At least one active administrator is required");
        }
      }
      await client.query("UPDATE users SET is_active = $2 WHERE id = $1", [id, patch.isActive]);
      await logAction(client, actor.userId, id, patch.isActive ? "reactivated" : "deactivated");
      revoke = true;
    }

    if (patch.name !== undefined && patch.name !== target.name) {
      await client.query("UPDATE users SET name = $2 WHERE id = $1", [id, patch.name]);
      await logAction(client, actor.userId, id, "renamed", { from: target.name, to: patch.name });
      revoke = true; // the session caches the display name
    }

    if (patch.categoryIds !== undefined) {
      const role = patch.role ?? target.role;
      if (role !== "staff") throw new HttpError(400, "Only field staff can be limited to categories");
      await setCategories(client, id, patch.categoryIds);
      await logAction(client, actor.userId, id, "categories_changed", { categoryIds: patch.categoryIds });
    }

    if (patch.resetPassword) {
      temporaryPassword = generatePassword();
      await client.query(
        "UPDATE users SET password_hash = $2, must_change_password = true, password_changed_at = NULL WHERE id = $1",
        [id, await hashPassword(temporaryPassword)],
      );
      await logAction(client, actor.userId, id, "password_reset");
      revoke = true;
    }
  });

  if (revoke && actor.userId !== id) await revokeUserSessions(id);
  // Renaming yourself leaves your session until next login; the displayed name updates then.
  return { temporaryPassword };
}

export interface AdminAction {
  id: string;
  action: string;
  actorName: string | null;
  targetName: string | null;
  targetEmail: string | null;
  detail: Record<string, unknown> | null;
  createdAt: string;
}

export async function listAdminActions(limit = 50, offset = 0): Promise<AdminAction[]> {
  const rows = await query<{
    id: string;
    action: string;
    detail: Record<string, unknown> | null;
    created_at: Date;
    actor_name: string | null;
    target_name: string | null;
    target_email: string | null;
  }>(
    `SELECT a.id, a.action, a.detail, a.created_at, actor.name AS actor_name, target.name AS target_name, target.email AS target_email
       FROM admin_actions a
       LEFT JOIN users actor ON actor.id = a.actor_id
       LEFT JOIN users target ON target.id = a.target_user_id
      ORDER BY a.created_at DESC, a.id DESC
      LIMIT $1 OFFSET $2`,
    [Math.min(Math.max(limit, 1), 200), Math.max(offset, 0)],
  );
  return rows.map((r) => ({
    id: String(r.id),
    action: r.action,
    actorName: r.actor_name,
    targetName: r.target_name,
    targetEmail: r.target_email,
    detail: r.detail,
    createdAt: r.created_at.toISOString(),
  }));
}
