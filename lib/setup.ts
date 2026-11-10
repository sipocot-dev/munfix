import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import bcrypt from "bcryptjs";
import type { Pool, PoolClient } from "pg";

/** Arbitrary constant; serialises setup across app instances starting at the same time. */
const SETUP_LOCK = 727274;

export const MIGRATIONS_DIR = path.join(process.cwd(), "db", "migrations");

export const CATEGORIES: [slug: string, name: string, description: string][] = [
  ["roads", "Roads & potholes", "Potholes, cracks, damaged pavement, missing manhole covers"],
  ["streetlights", "Streetlights", "Broken, flickering or missing streetlights"],
  ["drainage", "Drainage & flooding", "Clogged canals, flooded streets, damaged culverts"],
  ["garbage", "Garbage & sanitation", "Uncollected waste, illegal dumping, overflowing bins"],
  ["water", "Water supply", "Leaks, no water, broken pipes or hydrants"],
  ["electricity", "Electricity", "Fallen poles, exposed or sagging wires"],
  ["bridges", "Bridges & sidewalks", "Damaged bridges, railings, sidewalks and footpaths"],
  ["signage", "Traffic signs & signals", "Missing, damaged or obstructed signs and signals"],
  ["public-facilities", "Public facilities", "Parks, plazas, public markets, barangay halls"],
  ["other", "Other", "Anything else that needs the city government's attention"],
];

type Log = (message: string) => void;

export async function migrationFiles(): Promise<string[]> {
  return (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();
}

/** Applies pending SQL migrations in order. Returns how many ran. Idempotent. */
export async function runMigrations(client: PoolClient, log: Log = console.log): Promise<number> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  const applied = new Set((await client.query<{ name: string }>("SELECT name FROM schema_migrations")).rows.map((r) => r.name));

  let ran = 0;
  for (const file of await migrationFiles()) {
    if (applied.has(file)) continue;
    const sql = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
    log(`Applying ${file}...`);
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
      await client.query("COMMIT");
      ran++;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }
  }
  return ran;
}

/** Categories (kept in sync with this list) and, if configured, the first admin account. */
export async function seedEssentials(client: PoolClient, log: Log = console.log): Promise<void> {
  for (const [i, [slug, name, description]] of CATEGORIES.entries()) {
    await client.query(
      `INSERT INTO categories (slug, name, description, sort_order) VALUES ($1, $2, $3, $4)
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, sort_order = EXCLUDED.sort_order`,
      [slug, name, description, i],
    );
  }
  log(`Seeded ${CATEGORIES.length} categories.`);

  const email = (process.env.SEED_ADMIN_EMAIL ?? "").trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? "";
  if (!email || !password) {
    const admins = await client.query("SELECT 1 FROM users WHERE role = 'admin' LIMIT 1");
    if (admins.rowCount === 0) {
      console.warn("No admin account exists. Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD and restart to create one.");
    }
    return;
  }

  const exists = await client.query("SELECT 1 FROM users WHERE lower(email) = $1", [email]);
  if (exists.rowCount === 0) {
    await client.query(`INSERT INTO users (email, name, password_hash, role) VALUES ($1, 'City Admin', $2, 'admin')`, [
      email,
      await bcrypt.hash(password, 10),
    ]);
    log(`Created admin user ${email}.`);
    if (password === "change-me-please") {
      console.warn("WARNING: the admin account uses the default password. Change SEED_ADMIN_PASSWORD and the account password.");
    }
  } else {
    log(`Admin user ${email} already exists; leaving it unchanged.`);
  }
}

/** Migrate only (used by `npm run db:migrate`), under the same lock. */
export async function ensureMigrated(pool: Pool, log: Log = console.log): Promise<number> {
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock($1)", [SETUP_LOCK]);
    return await runMigrations(client, log);
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [SETUP_LOCK]).catch(() => {});
    client.release();
  }
}

/** Migrate and seed under a lock, so several instances can boot together safely. */
export async function ensureDatabaseReady(pool: Pool, log: Log = console.log): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock($1)", [SETUP_LOCK]);
    const ran = await runMigrations(client, log);
    if (ran > 0) log(`Applied ${ran} migration(s).`);
    await client.query("BEGIN");
    try {
      await seedEssentials(client, log);
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [SETUP_LOCK]).catch(() => {});
    client.release();
  }
}
