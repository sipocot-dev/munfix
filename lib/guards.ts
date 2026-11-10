import { notFound, redirect } from "next/navigation";
import type { Role } from "./permissions";
import { getSession, type Session } from "./session";

/**
 * For server-rendered pages. Sends visitors to log in, sends accounts with a temporary
 * password to the change-password screen, and shows a 404 (not a 403) to users whose
 * role does not allow the page, so restricted pages are not discoverable.
 */
export async function requirePageRole(path: string, ...roles: Role[]): Promise<Session> {
  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(path)}`);
  if (session.mustChangePassword) redirect("/account?reason=password");
  if (roles.length > 0 && !roles.includes(session.role)) notFound();
  return session;
}
