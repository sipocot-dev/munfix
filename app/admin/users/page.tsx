import type { Metadata } from "next";
import UserManager from "@/components/UserManager";
import PageHeader from "@/components/ui/PageHeader";
import { requirePagePermission } from "@/lib/guards";
import { listCategories } from "@/lib/reports";
import { listRoles } from "@/lib/roles";

export const metadata: Metadata = { title: "Users & roles" };

export default async function UsersPage() {
  const session = await requirePagePermission("/admin/users", "users.manage");
  const [categories, roles] = await Promise.all([listCategories(), listRoles()]);
  return (
    <>
      <PageHeader
        title="Users & roles"
        description="Create staff accounts, change roles, limit field staff to categories, and deactivate accounts. Role and access changes sign the person out at once."
      />
      <UserManager categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        roles={roles}
        selfId={session.userId} />
    </>
  );
}
