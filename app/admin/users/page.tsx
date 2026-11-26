import type { Metadata } from "next";
import UserManager from "@/components/UserManager";
import PageHeader from "@/components/ui/PageHeader";
import { requirePageRole } from "@/lib/guards";
import { listCategories } from "@/lib/reports";

export const metadata: Metadata = { title: "Users & roles" };

export default async function UsersPage() {
  const session = await requirePageRole("/admin/users", "admin");
  const categories = await listCategories();
  return (
    <>
      <PageHeader
        title="Users & roles"
        description="Create staff accounts, change roles, limit field staff to categories, and deactivate accounts. Role and access changes sign the person out at once."
      />
      <UserManager categories={categories.map((c) => ({ id: c.id, name: c.name }))} selfId={session.userId} />
    </>
  );
}
