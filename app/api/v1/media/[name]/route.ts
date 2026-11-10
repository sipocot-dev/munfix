import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { canViewMedia } from "@/lib/reports";
import { getSession } from "@/lib/session";
import { CONTENT_TYPES, FILE_NAME_RE, readImage } from "@/lib/uploads";

type Ctx = { params: Promise<{ name: string }> };

/** Serves a report photo. Photos of unpublished reports are visible only to the owner and admins. */
export const GET = route<Ctx>(async (_req, { params }) => {
  const { name } = await params;
  if (!FILE_NAME_RE.test(name)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const access = await canViewMedia(name, await getSession());
  if (!access.allowed) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data = await readImage(name);
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": CONTENT_TYPES[name.split(".").pop() ?? ""] ?? "application/octet-stream",
      "Content-Length": String(data.length),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": access.isPublic ? "public, max-age=86400, immutable" : "private, no-store",
    },
  });
});
