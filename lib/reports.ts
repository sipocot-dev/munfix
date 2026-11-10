import type { PoolClient } from "pg";
import { cached, invalidateReports, reportsVersion } from "./cache";
import { isUuid, query, withTx } from "./db";
import { HttpError } from "./errors";
import { queueStatusEmail, triggerDrain } from "./notifications";
import type { Session } from "./session";
import {
  CITIZEN_WITHDRAWABLE,
  PUBLIC_STATUSES,
  TRANSITIONS,
  isPublicStatus,
  type Status,
} from "./status";

/* ----------------------------- Types ----------------------------- */

export interface Category {
  id: number;
  slug: string;
  name: string;
  description: string | null;
}

export interface ReportSummary {
  id: string;
  title: string;
  status: Status;
  lat: number;
  lng: number;
  address: string | null;
  barangay: string | null;
  categorySlug: string;
  categoryName: string;
  createdAt: string;
  resolvedAt: string | null;
  thumb: string | null;
}

export interface ReportEvent {
  id: string;
  fromStatus: Status | null;
  toStatus: Status;
  note: string | null;
  createdAt: string;
  /** Only populated for admins. */
  actorName: string | null;
}

export interface ReportDetail extends ReportSummary {
  description: string;
  duplicateOf: string | null;
  publishedAt: string | null;
  updatedAt: string;
  media: { id: string; url: string }[];
  events: ReportEvent[];
  isOwner: boolean;
  canWithdraw: boolean;
  /** Only populated for admins. */
  reporter?: { name: string; email: string };
  allowedTransitions?: Status[];
}

export interface AdminReportRow extends ReportSummary {
  description: string;
  reporterName: string;
}

export interface Stats {
  verified: number;
  inProgress: number;
  resolved: number;
  total: number;
  avgResolutionDays: number | null;
}

/* ----------------------------- Row mapping ----------------------------- */

interface SummaryRow {
  id: string;
  title: string;
  status: Status;
  lat: number;
  lng: number;
  address: string | null;
  barangay: string | null;
  category_slug: string;
  category_name: string;
  created_at: Date;
  resolved_at: Date | null;
  thumb: string | null;
}

const SUMMARY_COLUMNS = `
  r.id, r.title, r.status, r.lat, r.lng, r.address, r.barangay,
  r.created_at, r.resolved_at,
  c.slug AS category_slug, c.name AS category_name,
  (SELECT m.path FROM report_media m WHERE m.report_id = r.id ORDER BY m.created_at LIMIT 1) AS thumb
`;

function toSummary(row: SummaryRow): ReportSummary {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    lat: row.lat,
    lng: row.lng,
    address: row.address,
    barangay: row.barangay,
    categorySlug: row.category_slug,
    categoryName: row.category_name,
    createdAt: row.created_at.toISOString(),
    resolvedAt: row.resolved_at ? row.resolved_at.toISOString() : null,
    thumb: row.thumb ? `/api/v1/media/${row.thumb}` : null,
  };
}

/* ----------------------------- Categories ----------------------------- */

export async function listCategories(): Promise<Category[]> {
  return cached("categories:all", 3600, () =>
    query<Category>("SELECT id, slug, name, description FROM categories ORDER BY sort_order, name"),
  );
}

/* ----------------------------- Public reads ----------------------------- */

export interface ReportFilters {
  /** [minLng, minLat, maxLng, maxLat] */
  bbox?: [number, number, number, number];
  statuses?: Status[];
  category?: string;
  limit?: number;
}

export async function listPublicReports(filters: ReportFilters = {}): Promise<ReportSummary[]> {
  const requested = filters.statuses?.filter((s) => isPublicStatus(s)) ?? [];
  const statuses: Status[] = requested.length > 0 ? requested : [...PUBLIC_STATUSES];
  const limit = Math.min(Math.max(Math.floor(filters.limit ?? 500), 1), 1000);

  const version = await reportsVersion();
  const key = `reports:list:${version}:${JSON.stringify([filters.bbox ?? null, statuses, filters.category ?? null, limit])}`;

  return cached(key, 60, async () => {
    const params: unknown[] = [statuses];
    const where = ["r.status = ANY($1::text[])"];

    if (filters.bbox) {
      const [minLng, minLat, maxLng, maxLat] = filters.bbox;
      params.push(minLng, maxLng, minLat, maxLat);
      const n = params.length;
      where.push(`r.lng BETWEEN $${n - 3} AND $${n - 2}`, `r.lat BETWEEN $${n - 1} AND $${n}`);
    }
    if (filters.category) {
      params.push(filters.category);
      where.push(`c.slug = $${params.length}`);
    }
    params.push(limit);

    const rows = await query<SummaryRow>(
      `SELECT ${SUMMARY_COLUMNS}
         FROM reports r JOIN categories c ON c.id = r.category_id
        WHERE ${where.join(" AND ")}
        ORDER BY r.created_at DESC
        LIMIT $${params.length}`,
      params,
    );
    return rows.map(toSummary);
  });
}

