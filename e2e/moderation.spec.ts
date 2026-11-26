import { expect, test } from "@playwright/test";
import { apiAs, createReport, storageFile, transition, uniqueTitle } from "./helpers";

test.describe("moderator", () => {
  test.use({ storageState: storageFile("moderator") });

  test("new reports appear in the Published tab, and hiding one takes it off the public map", async ({ page }) => {
    const citizen = await apiAs("citizen");
    const title = uniqueTitle("Offensive graffiti report");
    const id = await createReport(citizen, title);

    await page.goto("/admin");
    const card = page.locator("li.card", { hasText: title });
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: "Hide…" }).click();
    // A reason is required: the reporter is told why.
    await expect(card.getByLabel("Reason")).toHaveAttribute("required", "");
    await card.getByLabel("Reason").fill("Contains a phone number");
    await card.getByRole("button", { name: /Confirm: Hidden/ }).click();
    await expect(page.getByRole("status").filter({ hasText: "Moved to Hidden." })).toBeVisible();
    await expect(card).toBeHidden();

    const anon = await apiAs(null);
    expect((await anon.get(`/api/v1/reports/${id}`)).status()).toBe(404);
    const list = await (await anon.get("/api/v1/reports?limit=1000")).json();
    expect(list.reports.map((r: { id: string }) => r.id)).not.toContain(id);

    // The reporter still sees it, with the reason.
    const own = await (await citizen.get(`/api/v1/reports/${id}`)).json();
    expect(own.report.status).toBe("hidden");
    expect(JSON.stringify(own.report.events)).toContain("Contains a phone number");

    // Restoring publishes it again.
    await page.goto("/admin?tab=removed");
    const hidden = page.locator("li.card", { hasText: title });
    await hidden.getByRole("button", { name: "Publish" }).click();
    await hidden.getByRole("button", { name: /Confirm: Published/ }).click();
    await expect(page.getByRole("status").filter({ hasText: "Moved to Published." })).toBeVisible();
    expect((await anon.get(`/api/v1/reports/${id}`)).status()).toBe(200);
  });

  test("putting a report under review keeps it public", async () => {
    const id = await createReport(await apiAs("admin"), uniqueTitle("Possible duplicate pothole"));
    const mod = await apiAs("moderator");
    expect((await transition(mod, id, "under_review", "Checking the location")).status()).toBe(200);
    const anon = await apiAs(null);
    const res = await anon.get(`/api/v1/reports/${id}`);
    expect(res.status()).toBe(200);
    expect((await res.json()).report.status).toBe("under_review");
  });

  test("rejecting needs a reason (server rule)", async () => {
    const id = await createReport(await apiAs("admin"), uniqueTitle("Report to reject"));
    const mod = await apiAs("moderator");
    expect((await transition(mod, id, "rejected")).status()).toBe(400);
    expect((await transition(mod, id, "rejected", "Outside the municipality")).status()).toBe(200);
  });

  test("moderators cannot do field work", async () => {
    const id = await createReport(await apiAs("admin"), uniqueTitle("Moderator must not resolve"));
    const mod = await apiAs("moderator");
    expect((await transition(mod, id, "resolved")).status()).toBe(403);
  });
});

test.describe("field staff", () => {
  test.use({ storageState: storageFile("staff") });

  test("marks work in progress and resolved from the work queue", { tag: "@mobile" }, async ({ page }) => {
    const title = uniqueTitle("Pothole for the crew");
    const id = await createReport(await apiAs("admin"), title);

    await page.goto("/admin");
    await expect(page.getByRole("heading", { level: 1, name: "Work queue" })).toBeVisible();
    let card = page.locator("li.card", { hasText: title });
    // No moderation actions for field staff.
    await expect(card.getByRole("button", { name: "Hide…" })).toHaveCount(0);
    await card.getByRole("button", { name: "Mark in progress" }).click();
    await card.getByRole("button", { name: /Confirm: In progress/ }).click();
    await expect(page.getByRole("status").filter({ hasText: "Moved to In progress." })).toBeVisible();

    await page.getByRole("button", { name: "In progress", exact: false }).first().click();
    card = page.locator("li.card", { hasText: title });
    await card.getByRole("button", { name: "Mark resolved" }).click();
    await card.getByLabel("Note").fill("Pothole filled.");
    await card.getByRole("button", { name: /Confirm: Resolved/ }).click();
    await expect(page.getByRole("status").filter({ hasText: "Moved to Resolved." })).toBeVisible();

    const anon = await apiAs(null);
    const report = (await (await anon.get(`/api/v1/reports/${id}`)).json()).report;
    expect(report.status).toBe("resolved");
    expect(JSON.stringify(report.events)).toContain("Pothole filled.");
  });

  test("cannot hide, reject or restore reports, and never sees reporters", async () => {
    const id = await createReport(await apiAs("admin"), uniqueTitle("Staff must not hide"));
    const staff = await apiAs("staff");
    expect((await transition(staff, id, "hidden", "x")).status()).toBe(403);
    expect((await transition(staff, id, "rejected", "x")).status()).toBe(403);
    const queue = await (await staff.get("/api/v1/admin/reports?status=verified")).json();
    for (const r of queue.reports) expect(r.reporterName).toBe("Hidden");
  });
});
