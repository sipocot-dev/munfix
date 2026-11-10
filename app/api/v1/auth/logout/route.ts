import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { destroySession } from "@/lib/session";

export const POST = route(async () => {
  await destroySession();
  return NextResponse.json({ ok: true });
});
