"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LogoutButton() {
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
    <button onClick={logout} disabled={busy} className="btn btn-secondary !py-1.5">
      Log out
    </button>
  );
}
