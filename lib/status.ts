export const STATUSES = [
  "submitted",
  "under_review",
  "verified",
  "in_progress",
  "resolved",
  "rejected",
  "duplicate",
  "withdrawn",
] as const;

export type Status = (typeof STATUSES)[number];

/** Statuses visible to the public (on the map and in lists). */
export const PUBLIC_STATUSES: readonly Status[] = ["verified", "in_progress", "resolved"];

/** Moderation queue statuses. */
export const QUEUE_STATUSES: readonly Status[] = ["submitted", "under_review"];

/** Statuses a citizen may withdraw or edit from. */
export const CITIZEN_WITHDRAWABLE: readonly Status[] = ["submitted", "under_review"];

/** Allowed admin transitions. */
export const TRANSITIONS: Record<Status, readonly Status[]> = {
  submitted: ["under_review", "verified", "rejected", "duplicate"],
  under_review: ["verified", "rejected", "duplicate"],
  verified: ["in_progress", "resolved", "rejected"],
  in_progress: ["resolved"],
  resolved: ["in_progress"],
  rejected: [],
  duplicate: [],
  withdrawn: [],
};

export const STATUS_LABEL: Record<Status, string> = {
  submitted: "Submitted",
  under_review: "Under review",
  verified: "Verified",
  in_progress: "In progress",
  resolved: "Resolved",
  rejected: "Rejected",
  duplicate: "Duplicate",
  withdrawn: "Withdrawn",
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
};

/** One-line explanation of each status for citizens. */
export const STATUS_HELP: Record<Status, string> = {
  submitted: "Received. City staff will review it before it is published.",
  under_review: "A moderator is checking the details.",
  verified: "Confirmed by city staff and visible on the public map.",
  in_progress: "A crew is working on it.",
  resolved: "Marked as fixed.",
  rejected: "Not accepted. The reason is in the timeline.",
  duplicate: "Merged into an existing report.",
  withdrawn: "Withdrawn by the reporter.",
};

export function isStatus(value: unknown): value is Status {
  return typeof value === "string" && (STATUSES as readonly string[]).includes(value);
}

export function isPublicStatus(status: Status): boolean {
  return PUBLIC_STATUSES.includes(status);
}
