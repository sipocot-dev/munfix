"use client";

import { useToast } from "./ui/Feedback";
import Icon from "./ui/Icon";

/** Coordinates, copy and open-in-maps actions. Sharing lives in ShareReport. */
export default function LocationCard({ lat, lng, address }: { lat: number; lng: number; address: string | null }) {
  const toast = useToast();
  const gps = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(gps);
      toast("Coordinates copied.");
    } catch {
      toast("This browser could not copy. Select the coordinates instead.", "error");
    }
  }

  return (
    <section className="card p-4" aria-label="Location">
      {address && <p className="text-sm font-medium text-slate-800">{address}</p>}
      <p className="select-all font-mono text-sm text-slate-600">{gps}</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" onClick={copy} className="btn btn-secondary btn-sm">
          <Icon name="copy" className="h-4 w-4" />
          Copy GPS
        </button>
        <a href={`https://www.google.com/maps?q=${lat},${lng}`} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
          <Icon name="external" className="h-4 w-4" />
          Directions
          <span className="sr-only">(opens Google Maps in a new tab)</span>
        </a>
      </div>
    </section>
  );
}
