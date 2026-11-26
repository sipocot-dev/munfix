"use client";

import { useEffect, useRef } from "react";
import { createMap } from "@/lib/map";
import { STATUS_COLOR, type Status } from "@/lib/status";

/** Small map showing one report's location. */
export default function StaticMap({ lng, lat, status }: { lng: number; lat: number; status: Status }) {
  const el = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let remove: (() => void) | undefined;

    (async () => {
      if (!el.current) return;
      const map = await createMap(el.current, { center: [lng, lat], zoom: 15.5 });
      if (cancelled) {
        map.remove();
        return;
      }
      const { Marker } = await import("maplibre-gl");
      if (cancelled) {
        map.remove();
        return;
      }
      new Marker({ color: STATUS_COLOR[status] }).setLngLat([lng, lat]).addTo(map);
      map.scrollZoom.disable();
      remove = () => map.remove();
    })();

    return () => {
      cancelled = true;
      remove?.();
    };
  }, [lng, lat, status]);

  return <div ref={el} role="region" aria-label="Map showing where the problem is" className="h-56 w-full overflow-hidden rounded-[10px] border border-line bg-surface-3" />;
}
