import { NextResponse } from "next/server";
import { requireUser, route } from "@/lib/api";
import { withinBounds } from "@/lib/config";
import { HttpError } from "@/lib/errors";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createReport, listPublicReports } from "@/lib/reports";
import { invalidateReports } from "@/lib/cache";
import { isStatus, type Status } from "@/lib/status";
import { deleteImages, saveImages } from "@/lib/uploads";
import { parseBbox, reportSchema } from "@/lib/validation";

/** Public: published reports, optionally filtered by bbox, status and category. */
export const GET = route(async (req) => {
  const sp = req.nextUrl.searchParams;
  const statuses = (sp.get("status") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(isStatus) as Status[];

  const reports = await listPublicReports({
    bbox: parseBbox(sp.get("bbox")),
    statuses,
    category: sp.get("category") ?? undefined,
    limit: Number(sp.get("limit")) || undefined,
  });
  return NextResponse.json({ reports });
});

/**
 * Authenticated: submit a report. Accepts multipart/form-data (fields plus up
 * to 3 `photos` files) or plain JSON when there are no photos.
 */
export const POST = route(async (req) => {
  const session = await requireUser();
  await enforceRateLimit(`report:${session.userId}`, 10, 3600);

  let raw: Record<string, unknown>;
  let files: File[] = [];

  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    raw = Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string"));
    files = form.getAll("photos").filter((v): v is File => typeof v !== "string" && v.size > 0);
  } else {
    try {
      raw = await req.json();
    } catch {
      throw new HttpError(400, "Request body must be valid JSON or multipart form data");
    }
  }

  const input = reportSchema.parse(raw);
  if (!withinBounds(input.lng, input.lat)) {
    throw new HttpError(400, "The selected location is outside Iligan City");
  }

  const stored = await saveImages(files);
  try {
    const id = await createReport(session.userId, input, stored);
    await invalidateReports();
    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    await deleteImages(stored);
    throw err;
  }
});
