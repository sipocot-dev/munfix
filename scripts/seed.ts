import { readFile } from "node:fs/promises";
import path from "node:path";
import type { PoolClient } from "pg";
import { pool } from "../lib/db";
import { generatePassword, hashPassword } from "../lib/passwords";
import { seedEssentials } from "../lib/setup";
import { saveImages } from "../lib/uploads";

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await seedEssentials(client);

    if (process.env.SEED_DEMO === "true") {
      await seedDemo(client);
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

type Client = PoolClient;

const ORDER = ["submitted", "verified", "in_progress", "resolved"];
const NOTES: Record<string, string> = {
  verified: "Thanks — verified by our field team.",
  in_progress: "Crew scheduled.",
  resolved: "Work completed.",
};
const RESOLVE_POINTS = 10;

/** A sample account for attribution and points. Its password is random and never shown, so nobody can log in as it. */
async function sampleUser(client: Client, email: string, name: string, role: string): Promise<string> {
  const hash = await hashPassword(generatePassword(32));
  const r = await client.query<{ id: string }>(
    `INSERT INTO users (email, name, password_hash, role) VALUES ($1, $2, $3, $4)
     ON CONFLICT ((lower(email))) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
    [email, name, hash, role],
  );
  return r.rows[0].id;
}

/** Stores a sample photo from scripts/seed-photos through the same path as real uploads. */
async function attachPhoto(client: Client, reportId: string, file: string): Promise<void> {
  const bytes = await readFile(path.join(process.cwd(), "scripts", "seed-photos", file));
  const [name] = await saveImages([new File([bytes], file, { type: file.endsWith(".png") ? "image/png" : "image/jpeg" })]);
  await client.query("INSERT INTO report_media (report_id, path) VALUES ($1, $2)", [reportId, name]);
}

async function seedDemo(client: Client) {
  const already = await client.query("SELECT 1 FROM reports LIMIT 1");
  if (already.rowCount && already.rowCount > 0) {
    console.log("Demo data already present; skipping.");
    return;
  }

  const lng = Number(process.env.NEXT_PUBLIC_MAP_CENTER_LNG ?? 122.9833);
  const lat = Number(process.env.NEXT_PUBLIC_MAP_CENTER_LAT ?? 13.7667);

  // The admin verifies reports; the sample resident files them and the sample staff member does the work.
  const admin = await client.query<{ id: string }>("SELECT id FROM users WHERE role = 'admin' ORDER BY created_at LIMIT 1");
  if (!admin.rows[0]) throw new Error("Create the admin account first (SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD).");
  const adminId = admin.rows[0].id;
  const resident = await sampleUser(client, "sample.resident@munfix.local", "Maria Santos", "citizen");
  const staff = await sampleUser(client, "sample.staff@munfix.local", "Ramon Dela Cruz", "staff");
  const actors: Record<string, string> = { submitted: resident, verified: adminId, in_progress: staff, resolved: staff };

  // [category, title, description, dLng, dLat, status, barangay, photo]
  const demo: [cat: string, title: string, description: string, dLng: number, dLat: number, status: string, barangay: string, photo?: string][] = [
    ["roads", "Large pothole near the public market", "A deep pothole has formed on the main road next to the market entrance and is a hazard for tricycles and motorcycles.", 0.004, 0.002, "verified", "North Centro", "pothole.jpg"],
    ["streetlights", "Streetlight out along the highway", "The streetlight in front of the elementary school has been out for two weeks. The crossing is very dark at night.", -0.006, 0.004, "in_progress", "North Centro", "streetlight.jpg"],
    ["drainage", "Clogged canal causes flooding", "The roadside canal is blocked with debris, and the street floods even after light rain.", 0.009, -0.003, "resolved", "South Centro", "drainage.png"],
    ["garbage", "Uncollected garbage at the corner", "Garbage has not been collected in over a week and is attracting stray animals.", -0.003, -0.006, "verified", "South Centro"],
    ["bridges", "Damaged railing on footbridge", "The railing on the footbridge is broken and children cross here every day on the way to school.", 0.012, 0.008, "in_progress", "Salvacion"],
    ["water", "Leaking water main", "Water has been spilling onto the road from a broken pipe for several days.", -0.011, -0.002, "submitted", "Salvacion"],
  ];

  for (const [cat, title, description, dLng, dLat, status, barangay, photo] of demo) {
    const r = await client.query<{ id: string }>(
      `INSERT INTO reports (user_id, category_id, title, description, lat, lng, barangay, status, published_at, resolved_at)
       VALUES ($1, (SELECT id FROM categories WHERE slug = $2), $3, $4, $5, $6, $7, $8,
               CASE WHEN $8 IN ('verified','in_progress','resolved') THEN now() - interval '10 days' END,
               CASE WHEN $8 = 'resolved' THEN now() - interval '2 days' END)
       RETURNING id`,
      [resident, cat, title, description, lat + dLat, lng + dLng, barangay, status],
    );
    const id = r.rows[0].id;
    const reached = ORDER.slice(0, ORDER.indexOf(status) + 1);
    for (const [i, to] of reached.entries()) {
      await client.query(
        `INSERT INTO report_events (report_id, actor_id, from_status, to_status, note) VALUES ($1, $2, $3, $4, $5)`,
        [id, actors[to], i ? reached[i - 1] : null, to, NOTES[to] ?? null],
      );
    }
    if (photo) await attachPhoto(client, id, photo);
    if (status === "resolved") {
      for (const uid of [resident, staff]) {
        await client.query("INSERT INTO point_awards (user_id, report_id, points, reason) VALUES ($1, $2, $3, 'resolved') ON CONFLICT DO NOTHING", [uid, id, RESOLVE_POINTS]);
      }
      await client.query(
        `INSERT INTO report_events (report_id, actor_id, to_status, note, kind) VALUES ($1, $2, 'resolved', 'The street no longer floods. Thank you.', 'feedback')`,
        [id, resident],
      );
    }
    if (status === "in_progress") {
      await client.query(
        `INSERT INTO report_events (report_id, actor_id, to_status, note, kind) VALUES ($1, $2, 'in_progress', 'Please confirm a crew date this week.', 'followup')`,
        [id, adminId],
      );
    }
  }
  console.log(`Seeded ${demo.length} sample reports with photos, points and community entries.`);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
