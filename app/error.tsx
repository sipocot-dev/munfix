"use client";

import Link from "next/link";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="text-3xl font-bold tracking-tight">Something went wrong</h1>
      <p className="mt-2 text-slate-600">
        We could not load this page. This is usually temporary. Please try again in a moment.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <button onClick={reset} className="btn btn-primary">
          Try again
        </button>
        <Link href="/" className="btn btn-secondary">
          Back to the map
        </Link>
      </div>
      {error.digest && <p className="mt-6 text-xs text-slate-400">Reference: {error.digest}</p>}
    </div>
  );
}
