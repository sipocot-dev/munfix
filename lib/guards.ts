import { notFound, redirect } from "next/navigation";
import type { Permission } from "./permissions";
import { getSession, type Session } from "./session";

/**
 * For server-rendered pages. Sends visitors to log in, sends accounts with a temporary password to
 * the change-password screen, and shows a 404 (not a 403) to users without any of the given
 * permissions, so restricted pages are not discoverable. With no permissions listed, any signed-in user may open the page.
 */
export async function requirePagePermission(path: string, ...anyOf: Permission[]): Promise<Session> {
  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(path)}`);
  if (session.mustChangePassword) redirect("/account?reason=password");
  if (anyOf.length > 0 && !anyOf.some((p) => session.permissions.includes(p))) notFound();
  return session;
}
