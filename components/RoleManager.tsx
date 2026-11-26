"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiError } from "@/lib/client";
import { CRITICAL_PERMISSIONS, PERMISSIONS, type Permission } from "@/lib/permissions";
import type { RoleRow } from "@/lib/roles";
import Alert from "./ui/Alert";
import { useConfirm, useToast } from "./ui/Feedback";
import FormField from "./ui/FormField";
import Icon from "./ui/Icon";
import Spinner from "./ui/Spinner";

const GROUPS: { title: string; permissions: Permission[] }[] = [
  { title: "Reports", permissions: ["reports.review", "reports.view_private", "reports.view_reporter", "reports.work"] },
  { title: "Oversight", permissions: ["stats.view", "audit.view", "system.view"] },
  { title: "Access control", permissions: ["users.manage", "roles.manage"] },
];

type Draft = { name: string; description: string; permissions: Permission[] };

/**
 * Roles and their permissions. Mirrors the server's rules so people see why something is unavailable; the
 * API enforces them regardless (lib/roles.ts): built-in roles are fixed, your own role is locked, and no
 * role can be given a permission you do not have.
 */
export default function RoleManager({ roles, myRole, myPermissions }: { roles: RoleRow[]; myRole: string; myPermissions: Permission[] }) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(key: string | "new", draft: Draft) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(key === "new" ? "/api/v1/admin/roles" : `/api/v1/admin/roles/${key}`, {
        method: key === "new" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!res.ok) return setError(apiError(await res.json().catch(() => ({}))));
      toast(key === "new" ? `Role “${draft.name}” created.` : `Role “${draft.name}” saved.`);
      setEditing(null);
      router.refresh();
    } catch {
      setError("Could not reach the server. Nothing was changed.");
    } finally {
      setBusy(false);
    }
  }

  async function setActive(role: RoleRow, isActive: boolean) {
    if (!isActive) {
      const ok = await confirm({
        title: `Disable “${role.name}”?`,
        body:
          role.userCount > 0
            ? `${role.userCount} account${role.userCount === 1 ? "" : "s"} with this role lose its permissions at once and can then only use MunFix as residents. You can enable it again later.`
            : "Nobody has this role yet. It cannot be assigned while disabled.",
        confirmLabel: "Disable role",
        danger: true,
      });
      if (!ok) return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/admin/roles/${role.key}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) return setError(apiError(await res.json().catch(() => ({}))));
      toast(isActive ? `“${role.name}” is enabled.` : `“${role.name}” is disabled.`);
      router.refresh();
    } catch {
      setError("Could not reach the server. Nothing was changed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {error && <Alert tone="danger">{error}</Alert>}

      {editing === "new" ? (
        <RoleForm
          title="New role"
          initial={{ name: "", description: "", permissions: [] }}
          myPermissions={myPermissions}
          busy={busy}
          onCancel={() => setEditing(null)}
          onSave={(d) => save("new", d)}
          submitLabel="Create role"
        />
      ) : (
        <button type="button" onClick={() => setEditing("new")} className="btn btn-primary">
          <Icon name="plus" className="h-4 w-4" />
          New role
        </button>
      )}

      <ul className="space-y-3">
        {roles.map((role) => {
          const own = role.key === myRole;
          const outOfReach = role.permissions.some((p) => !myPermissions.includes(p));
          const locked = role.isSystem || own || outOfReach;
          if (editing === role.key) {
            return (
              <li key={role.key}>
                <RoleForm
                  title={`Edit “${role.name}”`}
                  initial={{ name: role.name, description: role.description, permissions: role.permissions }}
                  myPermissions={myPermissions}
                  busy={busy}
                  onCancel={() => setEditing(null)}
                  onSave={(d) => save(role.key, d)}
                  submitLabel="Save role"
                />
              </li>
            );
          }
          return (
            <li key={role.key} className={`card p-4 sm:p-5 ${role.isActive ? "" : "bg-surface-2"}`} aria-label={role.name}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="flex flex-wrap items-center gap-2 text-lg font-semibold text-fg">
                    {role.name}
                    {role.isSystem && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent-strong">Built-in</span>}
                    {!role.isActive && <span className="rounded-full bg-surface-3 px-2 py-0.5 text-xs font-semibold text-fg-muted">Disabled</span>}
                    {own && <span className="text-xs font-normal text-fg-muted">(your role)</span>}
                  </h2>
                  {role.description && <p className="mt-0.5 text-sm text-fg-muted">{role.description}</p>}
                  <p className="mt-1 text-sm text-fg-muted">
                    {role.userCount} account{role.userCount === 1 ? "" : "s"}
                  </p>
                </div>
                {!locked && (
                  <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={busy} onClick={() => setEditing(role.key)} className="btn btn-secondary btn-sm">
                      <Icon name="edit" className="h-4 w-4" />
                      Edit
                    </button>
                    <button type="button" disabled={busy} onClick={() => setActive(role, !role.isActive)} className={`btn btn-sm ${role.isActive ? "btn-danger" : "btn-secondary"}`}>
                      {role.isActive ? "Disable" : "Enable"}
                    </button>
                  </div>
                )}
              </div>
              <PermissionSummary permissions={role.permissions} />
              {locked && !role.isSystem && (
                <p className="mt-3 text-sm text-fg-muted">
                  {own ? "You cannot change the role you hold; another administrator can." : "This role has permissions you do not have, so you cannot change it."}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function PermissionSummary({ permissions }: { permissions: Permission[] }) {
  if (permissions.length === 0) return <p className="mt-3 text-sm text-fg-muted">No staff permissions: uses MunFix as a resident.</p>;
  return (
    <ul className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
      {permissions.map((p) => (
        <li key={p} className="flex gap-2 text-fg">
          <Icon name="check" className="mt-0.5 h-4 w-4 flex-none text-success" />
          {PERMISSIONS[p]}
        </li>
      ))}
    </ul>
  );
}

function RoleForm({
  title,
  initial,
  myPermissions,
  busy,
  onCancel,
  onSave,
  submitLabel,
}: {
  title: string;
  initial: Draft;
  myPermissions: Permission[];
  busy: boolean;
  onCancel: () => void;
  onSave: (d: Draft) => void;
  submitLabel: string;
}) {
  const [draft, setDraft] = useState(initial);
  const toggle = (p: Permission, on: boolean) => setDraft((d) => ({ ...d, permissions: on ? [...d.permissions, p] : d.permissions.filter((x) => x !== p) }));
  const grantsAccessControl = draft.permissions.some((p) => CRITICAL_PERMISSIONS.includes(p));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ ...draft, name: draft.name.trim(), description: draft.description.trim() });
      }}
      className="card animate-fade-up space-y-5 p-5"
      aria-label={title}
    >
      <h2 className="text-lg font-semibold text-fg">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Name" hint="Shown to the people who hold it, for example “Barangay inspector”.">
          <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required minLength={2} maxLength={60} className="field" />
        </FormField>
        <FormField label="Description" optional>
          <input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} maxLength={300} className="field" />
        </FormField>
      </div>
      {GROUPS.map((g) => (
        <fieldset key={g.title}>
          <legend className="label">{g.title}</legend>
          <div className="mt-2 space-y-2">
            {g.permissions.map((p) => {
              const unavailable = !myPermissions.includes(p);
              return (
                <label key={p} className={`flex gap-3 text-sm ${unavailable ? "cursor-not-allowed text-fg-subtle" : "cursor-pointer text-fg"}`}>
                  <input
                    type="checkbox"
                    checked={draft.permissions.includes(p)}
                    disabled={unavailable}
                    onChange={(e) => toggle(p, e.target.checked)}
                    className="mt-0.5 h-4 w-4 flex-none accent-primary"
                  />
                  <span>
                    {PERMISSIONS[p]}
                    {unavailable && <span className="block text-xs">Your own role does not have this permission.</span>}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}
      {grantsAccessControl && (
        <Alert tone="warning" live={false} title="This role controls access">
          People with it can change other accounts or roles, within the limits of their own permissions.
        </Alert>
      )}
      <div className="flex flex-wrap gap-2 border-t border-line pt-4">
        <button type="submit" disabled={busy} className="btn btn-primary">
          {busy && <Spinner />}
          {busy ? "Saving…" : submitLabel}
        </button>
        <button type="button" onClick={onCancel} className="btn btn-ghost">
          Cancel
        </button>
      </div>
    </form>
  );
}
