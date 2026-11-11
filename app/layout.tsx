import type { Metadata, Viewport } from "next";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import Link from "next/link";
import Header from "@/components/Header";
import { MUNICIPALITY } from "@/lib/config";

// Every page reads the session cookie and the database, so nothing is prerendered.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    default: `MunFix ${MUNICIPALITY.name}`,
    template: `%s · MunFix ${MUNICIPALITY.name}`,
  },
  description: `Report infrastructure problems in ${MUNICIPALITY.name}, see them on a map, and follow their progress until they are fixed.`,
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col font-sans">
        <Header />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-slate-200 bg-white py-6 text-center text-sm text-slate-500">
          <p>MunFix · A community civic reporting platform for {MUNICIPALITY.name}, {MUNICIPALITY.province}</p>
          <p className="mt-2 space-x-4">
            <Link href="/privacy" className="hover:underline">Privacy</Link>
            <Link href="/terms" className="hover:underline">Terms</Link>
            <Link href="/data-deletion" className="hover:underline">Data deletion</Link>
          </p>
        </footer>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
