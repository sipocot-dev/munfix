import { describe, expect, it, vi } from "vitest";

const seen = vi.hoisted(() => ({ hashes: [] as string[] }));
vi.mock("@/lib/db", () => ({ query: vi.fn(async () => []) }));
vi.mock("@/lib/redis", () => ({ redis: {} }));
vi.mock("@/lib/rate-limit", () => ({ clientIp: () => "1.2.3.4", enforceRateLimit: vi.fn(async () => {}) }));
vi.mock("@/lib/session", () => ({ createSession: vi.fn(), getSession: vi.fn(async () => null) }));
vi.mock("@/lib/passwords", async (orig) => {
  const real = await orig<typeof import("@/lib/passwords")>();
  return { ...real, verifyPassword: vi.fn(async (_p: string, hash: string) => (seen.hashes.push(hash), false)) };
});

import { NextRequest } from "next/server";
import { POST } from "@/app/api/v1/auth/login/route";
import { hashPassword } from "@/lib/passwords";

describe("POST /api/v1/auth/login with an unknown email", () => {
  it("answers 401 after a bcrypt comparison at the same cost as real password hashes", async () => {
    const res = await POST(
      new NextRequest("http://x/api/v1/auth/login", { method: "POST", body: JSON.stringify({ email: "nobody@example.com", password: "whatever-123" }) }),
      {},
    );
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Incorrect email or password" });
    const cost = (h: string) => h.split("$")[2];
    expect(seen.hashes).toHaveLength(1);
    expect(cost(seen.hashes[0])).toBe(cost(await hashPassword("x")));
  });
});
