import { expect, test } from "@playwright/test";
import { ACCOUNTS, PASSWORD } from "./helpers";

// Desktop only: each run of these logs in, and logins are rate-limited per IP.

test("a wrong password shows a clear error and keeps the email", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(ACCOUNTS.citizen);
  await page.getByLabel("Password", { exact: true }).fill("not-the-password");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Incorrect email or password" })).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveValue(ACCOUNTS.citizen);
});

test("logging in returns to a same-site page, never to another site", async ({ page }) => {
  await page.goto("/login?next=/%5Cexample.com");
  await page.getByLabel("Email").fill(ACCOUNTS.citizen);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  expect(new URL(page.url()).origin).toBe(new URL(page.context().pages()[0].url()).origin);
  expect(page.url()).not.toContain("example.com");

  // Logging out from the account menu ends the session.
  await page.goto("/me");
  await page.getByRole("button", { name: /Demo Citizen/ }).click();
  await page.getByRole("button", { name: "Log out" }).first().click();
  await page.waitForURL("/");
  await page.goto("/me");
  await expect(page).toHaveURL(/\/login\?next=%2Fme/);
});

test("staff land on their workspace after logging in", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(ACCOUNTS.moderator);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { level: 1, name: "Moderation queue" })).toBeVisible();
});

test("registration validates in the browser before sending anything", async ({ page }) => {
  await page.goto("/register");
  await page.getByRole("button", { name: "Create account" }).click();
  // Native constraint validation keeps the form on the page and points at the first empty field.
  await expect(page).toHaveURL(/\/register$/);
  expect(await page.getByLabel("Full name").evaluate((el: HTMLInputElement) => el.validity.valueMissing)).toBe(true);
  await page.getByLabel("Full name").fill("Test Resident");
  await page.getByLabel("Email").fill("not-an-email");
  await page.getByLabel("Password", { exact: true }).fill("short");
  expect(await page.getByLabel("Email").evaluate((el: HTMLInputElement) => el.validity.typeMismatch)).toBe(true);
  expect(await page.getByLabel("Password", { exact: true }).evaluate((el: HTMLInputElement) => el.validity.tooShort)).toBe(true);
});

test("the password field can be shown and hidden", async ({ page }) => {
  await page.goto("/login");
  const pw = page.getByLabel("Password", { exact: true });
  await pw.fill("abc");
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(pw).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Hide password" }).click();
  await expect(pw).toHaveAttribute("type", "password");
});
