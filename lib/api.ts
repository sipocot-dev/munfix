import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { ZodError } from "zod";
import { HttpError } from "./errors";
import { logger } from "./logger";
import type { Role } from "./permissions";
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
      // The request id goes back to the caller so a support report can be matched to this log line.
      const requestId = req.headers.get("x-request-id") ?? randomUUID();
      logger.error("unhandled error", { requestId, method: req.method, path: new URL(req.url).pathname, err });
      return NextResponse.json({ error: "Internal server error", requestId }, { status: 500, headers: { "x-request-id": requestId } });
    }
  };
}

/**
 * Requires a signed-in user. Accounts holding a temporary password are blocked from
 * everything except changing it (pass allowPasswordChange for that one route).
 */
export async function requireUser(opts: { allowPasswordChange?: boolean } = {}): Promise<Session> {
  const session = await getSession();
  if (!session) throw new HttpError(401, "Authentication required");
  if (session.mustChangePassword && !opts.allowPasswordChange) {
    throw new HttpError(403, "You must choose a new password before continuing", { code: "password_change_required" });
  }
  return session;
}

export async function requireRole(...roles: Role[]): Promise<Session> {
  const session = await requireUser();
  if (!roles.includes(session.role)) throw new HttpError(403, "Forbidden");
  return session;
}

export const requireAdmin = () => requireRole("admin");
/** Moderators, field staff and administrators. */
export const requireStaff = () => requireRole("moderator", "staff", "admin");

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, "Request body must be valid JSON");
  }
}
