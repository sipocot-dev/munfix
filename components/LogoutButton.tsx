"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Icon from "./ui/Icon";

export default function LogoutButton({ variant = "button" }: { variant?: "button" | "menu" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    try {
      await fetch("/api/v1/auth/logout", { method: "POST" });
    } finally {
      router.push("/");
      router.refresh();
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={busy}
      className={
        variant === "menu"
          ? "flex h-10 w-full items-center gap-2.5 rounded-md px-3 text-left text-sm font-medium text-fg-muted hover:bg-surface-3 disabled:opacity-60"
          : "btn btn-secondary btn-sm"
      }
    >
      <Icon name="logout" className={variant === "menu" ? "h-4.5 w-4.5 text-fg-muted" : "h-4 w-4"} />
      {busy ? "Logging out…" : "Log out"}
    </button>
  );
}
