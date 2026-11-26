import AdminNav from "@/components/AdminNav";
import { canOpen, WORKSPACE_AREAS } from "@/lib/permissions";
import { getSession } from "@/lib/session";

/**
 * Frame for the staff workspace. Access control stays in each page (requirePagePermission): a layout does not
 * re-run on client navigation, so it must never be the only guard.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const areas = session ? WORKSPACE_AREAS.filter((a) => canOpen(session.permissions, a.anyOf)) : [];
  return (
    <div className="container-page">
      {session && areas.length > 0 && (
        <div className="mb-6">
          <p className="eyebrow mb-2">Workspace · {session.roleName}</p>
          <AdminNav areas={areas.map((a) => a.href)} />
        </div>
      )}
      {children}
    </div>
  );
}
