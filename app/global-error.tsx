"use client";

// Last-resort boundary for errors in the root layout itself; it replaces the whole document.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", textAlign: "center", padding: "6rem 1rem", color: "#0f172a" }}>
        <h1 style={{ fontSize: "1.75rem" }}>Something went wrong</h1>
        <p style={{ color: "#475569" }}>We could not load MunFix. Please try again in a moment.</p>
        <button
          onClick={reset}
          style={{ marginTop: "1rem", padding: "0.6rem 1.2rem", borderRadius: 8, border: 0, background: "#0f766e", color: "white", fontWeight: 600 }}
        >
          Try again
        </button>
        {error.digest && <p style={{ marginTop: "1.5rem", fontSize: 12, color: "#94a3b8" }}>Reference: {error.digest}</p>}
      </body>
    </html>
  );
}
