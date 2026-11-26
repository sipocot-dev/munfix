// Permission rules. No server imports, so client components can use them too.
// Roles are data (table `roles`, managed on Admin -> Roles); what a user may do depends only on the
// permissions of their role. The server enforces these rules; the client uses them to decide what to show.
import { TRANSITIONS, type Status } from "./status";

export const PERMISSIONS = {
  "reports.review": "Review reports: put them under review, publish, hide, reject or mark as duplicates",
  "reports.view_private": "See reports that are not public (hidden, rejected, awaiting review) and their photos",
  "reports.view_reporter": "See who submitted a report (name and email)",
  "reports.work": "Field work: mark public reports as in progress and resolved",
  "stats.view": "See the overview dashboard",
  "audit.view": "See the audit log",
  "system.view": "See system health and send a test email",
  "users.manage": "Create accounts, change their role, deactivate them and reset passwords",
  "roles.manage": "Create and edit roles and choose their permissions",
} as const;

export type Permission = keyof typeof PERMISSIONS;
export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

/** Permissions that control access itself. Granting them is guarded more strictly (lib/roles.ts). */
export const CRITICAL_PERMISSIONS: readonly Permission[] = ["users.manage", "roles.manage"];

export function isPermission(value: unknown): value is Permission {
  return typeof value === "string" && value in PERMISSIONS;
}

/** A role key: the stable identifier stored on users.role. */
export type Role = string;

export interface RoleDef {
  name: string;
  description: string;
  permissions: readonly Permission[];
}

/**
 * The four built-in roles. Seeded by migration 007 and re-synced on every start (lib/setup.ts), so
 * these definitions are the source of truth: they cannot be edited, disabled or deleted in the app.
 * Their permissions reproduce the behaviour of the earlier hard-coded roles.
 */
export const SYSTEM_ROLES = {
  citizen: {
    name: "Citizen",
    description: "Reports problems and follows their progress.",
    permissions: [],
  },
  staff: {
    name: "Field staff",
    description: "Works on public reports: marks them in progress and resolved. Can be limited to certain categories.",
    permissions: ["reports.work"],
  },
  moderator: {
    name: "Moderator",
    description: "Reviews reports: puts them under review, hides, rejects or merges duplicates, and restores hidden ones.",
    permissions: ["reports.review", "reports.view_private", "reports.view_reporter", "stats.view"],
  },
  admin: {
    name: "Administrator",
    description: "Full access: everything above, plus user accounts, roles, the audit log and system settings.",
    permissions: ALL_PERMISSIONS,
  },
} as const satisfies Record<string, RoleDef>;

export type SystemRole = keyof typeof SYSTEM_ROLES;
export const SYSTEM_ROLE_KEYS = Object.keys(SYSTEM_ROLES) as SystemRole[];

export function isSystemRole(key: string): key is SystemRole {
  return key in SYSTEM_ROLES;
}

type Perms = readonly Permission[] | null | undefined;
const has = (p: Perms, perm: Permission) => Boolean(p?.includes(perm));

/** Whether every permission in `wanted` is also in `held`. The core of the no-escalation rule. */
export function isSubset(wanted: readonly string[], held: readonly string[]): boolean {
  return wanted.every((p) => held.includes(p));
}

/** Can open the work queue (/admin). */
export function hasWorkspace(p: Perms): boolean {
  return has(p, "reports.review") || has(p, "reports.work");
}

/** Can see reports that are not public, and their photos. */
export function canViewUnpublished(p: Perms): boolean {
  return has(p, "reports.view_private");
}

/** Field-work-only roles are limited to their assigned categories (user_categories), if any. */
export function isCategoryScoped(p: Perms): boolean {
  return has(p, "reports.work") && !has(p, "reports.review");
}

const REVIEW_TARGETS: readonly Status[] = ["under_review", "verified", "rejected", "duplicate", "hidden"];
const WORK_TARGETS: readonly Status[] = ["in_progress", "resolved"];

/** Statuses these permissions may move a report to, from the given status. */
export function allowedTransitions(p: Perms, from: Status): Status[] {
  const targets = new Set<Status>([...(has(p, "reports.review") ? REVIEW_TARGETS : []), ...(has(p, "reports.work") ? WORK_TARGETS : [])]);
  return TRANSITIONS[from].filter((to) => targets.has(to));
}

/** Report statuses these permissions may list in the work queue. */
export function viewableStatuses(p: Perms): Status[] {
  if (has(p, "reports.review") || has(p, "reports.view_private")) {
    return ["submitted", "under_review", "verified", "in_progress", "resolved", "rejected", "duplicate", "hidden"];
  }
  if (has(p, "reports.work")) return ["verified", "under_review", "in_progress", "resolved"];
  return [];
}

export interface QueueTab {
  key: string;
  label: string;
  statuses: Status[];
}

/** Tabs shown on the work queue, depending on what the user can do. */
export function queueTabs(p: Perms): QueueTab[] {
  const published: QueueTab = { key: "published", label: "Published", statuses: ["verified"] };
  const review: QueueTab = { key: "review", label: "Under review", statuses: ["under_review", "submitted"] };
  const progress: QueueTab = { key: "in_progress", label: "In progress", statuses: ["in_progress"] };
  const resolved: QueueTab = { key: "resolved", label: "Resolved", statuses: ["resolved"] };
  const removed: QueueTab = { key: "removed", label: "Hidden or rejected", statuses: ["hidden", "rejected", "duplicate"] };
  if (has(p, "reports.review")) return [published, review, progress, resolved, removed];
  if (has(p, "reports.work")) return [published, progress, resolved];
  return [];
}

export function defaultTab(p: Perms): QueueTab | undefined {
  return queueTabs(p)[0];
}

/** Workspace areas and the permission each needs. Shared by the navigation and the page guards. */
export const WORKSPACE_AREAS = [
  { href: "/admin", label: "Work queue", anyOf: ["reports.review", "reports.work"] },
  { href: "/admin/overview", label: "Overview", anyOf: ["stats.view"] },
  { href: "/admin/users", label: "Users", anyOf: ["users.manage"] },
  { href: "/admin/roles", label: "Roles", anyOf: ["roles.manage"] },
  { href: "/admin/audit", label: "Audit log", anyOf: ["audit.view"] },
  { href: "/admin/system", label: "System", anyOf: ["system.view"] },
] as const satisfies readonly { href: string; label: string; anyOf: readonly Permission[] }[];

export function canOpen(p: Perms, anyOf: readonly Permission[]): boolean {
  return anyOf.some((perm) => has(p, perm));
}
