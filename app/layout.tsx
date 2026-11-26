import type { Metadata, Viewport } from "next";
import { Public_Sans } from "next/font/google";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import SiteFooter from "@/components/SiteFooter";
import Header from "@/components/Header";
import { FeedbackProvider } from "@/components/ui/Feedback";
import { MUNICIPALITY } from "@/lib/config";

// Self-hosted at build time: no render-blocking request to Google Fonts and no layout shift on load.
const publicSans = Public_Sans({ subsets: ["latin"], variable: "--font-public-sans", display: "swap" });

// Every page reads the session cookie and the database, so nothing is prerendered.
export const dynamic = "force-dynamic";

const description = `Report infrastructure problems in ${MUNICIPALITY.name}, see them on a map, and follow their progress until they are fixed.`;

export const metadata: Metadata = {
  title: {
    default: `MunFix ${MUNICIPALITY.name}`,
    template: `%s · MunFix ${MUNICIPALITY.name}`,
  },
  description,
  applicationName: "MunFix",
  ...(process.env.APP_URL ? { metadataBase: new URL(process.env.APP_URL) } : {}),
  openGraph: { type: "website", siteName: `MunFix ${MUNICIPALITY.name}`, description, locale: "en_PH" },
  twitter: { card: "summary" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#1d3557" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={publicSans.variable}>
      <body className="flex min-h-screen flex-col font-sans">
        <a
          href="#main"
          className="sr-only z-50 rounded-md bg-ink-700 px-4 py-2 font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-3"
        >
          Skip to content
        </a>
        <FeedbackProvider>
          <Header />
          <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
            {children}
          </main>
          <SiteFooter municipality={MUNICIPALITY.name} province={MUNICIPALITY.province} />
        </FeedbackProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
