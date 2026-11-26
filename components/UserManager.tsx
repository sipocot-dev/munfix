"use client";

import { useCallback, useEffect, useState } from "react";
import { apiError } from "@/lib/client";
import { formatDate } from "@/lib/format";
import { ROLES, ROLE_DESCRIPTION, ROLE_LABEL, type Role } from "@/lib/permissions";
import type { UserRow } from "@/lib/users";
import { initials } from "./SiteNav";
import Alert from "./ui/Alert";
import { useConfirm, useToast } from "./ui/Feedback";
import FormField from "./ui/FormField";
import Icon from "./ui/Icon";
import Pagination from "./ui/Pagination";
import { Skeleton } from "./ui/Skeleton";
import Spinner from "./ui/Spinner";

interface Cat {
  id: number;
  name: string;
}

const PAGE_SIZE = 50;

function CategoryPicker({ cats, value, onChange }: { cats: Cat[]; value: number[]; onChange: (v: number[]) => void }) {
  return (
    <fieldset>
      <legend className="label">Categories</legend>
      <p className="hint !mt-0 mb-2">None selected means all categories.</p>
      <div className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
        {cats.map((c) => (
          <label key={c.id} className="inline-flex min-h-8 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={value.includes(c.id)}
              onChange={(e) => onChange(e.target.checked ? [...value, c.id] : value.filter((x) => x !== c.id))}
              className="h-4 w-4 accent-ink-700"
            />
            {c.name}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function TempPassword({ email, password, onClose }: { email: string; password: string; onClose: () => void }) {
  const toast = useToast();
  return (
    <div role="alert" className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
      <p className="font-semibold">Temporary password for {email}</p>
      <div className="my-3 flex flex-wrap items-center gap-2">
        <code className="select-all rounded-md border border-amber-200 bg-white px-3 py-2 font-mono text-base">{password}</code>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() =>
            navigator.clipboard.writeText(password).then(
              () => toast("Temporary password copied."),
              () => toast("Could not copy. Select the password instead.", "error"),
            )
          }
        >
          <Icon name="copy" className="h-4 w-4" />
          Copy
        </button>
      </div>
      <p>Shown only once. Give it to the person through a secure channel. They must choose their own password when they first log in.</p>
      <button type="button" onClick={onClose} className="btn btn-secondary btn-sm mt-3">
        I have saved it
      </button>
    </div>
  );
}

export default function UserManager({ categories, selfId }: { categories: Cat[]; selfId: string }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [temp, setTemp] = useState<{ email: string; password: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [newRole, setNewRole] = useState<Role>("moderator");
  const [newCats, setNewCats] = useState<number[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editCats, setEditCats] = useState<number[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const sp = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String((page - 1) * PAGE_SIZE) });
      if (q.trim()) sp.set("q", q.trim());
      if (roleFilter) sp.set("role", roleFilter);
      const res = await fetch(`/api/v1/admin/users?${sp}`);
      if (!res.ok) throw new Error(apiError(await res.json().catch(() => ({}))));
      const data = (await res.json()) as { users: UserRow[]; total: number };
      setUsers(data.users);
      setTotal(data.total);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not load users.");
    } finally {
      setLoading(false);
    }
  }, [q, roleFilter, page]);

  // Debounced so typing in the search box does not fire a request per key.
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  async function patch(u: UserRow, body: Record<string, unknown>, done: string) {
    setError(null);
    setBusy(u.id);
    try {
      const res = await fetch(`/api/v1/admin/users/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setError(apiError(data));
      if (data.temporaryPassword) setTemp({ email: u.email, password: data.temporaryPassword });
      toast(done);
      await load();
    } catch {
      setError("Could not reach the server. Nothing was changed.");
    } finally {
      setBusy(null);
    }
  }

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setBusy("create");
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
      toast("Account created.");
      await load();
    } catch {
      setError("Could not reach the server. Nothing was created.");
    } finally {
      setBusy(null);
    }
  }

  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  return (
    <div>
      {temp && <TempPassword {...temp} onClose={() => setTemp(null)} />}
      {error && (
        <Alert tone="danger" className="mb-4">
          {error}
        </Alert>
      )}

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative sm:w-72">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Search name or email"
            aria-label="Search users"
            className="field !pl-9"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value);
            setPage(1);
          }}
          aria-label="Filter by role"
          className="field sm:w-48"
        >
          <option value="">All roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
        <button type="button" onClick={() => setCreating((v) => !v)} aria-expanded={creating} className="btn btn-primary sm:ml-auto">
          <Icon name={creating ? "x" : "plus"} className="h-4 w-4" />
          {creating ? "Cancel" : "Add staff account"}
        </button>
      </div>

      {creating && (
        <form onSubmit={create} className="card animate-fade-up mb-6 space-y-4 p-5" aria-label="New account">
          <h2 className="text-lg font-semibold">New account</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Full name">
              <input name="name" required minLength={2} maxLength={80} autoComplete="off" className="field" />
            </FormField>
            <FormField label="Email">
              <input name="email" type="email" required autoComplete="off" className="field" />
            </FormField>
          </div>
          <FormField label="Role" hint={ROLE_DESCRIPTION[newRole]}>
            <select value={newRole} onChange={(e) => setNewRole(e.target.value as Role)} className="field sm:max-w-xs">
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </FormField>
          {newRole === "staff" && <CategoryPicker cats={categories} value={newCats} onChange={setNewCats} />}
          <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
            <button type="submit" disabled={busy === "create"} className="btn btn-primary">
              {busy === "create" && <Spinner />}
              {busy === "create" ? "Creating…" : "Create account"}
            </button>
            <p className="text-sm text-slate-600">A one-time temporary password is generated; it is shown once.</p>
          </div>
        </form>
      )}

      <p className="mb-3 text-sm text-slate-600" aria-live="polite">
        {loading ? "Loading…" : total === 0 ? "No accounts match." : `Showing ${from}–${to} of ${total} account${total === 1 ? "" : "s"}`}
      </p>

      {loadError && (
        <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {loadError}
          <button type="button" onClick={load} className="btn btn-secondary btn-sm">
            Try again
          </button>
        </div>
      )}

      {loading && users.length === 0 ? (
        <ul className="space-y-3" aria-hidden>
          {[0, 1, 2].map((i) => (
            <li key={i} className="card flex gap-4 p-4">
              <Skeleton className="h-10 w-10 flex-none rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <ul className={`space-y-3 ${loading ? "opacity-60" : ""}`}>
          {users.map((u) => {
            const self = u.id === selfId;
            return (
              <li key={u.id} className={`card p-4 sm:p-5 ${u.isActive ? "" : "bg-slate-50"}`}>
                <div className="flex flex-wrap items-start gap-4">
                  <span className={`grid h-10 w-10 flex-none place-items-center rounded-full text-sm font-bold ${u.isActive ? "bg-ink-700 text-white" : "bg-slate-300 text-slate-700"}`} aria-hidden>
                    {initials(u.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-semibold text-slate-900">
                      {u.name}
                      {self && <span className="text-xs font-normal text-slate-600">(you)</span>}
                      {!u.isActive && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700">Deactivated</span>}
                      {u.mustChangePassword && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">Temporary password</span>}
                    </p>
                    <p className="break-all text-sm text-slate-700">{u.email}</p>
                    <p className="mt-1 text-xs text-slate-600">
                      Joined {formatDate(u.createdAt)} · {u.lastLoginAt ? `last login ${formatDate(u.lastLoginAt)}` : "never logged in"} · {u.reportCount} report{u.reportCount === 1 ? "" : "s"}
                      {u.providers.length > 0 && ` · ${u.providers.join(", ")}`}
                    </p>
                  </div>
                  <div className="w-full sm:w-48">
                    <label htmlFor={`role-${u.id}`} className="sr-only">
                      Role for {u.name}
                    </label>
                    <select
                      id={`role-${u.id}`}
                      value={u.role}
                      disabled={self || busy === u.id}
                      title={self ? "You cannot change your own role" : undefined}
                      onChange={async (e) => {
                        const role = e.target.value as Role;
                        const ok = await confirm({
                          title: `Make ${u.name} ${ROLE_LABEL[role].toLowerCase()}?`,
                          body: `${ROLE_DESCRIPTION[role]} They will be signed out so the change takes effect at once.`,
                          confirmLabel: "Change role",
                        });
                        if (ok) await patch(u, { role }, `${u.name} is now ${ROLE_LABEL[role].toLowerCase()}.`);
                      }}
                      className="field"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABEL[r]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {u.role === "staff" && (
                  <div className="mt-3 text-sm sm:pl-14">
                    {editing === u.id ? (
                      <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <CategoryPicker cats={categories} value={editCats} onChange={setEditCats} />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            disabled={busy === u.id}
                            onClick={async () => {
                              await patch(u, { categoryIds: editCats }, "Categories saved.");
                              setEditing(null);
                            }}
                          >
                            Save
                          </button>
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-slate-700">
                        <span className="font-semibold">Covers:</span>{" "}
                        {u.categoryIds.length === 0 ? "all categories" : categories.filter((c) => u.categoryIds.includes(c.id)).map((c) => c.name).join(", ")}{" "}
                        <button
                          type="button"
                          className="font-semibold text-ink-700 underline underline-offset-2"
                          onClick={() => {
                            setEditing(u.id);
                            setEditCats(u.categoryIds);
                          }}
                        >
                          Change
                        </button>
                      </p>
                    )}
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3 sm:pl-14">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={busy === u.id}
                    onClick={async () => {
                      const ok = await confirm({
                        title: `Reset the password for ${u.email}?`,
                        body: "They are signed out everywhere and get a temporary password, shown to you once.",
                        confirmLabel: "Reset password",
                      });
                      if (ok) await patch(u, { resetPassword: true }, "Password reset.");
                    }}
                  >
                    Reset password
                  </button>
                  {!self && (
                    <button
                      type="button"
                      className={`btn btn-sm ${u.isActive ? "btn-danger" : "btn-secondary"}`}
                      disabled={busy === u.id}
                      onClick={async () => {
                        if (u.isActive) {
                          const ok = await confirm({
                            title: `Deactivate ${u.name}?`,
                            body: "They are signed out at once and cannot log in until reactivated. Their reports stay.",
                            confirmLabel: "Deactivate",
                            danger: true,
                          });
                          if (!ok) return;
                        }
                        await patch(u, { isActive: !u.isActive }, u.isActive ? `${u.name} was deactivated.` : `${u.name} was reactivated.`);
                      }}
                    >
                      {busy === u.id && <Spinner />}
                      {u.isActive ? "Deactivate" : "Reactivate"}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Pagination
        page={page}
        label={total > 0 ? `Page ${page} of ${Math.max(1, Math.ceil(total / PAGE_SIZE))}` : undefined}
        prev={page > 1 ? { onClick: () => setPage((p) => p - 1) } : null}
        next={page * PAGE_SIZE < total ? { onClick: () => setPage((p) => p + 1) } : null}
      />
    </div>
  );
}
