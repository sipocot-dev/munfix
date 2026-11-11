"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** The home page is a full-screen map, so it has no footer. */
export default function SiteFooter({ municipality, province }: { municipality: string; province: string }) {
  if (usePathname() === "/") return null;
  return (
    <footer className="border-t border-slate-200 bg-white py-6 text-center text-sm text-slate-500">
      <p>
        MunFix · A community civic reporting platform for {municipality}, {province}
      </p>
      <p className="mt-2 space-x-4">
        <Link href="/privacy" className="hover:underline">Privacy</Link>
        <Link href="/terms" className="hover:underline">Terms</Link>
        <Link href="/data-deletion" className="hover:underline">Data deletion</Link>
      </p>
    </footer>
  );
}
