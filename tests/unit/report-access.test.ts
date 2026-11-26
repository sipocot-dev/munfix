import { beforeEach, describe, expect, it, vi } from "vitest";
import { SYSTEM_ROLES, type SystemRole } from "@/lib/permissions";
import type { Session } from "@/lib/session";
import type { Status } from "@/lib/status";

/*
 * Authorization rules in lib/reports.ts, checked against a fake database. The fake answers by
 * matching SQL text, so these tests pin who-can-see/do-what without needing Postgres.
 */

const OWNER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const REPORT = "33333333-3333-4333-8333-333333333333";

const state = vi.hoisted(() => ({
  status: "submitted" as string,
  categoryId: 1,
  staffScope: [] as number[],
  rateLimited: false,
  writes: [] as string[],
}));

function answer(sql: string, params: unknown[] = []): Record<string, unknown>[] {
  if (/FROM report_media m JOIN reports r/.test(sql)) return params[0] === "known.jpg" ? [{ status: state.status, user_id: OWNER }] : [];
  if (/FROM user_categories/.test(sql)) return state.staffScope.map((category_id) => ({ category_id }));
  if (/FOR UPDATE/.test(sql) && /FROM reports/.test(sql)) return [{ status: state.status, category_id: state.categoryId, user_id: OWNER }];
  if (/u\.email AS reporter_email/.test(sql)) {
    return [
      {
        id: REPORT, title: "Pothole", status: state.status, lat: 13.7, lng: 122.9, address: null, barangay: null,
        created_at: new Date(), resolved_at: null, category_slug: "roads", category_name: "Roads", problem_type: null,
        thumb: null, description: "Deep pothole", user_id: OWNER, category_id: state.categoryId, duplicate_of: null,
        published_at: null, updated_at: new Date(), reporter_name: "Rina Reporter", reporter_email: "rina@example.com",
      },
    ];
  }
  if (/SELECT status FROM reports WHERE id/.test(sql)) return [{ status: state.status }];
  if (/^\s*(INSERT|UPDATE|DELETE)/i.test(sql)) state.writes.push(sql.trim().split(/\s+/).slice(0, 3).join(" "));
  return [];
}

vi.mock("@/lib/db", () => ({
  isUuid: (v: string) => /^[0-9a-f-]{36}$/.test(v),
  query: vi.fn(async (sql: string, params?: unknown[]) => answer(sql, params)),
  withTx: vi.fn(async (fn: (c: unknown) => unknown) => fn({ query: async (sql: string, params?: unknown[]) => ({ rows: answer(sql, params), rowCount: 1 }) })),
}));
vi.mock("@/lib/redis", () => ({ redis: {} }));
vi.mock("@/lib/cache", () => ({ cached: (_k: string, _t: number, load: () => unknown) => load(), invalidateReports: async () => {}, reportsVersion: async () => "0" }));
vi.mock("@/lib/notifications", () => ({ queueStatusEmail: async () => {}, triggerDrain: () => {} }));
vi.mock("@/lib/rate-limit", async () => {
  const { HttpError } = await import("@/lib/errors");
  return {
    enforceRateLimit: vi.fn(async () => {
      if (state.rateLimited) throw new HttpError(429, "Too many requests. Please try again later.");
    }),
  };
});

import { addActivity, canViewMedia, getReportDetail, transitionReport } from "@/lib/reports";

// Sessions as getSession builds them: permissions come from the role (here the built-in definitions).
const as = (role: SystemRole, userId = OTHER, extra: Partial<Session> = {}): Session => ({
  userId,
  name: "U",
  role,
  roleName: SYSTEM_ROLES[role].name,
  permissions: [...SYSTEM_ROLES[role].permissions],
  ...extra,
});

beforeEach(() => {
  state.status = "submitted";
  state.categoryId = 1;
  state.staffScope = [];
  state.rateLimited = false;
  state.writes = [];
});

