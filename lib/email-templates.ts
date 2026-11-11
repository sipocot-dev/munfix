import { MUNICIPALITY } from "./config";
import { STATUS_COLOR, STATUS_LABEL, type Status } from "./status";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function appBaseUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

interface Input {
  name: string;
  title: string;
  reportId: string;
  from: Status | null;
  to: Status;
  note: string | null;
  duplicateOf: string | null;
}

/** Subject, headline and body sentence for each status. Returns null for statuses that send no email. */
function copy(i: Input): { subject: string; headline: string; body: string } | null {
  switch (i.to) {
    case "submitted":
      return {
        subject: "We received your report",
        headline: "We received your report",
        body: "City staff will review it before it appears on the public map. We will email you when its status changes.",
      };
    case "verified":
      return {
        subject: "Your report was verified",
        headline: "Your report was verified",
        body: "City staff confirmed the problem. It is now public on the map, and we will keep you posted as work progresses.",
      };
    case "in_progress":
      return i.from === "resolved"
        ? {
            subject: "Your report was reopened",
            headline: "Your report was reopened",
            body: "This issue was marked as needing more work and is back in progress.",
          }
        : {
            subject: "Work has started on your report",
            headline: "Work has started",
            body: "A crew is now working on the issue you reported.",
          };
    case "resolved":
      return {
        subject: "Your report was resolved",
        headline: "Your report was resolved",
        body: "The issue you reported has been marked as fixed. Thank you for helping improve " + MUNICIPALITY.name + ".",
      };
    case "rejected":
      return {
        subject: "Your report could not be accepted",
        headline: "Your report could not be accepted",
        body: "City staff reviewed your report but could not accept it.",
      };
    case "duplicate":
      return {
        subject: "Your report matches an existing one",
        headline: "Your report matches an existing report",
        body: "Another report already covers this problem, so yours was merged into it. You can follow the original for updates.",
      };
    default:
      return null;
  }
}

export function statusEmail(i: Input): { subject: string; text: string; html: string } | null {
  const c = copy(i);
  if (!c) return null;

  const base = appBaseUrl();
  const url = `${base}/reports/${i.reportId}`;
  const originalUrl = i.to === "duplicate" && i.duplicateOf ? `${base}/reports/${i.duplicateOf}` : null;
  const manageUrl = `${base}/me`;
  const color = STATUS_COLOR[i.to];
  const noteLabel = i.to === "rejected" ? "Reason" : "Note from city staff";

  const text = [
    `Hi ${i.name},`,
    "",
    `${c.headline}: "${i.title}"`,
    "",
    c.body,
    i.note ? `\n${noteLabel}: ${i.note}` : "",
    "",
    `View your report: ${url}`,
    originalUrl ? `Original report: ${originalUrl}` : "",
    "",
    `— MunFix ${MUNICIPALITY.name}`,
    `You can turn these emails off at ${manageUrl}`,
  ]
    .filter((line, idx, arr) => line !== "" || arr[idx - 1] !== "")
    .join("\n");

  const html = `<!doctype html>
<html><body style="margin:0;background:#f8fafc;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px">
      <tr><td style="padding:24px 24px 8px">
        <div style="font-size:13px;font-weight:700;color:#1d3557">MunFix ${escapeHtml(MUNICIPALITY.name)}</div>
        <h1 style="margin:12px 0 4px;font-size:20px;line-height:1.3">${escapeHtml(c.headline)}</h1>
        <span style="display:inline-block;margin:4px 0 12px;padding:2px 10px;border-radius:999px;font-size:12px;font-weight:700;color:${color};background:${color}1a">${escapeHtml(STATUS_LABEL[i.to])}</span>
      </td></tr>
      <tr><td style="padding:0 24px">
        <p style="margin:0 0 12px;font-size:15px">Hi ${escapeHtml(i.name)},</p>
        <p style="margin:0 0 12px;font-size:15px;font-weight:600">${escapeHtml(i.title)}</p>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.5;color:#334155">${escapeHtml(c.body)}</p>
        ${
          i.note
            ? `<div style="margin:0 0 16px;padding:12px;background:#f1f5f9;border-radius:8px;font-size:14px;line-height:1.5"><strong>${noteLabel}:</strong> ${escapeHtml(i.note)}</div>`
            : ""
        }
        <a href="${escapeHtml(url)}" style="display:inline-block;padding:10px 18px;background:#1d3557;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px">View your report</a>
        ${originalUrl ? `<p style="margin:12px 0 0;font-size:14px"><a href="${escapeHtml(originalUrl)}" style="color:#1d3557">View the original report</a></p>` : ""}
      </td></tr>
      <tr><td style="padding:24px;font-size:12px;color:#64748b">
        You are receiving this because you submitted a report on MunFix ${escapeHtml(MUNICIPALITY.name)}.
        <a href="${escapeHtml(manageUrl)}" style="color:#64748b">Turn these emails off</a>.
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;

  return { subject: `[MunFix] ${c.subject}`, text, html };
}

export function resetEmail(i: { name: string; url: string; minutes: number }): { subject: string; text: string; html: string } {
  const text = [
    `Hi ${i.name},`,
    "",
    `We received a request to reset your MunFix ${MUNICIPALITY.name} password. Open this link to choose a new one (valid for ${i.minutes} minutes):`,
    "",
    i.url,
    "",
    "If you did not ask for this, you can ignore this email. Your password will not change.",
    "",
    `— MunFix ${MUNICIPALITY.name}`,
  ].join("\n");

  const html = `<!doctype html>
<html><body style="margin:0;background:#f8fafc;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px">
      <tr><td style="padding:24px">
        <div style="font-size:13px;font-weight:700;color:#1d3557">MunFix ${escapeHtml(MUNICIPALITY.name)}</div>
        <h1 style="margin:12px 0;font-size:20px">Reset your password</h1>
        <p style="margin:0 0 12px;font-size:15px">Hi ${escapeHtml(i.name)},</p>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.5;color:#334155">We received a request to reset your password. This link is valid for ${i.minutes} minutes.</p>
        <a href="${escapeHtml(i.url)}" style="display:inline-block;padding:10px 18px;background:#1d3557;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px">Choose a new password</a>
        <p style="margin:16px 0 0;font-size:12px;color:#64748b">If you did not ask for this, ignore this email. Your password will not change.</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
  return { subject: "[MunFix] Reset your password", text, html };
}
