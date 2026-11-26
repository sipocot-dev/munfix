import { expect, test } from "@playwright/test";
import { expectNoHorizontalOverflow, watchConsole } from "./helpers";

const PUBLIC_ROUTES: [string, RegExp][] = [
  ["/", /Reported issues in/],
  ["/about", /How it works/],
  ["/login", /Log in to MunFix/],
  ["/register", /Create your account/],
  ["/forgot-password", /Forgot your password/],
  ["/reset-password", /Choose a new password/],
  ["/privacy", /Privacy policy/],
  ["/terms", /Terms of use/],
  ["/data-deletion", /Data deletion/],
];

test.describe("public pages", { tag: "@responsive" }, () => {
  for (const [path, heading] of PUBLIC_ROUTES) {
    test(`${path} renders with one h1, landmarks, no errors and no sideways scroll`, async ({ page }, info) => {
      const errors = watchConsole(page);
      await page.goto(path);
      // On phones the explorer's sidebar heading lives in the list view.
      if (path === "/" && info.project.name !== "desktop" && (page.viewportSize()?.width ?? 0) < 1024) {
        await page.getByRole("button", { name: /^List/ }).click();
      }
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
      expect(await page.getByRole("heading", { level: 1 }).count()).toBe(1);
      await expect(page.getByRole("main")).toBeVisible();
      await expect(page.getByRole("banner")).toBeVisible();
      await expectNoHorizontalOverflow(page);
      expect(errors).toEqual([]);
    });
  }

  test("unknown pages show the 404 page", async ({ page }) => {
    const res = await page.goto("/no-such-page");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  });

  test("the skip link is the first tab stop and moves focus to the content", async ({ page }) => {
    await page.goto("/about");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#main")).toBeFocused();
  });
});

test.describe("navigation", { tag: ["@responsive", "@cross-browser"] }, () => {
  test("the main navigation reaches How it works and marks the current page", async ({ page }) => {
    await page.goto("/");
    const narrow = (page.viewportSize()?.width ?? 0) < 1024;
    if (narrow) await page.getByRole("button", { name: "Open menu" }).click();
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "How it works" }).click();
    await expect(page).toHaveURL(/\/about$/);
    if (narrow) await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "How it works" })).toHaveAttribute("aria-current", "page");
  });
});

test.describe("theme", { tag: "@responsive" }, () => {
  test("defaults to the operating system preference", async ({ browser }) => {
    const ctx = await browser.newContext({ colorScheme: "dark" });
    const page = await ctx.newPage();
    await page.goto("/about");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await ctx.close();
  });

  test("a chosen theme is applied before first paint and survives reloads (no flash)", async ({ page }) => {
    await page.goto("/about");
    const narrow = (page.viewportSize()?.width ?? 0) < 1024;
    if (narrow) await page.getByRole("button", { name: "Open menu" }).click();
    await page.getByRole("radio", { name: "Dark" }).first().check({ force: true });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    // Record the theme at the moment <body> is first created, i.e. before anything is painted.
    await page.addInitScript(() => {
      new MutationObserver((_, obs) => {
        if (!document.body) return;
        (window as unknown as { __themeAtBody?: string }).__themeAtBody = document.documentElement.dataset.theme ?? "unset";
        obs.disconnect();
      }).observe(document, { childList: true, subtree: true });
    });
    await page.reload();
    expect(await page.evaluate(() => (window as unknown as { __themeAtBody?: string }).__themeAtBody)).toBe("dark");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe("rgb(13, 23, 38)");
  });

  test("System follows the operating system and forgets the stored choice", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/about");
    await page.evaluate(() => localStorage.setItem("munfix-theme", "dark"));
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    const narrow = (page.viewportSize()?.width ?? 0) < 1024;
    if (narrow) await page.getByRole("button", { name: "Open menu" }).click();
    await page.getByRole("radio", { name: "System" }).first().check({ force: true });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    expect(await page.evaluate(() => localStorage.getItem("munfix-theme"))).toBeNull();
    await page.emulateMedia({ colorScheme: "dark" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });
});
