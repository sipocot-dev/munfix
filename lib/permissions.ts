// Pure role/permission rules. No server imports, so client components can use them too.
// The server enforces the same rules; the client uses them only to decide what to show.
import { TRANSITIONS, type Status } from "./status";

export const ROLES = ["citizen", "moderator", "staff", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  citizen: "Citizen",
  moderator: "Moderator",
  staff: "Field staff",
  admin: "Administrator",
};

export const ROLE_DESCRIPTION: Record<Role, string> = {
  citizen: "Reports problems and follows their progress.",
  moderator: "Reviews new reports: verify and publish, reject, or mark duplicates.",
  staff: "Works on published reports: marks them in progress and resolved. Can be limited to certain categories.",
  admin: "Full access: everything above, plus user accounts, roles, the audit log and system settings.",
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/** Roles that can open the moderation workspace. */
export function isStaffRole(role: Role | null | undefined): boolean {
  return role === "moderator" || role === "staff" || role === "admin";
}

/** Roles that can see reports that are not published yet (and their reporters). */
export function canViewUnpublished(role: Role | null | undefined): boolean {
  return role === "moderator" || role === "admin";
}

const MODERATOR_TARGETS: readonly Status[] = ["under_review", "verified", "rejected", "duplicate"];
const STAFF_TARGETS: readonly Status[] = ["in_progress", "resolved"];

/** Statuses a role may move a report to, from the given status. */
export function allowedTransitions(role: Role | null | undefined, from: Status): Status[] {
  const base = TRANSITIONS[from];
  switch (role) {
    case "admin":
      return [...base];
    case "moderator":
      return base.filter((to) => MODERATOR_TARGETS.includes(to));
    case "staff":
      return base.filter((to) => STAFF_TARGETS.includes(to));
    default:
      return [];
  }
}

/** Report statuses a role may list in the work queue. Staff never see unreviewed reports. */
export function viewableStatuses(role: Role | null | undefined): Status[] {
  if (role === "staff") return ["verified", "in_progress", "resolved"];
  if (role === "moderator" || role === "admin") {
    return ["submitted", "under_review", "verified", "in_progress", "resolved", "rejected", "duplicate"];
  }
  return [];
}

export interface QueueTab {
  key: string;
  label: string;
  statuses: Status[];
}

/** Tabs shown on the moderation page, per role. */
export function queueTabs(role: Role): QueueTab[] {
  const review: QueueTab = { key: "queue", label: "Needs review", statuses: ["submitted", "under_review"] };
  const verified: QueueTab = { key: "verified", label: "Verified", statuses: ["verified"] };
  const progress: QueueTab = { key: "in_progress", label: "In progress", statuses: ["in_progress"] };
  const resolved: QueueTab = { key: "resolved", label: "Resolved", statuses: ["resolved"] };
  const closed: QueueTab = { key: "closed", label: "Rejected / duplicate", statuses: ["rejected", "duplicate"] };
  if (role === "staff") return [verified, progress, resolved];
  return [review, verified, progress, resolved, closed];
}

export function defaultTab(role: Role): QueueTab {
  return queueTabs(role)[0];
}
