import { expect, test as setup } from "@playwright/test";
import Redis from "ioredis";
import { mkdirSync } from "node:fs";
import { ACCOUNTS, BASE, PASSWORD, storageFile, type RoleName } from "./helpers";

// One login per role for the whole run: the app rate-limits logins (per IP and per account).
mkdirSync("e2e/.auth", { recursive: true });

// Start every run from clean rate-limit counters, so reruns within the hour behave like the first run.
// This only touches the test environment's Redis; the limits themselves are unchanged.
setup("reset rate limits in the test Redis", async () => {
  const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", { lazyConnect: true, maxRetriesPerRequest: 1 });
  await redis.connect();
  const keys = await redis.keys("rl:*");
  if (keys.length) await redis.del(...keys);
  await redis.quit();
});

for (const role of Object.keys(ACCOUNTS) as RoleName[]) {
  setup(`sign in as ${role}`, async ({ request }) => {
    const res = await request.post("/api/v1/auth/login", { data: { email: ACCOUNTS[role], password: PASSWORD }, headers: { origin: BASE } });
    expect(res.status(), await res.text()).toBe(200);
    await request.storageState({ path: storageFile(role) });
  });
}
