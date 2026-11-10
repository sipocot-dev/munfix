import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { listCategories, listProblemTypes } from "@/lib/reports";

export const GET = route(async () => {
  const [categories, problemTypes] = await Promise.all([listCategories(), listProblemTypes()]);
  return NextResponse.json({ categories, problemTypes });
});
