export const STATUSES = [
  "submitted",
  "under_review",
  "verified",
  "in_progress",
  "resolved",
  "rejected",
  "duplicate",
  "withdrawn",
  "hidden",
] as const;

export type Status = (typeof STATUSES)[number];

/*
 * Publication model (migration 007): a new report is public the moment it is submitted. Its status is
 * "verified", labelled "Published" (the key is kept so existing data and history stay valid).
 * "under_review" means a moderator is checking a public report; it stays visible. Moderators take a
 * report off the map with "hidden" (reversible) or "rejected" (final). "submitted" only remains on
 * reports filed before automatic publication; they stay private until a moderator decides.
 */

/** Statuses visible to the public (on the map and in lists). */
export const PUBLIC_STATUSES: readonly Status[] = ["verified", "under_review", "in_progress", "resolved"];

/** Statuses a reporter may still edit or withdraw: before any work has started. */
export const CITIZEN_EDITABLE: readonly Status[] = ["submitted", "verified", "under_review"];
export const CITIZEN_WITHDRAWABLE = CITIZEN_EDITABLE;

/** Allowed status changes (which roles may make each one is in lib/permissions.ts). */
export const TRANSITIONS: Record<Status, readonly Status[]> = {
  submitted: ["verified", "under_review", "rejected", "duplicate", "hidden"],
  verified: ["under_review", "in_progress", "resolved", "rejected", "duplicate", "hidden"],
  under_review: ["verified", "rejected", "duplicate", "hidden"],
  in_progress: ["resolved", "hidden"],
  resolved: ["in_progress", "hidden"],
  hidden: ["verified"],
  rejected: [],
  duplicate: [],
  withdrawn: [],
};

/** Changes that must carry a reason, because the reporter needs to know why. */
export const REASON_REQUIRED: readonly Status[] = ["rejected", "hidden"];

export const STATUS_LABEL: Record<Status, string> = {
  submitted: "Awaiting review",
  under_review: "Under review",
  verified: "Published",
  in_progress: "In progress",
  resolved: "Resolved",
  rejected: "Rejected",
  duplicate: "Duplicate",
  withdrawn: "Withdrawn",
  hidden: "Hidden",
};

export const STATUS_COLOR: Record<Status, string> = {
  submitted: "#64748b",
  under_review: "#7c3aed",
  verified: "#d97706",
  in_progress: "#2563eb",
  resolved: "#16a34a",
  rejected: "#dc2626",
  duplicate: "#64748b",
  withdrawn: "#94a3b8",
  hidden: "#71717a",
};

/**
 * Darker shade of each status colour for text and small icons: every value is at least 4.5:1 on white
 * and on its own 10% badge tint (checked in tests/unit/design-system.test.ts). STATUS_COLOR alone fails AA for amber and green.
 */
export const STATUS_TEXT: Record<Status, string> = {
  submitted: "#334155",
  under_review: "#6d28d9",
  verified: "#92400e",
  in_progress: "#1d4ed8",
  resolved: "#166534",
  rejected: "#b91c1c",
  duplicate: "#475569",
  withdrawn: "#475569",
  hidden: "#3f3f46",
};

/** STATUS_TEXT for dark mode: light tints that keep 4.5:1 on dark surfaces and on the badge tint. */
export const STATUS_TEXT_DARK: Record<Status, string> = {
  submitted: "#cbd5e1",
  under_review: "#c4b5fd",
  verified: "#fcd34d",
  in_progress: "#93c5fd",
  resolved: "#86efac",
  rejected: "#fca5a5",
  duplicate: "#cbd5e1",
  withdrawn: "#cbd5e1",
  hidden: "#d4d4d8",
};

/** CSS variables for the .status-text class (app/globals.css), which picks the shade for the current theme. */
export function statusTextVars(status: Status): Record<string, string> {
  return { "--st": STATUS_TEXT[status], "--st-d": STATUS_TEXT_DARK[status] };
}

/** One-line explanation of each status for citizens. */
export const STATUS_HELP: Record<Status, string> = {
  submitted: "Filed before reports were published automatically. A moderator will decide.",
  under_review: "Public, and a moderator is checking the details.",
  verified: "Public on the map. City staff can see it and plan the work.",
  in_progress: "A crew is working on it.",
  resolved: "Marked as fixed.",
  rejected: "Not accepted. The reason is in the timeline.",
  duplicate: "Merged into an existing report.",
  withdrawn: "Withdrawn by the reporter.",
  hidden: "Taken off the public map by a moderator. The reason is in the timeline.",
};

export function isStatus(value: unknown): value is Status {
  return typeof value === "string" && (STATUSES as readonly string[]).includes(value);
}

export function isPublicStatus(status: Status): boolean {
  return PUBLIC_STATUSES.includes(status);
}
