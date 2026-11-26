// Explorer filter logic shared by the home page (server) and the Explorer (client). Kept out of the
// "use client" module: a server component importing a constant from there would get a client reference.
import type { ReportSummary } from "./reports";
import { PUBLIC_STATUSES, type Status } from "./status";

/** The map opens on reports that still need work (published, under review, in progress); Resolved is one click away. */
export const DEFAULT_STATUSES: Status[] = ["verified", "under_review", "in_progress"];

export interface ExplorerFilters {
  statuses: Status[];
  category: string;
  q: string;
}

/** Text search across what a resident would type: title, category, problem type, barangay, landmark. */
export function matchesQuery(r: Pick<ReportSummary, "title" | "categoryName" | "problemType" | "barangay" | "address">, needle: string): boolean {
  if (!needle) return true;
  const n = needle.toLowerCase();
  return [r.title, r.categoryName, r.problemType, r.barangay, r.address].some((v) => v?.toLowerCase().includes(n));
}

/** Filters as a query string, so a filtered view can be bookmarked or shared. Defaults are left out. */
export function filtersToQuery(f: ExplorerFilters): string {
  const sp = new URLSearchParams();
  if (f.statuses.join() !== DEFAULT_STATUSES.join()) sp.set("status", f.statuses.join(","));
  if (f.category) sp.set("category", f.category);
  if (f.q.trim()) sp.set("q", f.q.trim());
  const s = sp.toString();
  return s ? `?${s}` : "";
}

/** Reads filters from the URL. Unknown statuses or categories fall back to the defaults. */
export function filtersFromQuery(sp: { status?: string; category?: string; q?: string }, categorySlugs: string[]): ExplorerFilters {
  const wanted = (sp.status ?? "").split(",");
  const statuses = PUBLIC_STATUSES.filter((s) => wanted.includes(s));
  return {
    statuses: statuses.length > 0 ? statuses : [...DEFAULT_STATUSES],
    category: sp.category && categorySlugs.includes(sp.category) ? sp.category : "",
    q: (sp.q ?? "").slice(0, 100),
  };
}
