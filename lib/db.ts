import { Pool, type PoolClient, type QueryResultRow } from "pg";

const g = globalThis as unknown as { __pgPool?: Pool };

/**
 * Connection string from DATABASE_URL, or the names Vercel's Postgres/Prisma integrations set.
 * Direct URLs are preferred over pooled ones: migrations use advisory locks, which a
 * transaction-pooling proxy (pgbouncer) does not keep on one connection.
 */
export function databaseUrl(): string | undefined {
  const e = process.env;
  return e.DATABASE_URL || e.POSTGRES_URL_NON_POOLING || e.POSTGRES_URL || e.PRISMA_DATABASE_URL || e.DATABASE_URL_POOLED || undefined;
}

export const pool: Pool =
  g.__pgPool ??
  new Pool({
    connectionString: databaseUrl(),
    // Serverless platforms run many instances; keep each one's share of the connection limit small.
    max: process.env.VERCEL ? 3 : 10,
    idleTimeoutMillis: 30_000,
    // Fail fast with a clear error instead of hanging when the database is unreachable.
    connectionTimeoutMillis: 8_000,
    statement_timeout: 15_000,
  });

if (process.env.NODE_ENV !== "production") g.__pgPool = pool;

/** Postgres "undefined table" / "undefined column": the schema is behind the code. */
function isSchemaBehind(err: unknown): boolean {
  const code = typeof err === "object" && err !== null ? (err as { code?: string }).code : undefined;
  return code === "42P01" || code === "42703";
}

let healing: Promise<void> | null = null;
let lastHeal = 0;

/** Applies pending migrations once (at most every 30 s) when a query shows the schema is out of date. */
async function healSchema(): Promise<boolean> {
  if (process.env.AUTO_SETUP === "false" || !databaseUrl()) return false;
  if (!healing) {
    if (Date.now() - lastHeal < 30_000) return false;
    lastHeal = Date.now();
    healing = import("./setup")
      .then(({ ensureDatabaseReady }) => ensureDatabaseReady(pool, (m) => console.log(`[setup] ${m}`)))
      .catch((e) => console.error("[setup] self-heal failed:", e instanceof Error ? e.message : e))
      .finally(() => {
        healing = null;
      });
  }
  await healing;
  return true;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  try {
    return (await pool.query<T>(text, params)).rows;
  } catch (err) {
    if (isSchemaBehind(err) && (await healSchema())) return (await pool.query<T>(text, params)).rows;
    throw err;
  }
}

export async function withTx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "23505";
}
