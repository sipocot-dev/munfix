"use client";

import { useState } from "react";

/** Coordinates, copy and open-in-maps actions. Sharing lives in ShareReport. */
export default function LocationCard({ lat, lng, address }: { lat: number; lng: number; address: string | null }) {
  const [message, setMessage] = useState<string | null>(null);
  const gps = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

  async function copy(text: string, done: string) {
    try {
      await navigator.clipboard.writeText(text);
      setMessage(done);
    } catch {
      setMessage("Could not copy on this browser.");
    }
  }

  return (
    <section className="card space-y-3 p-5">
      <h2 className="text-lg font-semibold">Location</h2>
      {address && <p className="text-sm text-slate-700">{address}</p>}
      <p className="font-mono text-sm text-slate-600">{gps}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => copy(gps, "GPS copied")} className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200">
          Copy GPS
        </button>
        <a
          href={`https://www.google.com/maps?q=${lat},${lng}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
        >
          Open in Maps
        </a>
      </div>
      <p role="status" className="min-h-5 text-xs text-slate-500">
        {message}
      </p>
    </section>
  );
}
