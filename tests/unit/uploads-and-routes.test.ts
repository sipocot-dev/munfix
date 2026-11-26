import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const media = vi.hoisted(() => ({ access: { allowed: true, isPublic: true } }));
vi.mock("@/lib/redis", () => ({ redis: {} }));
vi.mock("@/lib/session", () => ({ getSession: vi.fn(async () => null) }));
vi.mock("@/lib/reports", () => ({ canViewMedia: vi.fn(async () => media.access) }));
vi.mock("@/lib/notifications", () => ({ drainOutbox: vi.fn(async () => 0) }));
vi.mock("@/lib/db", () => ({ query: vi.fn(async () => []) }));

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);

let dir: string;
let uploads: typeof import("@/lib/uploads");

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "munfix-uploads-"));
  vi.stubEnv("UPLOAD_DIR", dir);
  vi.stubEnv("STORAGE_DRIVER", "local");
  vi.stubEnv("VERCEL", "");
  uploads = await import("@/lib/uploads");
});
afterAll(async () => {
  vi.unstubAllEnvs();
  await rm(dir, { recursive: true, force: true });
});

const file = (bytes: Buffer, name: string, type: string) => new File([new Uint8Array(bytes)], name, { type });

describe("saveImages", () => {
  it("names files by their sniffed type, not the client's name or MIME type", async () => {
    const [name] = await uploads.saveImages([file(PNG, "photo.jpg", "image/jpeg")]);
    expect(name).toMatch(/^[0-9a-f-]{36}\.png$/);
  });

  it.each([
    ["HTML renamed to .jpg", Buffer.from("<html><script>alert(1)</script>"), "x.jpg", "image/jpeg"],
    ["SVG", Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), "x.svg", "image/svg+xml"],
    ["empty-ish", Buffer.from([0xff]), "x.jpg", "image/jpeg"],
  ])("rejects %s", async (_l, bytes, name, type) => {
    await expect(uploads.saveImages([file(bytes, name, type)])).rejects.toMatchObject({ status: 400 });
  });

  it("rejects files over 5 MB and more than three files, before writing anything", async () => {
    const before = (await readdir(dir)).length;
    const big = Buffer.concat([JPG, Buffer.alloc(uploads.MAX_FILE_BYTES)]);
    await expect(uploads.saveImages([file(big, "big.jpg", "image/jpeg")])).rejects.toMatchObject({ status: 400 });
    await expect(uploads.saveImages(Array.from({ length: 4 }, () => file(JPG, "a.jpg", "image/jpeg")))).rejects.toMatchObject({ status: 400 });
    // One bad file in a batch stores none of the batch.
    await expect(uploads.saveImages([file(JPG, "a.jpg", "image/jpeg"), file(Buffer.from("nope"), "b.jpg", "image/jpeg")])).rejects.toMatchObject({ status: 400 });
    expect((await readdir(dir)).length).toBe(before);
  });

  it("refuses to read names outside the upload pattern (path traversal)", async () => {
    expect(await uploads.readImage("../../etc/passwd")).toBeNull();
    expect(uploads.FILE_NAME_RE.test("..%2F..%2Fetc%2Fpasswd.jpg")).toBe(false);
  });
});

describe("GET /api/v1/media/:name", () => {
  const get = async (name: string) => {
    const { GET } = await import("@/app/api/v1/media/[name]/route");
    const { NextRequest } = await import("next/server");
    return GET(new NextRequest(`http://x/api/v1/media/${name}`), { params: Promise.resolve({ name }) });
  };

  it("serves public photos with a short shared-cache lifetime and nosniff", async () => {
    const [name] = await uploads.saveImages([file(JPG, "a.jpg", "image/jpeg")]);
    media.access = { allowed: true, isPublic: true };
    const res = await get(name);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    // A published report can still be rejected; its photos must not stay in shared caches for a day.
    expect(res.headers.get("cache-control")).toBe("public, max-age=300");
  });

  it("keeps private photos out of every cache and hides them with 404", async () => {
    const [name] = await uploads.saveImages([file(JPG, "a.jpg", "image/jpeg")]);
    media.access = { allowed: true, isPublic: false };
    expect((await get(name)).headers.get("cache-control")).toBe("private, no-store");
    media.access = { allowed: false, isPublic: false };
    expect((await get(name)).status).toBe(404);
  });
});

describe("GET /api/cron/mail", () => {
  const call = async (auth?: string) => {
    const { GET } = await import("@/app/api/cron/mail/route");
    return GET(new Request("http://x/api/cron/mail", { headers: auth ? { authorization: auth } : {} }));
  };

  it("stays closed without CRON_SECRET", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await call("Bearer ")).status).toBe(401);
  });

  it("requires the exact bearer secret", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret-value");
    expect((await call()).status).toBe(401);
    expect((await call("Bearer wrong")).status).toBe(401);
    expect((await call("Bearer s3cret-value")).status).toBe(200);
  });
});

describe("test accounts", () => {
  const run = async (appUrl: string) => {
    vi.stubEnv("SEED_DEMO_ACCOUNTS", "true");
    vi.stubEnv("DEMO_PASSWORD", "");
    vi.stubEnv("SEED_ADMIN_EMAIL", "");
    vi.stubEnv("APP_URL", appUrl);
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const sql: string[] = [];
    const client = { query: vi.fn(async (text: string) => (sql.push(text), { rows: [], rowCount: 1 })) };
    const { seedEssentials } = await import("@/lib/setup");
    await seedEssentials(client as never, () => {});
    err.mockRestore();
    return sql.filter((s) => s.includes("INSERT INTO users")).length;
  };

  it("are never created on a real (non-local) deployment, whatever the flags say", async () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(await run("https://munfix.bettersipocot.org")).toBe(0);
    expect(await run("")).toBe(0);
    vi.stubEnv("VERCEL_ENV", "production");
    expect(await run("http://localhost:3000")).toBe(0);
    vi.stubEnv("VERCEL_ENV", "");
  });

  it("are created (one per built-in role) on a local or CI deployment", async () => {
    expect(await run("http://localhost:3200")).toBe(4);
    expect(await run("http://127.0.0.1:3000")).toBe(4);
  });

  it("are recognised for the login guard", async () => {
    const { isDemoAccount } = await import("@/lib/setup");
    expect(isDemoAccount(" Demo.Admin@munfix.local ")).toBe(true);
    expect(isDemoAccount("someone@munfix.local")).toBe(false);
  });
});
