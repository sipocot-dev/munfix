import { NextResponse } from "next/server";
import { readJson, requireUser, route } from "@/lib/api";
import { HttpError } from "@/lib/errors";
import { getReportDetail, updateOwnReport, withdrawReport } from "@/lib/reports";
import { getSession } from "@/lib/session";
import { reportEditSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const report = await getReportDetail(id, await getSession());
  if (!report) throw new HttpError(404, "Report not found");
  return NextResponse.json({ report });
});

/** Owner edit — allowed only while the report is still "submitted". */
export const PATCH = route<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const session = await requireUser();
  const edit = reportEditSchema.parse(await readJson(req));
  await updateOwnReport(id, session.userId, edit);
  return NextResponse.json({ ok: true });
});

/** Owner withdraw — allowed while the report is submitted or under review. */
export const DELETE = route<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const session = await requireUser();
  await withdrawReport(id, session.userId);
  return NextResponse.json({ ok: true });
});
