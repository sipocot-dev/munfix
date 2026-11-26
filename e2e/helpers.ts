import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, request as pwRequest, type APIRequestContext, type Page } from "@playwright/test";

export const BASE = process.env.E2E_BASE_URL ?? `http://localhost:${process.env.E2E_PORT ?? 3200}`;
export const MAILPIT = process.env.MAILPIT_URL ?? "http://localhost:8025";
/** Development/test-only password of the seeded test accounts (docs/testing-accounts.md). */
export const PASSWORD = process.env.DEMO_PASSWORD || "demo-password";

export const ACCOUNTS = {
  citizen: "demo.citizen@munfix.local",
  staff: "demo.staff@munfix.local",
  moderator: "demo.moderator@munfix.local",
  admin: "demo.admin@munfix.local",
} as const;
export type RoleName = keyof typeof ACCOUNTS;

export const storageFile = (role: RoleName) => path.join("e2e", ".auth", `${role}.json`);

/** An API client signed in as a test account (reuses the session saved by auth.setup.ts). */
export function apiAs(role: RoleName | null): Promise<APIRequestContext> {
  return pwRequest.newContext({
    baseURL: BASE,
    storageState: role ? storageFile(role) : undefined,
    // The app rejects cross-site writes; a browser would send its own origin.
    extraHTTPHeaders: { origin: BASE },
  });
}

const PHOTO = readFileSync(path.join("scripts", "seed-photos", "pothole.jpg"));

let seq = 0;
/** A unique, recognisable title for data a test creates. */
export function uniqueTitle(prefix: string): string {
  return `${prefix} ${Date.now().toString(36)}${(seq++).toString(36)}`;
}

/** Submits a report through the API (as a browser would) and returns its id. Near the town centre. */
export async function createReport(api: APIRequestContext, title: string): Promise<string> {
  const res = await api.post("/api/v1/reports", {
    multipart: {
      title,
      description: "Created by an end-to-end test. Safe to delete.",
      categorySlug: "roads",
      problemTypeSlug: "pothole",
      lat: String(13.7667 + (Math.random() - 0.5) * 0.004),
      lng: String(122.9833 + (Math.random() - 0.5) * 0.004),
      barangay: "North Centro",
      photos: { name: "photo.jpg", mimeType: "image/jpeg", buffer: PHOTO },
    },
  });
  expect(res.status(), await res.text()).toBe(201);
  return (await res.json()).id;
}

export async function transition(api: APIRequestContext, id: string, to: string, note?: string) {
  return api.post(`/api/v1/admin/reports/${id}/transition`, { data: { to, note } });
}

/** Fails the test on uncaught page errors and console errors (except third-party analytics outside Vercel). */
export function watchConsole(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const text = m.text();
    if (/_vercel\/(insights|speed-insights)|Failed to load resource/.test(text)) return;
    errors.push(text);
  });
  return errors;
}

/** No sideways scrolling at the current viewport. */
export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, "page scrolls sideways").toBeLessThanOrEqual(0);
}

/* ----------------------------- Mailpit ----------------------------- */

export async function mailpitAvailable(): Promise<boolean> {
  try {
    return (await fetch(`${MAILPIT}/api/v1/info`)).ok;
  } catch {
    return false;
  }
}

interface MailSummary {
  ID: string;
  Subject: string;
  To: { Address: string }[];
}

/**
 * Waits for an email to `to` whose subject contains `subject` and, if given, whose text contains `contains`
 * (several tests email the same test account, so the subject alone is not unique). Returns the text body.
 */
export async function waitForMail(to: string, subject: string, contains?: string): Promise<{ subject: string; text: string }> {
  let found: { Subject: string; Text: string } | undefined;
  await expect
    .poll(
      async () => {
        const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}&limit=200`);
        const data = (await res.json()) as { messages: MailSummary[] };
        for (const m of data.messages.filter((x) => x.Subject.includes(subject))) {
          const msg = (await (await fetch(`${MAILPIT}/api/v1/message/${m.ID}`)).json()) as { Subject: string; Text: string };
          if (!contains || msg.Text.includes(contains)) {
            found = msg;
            return true;
          }
        }
        return false;
      },
      { message: `email "${subject}" to ${to}${contains ? ` containing "${contains}"` : ""}`, timeout: 30_000, intervals: [500, 1000, 2000] },
    )
    .toBe(true);
  return { subject: found!.Subject, text: found!.Text };
}
