"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "./ui/Logo";

/** The home page is a full-screen map, so it has no footer; its sidebar carries the legal links instead. */
export default function SiteFooter({ municipality, province }: { municipality: string; province: string }) {
  if (usePathname() === "/") return null;
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2.5">
            <Logo className="h-8 w-8" />
            <span className="font-bold text-slate-900">MunFix {municipality}</span>
          </div>
          <p className="mt-3 max-w-sm text-sm text-slate-600">
            A community civic reporting platform for {municipality}, {province}. Report problems, see them on the map, and follow them until they are fixed.
          </p>
          <p className="mt-3 text-sm text-slate-600">
            Not for emergencies. In an emergency, call your local emergency hotline.
          </p>
        </div>
        <FooterLinks
          title="Use MunFix"
          links={[
            ["/", "Map of reports"],
            ["/report/new", "Report an issue"],
            ["/me", "My reports"],
            ["/about", "How it works"],
          ]}
        />
        <FooterLinks
          title="Your data"
          links={[
            ["/privacy", "Privacy policy"],
            ["/terms", "Terms of use"],
            ["/data-deletion", "Data deletion"],
            ["/account", "Account settings"],
          ]}
        />
      </div>
    </footer>
  );
}

function FooterLinks({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <nav aria-label={title}>
      <p className="eyebrow">{title}</p>
      <ul className="mt-3 space-y-2 text-sm">
        {links.map(([href, label]) => (
          <li key={href}>
            <Link href={href} className="text-slate-700 hover:text-ink-700 hover:underline">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
