import type { Metadata } from "next";
import AdminNav from "@/components/AdminNav";
import UserManager from "@/components/UserManager";
import { requirePageRole } from "@/lib/guards";
import { listCategories } from "@/lib/reports";

export const metadata: Metadata = { title: "Users" };

export default async function UsersPage() {
  const session = await requirePageRole("/admin/users", "admin");
  const categories = await listCategories();
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-3xl font-bold tracking-tight">Users &amp; roles</h1>
      <p className="mt-2 mb-4 text-slate-600">Create staff accounts, change roles, limit field staff to categories, and deactivate accounts. Changes sign the person out immediately.</p>
      <AdminNav role={session.role} current="/admin/users" />
      <UserManager categories={categories.map((c) => ({ id: c.id, name: c.name }))} selfId={session.userId} />
    </div>
  );
}
