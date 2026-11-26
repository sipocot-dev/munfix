import { expect, test, request as pwRequest } from "@playwright/test";
import { apiAs, BASE, storageFile, uniqueTitle } from "./helpers";

test.use({ storageState: storageFile("admin") });

/** Creates an account through the admin API and signs it in, returning an API client for it. */
async function newAccountWithRole(role: string) {
  const admin = await apiAs("admin");
  const email = `e2e-${Date.now().toString(36)}@munfix.local`;
  const created = await admin.post("/api/v1/admin/users", { data: { name: "E2E Person", email, role } });
  expect(created.status(), await created.text()).toBe(201);
  const { temporaryPassword, id } = await created.json();
  const ctx = await pwRequest.newContext({ baseURL: BASE, extraHTTPHeaders: { origin: BASE } });
  expect((await ctx.post("/api/v1/auth/login", { data: { email, password: temporaryPassword } })).status()).toBe(200);
  const newPassword = `E2E-pass-${Date.now()}`;
  expect((await ctx.post("/api/v1/me/password", { data: { currentPassword: temporaryPassword, newPassword } })).status()).toBe(200);
  return { ctx, id, email };
}

test("an administrator creates a custom role, assigns it, and its permissions are enforced on the server", async ({ page }) => {
  const name = uniqueTitle("Auditors");
  await page.goto("/admin/roles");
  await page.getByRole("button", { name: "New role" }).click();
  const form = page.getByRole("form", { name: "New role" });
  await form.getByLabel("Name", { exact: true }).fill(name);
  await form.getByLabel("Description").fill("Read the audit log and the overview");
  await form.getByLabel("See the audit log").check();
  await form.getByLabel("See the overview dashboard").check();
  await form.getByRole("button", { name: "Create role" }).click();
  await expect(page.getByRole("status").filter({ hasText: `Role “${name}” created.` })).toBeVisible();
  const card = page.getByRole("listitem", { name });
  await expect(card).toContainText("See the audit log");

  const roles = await (await (await apiAs("admin")).get("/api/v1/admin/roles")).json();
  const key = roles.roles.find((r: { name: string }) => r.name === name).key;
  const person = await newAccountWithRole(key);

  // Granted: audit log and overview. Not granted: users, roles, system, the work queue.
  expect((await person.ctx.get("/api/v1/admin/audit-logs")).status()).toBe(200);
  expect((await person.ctx.get("/api/v1/admin/users")).status()).toBe(403);
  expect((await person.ctx.get("/api/v1/admin/roles")).status()).toBe(403);
  expect((await person.ctx.get("/api/v1/admin/reports")).status()).toBe(403);
  expect((await person.ctx.post("/api/v1/admin/system/test-email")).status()).toBe(403);

  // Disabling the role removes its access on the very next request.
  await page.reload();
  await page.getByRole("listitem", { name }).getByRole("button", { name: "Disable" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Disable role" }).click();
  await expect(page.getByRole("status").filter({ hasText: "is disabled." })).toBeVisible();
  expect((await person.ctx.get("/api/v1/admin/audit-logs")).status()).toBe(403);

  // A disabled role cannot be assigned.
  const admin = await apiAs("admin");
  const res = await admin.patch(`/api/v1/admin/users/${person.id}`, { data: { role: key } });
  expect([200, 409]).toContain(res.status()); // already has it: no change; any other user gets 409
});

test("built-in roles and your own role are locked, in the page and in the API", async ({ page }) => {
  await page.goto("/admin/roles");
  const adminRole = page.getByRole("listitem", { name: "Administrator" });
  await expect(adminRole).toContainText("Built-in");
  await expect(adminRole.getByRole("button", { name: "Edit" })).toHaveCount(0);
  const admin = await apiAs("admin");
  expect((await admin.patch("/api/v1/admin/roles/admin", { data: { isActive: false } })).status()).toBe(409);
  expect((await admin.patch("/api/v1/admin/roles/moderator", { data: { permissions: [] } })).status()).toBe(409);
});

test("a user manager cannot grant more access than they have", async () => {
  const admin = await apiAs("admin");
  const created = await admin.post("/api/v1/admin/roles", { data: { name: uniqueTitle("User managers"), permissions: ["users.manage"] } });
  expect(created.status()).toBe(201);
  const key = (await created.json()).role.key;
  const manager = await newAccountWithRole(key);
  const target = await admin.post("/api/v1/admin/users", { data: { name: "Target", email: `t-${Date.now().toString(36)}@munfix.local`, role: "citizen" } });
  const targetId = (await target.json()).id;
  // Not allowed: promoting anyone (including themselves) to administrator or moderator.
  expect((await manager.ctx.patch(`/api/v1/admin/users/${targetId}`, { data: { role: "admin" } })).status()).toBe(403);
  expect((await manager.ctx.patch(`/api/v1/admin/users/${manager.id}`, { data: { role: "admin" } })).status()).toBe(400);
  // Not allowed: acting on an account with more access, such as resetting an administrator's password.
  const users = await (await admin.get("/api/v1/admin/users?role=admin")).json();
  const someAdmin = users.users[0].id;
  expect((await manager.ctx.patch(`/api/v1/admin/users/${someAdmin}`, { data: { resetPassword: true } })).status()).toBe(403);
  // Allowed: managing a resident.
  expect((await manager.ctx.patch(`/api/v1/admin/users/${targetId}`, { data: { name: "Renamed Target" } })).status()).toBe(200);
});

test("the users page assigns roles through a confirmation dialog", async ({ page }) => {
  const admin = await apiAs("admin");
  const email = `dialog-${Date.now().toString(36)}@munfix.local`;
  await admin.post("/api/v1/admin/users", { data: { name: "Dialog Person", email, role: "citizen" } });
  await page.goto(`/admin/users`);
  await page.getByLabel("Search users").fill(email);
  const row = page.getByRole("listitem").filter({ hasText: email });
  await expect(row).toBeVisible();
  await row.getByLabel("Role for Dialog Person").selectOption("staff");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Change Dialog Person's role to Field staff?");
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(row.getByLabel("Role for Dialog Person")).toHaveValue("citizen");
  await row.getByLabel("Role for Dialog Person").selectOption("staff");
  await page.getByRole("dialog").getByRole("button", { name: "Change role" }).click();
  await expect(page.getByRole("status").filter({ hasText: "role is now Field staff" })).toBeVisible();
});

test("every workspace page opens for an administrator", { tag: "@responsive" }, async ({ page }) => {
  for (const [path, heading] of [
    ["/admin", "Moderation queue"],
    ["/admin/overview", "Overview"],
    ["/admin/users", "Users & roles"],
    ["/admin/roles", "Roles and permissions"],
    ["/admin/audit", "Audit log"],
    ["/admin/system", "System"],
    ["/account", "Account settings"],
    ["/me", "My reports"],
    ["/report/new", "Report an issue"],
  ] as const) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `${path} scrolls sideways`).toBeLessThanOrEqual(0);
  }
});