describe("report detail visibility", () => {
  it.each<[string, Session | null, boolean]>([
    ["anonymous", null, false],
    ["another citizen", as("citizen"), false],
    ["field staff", as("staff"), false],
    ["the owner", as("citizen", OWNER), true],
    ["a moderator", as("moderator"), true],
    ["an admin", as("admin"), true],
    ["an admin still on a temporary password", as("admin", OTHER, { mustChangePassword: true }), false],
  ])("unpublished report: %s -> visible=%s", async (_l, viewer, visible) => {
    const d = await getReportDetail(REPORT, viewer);
    expect(Boolean(d)).toBe(visible);
  });

  it("shows published reports to everyone but the reporter's identity only to moderators and admins", async () => {
    state.status = "verified";
    expect((await getReportDetail(REPORT, null))?.reporter).toBeUndefined();
    expect((await getReportDetail(REPORT, as("staff")))?.reporter).toBeUndefined();
    expect((await getReportDetail(REPORT, as("citizen", OWNER)))?.reporter).toBeUndefined();
    expect((await getReportDetail(REPORT, as("moderator")))?.reporter?.email).toBe("rina@example.com");
  });

  it("gives field staff no actions outside their categories", async () => {
    state.status = "verified";
    state.staffScope = [2];
    expect((await getReportDetail(REPORT, as("staff")))?.allowedTransitions).toEqual([]);
    state.staffScope = [1];
    expect((await getReportDetail(REPORT, as("staff")))?.allowedTransitions).toEqual(["in_progress", "resolved"]);
  });

  it("rejects malformed ids without querying", async () => {
    expect(await getReportDetail("../etc/passwd", as("admin"))).toBeNull();
  });
});

describe("media access", () => {
  it.each<[string, Status, Session | null, boolean]>([
    ["public report, anonymous", "verified", null, true],
    ["unpublished, anonymous", "submitted", null, false],
    ["unpublished, other citizen", "submitted", as("citizen"), false],
    ["unpublished, field staff", "submitted", as("staff"), false],
    ["unpublished, owner", "submitted", as("citizen", OWNER), true],
    ["unpublished, moderator", "submitted", as("moderator"), true],
    ["rejected, anonymous", "rejected", null, false],
  ])("%s -> %s", async (_l, status, viewer, allowed) => {
    state.status = status;
    expect((await canViewMedia("known.jpg", viewer)).allowed).toBe(allowed);
  });

  it("denies files that belong to no report", async () => {
    expect((await canViewMedia("unknown.jpg", as("admin"))).allowed).toBe(false);
  });
});

describe("status transitions", () => {
  const attempt = (status: Status, actor: Session, to: Status, note?: string) => {
    state.status = status;
    return transitionReport(REPORT, actor, to, note, undefined);
  };

  it("refuses citizens, including on their own unreviewed report", async () => {
    await expect(attempt("submitted", as("citizen"), "verified")).rejects.toMatchObject({ status: 403 });
    await expect(attempt("submitted", as("citizen", OWNER), "verified")).rejects.toMatchObject({ status: 403 });
  });

  it("lets only the reporter (or staff) reopen a resolved report", async () => {
    await expect(attempt("resolved", as("citizen"), "in_progress")).rejects.toMatchObject({ status: 403 });
    await expect(attempt("resolved", as("citizen", OWNER), "in_progress")).resolves.toEqual({ id: REPORT, status: "in_progress" });
  });

  it("keeps moderators out of field work and staff out of review", async () => {
    await expect(attempt("verified", as("moderator"), "resolved")).rejects.toMatchObject({ status: 403 });
    await expect(attempt("submitted", as("staff"), "verified")).rejects.toMatchObject({ status: 403 });
  });

  it("enforces the field-staff category scope", async () => {
    state.staffScope = [2];
    await expect(attempt("verified", as("staff"), "in_progress")).rejects.toMatchObject({ status: 403 });
  });

  it("refuses transitions the state machine forbids, even for admins", async () => {
    await expect(attempt("rejected", as("admin"), "verified")).rejects.toMatchObject({ status: 409 });
    await expect(attempt("withdrawn", as("admin"), "verified")).rejects.toMatchObject({ status: 409 });
  });

  it("requires a reason to reject", async () => {
    await expect(attempt("submitted", as("moderator"), "rejected")).rejects.toMatchObject({ status: 400 });
    await expect(attempt("submitted", as("moderator"), "rejected", "Not in Sipocot")).resolves.toMatchObject({ status: "rejected" });
  });

  it("writes the status change and its audit event in the same transaction", async () => {
    await attempt("submitted", as("moderator"), "verified");
    expect(state.writes).toEqual(["UPDATE reports SET", "INSERT INTO report_events"]);
  });
});

