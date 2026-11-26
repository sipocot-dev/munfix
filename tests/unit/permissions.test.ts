import { describe, expect, it } from "vitest";
import {
  ALL_PERMISSIONS,
  allowedTransitions,
  canOpen,
  canViewUnpublished,
  hasWorkspace,
  isCategoryScoped,
  isSubset,
  queueTabs,
  SYSTEM_ROLES,
  viewableStatuses,
  WORKSPACE_AREAS,
  type Permission,
} from "@/lib/permissions";
import { TRANSITIONS, type Status } from "@/lib/status";

const P = (role: keyof typeof SYSTEM_ROLES): readonly Permission[] => SYSTEM_ROLES[role].permissions;
const FROM = Object.keys(TRANSITIONS) as Status[];

describe("built-in roles keep their earlier abilities", () => {
  it("citizens have no permissions and no workspace", () => {
    expect(P("citizen")).toEqual([]);
    expect(hasWorkspace(P("citizen"))).toBe(false);
    for (const from of FROM) expect(allowedTransitions(P("citizen"), from)).toEqual([]);
  });

  it("field staff only do field work, limited to their categories, and never see private reports or reporters", () => {
    expect(allowedTransitions(P("staff"), "verified")).toEqual(["in_progress", "resolved"]);
    expect(allowedTransitions(P("staff"), "resolved")).toEqual(["in_progress"]);
    expect(allowedTransitions(P("staff"), "submitted")).toEqual([]);
    expect(isCategoryScoped(P("staff"))).toBe(true);
    expect(canViewUnpublished(P("staff"))).toBe(false);
    expect(P("staff")).not.toContain("reports.view_reporter");
    expect(viewableStatuses(P("staff"))).not.toContain("hidden");
  });

  it("moderators review and remove, but do not do field work or administration", () => {
    expect(allowedTransitions(P("moderator"), "verified")).toEqual(["under_review", "rejected", "duplicate", "hidden"]);
    expect(allowedTransitions(P("moderator"), "hidden")).toEqual(["verified"]);
    expect(allowedTransitions(P("moderator"), "in_progress")).toEqual(["hidden"]);
    expect(canViewUnpublished(P("moderator"))).toBe(true);
    for (const p of ["users.manage", "roles.manage", "audit.view", "system.view", "reports.work"] as const) expect(P("moderator")).not.toContain(p);
  });

  it("administrators hold every permission and every legal transition", () => {
    expect([...P("admin")].sort()).toEqual([...ALL_PERMISSIONS].sort());
    for (const from of FROM) expect(allowedTransitions(P("admin"), from)).toEqual([...TRANSITIONS[from]]);
    expect(isCategoryScoped(P("admin"))).toBe(false);
  });

  it("never offers a transition the state machine forbids, for any permission set", () => {
    for (const perms of [P("citizen"), P("staff"), P("moderator"), P("admin"), ["reports.work", "reports.review"] as Permission[]]) {
      for (const from of FROM) for (const to of allowedTransitions(perms, from)) expect(TRANSITIONS[from]).toContain(to);
    }
  });
});

describe("custom permission sets", () => {
  it("open exactly the workspace areas they grant", () => {
    const auditor: Permission[] = ["audit.view", "stats.view"];
    const open = WORKSPACE_AREAS.filter((a) => canOpen(auditor, a.anyOf)).map((a) => a.href);
    expect(open).toEqual(["/admin/overview", "/admin/audit"]);
    expect(hasWorkspace(auditor)).toBe(false);
    expect(queueTabs(auditor)).toEqual([]);
  });

  it("review without view_private still lists only what review needs", () => {
    expect(viewableStatuses(["reports.review"])).toContain("hidden");
  });
});

describe("no-escalation helper", () => {
  it("is a strict subset check", () => {
    expect(isSubset(["users.manage"], ["users.manage", "roles.manage"])).toBe(true);
    expect(isSubset(["users.manage", "roles.manage"], ["users.manage"])).toBe(false);
    expect(isSubset([], [])).toBe(true);
  });
});
