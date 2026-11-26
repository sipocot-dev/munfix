import { expect, test } from "@playwright/test";
import { ACCOUNTS, apiAs, createReport, mailpitAvailable, transition, uniqueTitle, waitForMail } from "./helpers";

/*
 * Email, through Mailpit (docker compose service "mailpit"; a service container in CI). The app sends
 * with SMTP_HOST=localhost SMTP_PORT=1025. These tests read what arrived through Mailpit's API.
 * MunFix has no in-app notifications: email is the only notification channel.
 */

test.beforeAll(async () => {
  test.skip(!(await mailpitAvailable()), "Mailpit is not reachable at MAILPIT_URL (start it with npm run services:up)");
});

test("a new report confirms publication by email", async () => {
  const title = uniqueTitle("Email check pothole");
  await createReport(await apiAs("citizen"), title);
  const mail = await waitForMail(ACCOUNTS.citizen, "Your report is on the public map");
  expect(mail.text).toContain(title);
});

test("moderation and field work send status emails with the reason or note", async () => {
  const citizen = await apiAs("citizen");
  const id = await createReport(citizen, uniqueTitle("Email check hidden"));
  await transition(await apiAs("moderator"), id, "hidden", "Shows a licence plate");
  const hidden = await waitForMail(ACCOUNTS.citizen, "Your report was hidden");
  expect(hidden.text).toContain("Reason: Shows a licence plate");

  const id2 = await createReport(citizen, uniqueTitle("Email check resolved"));
  const staff = await apiAs("staff");
  await transition(staff, id2, "in_progress");
  await waitForMail(ACCOUNTS.citizen, "Work has started on your report");
  await transition(staff, id2, "resolved", "Filled and levelled");
  const resolved = await waitForMail(ACCOUNTS.citizen, "Your report was resolved");
  expect(resolved.text).toContain("Filled and levelled");
});

test("password reset sends a working, single-use link", async ({ page }) => {
  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill(ACCOUNTS.staff);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText("Check your email")).toBeVisible();
  const mail = await waitForMail(ACCOUNTS.staff, "Reset your password");
  const link = mail.text.match(/https?:\/\/\S+\/reset-password\?token=\S+/)?.[0];
  expect(link).toBeTruthy();
  // Open the link but do not change the shared test account's password; an invalid token is refused.
  await page.goto(new URL(link!).pathname + new URL(link!).search);
  await expect(page.getByRole("heading", { name: "Choose a new password" })).toBeVisible();
  const res = await (await apiAs(null)).post("/api/v1/auth/reset", { data: { token: "x".repeat(40), password: "Another-pass-123" } });
  expect(res.status()).toBe(400);
});

test("registration sends no email (there is no address verification yet)", async () => {
  // Documented gap (docs/claude-audit-report.md O1): accounts are not email-verified.
  const anon = await apiAs(null);
  const email = `reg-${Date.now().toString(36)}@munfix.local`;
  const res = await anon.post("/api/v1/auth/register", { data: { name: "New Resident", email, password: "A-strong-pass-123" } });
  expect(res.status()).toBe(201);
  await new Promise((r) => setTimeout(r, 2000));
  const search = await fetch(`${process.env.MAILPIT_URL ?? "http://localhost:8025"}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`);
  expect((await search.json()).messages).toEqual([]);
});
