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

export function isStatus(value: unknown): value is Status {
  return typeof value === "string" && (STATUSES as readonly string[]).includes(value);
}

export function isPublicStatus(status: Status): boolean {
  return PUBLIC_STATUSES.includes(status);
}
