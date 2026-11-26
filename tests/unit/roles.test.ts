import { beforeEach, describe, expect, it, vi } from "vitest";
import { SYSTEM_ROLES, type Permission, type SystemRole } from "@/lib/permissions";
import type { Session } from "@/lib/session";

/*
 * Role and account management against a fake database: who may create, edit, assign and act on what.
 * These are the privilege-escalation guards, so each rule has a test.
 */

const db = vi.hoisted(() => ({
  roles: new Map<string, { name: string; description: string; permissions: string[]; is_active: boolean; is_system: boolean }>(),
  users: new Map<string, { role: string; is_active: boolean; name: string }>(),
  writes: [] as string[],
}));

function run(sql: string, params: unknown[] = []): Record<string, unknown>[] {
  const t = sql.replace(/\s+/g, " ").trim();
  if (/^SELECT name, (description, )?permissions, is_active FROM roles WHERE key = \$1/.test(t)) {
    const r = db.roles.get(params[0] as string);
    return r ? [r] : [];
  }
  if (/^SELECT name, description, permissions, is_active FROM roles WHERE key = \$1 FOR UPDATE/.test(t)) {
    const r = db.roles.get(params[0] as string);
    return r ? [r] : [];
  }
  if (t.startsWith("SELECT r.key, r.name")) {
    return [...db.roles].map(([key, r]) => ({ key, ...r, user_count: "0" }));
  }
  if (t.startsWith("SELECT u.id, u.role, u.is_active, u.name, r.permissions")) {
    const u = db.users.get(params[0] as string);
    return u ? [{ id: params[0], ...u, role_permissions: db.roles.get(u.role)!.permissions }] : [];
  }
  if (t.startsWith("SELECT count(*) AS n FROM users WHERE role = 'admin'")) return [{ n: "1" }];
  if (t.startsWith("INSERT INTO roles")) {
    db.roles.set(params[0] as string, { name: params[1] as string, description: params[2] as string, permissions: params[3] as string[], is_active: true, is_system: false });
  }
  if (t.startsWith("UPDATE roles")) {
    const r = db.roles.get(params[0] as string)!;
    Object.assign(r, { name: params[1], description: params[2], permissions: params[3], is_active: params[4] });
  }
  if (/^(INSERT|UPDATE|DELETE)/.test(t)) db.writes.push(t.split(" ").slice(0, 3).join(" "));
  return [];
}

vi.mock("@/lib/db", () => ({
  isUuid: (v: string) => /^[0-9a-f-]{36}$/.test(v),
  isUniqueViolation: () => false,
  query: vi.fn(async (sql: string, params?: unknown[]) => run(sql, params)),
  withTx: vi.fn(async (fn: (c: unknown) => unknown) => fn({ query: async (sql: string, params?: unknown[]) => ({ rows: run(sql, params), rowCount: 1 }) })),
}));
vi.mock("@/lib/redis", () => ({ redis: {} }));
vi.mock("@/lib/session", () => ({ revokeUserSessions: vi.fn(async () => {}) }));
vi.mock("@/lib/passwords", () => ({ generatePassword: () => "Temp-Password-1", hashPassword: async () => "hash" }));

import { createRole, roleKeyFrom, updateRole } from "@/lib/roles";
import { createUser, updateUser } from "@/lib/users";

const ADMIN_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_ADMIN = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CITIZEN_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const MANAGER_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

const actor = (role: string, permissions: readonly Permission[], userId = ADMIN_ID): Session => ({ userId, name: "A", role, roleName: role, permissions: [...permissions] });
const admin = actor("admin", SYSTEM_ROLES.admin.permissions);
// A custom role that may manage accounts but not roles, and does no report work.
const manager = actor("user-managers", ["users.manage"], MANAGER_ID);

beforeEach(() => {
  db.roles.clear();
  db.users.clear();
  db.writes = [];
  for (const [key, def] of Object.entries(SYSTEM_ROLES)) {
    db.roles.set(key, { name: def.name, description: def.description, permissions: [...def.permissions], is_active: true, is_system: true });
  }
  db.roles.set("user-managers", { name: "User managers", description: "", permissions: ["users.manage"], is_active: true, is_system: false });
  db.roles.set("inspectors", { name: "Inspectors", description: "", permissions: ["reports.work"], is_active: true, is_system: false });
  db.users.set(OTHER_ADMIN, { role: "admin", is_active: true, name: "Other admin" });
  db.users.set(CITIZEN_ID, { role: "citizen", is_active: true, name: "Resident" });
  db.users.set(MANAGER_ID, { role: "user-managers", is_active: true, name: "Manager" });
});

