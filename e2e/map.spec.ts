import { expect, test, type Locator, type Page } from "@playwright/test";

/*
 * Map markers. Regression tests for the cluster hover jump: MapLibre places markers with `transform`, and
 * the hover style used to scale the marker root, which also scaled that offset and moved the marker.
 */

async function openMap(page: Page) {
  await page.goto("/?status=verified,under_review,in_progress,resolved");
  const narrow = (page.viewportSize()?.width ?? 0) < 1024;
  if (narrow) await expect(page.getByRole("button", { name: "Map", exact: true })).toHaveAttribute("aria-pressed", "true");
  const webgl = await page.evaluate(() => Boolean(document.createElement("canvas").getContext("webgl2") || document.createElement("canvas").getContext("webgl")));
  test.skip(!webgl, "This browser build has no WebGL, so MapLibre cannot draw; the list view covers it.");
  const map = page.getByRole("region", { name: /Map of reported issues/ });
  await expect(map).toBeVisible();
  await expect(page.locator(".pin, .cluster").first()).toBeVisible({ timeout: 30_000 });
  return map;
}

async function box(l: Locator) {
  const b = await l.boundingBox();
  if (!b) throw new Error("not visible");
  return b;
}

test.describe("map markers", { tag: ["@responsive", "@cross-browser"] }, () => {
  test("clusters stay put on hover and focus, and their number stays centred", async ({ page, isMobile }) => {
    await openMap(page);
    const cluster = page.locator(".cluster").first();
    test.skip((await cluster.count()) === 0, "No clusters at this zoom with the current data");
    const before = await box(cluster);
    if (!isMobile) {
      await cluster.hover();
      await page.waitForTimeout(250); // longer than the hover transition
      expect(await box(cluster)).toEqual(before);
    }
    await cluster.focus();
    expect(await box(cluster)).toEqual(before);
    // The number is centred in the bubble.
    const disc = await box(cluster.locator(".cluster-disc"));
    expect(Math.abs(disc.x + disc.width / 2 - (before.x + before.width / 2))).toBeLessThan(1);
    expect(Math.abs(disc.y + disc.height / 2 - (before.y + before.height / 2))).toBeLessThan(1);
    // The root carries no transform of its own besides MapLibre's placement.
    const own = await cluster.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { scale: cs.scale, translate: cs.translate, rotate: cs.rotate };
    });
    expect(own).toEqual({ scale: "none", translate: "none", rotate: "none" });
  });

  test("pins keep their position on hover; only the drawing lifts", async ({ page, isMobile }) => {
    await openMap(page);
    // Zoom in until single pins appear.
    for (let i = 0; i < 6 && (await page.locator(".pin").count()) === 0; i++) {
      await page.getByRole("button", { name: "Zoom in", exact: true }).click();
      await page.waitForTimeout(500);
    }
    const pin = page.locator(".pin").first();
    await expect(pin).toBeVisible();
    const before = await box(pin);
    if (!isMobile) {
      await pin.hover();
      await page.waitForTimeout(300);
      expect(await box(pin)).toEqual(before);
    }
    expect(await pin.evaluate((el) => getComputedStyle(el).scale)).toBe("none");
  });

  test("a cluster opens with the keyboard (Enter zooms in to the reports)", async ({ page, isMobile }) => {
    test.skip(isMobile, "keyboard test");
    await openMap(page);
    const cluster = page.locator(".cluster").first();
    test.skip((await cluster.count()) === 0, "No clusters at this zoom with the current data");
    const label = (await cluster.getAttribute("aria-label")) ?? "";
    expect(label).toMatch(/^\d+ reports in this area/);
    await cluster.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".pin").first()).toBeVisible({ timeout: 15_000 });
  });

  test("selecting a pin (click or tap) opens a preview with a link to the report", async ({ page, isMobile }) => {
    await openMap(page);
    for (let i = 0; i < 6 && (await page.locator(".pin").count()) === 0; i++) {
      await page.getByRole("button", { name: "Zoom in", exact: true }).click();
      await page.waitForTimeout(500);
    }
    const pin = page.locator(".pin").first();
    if (isMobile) await pin.tap();
    else await pin.click();
    const link = page.locator(".maplibregl-popup").getByRole("link", { name: /View report/ });
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(/\/reports\/[0-9a-f-]{36}$/);
  });

  test("the legend opens and lists statuses and categories", async ({ page }) => {
    await openMap(page);
    await page.getByRole("button", { name: "Legend" }).click();
    const legend = page.locator("#map-legend");
    await expect(legend).toContainText("Published");
    await expect(legend).toContainText("Roads & potholes");
  });
});

test.describe("explorer list", { tag: "@responsive" }, () => {
  test("filters persist in the URL and Show on map selects the report", async ({ page }) => {
    await page.goto("/");
    const narrow = (page.viewportSize()?.width ?? 0) < 1024;
    if (narrow) await page.getByRole("button", { name: /^List/ }).click();
    await page.getByRole("button", { name: "Resolved", pressed: false }).click();
    await expect(page).toHaveURL(/status=verified%2Cunder_review%2Cin_progress%2Cresolved|status=verified,under_review,in_progress,resolved/);
    await page.reload();
    if (narrow) await page.getByRole("button", { name: /^List/ }).click();
    await expect(page.getByRole("button", { name: "Resolved" })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Show on map" }).first().click();
    await expect(page.locator(".maplibregl-popup")).toBeVisible({ timeout: 20_000 });
  });

  test("search narrows the list and is kept in the URL", async ({ page }) => {
    await page.goto("/");
    const narrow = (page.viewportSize()?.width ?? 0) < 1024;
    if (narrow) await page.getByRole("button", { name: /^List/ }).click();
    const links = page.locator("section[aria-label='Reports map and list'] ul li a[href^='/reports/']");
    await expect(links.first()).toBeVisible();
    const before = await links.count();
    // Search covers title, category, problem type, barangay and landmark; "public market" is in a seeded title.
    await page.getByLabel("Search reports").first().fill("public market");
    await expect(page).toHaveURL(/q=public(\+|%20)market/);
    await expect(links.filter({ hasText: /public market/i }).first()).toBeVisible();
    expect(await links.count()).toBeLessThan(before);
  });
});
