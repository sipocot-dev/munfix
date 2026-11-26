import { expect, test } from "@playwright/test";
import path from "node:path";
import { apiAs, createReport, storageFile, uniqueTitle } from "./helpers";

test.use({ storageState: storageFile("citizen") });

test("submitting a report publishes it at once, without the reporter's name", async ({ page }) => {
  const title = uniqueTitle("Broken streetlight by the chapel");
  await page.goto("/report/new");
  await page.getByLabel("Short title").fill(title);
  await page.locator("label", { hasText: "Streetlights" }).click();
  await page.getByLabel("Type of problem").selectOption({ index: 1 });
  await page.getByLabel("Details").fill("The light has been off for two weeks and the road is dark at night.");
  await page.getByRole("button", { name: "Pin map centre" }).click();
  await page.locator("#photos").setInputFiles(path.join("scripts", "seed-photos", "streetlight.jpg"));
  await expect(page.getByAltText("Selected photo 1")).toBeVisible();
  await page.getByRole("button", { name: "Submit report" }).click();

  await page.waitForURL(/\/reports\/[0-9a-f-]{36}\?submitted=1/);
  await expect(page.getByText("Thank you, your report is published")).toBeVisible();
  await expect(page.getByText("Published", { exact: true }).first()).toBeVisible();
  const id = new URL(page.url()).pathname.split("/").pop()!;

  // Anyone can see it straight away, on the report page and in the public list, with no personal data.
  const anon = await apiAs(null);
  const detail = await anon.get(`/api/v1/reports/${id}`);
  expect(detail.status()).toBe(200);
  const report = (await detail.json()).report;
  expect(report.status).toBe("verified");
  expect(report.reporter).toBeUndefined();
  expect(JSON.stringify(report)).not.toContain("demo.citizen@munfix.local");
  const list = await (await anon.get("/api/v1/reports?limit=1000")).json();
  expect(list.reports.map((r: { id: string }) => r.id)).toContain(id);
});

test("the form explains what is missing instead of sending an incomplete report", async ({ page }) => {
  await page.goto("/report/new");
  await page.getByLabel("Short title").fill("Something is broken");
  await page.locator("label", { hasText: "Other" }).click();
  await page.getByLabel("Details").fill("There is a problem that needs attention.");
  await page.getByRole("button", { name: "Submit report" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Mark where the problem is" })).toBeVisible();
});

test("a reporter can edit their published report until work starts, and the edit is audited", async ({ page }) => {
  const api = await apiAs("citizen");
  const id = await createReport(api, uniqueTitle("Clogged canal near the school"));
  await page.goto(`/reports/${id}`);
  await page.getByRole("button", { name: "Edit report" }).click();
  const newTitle = uniqueTitle("Clogged canal beside the school");
  await page.getByLabel("Title").fill(newTitle);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Your report was updated." })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: newTitle })).toBeVisible();

  const admin = await apiAs("admin");
  const logs = await (await admin.get("/api/v1/admin/audit-logs?limit=50")).json();
  expect(logs.logs.some((l: { reportId: string; kind: string }) => l.reportId === id && l.kind === "edited")).toBe(true);

  // Once work starts the reporter can no longer edit.
  const staff = await apiAs("staff");
  expect((await staff.post(`/api/v1/admin/reports/${id}/transition`, { data: { to: "in_progress" } })).status()).toBe(200);
  const res = await api.patch(`/api/v1/reports/${id}`, { data: { title: "Too late to change this" } });
  expect(res.status()).toBe(409);
});

test("withdrawing asks for confirmation in a dialog; Escape cancels", async ({ page }) => {
  const api = await apiAs("citizen");
  const id = await createReport(api, uniqueTitle("Overflowing bin at the plaza"));
  await page.goto(`/reports/${id}`);
  await page.getByRole("button", { name: "Withdraw report" }).click();
  const dialog = page.getByRole("dialog", { name: "Withdraw this report?" });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await page.getByRole("button", { name: "Withdraw report" }).click();
  await dialog.getByRole("button", { name: "Withdraw report" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Your report was withdrawn." })).toBeVisible();
  await expect(page.getByText("Withdrawn by the reporter")).toBeVisible();
});

test("My reports groups reports by stage", async ({ page }) => {
  await page.goto("/me");
  await expect(page.getByRole("heading", { level: 1, name: "My reports" })).toBeVisible();
  await page.getByRole("button", { name: /Public, not started/ }).click();
  await expect(page.getByRole("button", { name: /Public, not started/ })).toHaveAttribute("aria-pressed", "true");
});

test("feedback on a public report is added and confirmed", async ({ page }) => {
  const api = await apiAs("citizen");
  const id = await createReport(api, uniqueTitle("Leaking pipe on Rizal Street"));
  await page.goto(`/reports/${id}`);
  const text = `Still leaking this morning ${Date.now()}`;
  await page.getByRole("textbox", { name: "Follow-up requests" }).fill(text);
  await page.getByRole("button", { name: "Request follow-up" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Your follow-up request was added." })).toBeVisible();
  await expect(page.getByText(text)).toBeVisible();
});
