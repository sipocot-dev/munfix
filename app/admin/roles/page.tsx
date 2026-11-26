import type { Metadata } from "next";
import RoleManager from "@/components/RoleManager";
import PageHeader from "@/components/ui/PageHeader";
import { requirePagePermission } from "@/lib/guards";
import { listRoles } from "@/lib/roles";

export const metadata: Metadata = { title: "Roles" };

export default async function RolesPage() {
  const session = await requirePagePermission("/admin/roles", "roles.manage");
  const roles = await listRoles();
  return (
    <>
      <PageHeader
        title="Roles and permissions"
        description="A role is a set of permissions. The four built-in roles are fixed; create custom roles for other combinations. Changes apply to everyone with the role on their next click. Assign roles on the Users page."
      />
      <RoleManager roles={roles} myRole={session.role} myPermissions={session.permissions} />
    </>
  );
}
