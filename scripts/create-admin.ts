// Create an administrator, or recover access to one.
//
//   npm run admin:create -- --email you@example.com --name "Your Name"
//   npm run admin:create -- --email you@example.com --reset     (new password for an existing account)
//
// A strong password is generated and printed once. The account must change it at first login.
import { pool } from "../lib/db";
import { generatePassword, hashPassword } from "../lib/passwords";
import { redis } from "../lib/redis";
import { revokeUserSessions } from "../lib/session";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  const email = arg("email")?.trim().toLowerCase();
  const name = arg("name")?.trim() || "City Admin";
  const reset = process.argv.includes("--reset");

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    console.error('Usage: npm run admin:create -- --email you@example.com [--name "Your Name"] [--reset]');
    process.exitCode = 1;
    return;
  }

  const existing = await pool.query<{ id: string; role: string; password_hash: string | null }>(
    "SELECT id, role, password_hash FROM users WHERE lower(email) = $1 AND deleted_at IS NULL",
    [email],
  );
  const user = existing.rows[0];

  // New accounts, explicit resets, and accounts that have no password yet (social sign-in only) get a fresh one.
  const needsPassword = !user || reset || user.password_hash === null;
  const password = needsPassword ? generatePassword(20) : null;

  if (!user) {
    await pool.query(
      `INSERT INTO users (email, name, password_hash, role, must_change_password) VALUES ($1, $2, $3, 'admin', true)`,
      [email, name, await hashPassword(password!)],
    );
    console.log("Created administrator account.");
  } else {
    await pool.query(
      `UPDATE users SET role = 'admin', is_active = true,
              password_hash = COALESCE($2, password_hash),
              must_change_password = CASE WHEN $2::text IS NULL THEN must_change_password ELSE true END
        WHERE id = $1`,
      [user.id, password ? await hashPassword(password) : null],
    );
    await revokeUserSessions(user.id);
    console.log(user.role === "admin" ? "Administrator account updated." : `Promoted existing ${user.role} account to administrator.`);
  }

  console.log(`  Email:    ${email}`);
  if (password) {
    console.log(`  Password: ${password}`);
    console.log("  Shown once. You will be asked to choose a new password at first login.");
  } else {
    console.log("  Password: unchanged (add --reset to generate a new one).");
  }
}

main()
  .catch((err) => {
    console.error("Failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
    redis.disconnect();
  });
