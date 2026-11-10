import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { HttpError } from "./errors";
import { getSession, type Session } from "./session";

/** Wraps a route handler with uniform error handling. */
export function route<C = unknown>(fn: (req: NextRequest, ctx: C) => Promise<Response>) {
  return async (req: NextRequest, ctx: C): Promise<Response> => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      if (err instanceof HttpError) {
        return NextResponse.json({ error: err.message, ...err.extra }, { status: err.status, headers: err.headers });
      }
      if (err instanceof ZodError) {
        return NextResponse.json(
          {
            error: "Invalid input",
            issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
          },
          { status: 400 },
        );
      }
      console.error("[api]", err);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  };
}

export async function requireUser(): Promise<Session> {
  const session = await getSession();
  if (!session) throw new HttpError(401, "Authentication required");
  return session;
}

export async function requireAdmin(): Promise<Session> {
  const session = await requireUser();
  if (session.role !== "admin") throw new HttpError(403, "Forbidden");
  return session;
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, "Request body must be valid JSON");
  }
}
