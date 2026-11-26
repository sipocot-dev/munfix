import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/redis", () => ({ redis: {} }));

import { ensureMigrated } from "@/lib/setup";

describe("ensureMigrated (npm run db:migrate)", () => {
  it("creates the app schema before running migrations, so a fresh database works", async () => {
    const sql: string[] = [];
    const client = {
      query: vi.fn(async (text: string) => {
        sql.push(text.trim().replace(/\s+/g, " "));
        return { rows: [], rowCount: 0 };
      }),
      release: vi.fn(),
    };
    const pool = { connect: async () => client };
    await ensureMigrated(pool as never, () => {});
    const schema = sql.findIndex((s) => s.startsWith("CREATE SCHEMA IF NOT EXISTS"));
    const migrations = sql.findIndex((s) => s.startsWith("CREATE TABLE IF NOT EXISTS schema_migrations"));
    expect(schema).toBeGreaterThan(-1);
    expect(schema).toBeLessThan(migrations);
    expect(client.release).toHaveBeenCalled();
  });
});
