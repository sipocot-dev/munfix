import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const redisMock = vi.hoisted(() => ({ multi: vi.fn() }));
vi.mock("@/lib/redis", () => ({ redis: redisMock }));
vi.mock("@/lib/session", () => ({ getSession: vi.fn(async () => null) }));

import { NextRequest } from "next/server";
import { assertSameOrigin, route } from "@/lib/api";
import { safeNext } from "@/lib/client";
import { HttpError } from "@/lib/errors";
import { clientIp, enforceRateLimit } from "@/lib/rate-limit";

describe("safeNext (post-login redirect)", () => {
  it("keeps same-site paths with their query and hash", () => {
    expect(safeNext("/reports/abc?x=1#top")).toBe("/reports/abc?x=1#top");
    expect(safeNext("/report/new?lat=13.7&lng=122.9")).toBe("/report/new?lat=13.7&lng=122.9");
  });

  it.each([
    ["protocol-relative", "//evil.example"],
    ["backslash", "/\\evil.example"],
    ["backslash-slash", "/\\/evil.example"],
    ["tab inside the scheme-relative prefix", "/\t/evil.example"],
    ["newline inside the prefix", "/\n/evil.example"],
    ["absolute URL", "https://evil.example/"],
    ["javascript URL", "javascript:alert(1)"],
    ["empty", ""],
    ["missing", undefined],
  ])("rejects %s", (_label, value) => {
    expect(safeNext(value)).toBe("/");
  });

  it("never resolves to another host when joined to the app URL", () => {
    for (const v of ["/\\evil.example", "/\t/evil.example", "//evil.example", "/ok"]) {
      expect(new URL(safeNext(v), "https://munfix.example").host).toBe("munfix.example");
    }
  });
});

describe("clientIp", () => {
  const req = (headers: Record<string, string>) => new Request("http://x/", { headers });

  it("prefers X-Real-IP, which the edge overwrites", () => {
    expect(clientIp(req({ "x-real-ip": "203.0.113.9", "x-forwarded-for": "6.6.6.6, 203.0.113.9" }))).toBe("203.0.113.9");
  });

  it("ignores a client-supplied first X-Forwarded-For hop", () => {
    expect(clientIp(req({ "x-forwarded-for": "6.6.6.6, 198.51.100.7" }))).toBe("198.51.100.7");
  });

  it("falls back to unknown", () => {
    expect(clientIp(req({}))).toBe("unknown");
  });
});

describe("enforceRateLimit", () => {
  const chain = (count: number, ttl: number) => {
    const c = { incr: () => c, expire: () => c, ttl: () => c, exec: async () => [[null, count], [null, 1], [null, ttl]] };
    return c;
  };

  it("allows requests up to the limit and refuses the next with Retry-After", async () => {
    redisMock.multi.mockReturnValueOnce(chain(3, 60));
    await expect(enforceRateLimit("k", 3, 60)).resolves.toBeUndefined();
    redisMock.multi.mockReturnValueOnce(chain(4, 42));
    const err = await enforceRateLimit("k", 3, 60).catch((e) => e);
    expect(err).toBeInstanceOf(HttpError);
    expect(err.status).toBe(429);
    expect(err.headers["Retry-After"]).toBe("42");
  });

  it("fails open when Redis is unreachable (documented trade-off)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    redisMock.multi.mockImplementationOnce(() => {
      throw new Error("ECONNREFUSED");
    });
    await expect(enforceRateLimit("k", 1, 60)).resolves.toBeUndefined();
    warn.mockRestore();
  });
});

describe("same-origin check for cookie-authenticated writes", () => {
  const prev = process.env.APP_URL;
  beforeEach(() => {
    process.env.APP_URL = "https://munfix.example";
  });
  afterEach(() => {
    process.env.APP_URL = prev;
  });

  const post = (headers: Record<string, string>, method = "POST") =>
    new Request("https://munfix.example/api/v1/reports", { method, headers: { host: "munfix.example", ...headers } });

  it("accepts the app's own origin and requests without Origin (non-browser clients)", () => {
    expect(() => assertSameOrigin(post({ origin: "https://munfix.example" }))).not.toThrow();
    expect(() => assertSameOrigin(post({}))).not.toThrow();
  });

  it("rejects a sibling subdomain, which SameSite=lax treats as same-site", () => {
    expect(() => assertSameOrigin(post({ origin: "https://other.example" }))).toThrow(HttpError);
    expect(() => assertSameOrigin(post({ origin: "https://evil.munfix.example" }))).toThrow(HttpError);
    expect(() => assertSameOrigin(post({ origin: "null" }))).toThrow(HttpError);
  });

  it("does not apply to reads", () => {
    expect(() => assertSameOrigin(post({ origin: "https://other.example" }, "GET"))).not.toThrow();
  });

  it("route() answers 403 before the handler runs", async () => {
    const handler = vi.fn(async () => new Response("ran"));
    const res = await route(handler)(
      new NextRequest("https://munfix.example/api/v1/auth/logout", { method: "POST", headers: { origin: "https://evil.example" } }),
      {},
    );
    expect(res.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });
});
