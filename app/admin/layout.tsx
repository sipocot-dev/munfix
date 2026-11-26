import AdminNav from "@/components/AdminNav";
import { isStaffRole, ROLE_LABEL } from "@/lib/permissions";
import { getSession } from "@/lib/session";

/**
 * Frame for the staff workspace. Access control stays in each page (requirePageRole): a layout does not
 * re-run on client navigation, so it must never be the only guard.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const staff = session && isStaffRole(session.role) && !session.mustChangePassword;
  return (
    <div className="container-page">
      {staff && (
        <div className="mb-6">
          <p className="eyebrow mb-2">Workspace · {ROLE_LABEL[session.role]}</p>
          <AdminNav role={session.role} />
        </div>
      )}
      {children}
    </div>
  );
}
