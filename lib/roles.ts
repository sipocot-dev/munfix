import { cache } from "react";
import { query, withTx } from "./db";
import { HttpError } from "./errors";
import {
  ALL_PERMISSIONS,
  isPermission,
  isSubset,
  isSystemRole,
  SYSTEM_ROLES,
  type Permission,
} from "./permissions";
import type { Session } from "./session";

export interface RoleRow {
  key: string;
  name: string;
  description: string;
  permissions: Permission[];
  isSystem: boolean;
  isActive: boolean;
  userCount: number;
}

export interface ResolvedRole {
  name: string;
  description?: string;
  permissions: readonly Permission[];
  isActive: boolean;
}

/**
 * A role's current definition. Memoised for the duration of one server render (React cache), so the
 * header, the page and its components share one lookup. If the database cannot be reached, built-in
 * roles fall back to their definitions in code and custom roles get no permissions (fail closed).
 */
export const resolveRole = cache(async (key: string): Promise<ResolvedRole> => {
  try {
    const [row] = await query<{ name: string; description: string; permissions: string[]; is_active: boolean }>(
      "SELECT name, description, permissions, is_active FROM roles WHERE key = $1",
      [key],
    );
    if (row) return { name: row.name, description: row.description, permissions: row.permissions.filter(isPermission), isActive: row.is_active };
  } catch (err) {
    console.error("[roles] lookup failed, using built-in definitions:", err instanceof Error ? err.message : err);
  }
  if (isSystemRole(key)) return { ...SYSTEM_ROLES[key], isActive: true };
  return { name: key, permissions: [], isActive: false };
});

export async function listRoles(): Promise<RoleRow[]> {
  const rows = await query<{ key: string; name: string; description: string; permissions: string[]; is_system: boolean; is_active: boolean; user_count: string }>(
    `SELECT r.key, r.name, r.description, r.permissions, r.is_system, r.is_active,
            (SELECT count(*) FROM users u WHERE u.role = r.key AND u.deleted_at IS NULL) AS user_count
       FROM roles r
      ORDER BY r.is_system DESC, cardinality(r.permissions), r.name`,
  );
  return rows.map((r) => ({
    key: r.key,
    name: r.name,
    description: r.description,
    permissions: r.permissions.filter(isPermission),
    isSystem: r.is_system,
    isActive: r.is_active,
    userCount: Number(r.user_count),
  }));
}

/** A URL-safe key from a role name ("Barangay inspectors" -> "barangay-inspectors"). */
export function roleKeyFrom(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // drop accents: "Peñafrancia" -> "penafrancia", not "pen-afrancia"
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return /^[a-z]/.test(base) && base.length >= 2 ? base : `role-${base || "custom"}`.slice(0, 32);
}

/**
 * The no-escalation rule, used for every role and user change: nobody can grant, create, or act on
 * access they do not hold themselves. A user manager without roles.manage can therefore never hand out
 * the Administrator role, nor reset an administrator's password.
 */
export function assertWithinOwnAccess(actor: Session, permissions: readonly string[], what: string): void {
  if (!isSubset(permissions, actor.permissions)) {
    throw new HttpError(403, `You cannot ${what}: it includes permissions your own role does not have`);
  }
}

function cleanPermissions(input: readonly string[]): Permission[] {
  const unknown = input.filter((p) => !isPermission(p));
  if (unknown.length) throw new HttpError(400, `Unknown permission: ${unknown.join(", ")}`);
  return ALL_PERMISSIONS.filter((p) => input.includes(p));
}

async function logRoleAction(client: { query: (q: string, v: unknown[]) => Promise<unknown> }, actor: Session, action: string, detail: Record<string, unknown>) {
  await client.query("INSERT INTO admin_actions (actor_id, target_user_id, action, detail) VALUES ($1, NULL, $2, $3)", [
    actor.userId,
    action,
    JSON.stringify(detail),
  ]);
}

export async function createRole(actor: Session, input: { name: string; description?: string; permissions: string[] }): Promise<RoleRow> {
  const permissions = cleanPermissions(input.permissions);
  assertWithinOwnAccess(actor, permissions, "create this role");
  const key = roleKeyFrom(input.name);
  if (isSystemRole(key)) throw new HttpError(409, "That name is used by a built-in role");
  try {
    await withTx(async (client) => {
      await client.query("INSERT INTO roles (key, name, description, permissions) VALUES ($1, $2, $3, $4)", [key, input.name, input.description ?? "", permissions]);
      await logRoleAction(client, actor, "role_created", { role: key, name: input.name, permissions });
    });
  } catch (err) {
    if ((err as { code?: string }).code === "23505") throw new HttpError(409, "A role with this name already exists");
    throw err;
  }
  return (await listRoles()).find((r) => r.key === key)!;
}

export interface RolePatch {
  name?: string;
  description?: string;
  permissions?: string[];
  isActive?: boolean;
}

/**
 * Edits a custom role. Built-in roles are fixed. Nobody can edit the role they hold themselves, which
 * is what keeps an administrator from removing their own access by mistake; and nobody can give a role
 * permissions they do not have.
 */
export async function updateRole(actor: Session, key: string, patch: RolePatch): Promise<RoleRow> {
  if (isSystemRole(key)) throw new HttpError(409, "Built-in roles cannot be changed. Create a custom role instead.");
  if (key === actor.role) throw new HttpError(409, "You cannot change the role you hold. Ask another administrator.");

  await withTx(async (client) => {
    const res = await client.query<{ name: string; description: string; permissions: string[]; is_active: boolean }>(
      "SELECT name, description, permissions, is_active FROM roles WHERE key = $1 FOR UPDATE",
      [key],
    );
    const current = res.rows[0];
    if (!current) throw new HttpError(404, "Role not found");
    // Editing a role changes access for everyone holding it, so it is limited to roles within your own access.
    assertWithinOwnAccess(actor, current.permissions, "change this role");

    const next = {
      name: patch.name ?? current.name,
      description: patch.description ?? current.description,
      permissions: patch.permissions ? cleanPermissions(patch.permissions) : current.permissions,
      isActive: patch.isActive ?? current.is_active,
    };
    assertWithinOwnAccess(actor, next.permissions, "give this role those permissions");

    await client.query("UPDATE roles SET name = $2, description = $3, permissions = $4, is_active = $5, updated_at = now() WHERE key = $1", [
      key,
      next.name,
      next.description,
      next.permissions,
      next.isActive,
    ]);
    await logRoleAction(client, actor, "role_updated", {
      role: key,
      ...(patch.name !== undefined && patch.name !== current.name ? { name: next.name } : {}),
      ...(patch.permissions ? { permissions: next.permissions } : {}),
      ...(patch.isActive !== undefined && patch.isActive !== current.is_active ? { active: next.isActive } : {}),
    });
  }).catch((err) => {
    if ((err as { code?: string }).code === "23505") throw new HttpError(409, "A role with this name already exists");
    throw err;
  });
  return (await listRoles()).find((r) => r.key === key)!;
}

/** Roles a user manager may assign: active, and within their own access. */
export async function assertAssignable(actor: Session, key: string): Promise<ResolvedRole> {
  const [row] = await query<{ name: string; permissions: string[]; is_active: boolean }>("SELECT name, permissions, is_active FROM roles WHERE key = $1", [key]);
  if (!row) throw new HttpError(400, "Unknown role");
  if (!row.is_active) throw new HttpError(409, "This role is disabled. Enable it before assigning it.");
  assertWithinOwnAccess(actor, row.permissions, "assign this role");
  return { name: row.name, permissions: row.permissions.filter(isPermission), isActive: true };
}