export async function getStats(): Promise<Stats> {
  const version = await reportsVersion();
  return cached(`reports:stats:${version}`, 60, async () => {
    const counts = await query<{ status: Status; n: number }>(
      `SELECT status, count(*)::int AS n FROM reports WHERE status = ANY($1::text[]) GROUP BY status`,
      [PUBLIC_STATUSES],
    );
    const by = Object.fromEntries(counts.map((c) => [c.status, c.n])) as Partial<Record<Status, number>>;
    const [avg] = await query<{ days: number | null }>(
      `SELECT avg(extract(epoch FROM (resolved_at - published_at)) / 86400)::float8 AS days
         FROM reports
        WHERE status = 'resolved' AND resolved_at IS NOT NULL AND published_at IS NOT NULL`,
    );
    const verified = by.verified ?? 0;
    const inProgress = by.in_progress ?? 0;
    const resolved = by.resolved ?? 0;
    return {
      verified,
      inProgress,
      resolved,
      total: verified + inProgress + resolved,
      avgResolutionDays: avg?.days != null ? Math.round(avg.days * 10) / 10 : null,
    };
  });
}

/* ----------------------------- Detail ----------------------------- */

interface DetailRow extends SummaryRow {
  description: string;
  user_id: string;
  duplicate_of: string | null;
  published_at: Date | null;
  updated_at: Date;
  reporter_name: string;
  reporter_email: string;
}

/**
 * Returns the report if the viewer is allowed to see it: public statuses are
 * visible to everyone, anything else only to the owner and admins.
 * Returns null (not 403) otherwise so unpublished reports aren't discoverable.
 */
export async function getReportDetail(id: string, viewer: Session | null): Promise<ReportDetail | null> {
  if (!isUuid(id)) return null;

  const [row] = await query<DetailRow>(
    `SELECT ${SUMMARY_COLUMNS}, r.description, r.user_id, r.duplicate_of, r.published_at, r.updated_at,
            u.name AS reporter_name, u.email AS reporter_email
       FROM reports r
       JOIN categories c ON c.id = r.category_id
       JOIN users u ON u.id = r.user_id
      WHERE r.id = $1`,
    [id],
  );
  if (!row) return null;

  const isAdmin = viewer?.role === "admin";
  const isOwner = viewer?.userId === row.user_id;
  if (!isPublicStatus(row.status) && !isOwner && !isAdmin) return null;

  const media = await query<{ id: string; path: string }>(
    "SELECT id, path FROM report_media WHERE report_id = $1 ORDER BY created_at",
    [id],
  );

  const events = await query<{
    id: string;
    from_status: Status | null;
    to_status: Status;
    note: string | null;
    created_at: Date;
    actor_name: string | null;
  }>(
    `SELECT e.id, e.from_status, e.to_status, e.note, e.created_at, u.name AS actor_name
       FROM report_events e LEFT JOIN users u ON u.id = e.actor_id
      WHERE e.report_id = $1
      ORDER BY e.created_at, e.id`,
    [id],
  );

  // The public only sees the part of the history that happened after publication.
  const visibleEvents = events.filter((e) => isOwner || isAdmin || isPublicStatus(e.to_status));

  const detail: ReportDetail = {
    ...toSummary(row),
    description: row.description,
    duplicateOf: row.duplicate_of,
    publishedAt: row.published_at ? row.published_at.toISOString() : null,
    updatedAt: row.updated_at.toISOString(),
    media: media.map((m) => ({ id: m.id, url: `/api/v1/media/${m.path}` })),
    events: visibleEvents.map((e) => ({
      id: String(e.id),
      fromStatus: e.from_status,
      toStatus: e.to_status,
      note: e.note,
      createdAt: e.created_at.toISOString(),
      actorName: isAdmin ? e.actor_name : null,
    })),
    isOwner,
    canWithdraw: isOwner && CITIZEN_WITHDRAWABLE.includes(row.status),
  };

  if (isAdmin) {
    detail.reporter = { name: row.reporter_name, email: row.reporter_email };
    detail.allowedTransitions = [...TRANSITIONS[row.status]];
  }
  return detail;
}

/* ----------------------------- Citizen operations ----------------------------- */

