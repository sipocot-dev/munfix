"use client";

import Link from "next/link";
import Icon from "@/components/ui/Icon";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="container-page container-narrow grid min-h-[60vh] place-items-center text-center">
      <div>
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-warning-soft text-warning">
          <Icon name="alert" className="h-7 w-7" />
        </span>
        <h1 className="mt-5 text-2xl font-bold tracking-tight sm:text-3xl">Something went wrong</h1>
        <p className="mx-auto mt-2 max-w-md text-fg-muted">We could not load this page. This is usually temporary; please try again in a moment.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={reset} className="btn btn-primary">
            <Icon name="refresh" className="h-4 w-4" />
            Try again
          </button>
          <Link href="/" className="btn btn-secondary">
            Back to the map
          </Link>
        </div>
        {error.digest && (
          <p className="mt-6 text-xs text-fg-muted">
            If you contact support, quote this reference: <span className="font-mono">{error.digest}</span>
          </p>
        )}
      </div>
    </div>
  );
}
