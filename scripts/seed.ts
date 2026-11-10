import bcrypt from "bcryptjs";
import type { PoolClient } from "pg";
import { pool } from "../lib/db";

const CATEGORIES: [slug: string, name: string, description: string][] = [
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

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const [i, [slug, name, description]] of CATEGORIES.entries()) {
      await client.query(
        `INSERT INTO categories (slug, name, description, sort_order) VALUES ($1, $2, $3, $4)
         ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, sort_order = EXCLUDED.sort_order`,
        [slug, name, description, i],
      );
    }
    console.log(`Seeded ${CATEGORIES.length} categories.`);

    const email = (process.env.SEED_ADMIN_EMAIL ?? "").trim().toLowerCase();
    const password = process.env.SEED_ADMIN_PASSWORD ?? "";
    if (email && password) {
      const exists = await client.query("SELECT 1 FROM users WHERE lower(email) = $1", [email]);
      if (exists.rowCount === 0) {
        await client.query(
          `INSERT INTO users (email, name, password_hash, role) VALUES ($1, 'City Admin', $2, 'admin')`,
          [email, await bcrypt.hash(password, 10)],
        );
        console.log(`Created admin user ${email}.`);
        if (password === "change-me-please") {
          console.warn("WARNING: the admin account uses the default password. Change SEED_ADMIN_PASSWORD before deploying.");
        }
      } else {
        console.log(`Admin user ${email} already exists; leaving it unchanged.`);
      }
    }

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

async function seedDemo(client: Client) {
  const already = await client.query("SELECT 1 FROM users WHERE lower(email) = 'demo.citizen@munfix.local'");
  if (already.rowCount && already.rowCount > 0) {
    console.log("Demo data already present; skipping.");
    return;
  }

  const lng = Number(process.env.NEXT_PUBLIC_MAP_CENTER_LNG ?? 122.9833);
  const lat = Number(process.env.NEXT_PUBLIC_MAP_CENTER_LAT ?? 13.7667);

  const user = await client.query<{ id: string }>(
    `INSERT INTO users (email, name, password_hash, role) VALUES ('demo.citizen@munfix.local', 'Demo Citizen', $1, 'citizen') RETURNING id`,
    [await bcrypt.hash("demo-password", 10)],
  );
  const admin = await client.query<{ id: string }>("SELECT id FROM users WHERE role = 'admin' ORDER BY created_at LIMIT 1");
  const userId = user.rows[0].id;
  const adminId = admin.rows[0]?.id ?? userId;

  const demo: [cat: string, title: string, description: string, dLng: number, dLat: number, status: string, barangay: string][] = [
    ["roads", "Large pothole near the public market", "A deep pothole has formed on the main road next to the market entrance and is a hazard for tricycles and motorcycles.", 0.004, 0.002, "verified", "North Centro"],
    ["streetlights", "Streetlight out along the highway", "The streetlight in front of the elementary school has been out for two weeks. The crossing is very dark at night.", -0.006, 0.004, "in_progress", "North Centro"],
    ["drainage", "Clogged canal causes flooding", "The roadside canal is blocked with debris, and the street floods even after light rain.", 0.009, -0.003, "resolved", "South Centro"],
    ["garbage", "Uncollected garbage at the corner", "Garbage has not been collected in over a week and is attracting stray animals.", -0.003, -0.006, "verified", "South Centro"],
    ["bridges", "Damaged railing on footbridge", "The railing on the footbridge is broken and children cross here every day on the way to school.", 0.012, 0.008, "in_progress", "Salvacion"],
    ["water", "Leaking water main", "Water has been spilling onto the road from a broken pipe for several days.", -0.011, -0.002, "submitted", "Salvacion"],
  ];

  for (const [cat, title, description, dLng, dLat, status, barangay] of demo) {
    const r = await client.query<{ id: string }>(
      `INSERT INTO reports (user_id, category_id, title, description, lat, lng, barangay, status, published_at, resolved_at)
       VALUES ($1, (SELECT id FROM categories WHERE slug = $2), $3, $4, $5, $6, $7, $8,
               CASE WHEN $8 IN ('verified','in_progress','resolved') THEN now() - interval '10 days' END,
               CASE WHEN $8 = 'resolved' THEN now() - interval '2 days' END)
       RETURNING id`,
      [userId, cat, title, description, lat + dLat, lng + dLng, barangay, status],
    );
    const id = r.rows[0].id;
    await client.query(`INSERT INTO report_events (report_id, actor_id, to_status) VALUES ($1, $2, 'submitted')`, [id, userId]);
    const path = ["verified", "in_progress", "resolved"];
    for (const step of status === "submitted" ? [] : path) {
      await client.query(
        `INSERT INTO report_events (report_id, actor_id, from_status, to_status, note) VALUES ($1, $2, $3, $4, $5)`,
        [id, adminId, step === "verified" ? "submitted" : path[path.indexOf(step) - 1], step,
          step === "verified" ? "Thanks — verified by our field team." : step === "in_progress" ? "Crew scheduled." : "Work completed."],
      );
      if (step === status) break;
    }
  }
  console.log(`Seeded ${demo.length} demo reports (login: demo.citizen@munfix.local / demo-password).`);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