export interface NewReport {
  title: string;
  description: string;
  categorySlug: string;
  lat: number;
  lng: number;
  address?: string;
  barangay?: string;
}

export async function createReport(userId: string, input: NewReport, mediaFiles: string[]): Promise<string> {
  const id = await withTx(async (client) => {
    const cat = await client.query<{ id: number }>("SELECT id FROM categories WHERE slug = $1", [input.categorySlug]);
    if (cat.rowCount === 0) throw new HttpError(400, "Unknown category");

    const res = await client.query<{ id: string }>(
      `INSERT INTO reports (user_id, category_id, title, description, lat, lng, address, barangay)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [userId, cat.rows[0].id, input.title, input.description, input.lat, input.lng, input.address ?? null, input.barangay ?? null],
    );
    const reportId = res.rows[0].id;

    for (const path of mediaFiles) {
      await client.query("INSERT INTO report_media (report_id, path) VALUES ($1, $2)", [reportId, path]);
    }
    await insertEvent(client, reportId, userId, null, "submitted", null);
    await queueStatusEmail(client, reportId, null, "submitted", null);
    return reportId;
  });
  triggerDrain();
  return id;
}

export async function listUserReports(userId: string): Promise<ReportSummary[]> {
  const rows = await query<SummaryRow>(
    `SELECT ${SUMMARY_COLUMNS}
       FROM reports r JOIN categories c ON c.id = r.category_id
      WHERE r.user_id = $1
      ORDER BY r.created_at DESC`,
    [userId],
  );
  return rows.map(toSummary);
}

export async function withdrawReport(id: string, userId: string): Promise<void> {
  if (!isUuid(id)) throw new HttpError(404, "Report not found");
  await withTx(async (client) => {
    const res = await client.query<{ status: Status; user_id: string }>(
      "SELECT status, user_id FROM reports WHERE id = $1 FOR UPDATE",
      [id],
    );
    const row = res.rows[0];
    if (!row || row.user_id !== userId) throw new HttpError(404, "Report not found");
    if (!CITIZEN_WITHDRAWABLE.includes(row.status)) {
      throw new HttpError(409, "This report can no longer be withdrawn");
    }
    await client.query("UPDATE reports SET status = 'withdrawn', updated_at = now() WHERE id = $1", [id]);
    await insertEvent(client, id, userId, row.status, "withdrawn", null);
  });
  await invalidateReports();
}

export interface ReportEdit {
  title?: string;
  description?: string;
  categorySlug?: string;
  address?: string;
  barangay?: string;
}

/** Citizens may edit their report only until a moderator picks it up. */
export async function updateOwnReport(id: string, userId: string, edit: ReportEdit): Promise<void> {
  if (!isUuid(id)) throw new HttpError(404, "Report not found");
  await withTx(async (client) => {
    const res = await client.query<{ status: Status; user_id: string }>(
      "SELECT status, user_id FROM reports WHERE id = $1 FOR UPDATE",
      [id],
    );
    const row = res.rows[0];
    if (!row || row.user_id !== userId) throw new HttpError(404, "Report not found");
    if (row.status !== "submitted") throw new HttpError(409, "This report can no longer be edited");

    const sets: string[] = [];
    const params: unknown[] = [];
    const add = (col: string, value: unknown) => {
      params.push(value);
      sets.push(`${col} = $${params.length}`);
    };

    if (edit.title !== undefined) add("title", edit.title);
    if (edit.description !== undefined) add("description", edit.description);
    if (edit.address !== undefined) add("address", edit.address);
    if (edit.barangay !== undefined) add("barangay", edit.barangay);
    if (edit.categorySlug !== undefined) {
      const cat = await client.query<{ id: number }>("SELECT id FROM categories WHERE slug = $1", [edit.categorySlug]);
      if (cat.rowCount === 0) throw new HttpError(400, "Unknown category");
      add("category_id", cat.rows[0].id);
    }
    if (sets.length === 0) return;

    params.push(id);
    await client.query(`UPDATE reports SET ${sets.join(", ")}, updated_at = now() WHERE id = $${params.length}`, params);
  });
}

/* ----------------------------- Admin operations ----------------------------- */

export async function listAdminReports(statuses: Status[], limit = 200): Promise<AdminReportRow[]> {
  const rows = await query<SummaryRow & { description: string; reporter_name: string }>(
    `SELECT ${SUMMARY_COLUMNS}, r.description, u.name AS reporter_name
       FROM reports r
       JOIN categories c ON c.id = r.category_id
       JOIN users u ON u.id = r.user_id
      WHERE r.status = ANY($1::text[])
      ORDER BY r.created_at DESC
      LIMIT $2`,
    [statuses, Math.min(Math.max(limit, 1), 500)],
  );
  return rows.map((row) => ({
    ...toSummary(row),
    description: row.description,
    reporterName: row.reporter_name,
  }));
}

export async function transitionReport(
  id: string,
  actor: Session,
  to: Status,
  note: string | undefined,
  duplicateOf: string | undefined,
): Promise<{ id: string; status: Status }> {
  if (!isUuid(id)) throw new HttpError(404, "Report not found");

  const result = await withTx(async (client) => {
    const res = await client.query<{ status: Status }>("SELECT status FROM reports WHERE id = $1 FOR UPDATE", [id]);
    const current = res.rows[0]?.status;
    if (!current) throw new HttpError(404, "Report not found");

    if (!TRANSITIONS[current].includes(to)) {
      throw new HttpError(409, `Cannot move a report from "${current}" to "${to}"`);
    }
    if (to === "rejected" && !note) {
      throw new HttpError(400, "A reason is required when rejecting a report");
    }
    if (to === "duplicate") {
      if (!duplicateOf) throw new HttpError(400, "Provide the ID of the original report");
      if (duplicateOf === id) throw new HttpError(400, "A report cannot be a duplicate of itself");
      const original = await client.query("SELECT 1 FROM reports WHERE id = $1", [duplicateOf]);
      if (original.rowCount === 0) throw new HttpError(400, "The original report does not exist");
    }

    await client.query(
      `UPDATE reports SET
         status = $2,
         duplicate_of = CASE WHEN $2 = 'duplicate' THEN $3::uuid ELSE duplicate_of END,
         published_at = CASE WHEN $2 = 'verified' AND published_at IS NULL THEN now() ELSE published_at END,
         resolved_at = CASE WHEN $2 = 'resolved' THEN now() WHEN $2 = 'in_progress' THEN NULL ELSE resolved_at END,
         updated_at = now()
       WHERE id = $1`,
      [id, to, duplicateOf ?? null],
    );
    await insertEvent(client, id, actor.userId, current, to, note ?? null);
    await queueStatusEmail(client, id, current, to, note ?? null);
    return { id, status: to };
  });

  await invalidateReports();
  triggerDrain();
  return result;
}

export interface AuditLogEntry {
  id: string;
  reportId: string;
  reportTitle: string;
  fromStatus: Status | null;
  toStatus: Status;
  note: string | null;
  actorName: string | null;
  createdAt: string;
}

export async function listAuditLogs(limit = 100, offset = 0): Promise<AuditLogEntry[]> {
  const rows = await query<{
    id: string;
    report_id: string;
    title: string;
    from_status: Status | null;
    to_status: Status;
    note: string | null;
    actor_name: string | null;
    created_at: Date;
  }>(
    `SELECT e.id, e.report_id, r.title, e.from_status, e.to_status, e.note, u.name AS actor_name, e.created_at
       FROM report_events e
       JOIN reports r ON r.id = e.report_id
       LEFT JOIN users u ON u.id = e.actor_id
      ORDER BY e.created_at DESC, e.id DESC
      LIMIT $1 OFFSET $2`,
    [Math.min(Math.max(limit, 1), 500), Math.max(offset, 0)],
  );
  return rows.map((r) => ({
    id: String(r.id),
    reportId: r.report_id,
    reportTitle: r.title,
    fromStatus: r.from_status,
    toStatus: r.to_status,
    note: r.note,
    actorName: r.actor_name,
    createdAt: r.created_at.toISOString(),
  }));
}

/* ----------------------------- Media access ----------------------------- */

/** Whether the viewer may fetch this stored file. */
export async function canViewMedia(
  fileName: string,
  viewer: Session | null,
): Promise<{ allowed: boolean; isPublic: boolean }> {
  const [row] = await query<{ status: Status; user_id: string }>(
    `SELECT r.status, r.user_id FROM report_media m JOIN reports r ON r.id = m.report_id WHERE m.path = $1`,
    [fileName],
  );
  if (!row) return { allowed: false, isPublic: false };
  const isPublic = isPublicStatus(row.status);
  const allowed = isPublic || viewer?.role === "admin" || viewer?.userId === row.user_id;
  return { allowed, isPublic };
}

/* ----------------------------- Internals ----------------------------- */

async function insertEvent(
  client: PoolClient,
  reportId: string,
  actorId: string,
  from: Status | null,
  to: Status,
  note: string | null,
): Promise<void> {
  await client.query(
    `INSERT INTO report_events (report_id, actor_id, from_status, to_status, note) VALUES ($1, $2, $3, $4, $5)`,
    [reportId, actorId, from, to, note],
  );
}
