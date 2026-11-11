"use client";

import { useCallback, useEffect, useState } from "react";
import { apiError } from "@/lib/client";
import { formatDate } from "@/lib/format";
import { ROLES, ROLE_DESCRIPTION, ROLE_LABEL, type Role } from "@/lib/permissions";
import type { UserRow } from "@/lib/users";

interface Cat {
  id: number;
  name: string;
}

function CategoryPicker({ cats, value, onChange }: { cats: Cat[]; value: number[]; onChange: (v: number[]) => void }) {
  return (
    <fieldset className="text-sm">
      <legend className="font-medium">Categories (none selected = all)</legend>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
        {cats.map((c) => (
          <label key={c.id} className="inline-flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={value.includes(c.id)}
              onChange={(e) => onChange(e.target.checked ? [...value, c.id] : value.filter((x) => x !== c.id))}
            />
            {c.name}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function TempPassword({ email, password, onClose }: { email: string; password: string; onClose: () => void }) {
  return (
    <div role="alert" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
      <p className="font-semibold">Temporary password for {email}</p>
      <code className="my-2 block select-all rounded bg-white px-3 py-2 text-base">{password}</code>
      <p>Shown only once. Give it to the person through a secure channel; they must choose a new password at first login.</p>
      <button type="button" onClick={onClose} className="btn btn-secondary mt-3 !py-1">I have saved it</button>
    </div>
  );
}

export default function UserManager({ categories, selfId }: { categories: Cat[]; selfId: string }) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [temp, setTemp] = useState<{ email: string; password: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [newRole, setNewRole] = useState<Role>("moderator");
  const [newCats, setNewCats] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editCats, setEditCats] = useState<number[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const sp = new URLSearchParams();
      if (q.trim()) sp.set("q", q.trim());
      if (roleFilter) sp.set("role", roleFilter);
      const res = await fetch(`/api/v1/admin/users?${sp}`);
      if (!res.ok) throw new Error(apiError(await res.json().catch(() => ({}))));
      const data = (await res.json()) as { users: UserRow[]; total: number };
      setUsers(data.users);
      setTotal(data.total);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load users.");
    } finally {
      setLoading(false);
    }
  }, [q, roleFilter]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  async function patch(id: string, body: Record<string, unknown>, email: string) {
    setError(null);
    const res = await fetch(`/api/v1/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setError(apiError(data));
    if (data.temporaryPassword) setTemp({ email, password: data.temporaryPassword });
    await load();
  }

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: f.get("name"), email: f.get("email"), role: newRole, categoryIds: newRole === "staff" ? newCats : undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setError(apiError(data));
      setTemp({ email: String(f.get("email")), password: data.temporaryPassword });
      form.reset();
      setCreating(false);
      setNewCats([]);
      await load();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {temp && <TempPassword {...temp} onClose={() => setTemp(null)} />}
      {error && <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or email" aria-label="Search users" className="field max-w-xs" />
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} aria-label="Filter by role" className="field w-auto">
          <option value="">All roles</option>
          {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
        </select>
        <span className="text-sm text-slate-500">{loading ? "Loading…" : `${total} account${total === 1 ? "" : "s"}`}</span>
        <button type="button" onClick={() => setCreating((v) => !v)} className="btn btn-primary ml-auto !py-1.5">
          {creating ? "Cancel" : "Add staff account"}
        </button>
      </div>

      {creating && (
        <form onSubmit={create} className="card mb-6 space-y-3 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium">Full name<input name="name" required minLength={2} maxLength={80} className="field mt-1" /></label>
            <label className="block text-sm font-medium">Email<input name="email" type="email" required className="field mt-1" /></label>
          </div>
          <label className="block text-sm font-medium">
            Role
            <select value={newRole} onChange={(e) => setNewRole(e.target.value as Role)} className="field mt-1">
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </select>
            <span className="mt-1 block text-xs font-normal text-slate-500">{ROLE_DESCRIPTION[newRole]}</span>
          </label>
          {newRole === "staff" && <CategoryPicker cats={categories} value={newCats} onChange={setNewCats} />}
          <button type="submit" disabled={busy} className="btn btn-primary">{busy ? "Creating…" : "Create account"}</button>
          <p className="text-xs text-slate-500">A one-time temporary password is generated. The person must change it at first login.</p>
        </form>
      )}

      <ul className="space-y-3">
        {users.map((u) => {
          const self = u.id === selfId;
          return (
            <li key={u.id} className={`card p-4 ${u.isActive ? "" : "opacity-70"}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    {u.name} {self && <span className="text-xs font-normal text-slate-500">(you)</span>}
                    {!u.isActive && <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-xs">Deactivated</span>}
                    {u.mustChangePassword && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900">Temp password</span>}
                  </p>
                  <p className="text-sm text-slate-600">{u.email}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Joined {formatDate(u.createdAt)} · {u.lastLoginAt ? `last login ${formatDate(u.lastLoginAt)}` : "never logged in"} · {u.reportCount} report{u.reportCount === 1 ? "" : "s"}
                    {u.providers.length > 0 && ` · ${u.providers.join(", ")}`}
                  </p>
                </div>
                <label className="text-sm">
                  <span className="sr-only">Role for {u.name}</span>
                  <select
                    value={u.role}
                    disabled={self}
                    title={self ? "You cannot change your own role" : undefined}
                    onChange={(e) => patch(u.id, { role: e.target.value }, u.email)}
                    className="field w-auto"
                  >
                    {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                  </select>
                </label>
              </div>

              {u.role === "staff" && (
                <div className="mt-3 text-sm">
                  {editing === u.id ? (
                    <div className="space-y-2">
                      <CategoryPicker cats={categories} value={editCats} onChange={setEditCats} />
                      <div className="flex gap-2">
                        <button type="button" className="btn btn-primary !py-1" onClick={async () => { await patch(u.id, { categoryIds: editCats }, u.email); setEditing(null); }}>Save</button>
                        <button type="button" className="btn btn-secondary !py-1" onClick={() => setEditing(null)}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-slate-600">
                      Scope: {u.categoryIds.length === 0 ? "all categories" : categories.filter((c) => u.categoryIds.includes(c.id)).map((c) => c.name).join(", ")}{" "}
                      <button type="button" className="font-semibold text-ink-700 hover:underline" onClick={() => { setEditing(u.id); setEditCats(u.categoryIds); }}>Edit</button>
                    </p>
                  )}
                </div>
              )}

              <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  className="btn btn-secondary !py-1"
                  onClick={() => confirm(`Reset the password for ${u.email}? They will be signed out and given a temporary password.`) && patch(u.id, { resetPassword: true }, u.email)}
                >
                  Reset password
                </button>
                {!self && (
                  <button
                    type="button"
                    className={`btn !py-1 ${u.isActive ? "btn-danger" : "btn-secondary"}`}
                    onClick={() => (u.isActive ? confirm(`Deactivate ${u.email}? They will be signed out.`) : true) && patch(u.id, { isActive: !u.isActive }, u.email)}
                  >
                    {u.isActive ? "Deactivate" : "Reactivate"}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
