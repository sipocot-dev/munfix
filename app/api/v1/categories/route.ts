import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { listCategories } from "@/lib/reports";

export const GET = route(async () => {
  return NextResponse.json({ categories: await listCategories() });
});
