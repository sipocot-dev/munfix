"use client";

import { useEffect, useState } from "react";
import { useToast } from "./ui/Feedback";
import Icon from "./ui/Icon";

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
  const toast = useToast();
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
      toast("Link copied.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast("This browser could not copy. Select the link instead.", "error");
    }
  }

  async function native() {
    // Cancelling the device share sheet is not an error.
    await navigator.share({ title: text, url }).catch(() => {});
  }

  return (
    <section className="card space-y-4 p-5" aria-labelledby="share-title">
      <div>
        <h2 id="share-title" className="flex items-center gap-2 text-lg font-semibold">
          <Icon name="share" className="h-4.5 w-4.5 text-fg-muted" />
          Share this report
        </h2>
        <p className="mt-0.5 text-sm text-fg-muted">Send it to people who can help get it fixed.</p>
      </div>

      <ul className="grid grid-cols-4 gap-2">
        {TARGETS.map((t) => (
          <li key={t.name}>
            <a
              href={url ? t.href(text, url) : undefined}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Share on ${t.name}`}
              className="group flex flex-col items-center gap-1.5 rounded-lg p-2 text-xs font-medium text-fg-muted transition hover:bg-surface-2"
            >
              <span
                className="grid h-11 w-11 place-items-center rounded-full text-base font-bold text-white transition group-hover:brightness-110"
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
        <button type="button" onClick={native} className="btn btn-secondary btn-sm w-full">
          More ways to share…
        </button>
      )}

      <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-2 p-1.5 pl-3">
        <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label="Report link" className="min-w-0 flex-1 bg-transparent font-mono text-xs text-fg-muted outline-none" />
        <button
          type="button"
          onClick={copy}
          disabled={!url}
          className={`btn btn-sm ${copied ? "bg-green-700 text-white" : "btn-secondary"}`}
        >
          <Icon name={copied ? "check" : "copy"} className="h-4 w-4" />
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>
    </section>
  );
}