describe("role keys", () => {
  it("are URL-safe slugs of the name", () => {
    expect(roleKeyFrom("Barangay Inspectors")).toBe("barangay-inspectors");
    expect(roleKeyFrom("  Ña / QA  ")).toBe("na-qa");
    expect(roleKeyFrom("42")).toBe("role-42");
  });
});

describe("creating roles", () => {
  it("works within your own access and is audited", async () => {
    const role = await createRole(admin, { name: "Barangay inspectors", permissions: ["reports.work", "stats.view"] });
    expect(role.key).toBe("barangay-inspectors");
    expect(role.permissions).toEqual(["reports.work", "stats.view"]);
    expect(db.writes).toContain("INSERT INTO admin_actions");
  });

  it("refuses permissions the creator does not hold (no escalation)", async () => {
    const roleAdmin = actor("role-admins", ["roles.manage"]);
    await expect(createRole(roleAdmin, { name: "Super", permissions: ["roles.manage", "users.manage"] })).rejects.toMatchObject({ status: 403 });
  });

  it("refuses unknown permissions and names of built-in roles", async () => {
    await expect(createRole(admin, { name: "Odd", permissions: ["reports.delete_everything"] })).rejects.toMatchObject({ status: 400 });
    await expect(createRole(admin, { name: "Admin", permissions: [] })).rejects.toMatchObject({ status: 409 });
  });
});

describe("editing roles", () => {
  it("never changes a built-in role", async () => {
    await expect(updateRole(admin, "moderator", { permissions: [] })).rejects.toMatchObject({ status: 409 });
    await expect(updateRole(admin, "admin", { isActive: false })).rejects.toMatchObject({ status: 409 });
  });

  it("never lets you change the role you hold (no accidental self-lockout)", async () => {
    const custom = actor("user-managers", ["users.manage", "roles.manage"]);
    await expect(updateRole(custom, "user-managers", { permissions: [] })).rejects.toMatchObject({ status: 409 });
  });

  it("refuses to add permissions you do not hold", async () => {
    const roleAdmin = actor("role-admins", ["roles.manage", "reports.work"]);
    await expect(updateRole(roleAdmin, "inspectors", { permissions: ["reports.work", "users.manage"] })).rejects.toMatchObject({ status: 403 });
  });

  it("can disable and re-enable a custom role", async () => {
    expect((await updateRole(admin, "inspectors", { isActive: false })).isActive).toBe(false);
    expect((await updateRole(admin, "inspectors", { isActive: true })).isActive).toBe(true);
  });
});

describe("assigning roles", () => {
  it("lets a user manager assign roles within their own access", async () => {
    await expect(updateUser(manager, CITIZEN_ID, { role: "user-managers" })).resolves.toBeDefined();
  });

  it("stops a user manager from handing out more access than they have, including to themselves", async () => {
    await expect(updateUser(manager, CITIZEN_ID, { role: "admin" })).rejects.toMatchObject({ status: 403 });
    await expect(createUser(manager, { name: "New", email: "n@example.com", role: "moderator" })).rejects.toMatchObject({ status: 403 });
    await expect(updateUser(manager, MANAGER_ID, { role: "admin" })).rejects.toMatchObject({ status: 400 });
  });

  it("stops a user manager from acting on accounts with more access (e.g. resetting an admin's password)", async () => {
    await expect(updateUser(manager, OTHER_ADMIN, { resetPassword: true })).rejects.toMatchObject({ status: 403 });
    await expect(updateUser(manager, OTHER_ADMIN, { isActive: false })).rejects.toMatchObject({ status: 403 });
  });

  it("refuses disabled and unknown roles", async () => {
    db.roles.get("inspectors")!.is_active = false;
    await expect(updateUser(admin, CITIZEN_ID, { role: "inspectors" })).rejects.toMatchObject({ status: 409 });
    await expect(updateUser(admin, CITIZEN_ID, { role: "nope" })).rejects.toMatchObject({ status: 400 });
  });

  it("only allows category limits on field-work roles", async () => {
    await expect(updateUser(admin, CITIZEN_ID, { categoryIds: [1] })).rejects.toMatchObject({ status: 400 });
  });
});

describe("built-in role definitions", () => {
  it.each(Object.keys(SYSTEM_ROLES) as SystemRole[])("%s matches migration 007's seed", (key) => {
    // The migration seeds the same permission sets; setup re-syncs them from code on start.
    const seeded: Record<SystemRole, string[]> = {
      citizen: [],
      staff: ["reports.work"],
      moderator: ["reports.review", "reports.view_private", "reports.view_reporter", "stats.view"],
      admin: ["reports.review", "reports.view_private", "reports.view_reporter", "reports.work", "stats.view", "audit.view", "system.view", "users.manage", "roles.manage"],
    };
    expect([...SYSTEM_ROLES[key].permissions].sort()).toEqual(seeded[key].sort());
  });
});
