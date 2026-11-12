"use client";

import { useEffect, useState } from "react";

const SITE = "MunFix Sipocot";

type Target = { name: string; mark: string; color: string; href: (text: string, url: string) => string };

// Each target opens its own share dialog in a new tab. Nothing is sent to a server from here.
const TARGETS: Target[] = [
  { name: "Facebook", mark: "f", color: "#1877F2", href: (_t, u) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(u)}` },
  { name: "X", mark: "X", color: "#0f172a", href: (t, u) => `https://x.com/intent/post?text=${encodeURIComponent(t)}&url=${encodeURIComponent(u)}` },
  { name: "WhatsApp", mark: "W", color: "#25D366", href: (t, u) => `https://wa.me/?text=${encodeURIComponent(`${t} ${u}`)}` },
  { name: "Email", mark: "@", color: "#475569", href: (t, u) => `mailto:?subject=${encodeURIComponent(t)}&body=${encodeURIComponent(u)}` },
];

/** Share a report to social apps, email, the device share sheet, or copy the link. */
export default function ShareReport({ title }: { title: string }) {
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [canNative, setCanNative] = useState(false);
  const text = `${title} · ${SITE}`;

  useEffect(() => {
    setUrl(window.location.href);
    setCanNative(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  async function native() {
    // Cancelling the device share sheet is not an error.
    await navigator.share({ title: text, url }).catch(() => {});
  }

  return (
    <section className="card space-y-4 p-5">
      <div>
        <h2 className="text-lg font-semibold">Share this report</h2>
        <p className="text-sm text-slate-500">Send it to people who can help get it fixed.</p>
      </div>

      <ul className="grid grid-cols-4 gap-2">
        {TARGETS.map((t) => (
          <li key={t.name}>
            <a
              href={url ? t.href(text, url) : undefined}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Share on ${t.name}`}
              className="group flex flex-col items-center gap-1.5 rounded-xl p-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-700"
            >
              <span
                className="grid h-11 w-11 place-items-center rounded-full text-base font-bold text-white shadow-sm transition duration-200 group-hover:-translate-y-0.5 group-hover:scale-105"
                style={{ backgroundColor: t.color }}
                aria-hidden
              >
                {t.mark}
              </span>
              {t.name}
            </a>
          </li>
        ))}
      </ul>

      {canNative && (
        <button type="button" onClick={native} className="btn btn-secondary w-full text-sm">
          More ways to share…
        </button>
      )}

      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1.5 pl-3">
        <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label="Report link" className="min-w-0 flex-1 bg-transparent font-mono text-xs text-slate-600 outline-none" />
        <button
          type="button"
          onClick={copy}
          disabled={!url}
          className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${copied ? "bg-emerald-600 text-white" : "bg-white text-slate-800 shadow-sm hover:bg-slate-100"}`}
        >
          {copied ? "Copied ✓" : "Copy link"}
        </button>
      </div>
    </section>
  );
}
