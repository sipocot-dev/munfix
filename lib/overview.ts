import { query } from "./db";
import type { Status } from "./status";

export interface Overview {
  byStatus: { status: Status; count: number }[];
  byCategory: { name: string; count: number }[];
  topBarangays: { barangay: string; count: number }[];
  daily: { day: string; count: number }[];
  avgResolutionDays: number | null;
  total: number;
  openQueue: number;
}

export async function getOverview(): Promise<Overview> {
  const [byStatus, byCategory, topBarangays, daily, [avg]] = await Promise.all([
    query<{ status: Status; count: string }>("SELECT status, count(*) FROM reports GROUP BY status"),
    query<{ name: string; count: string }>(
      "SELECT c.name, count(*) FROM reports r JOIN categories c ON c.id = r.category_id GROUP BY c.name ORDER BY count(*) DESC",
    ),
    query<{ barangay: string; count: string }>(
      "SELECT barangay, count(*) FROM reports WHERE barangay IS NOT NULL AND barangay <> '' GROUP BY barangay ORDER BY count(*) DESC, barangay LIMIT 8",
    ),
    query<{ day: string; count: string }>(
      `SELECT to_char(d::date, 'YYYY-MM-DD') AS day, count(r.id)
         FROM generate_series(current_date - 29, current_date, '1 day') d
         LEFT JOIN reports r ON r.created_at::date = d::date
        GROUP BY d ORDER BY d`,
    ),
    query<{ days: string | null }>(
      "SELECT avg(extract(epoch FROM resolved_at - created_at)) / 86400 AS days FROM reports WHERE resolved_at IS NOT NULL",
    ),
  ]);
  const statuses = byStatus.map((r) => ({ status: r.status, count: Number(r.count) }));
  const get = (s: Status) => statuses.find((x) => x.status === s)?.count ?? 0;
  return {
    byStatus: statuses,
    byCategory: byCategory.map((r) => ({ name: r.name, count: Number(r.count) })),
    topBarangays: topBarangays.map((r) => ({ barangay: r.barangay, count: Number(r.count) })),
    daily: daily.map((r) => ({ day: r.day, count: Number(r.count) })),
    avgResolutionDays: avg?.days != null ? Number(avg.days) : null,
    total: statuses.reduce((n, s) => n + s.count, 0),
    openQueue: get("submitted") + get("under_review"),
  };
}
