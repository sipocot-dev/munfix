import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { storageFile, type RoleName } from "./helpers";

/* Automated WCAG 2.2 AA checks (axe-core) on every page type, in both themes. */

const PAGES: [RoleName | null, string][] = [
  [null, "/"],
  [null, "/about"],
  [null, "/login"],
  [null, "/register"],
  [null, "/forgot-password"],
  [null, "/privacy"],
  [null, "/no-such-page"],
  ["citizen", "/me"],
  ["citizen", "/account"],
  ["citizen", "/report/new"],
  ["moderator", "/admin"],
  ["moderator", "/admin/overview"],
  ["admin", "/admin/users"],
  ["admin", "/admin/roles"],
  ["admin", "/admin/audit"],
  ["admin", "/admin/system"],
];

async function scan(page: Page) {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    // The map canvas and its tiles are imagery; the Next.js dev overlay is not part of the app.
    .exclude(".maplibregl-canvas")
    .exclude("nextjs-portal")
    .analyze();
  return result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")}`);
}

for (const theme of ["light", "dark"] as const) {
  test.describe(`accessibility, ${theme} theme`, { tag: "@responsive" }, () => {
    for (const [role, path] of PAGES) {
      test(`${path}${role ? ` (${role})` : ""}`, async ({ browser }, info) => {
        const ctx = await browser.newContext({
          ...info.project.use,
          colorScheme: theme,
          storageState: role ? storageFile(role) : undefined,
        });
        const page = await ctx.newPage();
        await page.goto(path);
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        if (path === "/") await page.locator(".pin, .cluster").first().waitFor({ timeout: 30_000 }).catch(() => {});
        expect(await scan(page)).toEqual([]);
        await ctx.close();
      });
    }
  });
}
