import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { Pool, PoolClient } from "pg";
import { DB_SCHEMA } from "./db";
import { hashPassword, isStrongBootstrapPassword } from "./passwords";

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

/** Problem types per category slug: [slug, name]. Kept in sync on every start. */
export const PROBLEM_TYPES: Record<string, [slug: string, name: string][]> = {
  roads: [["pothole", "Pothole"], ["cracked-road", "Cracked or broken road"], ["missing-manhole", "Missing manhole cover"], ["road-obstruction", "Obstruction on the road"], ["unpaved-road", "Unpaved or muddy road"]],
  streetlights: [["not-working", "Light not working"], ["flickering", "Flickering light"], ["missing-pole", "Missing or damaged pole"], ["needs-lighting", "Dark area needs a light"]],
  drainage: [["clogged-canal", "Clogged canal or drain"], ["flooding", "Flooded street"], ["broken-culvert", "Damaged culvert"], ["open-drain", "Uncovered drain"]],
  garbage: [["uncollected", "Uncollected garbage"], ["illegal-dumping", "Illegal dumping"], ["overflowing-bin", "Overflowing bin"], ["burning-waste", "Burning of waste"]],
  water: [["pipe-leak", "Leaking pipe"], ["no-water", "No water supply"], ["low-pressure", "Low water pressure"], ["hydrant", "Broken hydrant"]],
  electricity: [["fallen-pole", "Fallen or leaning pole"], ["exposed-wires", "Exposed or sagging wires"], ["power-outage", "Power outage"]],
  bridges: [["damaged-bridge", "Damaged bridge"], ["broken-railing", "Broken railing"], ["damaged-sidewalk", "Damaged sidewalk"], ["blocked-footpath", "Blocked footpath"]],
  signage: [["missing-sign", "Missing sign"], ["damaged-sign", "Damaged or faded sign"], ["obstructed-sign", "Obstructed sign"], ["signal-fault", "Signal not working"]],
  "public-facilities": [["park", "Park or plaza"], ["public-market", "Public market"], ["barangay-hall", "Barangay hall"], ["public-toilet", "Public toilet"], ["playground", "Playground or court"]],
};

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

/**
 * Optional demo logins for trying every role (SEED_DEMO_ACCOUNTS=true). They use DEMO_PASSWORD
 * (default "demo-password"), never expire, and are listed on Admin -> System so they get removed before launch.
 */
async function seedDemoAccounts(client: PoolClient, log: Log): Promise<void> {
  if (process.env.SEED_DEMO_ACCOUNTS !== "true") return;
  const password = process.env.DEMO_PASSWORD || "demo-password";
  const hash = await hashPassword(password);
  const accounts: [string, string, string][] = [
    ["demo.citizen@munfix.local", "Demo Citizen", "citizen"],
    ["demo.moderator@munfix.local", "Demo Moderator", "moderator"],
    ["demo.staff@munfix.local", "Demo Field Staff", "staff"],
  ];
  for (const [email, name, role] of accounts) {
    const res = await client.query(
      `INSERT INTO users (email, name, password_hash, role)
       SELECT $1::text, $2, $3, $4 WHERE NOT EXISTS (SELECT 1 FROM users WHERE lower(email) = $1)`,
      [email, name, hash, role],
    );
    if (res.rowCount) log(`Created demo account ${email} (${role}).`);
  }
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

  for (const [slug, types] of Object.entries(PROBLEM_TYPES)) {
    for (const [i, [tslug, tname]] of types.entries()) {
      await client.query(
        `INSERT INTO problem_types (category_id, slug, name, sort_order)
         SELECT id, $2, $3, $4 FROM categories WHERE slug = $1
         ON CONFLICT (category_id, slug) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order`,
        [slug, tslug, tname, i],
      );
    }
  }
  await seedDemoAccounts(client, log);

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
  if (exists.rowCount !== 0) {
    log(`Admin user ${email} already exists; leaving it unchanged.`);
    return;
  }

  // The password sits in an env file, so in production insist it is not a well-known default.
  if (process.env.NODE_ENV === "production" && !isStrongBootstrapPassword(password)) {
    console.error(
      "Refusing to create the admin account: SEED_ADMIN_PASSWORD is too weak (use 12+ characters and not the default). " +
        "Set a strong one and restart, or run `npm run admin:create -- --email you@example.com` to generate credentials.",
    );
    return;
  }

  // must_change_password: the seeded password is only a way in; the admin chooses their own at first login.
  await client.query(
    `INSERT INTO users (email, name, password_hash, role, must_change_password, password_changed_at)
     VALUES ($1, 'City Admin', $2, 'admin', true, NULL)`,
    [email, await hashPassword(password)],
  );
  log(`Created admin user ${email} (must change password at first login).`);
  if (!isStrongBootstrapPassword(password)) {
    console.warn("WARNING: the admin account uses a weak or default password. It must be changed at first login.");
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
    // Setup waits on the lock and runs migrations; the pool's 15 s statement timeout would cancel
    // it halfway ("canceling statement due to statement timeout"). Setup gets no timeout.
    await client.query("SET statement_timeout = 0");
    await client.query("SELECT pg_advisory_lock($1)", [SETUP_LOCK]);
    // Create MunFix's schema first; see DB_SCHEMA in lib/db.ts.
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${DB_SCHEMA}`);
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
