import { createHash, randomBytes } from "node:crypto";
import { query, withTx } from "./db";
import { appBaseUrl, resetEmail } from "./email-templates";
import { HttpError } from "./errors";
import { enqueueMail } from "./notifications";
import { assertPasswordAcceptable, hashPassword, verifyPassword } from "./passwords";
import { isStaffRole, type Role } from "./permissions";
import { invalidateReports } from "./cache";
import { revokeUserSessions } from "./session";

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

export interface Account {
  id: string;
  name: string;
  email: string;
  role: Role;
  hasPassword: boolean;
  emailNotifications: boolean;
  mustChangePassword: boolean;
  providers: string[];
  createdAt: string;
}

export async function getAccount(userId: string): Promise<Account | null> {
  const [u] = await query<{
    id: string;
    name: string;
    email: string;
    role: Role;
    password_hash: string | null;
    email_notifications: boolean;
    must_change_password: boolean;
    created_at: Date;
  }>(
    `SELECT id, name, email, role, password_hash, email_notifications, must_change_password, created_at
       FROM users WHERE id = $1 AND deleted_at IS NULL`,
    [userId],
  );
  if (!u) return null;
  const providers = await query<{ provider: string }>("SELECT provider FROM oauth_accounts WHERE user_id = $1 ORDER BY provider", [userId]);
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    hasPassword: u.password_hash !== null,
    emailNotifications: u.email_notifications,
    mustChangePassword: u.must_change_password,
    providers: providers.map((p) => p.provider),
    createdAt: u.created_at.toISOString(),
  };
}

/**
 * Sets a new password for the signed-in user. Accounts that already have a password
 * must prove they know it, including accounts that were given a temporary one.
 * Returns the user's session fields so the caller can start a fresh session.
 */
export async function changePassword(
  userId: string,
  currentPassword: string | undefined,
  newPassword: string,
): Promise<{ name: string; role: Role }> {
  const [u] = await query<{ name: string; email: string; role: Role; password_hash: string | null }>(
    "SELECT name, email, role, password_hash FROM users WHERE id = $1 AND is_active AND deleted_at IS NULL",
    [userId],
  );
  if (!u) throw new HttpError(404, "Account not found");

  if (u.password_hash) {
    if (!currentPassword || !(await verifyPassword(currentPassword, u.password_hash))) {
      throw new HttpError(400, "Your current password is incorrect");
    }
    if (currentPassword === newPassword) throw new HttpError(400, "Choose a password different from your current one");
  }
  assertPasswordAcceptable(newPassword, u.email);

  await query(
    "UPDATE users SET password_hash = $2, must_change_password = false, password_changed_at = now() WHERE id = $1",
    [userId, await hashPassword(newPassword)],
  );
  // Signs out every other device; the caller issues a new session for this one.
  await revokeUserSessions(userId);
  return { name: u.name, role: u.role };
}

export async function updateProfile(userId: string, name: string): Promise<void> {
  await query("UPDATE users SET name = $2 WHERE id = $1 AND deleted_at IS NULL", [userId, name]);
}

/**
 * Deletes an account by anonymising it. Published reports are public records and stay,
 * but no longer point to a person; reports still awaiting review are withdrawn.
 */
export async function deleteAccount(userId: string): Promise<void> {
  await withTx(async (client) => {
    const res = await client.query<{ role: Role }>("SELECT role FROM users WHERE id = $1 AND deleted_at IS NULL FOR UPDATE", [userId]);
    const user = res.rows[0];
    if (!user) throw new HttpError(404, "Account not found");
    if (isStaffRole(user.role)) {
      throw new HttpError(409, "Staff and administrator accounts cannot be deleted here. Ask an administrator to change your role first.");
    }

    await client.query(
      `INSERT INTO report_events (report_id, actor_id, from_status, to_status, note)
       SELECT id, user_id, status, 'withdrawn', 'Account deleted by its owner'
         FROM reports WHERE user_id = $1 AND status IN ('submitted', 'under_review')`,
      [userId],
    );
    await client.query(
      `UPDATE reports SET status = 'withdrawn', updated_at = now() WHERE user_id = $1 AND status IN ('submitted', 'under_review')`,
      [userId],
    );
    await client.query("DELETE FROM oauth_accounts WHERE user_id = $1", [userId]);
    await client.query("DELETE FROM password_resets WHERE user_id = $1", [userId]);
    await client.query(
      `UPDATE users
          SET email = 'deleted-' || id || '@deleted.invalid', name = 'Deleted user', password_hash = NULL,
              is_active = false, email_notifications = false, must_change_password = false, deleted_at = now()
        WHERE id = $1`,
      [userId],
    );
  });
  await revokeUserSessions(userId);
  await invalidateReports();
}

/* ----------------------------- Password reset ----------------------------- */

const RESET_TTL_MINUTES = 60;

/** Always resolves quietly, so the response never reveals whether an email is registered. */
export async function requestPasswordReset(email: string): Promise<void> {
  const [user] = await query<{ id: string; name: string; email: string }>(
    "SELECT id, name, email FROM users WHERE lower(email) = $1 AND is_active AND deleted_at IS NULL",
    [email],
  );
  if (!user) return;

  const token = randomBytes(32).toString("base64url");
  await query(
    `INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES ($1, $2, now() + make_interval(mins => $3))`,
    [user.id, sha256(token), RESET_TTL_MINUTES],
  );
  const url = `${appBaseUrl()}/reset-password?token=${token}`;
  await enqueueMail(user.id, user.email, resetEmail({ name: user.name, url, minutes: RESET_TTL_MINUTES }));
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const userId = await withTx(async (client) => {
    const res = await client.query<{ id: string; user_id: string; email: string }>(
      `SELECT pr.id, pr.user_id, u.email
         FROM password_resets pr JOIN users u ON u.id = pr.user_id
        WHERE pr.token_hash = $1 AND pr.used_at IS NULL AND pr.expires_at > now() AND u.is_active AND u.deleted_at IS NULL
        FOR UPDATE OF pr`,
      [sha256(token)],
    );
    const row = res.rows[0];
    if (!row) throw new HttpError(400, "This reset link is invalid or has expired. Request a new one.");

    // Checked before the token is consumed, so a rejected password doesn't burn the link.
    assertPasswordAcceptable(newPassword, row.email);

    await client.query(
      "UPDATE users SET password_hash = $2, must_change_password = false, password_changed_at = now() WHERE id = $1",
      [row.user_id, await hashPassword(newPassword)],
    );
    await client.query("UPDATE password_resets SET used_at = now() WHERE user_id = $1 AND used_at IS NULL", [row.user_id]);
    return row.user_id;
  });
  await revokeUserSessions(userId);
}