describe("feedback and follow-ups", () => {
  it("only accept entries on public reports", async () => {
    state.status = "submitted";
    await expect(addActivity(REPORT, as("citizen"), "feedback", "hi")).rejects.toMatchObject({ status: 404 });
  });

  it("are rate limited per account", async () => {
    state.status = "verified";
    state.rateLimited = true;
    await expect(addActivity(REPORT, as("citizen"), "followup", "any update?")).rejects.toMatchObject({ status: 429 });
    expect(state.writes).toEqual([]);
  });
});

describe("automatic publication and hiding", () => {
  it("new reports are created public (status verified, published now) with a matching audit event", async () => {
    const { createReport } = await import("@/lib/reports");
    const inserts: string[] = [];
    const { withTx } = await import("@/lib/db");
    vi.mocked(withTx).mockImplementationOnce(async (fn) =>
      fn({
        query: async (sql: string, params?: unknown[]) => {
          if (/^\s*INSERT/.test(sql)) inserts.push(`${sql.replace(/\s+/g, " ").trim()} ${JSON.stringify(params)}`);
          if (/FROM categories/.test(sql)) return { rows: [{ id: 1 }], rowCount: 1 };
          if (/FROM problem_types/.test(sql)) return { rows: [], rowCount: 0 };
          if (/INSERT INTO reports/.test(sql)) return { rows: [{ id: REPORT }], rowCount: 1 };
          return { rows: [], rowCount: 1 };
        },
      } as never),
    );
    await createReport(OWNER, { title: "Pothole here", description: "A deep pothole on the road", categorySlug: "roads", lat: 13.7, lng: 122.9 }, []);
    expect(inserts[0]).toMatch(/'verified', now\(\)\)/);
    expect(inserts.find((i) => i.includes("INSERT INTO report_events"))).toContain('null,"verified"');
  });

  it("hiding needs a reason and takes the report and its photos out of public view", async () => {
    await expect(transitionReport(REPORT, as("moderator"), "hidden", undefined, undefined)).rejects.toMatchObject({ status: 400 });
    state.status = "verified";
    await expect(transitionReport(REPORT, as("moderator"), "hidden", "Shows a licence plate", undefined)).resolves.toMatchObject({ status: "hidden" });
    state.status = "hidden";
    expect(await getReportDetail(REPORT, null)).toBeNull();
    expect((await canViewMedia("known.jpg", null)).allowed).toBe(false);
    expect(await getReportDetail(REPORT, as("citizen", OWNER))).not.toBeNull();
    expect(await getReportDetail(REPORT, as("moderator"))).not.toBeNull();
  });

  it("field staff cannot hide or restore reports", async () => {
    state.status = "verified";
    await expect(transitionReport(REPORT, as("staff"), "hidden", "x", undefined)).rejects.toMatchObject({ status: 403 });
    state.status = "hidden";
    await expect(transitionReport(REPORT, as("staff"), "verified", undefined, undefined)).rejects.toMatchObject({ status: 403 });
  });

  it("a session with a disabled role or a temporary password has no staff rights", async () => {
    state.status = "verified";
    await expect(transitionReport(REPORT, as("moderator", OTHER, { permissions: [] }), "hidden", "x", undefined)).rejects.toMatchObject({ status: 403 });
    await expect(transitionReport(REPORT, as("moderator", OTHER, { mustChangePassword: true }), "hidden", "x", undefined)).rejects.toMatchObject({ status: 403 });
  });
});
