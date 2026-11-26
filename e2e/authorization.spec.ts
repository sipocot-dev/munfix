import { expect, test } from "@playwright/test";
import { apiAs, BASE, storageFile, type RoleName } from "./helpers";

/* Negative tests: what each role must NOT be able to open or do, checked on pages and on the API. */

const WORKSPACE = ["/admin", "/admin/overview", "/admin/users", "/admin/roles", "/admin/audit", "/admin/system"];
const ALLOWED: Record<RoleName, string[]> = {
  citizen: [],
  staff: ["/admin"],
  moderator: ["/admin", "/admin/overview"],
  admin: WORKSPACE,
};

test("signed-out visitors are sent to log in from private pages", async ({ page }) => {
  for (const path of ["/me", "/account", "/report/new", "/admin", "/admin/users"]) {
    await page.goto(path);
    await expect(page, path).toHaveURL(/\/login\?next=/);
  }
});

for (const role of Object.keys(ALLOWED) as RoleName[]) {
  test.describe(`${role}`, () => {
    test.use({ storageState: storageFile(role) });

    test("only opens the workspace pages their role allows (others are a 404)", async ({ page }) => {
      for (const path of WORKSPACE) {
        const res = await page.goto(path);
        if (ALLOWED[role].includes(path)) {
          expect(res?.status(), path).toBe(200);
        } else {
          expect(res?.status(), path).toBe(404);
          await expect(page.getByRole("heading", { name: "Page not found" }), path).toBeVisible();
        }
      }
    });
  });
}

test("the admin APIs refuse everyone without the permission", async () => {
  const anon = await apiAs(null);
  expect((await anon.get("/api/v1/admin/users")).status()).toBe(401);
  for (const role of ["citizen", "staff", "moderator"] as const) {
    const api = await apiAs(role);
    expect((await api.get("/api/v1/admin/users")).status(), role).toBe(403);
    expect((await api.post("/api/v1/admin/roles", { data: { name: "Sneaky", permissions: ["users.manage"] } })).status(), role).toBe(403);
    expect((await api.get("/api/v1/admin/audit-logs")).status(), role).toBe(403);
  }
  const citizen = await apiAs("citizen");
  expect((await citizen.get("/api/v1/admin/reports")).status()).toBe(403);
});

test("writes from another site are refused even with a valid session", async () => {
  const api = await apiAs("citizen");
  const res = await api.post("/api/v1/reports/00000000-0000-0000-0000-000000000000/feedback", {
    data: { text: "cross-site" },
    headers: { origin: "https://evil.example" },
  });
  expect(res.status()).toBe(403);
  expect(BASE).toContain("localhost");
});

test("test accounts are labelled as such in System (admin)", async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: storageFile("admin") });
  const page = await ctx.newPage();
  await page.goto("/admin/system");
  await expect(page.getByText(/demo account\(s\) \(@munfix.local\) exist/)).toBeVisible();
  await ctx.close();
});
