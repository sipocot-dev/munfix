"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Map as MlMap, Marker as MlMarker, Popup as MlPopup } from "maplibre-gl";
import type { Category, ReportSummary } from "@/lib/reports";
import { glyphFor } from "@/lib/categoryIcons";
import { createMap } from "@/lib/map";
import { PUBLIC_STATUSES, STATUS_COLOR, STATUS_LABEL } from "@/lib/status";
import { withinBounds } from "@/lib/config";

interface Props {
  reports: ReportSummary[];
  categories: Category[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  className?: string;
}

const TERRAIN_SOURCE = "terrain-dem";

function pinElement(r: ReportSummary): HTMLButtonElement {
  const color = STATUS_COLOR[r.status];
  const el = document.createElement("button");
  el.type = "button";
  el.setAttribute("aria-label", `${r.title}, ${STATUS_LABEL[r.status]}`);
  el.style.cssText = "all:unset;cursor:pointer;display:block;width:34px;height:44px;transform-origin:50% 100%;transition:transform .15s";
  el.innerHTML = `<svg viewBox="0 0 34 44" width="34" height="44" style="display:block;filter:drop-shadow(0 2px 2px rgba(0,0,0,.35))" aria-hidden="true">
    <path d="M17 43C17 43 2 28 2 16a15 15 0 0 1 30 0c0 12-15 27-15 27Z" fill="${color}" stroke="#fff" stroke-width="2"/>
    <circle cx="17" cy="16" r="10" fill="#fff"/>
    <text x="17" y="21" text-anchor="middle" font-size="13">${glyphFor(r.categorySlug)}</text></svg>`;
  return el;
}

function popupNode(r: ReportSummary): HTMLElement {
  const root = document.createElement("div");
  root.style.maxWidth = "230px";

  if (r.thumb) {
    const img = document.createElement("img");
    img.src = r.thumb;
    img.alt = "";
    img.style.cssText = "width:100%;height:110px;object-fit:cover;border-radius:8px;margin-bottom:6px";
    root.append(img);
  }

  const status = document.createElement("div");
  status.textContent = STATUS_LABEL[r.status];
  status.style.cssText = `font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:${STATUS_COLOR[r.status]}`;

  const title = document.createElement("div");
  title.textContent = r.title;
  title.style.cssText = "font-weight:600;margin:2px 0 4px;color:#0f172a";

  const meta = document.createElement("div");
  meta.textContent = [r.categoryName, r.problemType, r.barangay].filter(Boolean).join(" · ");
  meta.style.cssText = "font-size:12px;color:#64748b;margin-bottom:6px";

  const link = document.createElement("a");
  link.href = `/reports/${r.id}`;
  link.textContent = "View details →";
  link.style.cssText = "font-size:13px;font-weight:600;color:#0f766e";

  root.append(status, title, meta, link);
  return root;
}

const ctrl =
  "grid h-11 w-11 place-items-center rounded-xl bg-white text-slate-700 shadow-md ring-1 ring-black/5 hover:bg-slate-50 active:scale-95 text-sm font-bold";

export default function ReportsMap({ reports, categories, selectedId, onSelect, className }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const popupRef = useRef<MlPopup | null>(null);
  const markersRef = useRef<Map<string, { marker: MlMarker; el: HTMLElement }>>(new Map());
  const reportsRef = useRef(reports);
  const onSelectRef = useRef(onSelect);
  const [ready, setReady] = useState(false);
  const [tileErrors, setTileErrors] = useState(0);
  const [visible, setVisible] = useState(reports.length);
  const [pitched, setPitched] = useState(false);
  const [terrain, setTerrain] = useState(false);
  const [bearing, setBearing] = useState(0);
  const [legend, setLegend] = useState(false);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  reportsRef.current = reports;
  onSelectRef.current = onSelect;

  const countVisible = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const b = map.getBounds();
    setVisible(reportsRef.current.filter((r) => b.contains([r.lng, r.lat])).length);
  }, []);

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!el.current) return;
      const map = await createMap(el.current, { controls: false, vector: true });
      map.on("error", (e) => {
        // Count failed tile requests so the page can say the basemap is unavailable.
        const err = e as { error?: Error; tile?: unknown };
        if (err.tile) setTileErrors((n) => n + 1);
      });
      if (cancelled) {
        map.remove();
        return;
      }
      mapRef.current = map;
      map.on("moveend", countVisible);
      map.on("rotate", () => setBearing(map.getBearing()));
      map.on("click", (e) => {
        // Clicks on pins stop propagating in the pin element, so this only fires on open map.
        const { lng, lat } = e.lngLat;
        popupRef.current?.remove();
        popupRef.current = null;
        onSelectRef.current(null);
        const inside = withinBounds(lng, lat);
        import("maplibre-gl").then(({ Popup }) => {
          if (!mapRef.current) return;
          const root = document.createElement("div");
          root.style.cssText = "min-width:200px";
          const head = document.createElement("div");
          head.textContent = inside ? "Report an issue here?" : "Outside the municipality";
          head.style.cssText = "font-weight:600;color:#0f172a";
          const coords = document.createElement("div");
          coords.textContent = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
          coords.style.cssText = "font-size:12px;color:#64748b;margin:2px 0 8px";
          root.append(head, coords);
          if (inside) {
            const a = document.createElement("a");
            a.href = `/report/new?lat=${lat}&lng=${lng}`;
            a.textContent = "+ Report a problem here";
            a.style.cssText = "display:inline-block;background:#ea580c;color:#fff;padding:7px 12px;border-radius:8px;font-weight:600;font-size:13px;text-decoration:none";
            root.append(a);
          } else {
            const note = document.createElement("div");
            note.textContent = "Reports can only be placed inside the city.";
            note.style.cssText = "font-size:12px;color:#64748b";
            root.append(note);
          }
          const popup = new Popup({ offset: 8, closeButton: true, maxWidth: "260px" })
            .setLngLat([lng, lat])
            .setDOMContent(root)
            .addTo(mapRef.current);
          popupRef.current = popup;
        });
      });
      // Pins can be added as soon as the style exists; tiles may still be loading.
      map.once("style.load", () => setReady(true));
      if (map.isStyleLoaded()) setReady(true);
    })();
    const markers = markersRef.current;
    return () => {
      cancelled = true;
      popupRef.current = null;
      markers.forEach((m) => m.marker.remove());
      markers.clear();
      mapRef.current?.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, [countVisible]);

  // Keep one marker per report.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    let cancelled = false;
    (async () => {
      const { Marker } = await import("maplibre-gl");
      if (cancelled) return;
      const markers = markersRef.current;
      const ids = new Set(reports.map((r) => r.id));
      for (const [id, m] of markers) {
        if (!ids.has(id)) {
          m.marker.remove();
          markers.delete(id);
        }
      }
      for (const r of reports) {
        if (markers.has(r.id)) continue;
        const node = pinElement(r);
        node.addEventListener("click", (e) => {
          e.stopPropagation();
          onSelectRef.current(r.id);
        });
        const marker = new Marker({ element: node, anchor: "bottom" }).setLngLat([r.lng, r.lat]).addTo(map);
        markers.set(r.id, { marker, el: node });
      }
      countVisible();
    })();
    return () => {
      cancelled = true;
    };
  }, [reports, ready, countVisible]);

  // Highlight the selected pin and show its popup.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;

    markersRef.current.forEach((m, id) => {
      m.el.style.transform = id === selectedId ? "scale(1.25)" : "";
      m.el.style.zIndex = id === selectedId ? "5" : "";
    });

    if (popupRef.current) {
      const old = popupRef.current;
      popupRef.current = null;
      old.remove();
    }

    const report = selectedId ? reports.find((r) => r.id === selectedId) : undefined;
    if (!report) return;

    let cancelled = false;
    (async () => {
      const { Popup } = await import("maplibre-gl");
      if (cancelled || !mapRef.current) return;
      const popup = new Popup({ offset: [0, -40], closeButton: true, maxWidth: "250px" })
        .setLngLat([report.lng, report.lat])
        .setDOMContent(popupNode(report))
        .addTo(mapRef.current);
      popup.on("close", () => {
        if (popupRef.current === popup) {
          popupRef.current = null;
          onSelectRef.current(null);
        }
      });
      popupRef.current = popup;
      mapRef.current.easeTo({ center: [report.lng, report.lat], zoom: Math.max(mapRef.current.getZoom(), 15), duration: 500 });
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId, ready, reports]);

  function toggle3d() {
    const map = mapRef.current;
    if (!map) return;
    const next = !pitched;
    setPitched(next);
    map.easeTo({ pitch: next ? 62 : 0, bearing: next ? map.getBearing() : 0, duration: 600 });
  }

  function toggleTerrain() {
    const map = mapRef.current;
    if (!map) return;
    const next = !terrain;
    setTerrain(next);
    if (next) {
      if (!map.getSource(TERRAIN_SOURCE)) {
        map.addSource(TERRAIN_SOURCE, {
          type: "raster-dem",
          tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
          tileSize: 256,
          maxzoom: 14,
          encoding: "terrarium",
          attribution: "Terrain: Mapzen / AWS",
        });
      }
      map.setTerrain({ source: TERRAIN_SOURCE, exaggeration: 1.6 });
      if (!pitched) {
        setPitched(true);
        map.easeTo({ pitch: 55, duration: 600 });
      }
    } else {
      map.setTerrain(null);
    }
  }

  function locate() {
    if (!navigator.geolocation) return setGeoError("Location is not available in this browser.");
    setLocating(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        mapRef.current?.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 16 });
      },
      () => {
        setLocating(false);
        setGeoError("We couldn't get your location. Check the browser permission.");
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  return (
    <div className={`relative ${className ?? ""}`}>
      <div ref={el} className="h-full w-full bg-[#e8ecef]" role="application" aria-label="Map of reported issues" />

      {tileErrors >= 3 && (
        <p role="status" className="absolute bottom-6 left-1/2 max-w-sm -translate-x-1/2 rounded-lg bg-white/95 px-3 py-2 text-center text-xs text-slate-600 shadow-md">
          The street map is slow to load. Your reports are still shown on the pins.
        </p>
      )}

      <div className="pointer-events-none absolute right-3 top-3 rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-md ring-1 ring-black/5" aria-live="polite">
        {visible} report{visible === 1 ? "" : "s"} visible
      </div>

      {geoError && (
        <p role="alert" className="absolute right-3 top-16 max-w-xs rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 shadow-md">
          {geoError}
        </p>
      )}

      <div className="absolute bottom-6 left-3">
        {legend && (
          <div className="mb-2 w-64 rounded-xl bg-white p-4 text-sm shadow-lg ring-1 ring-black/5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Status</p>
            <ul className="space-y-1.5">
              {PUBLIC_STATUSES.map((s) => (
                <li key={s} className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: STATUS_COLOR[s] }} />
                  {STATUS_LABEL[s]}
                </li>
              ))}
            </ul>
            <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Category</p>
            <ul className="grid grid-cols-1 gap-1.5">
              {categories.map((c) => (
                <li key={c.slug} className="flex items-center gap-2">
                  <span className="w-5 text-center" aria-hidden>{glyphFor(c.slug)}</span>
                  {c.name}
                </li>
              ))}
            </ul>
          </div>
        )}
        <button
          type="button"
          onClick={() => setLegend((v) => !v)}
          aria-expanded={legend}
          className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-md ring-1 ring-black/5 hover:bg-slate-50"
        >
          <span className="grid h-5 w-5 place-items-center rounded-full border-2 border-slate-700 text-[11px] leading-none">?</span>
          Legend
        </button>
      </div>

      <div className="absolute bottom-6 right-3 flex flex-col gap-2">
        <button type="button" onClick={toggle3d} aria-pressed={pitched} aria-label="Toggle 3D view" className={`${ctrl} ${pitched ? "!bg-teal-700 !text-white" : ""}`}>
          3D
        </button>
        <button type="button" onClick={toggleTerrain} aria-pressed={terrain} aria-label="Toggle terrain" className={`${ctrl} ${terrain ? "!bg-teal-700 !text-white" : ""}`}>
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden>
            <path d="M3 19 9 8l4 7 3-4 5 8H3Z" />
          </svg>
        </button>
        <div className="overflow-hidden rounded-xl bg-white shadow-md ring-1 ring-black/5">
          <button type="button" onClick={() => mapRef.current?.zoomIn()} aria-label="Zoom in" className="grid h-11 w-11 place-items-center text-xl hover:bg-slate-50">
            +
          </button>
          <button type="button" onClick={() => mapRef.current?.zoomOut()} aria-label="Zoom out" className="grid h-11 w-11 place-items-center border-t border-slate-100 text-xl hover:bg-slate-50">
            −
          </button>
        </div>
        <button
          type="button"
          onClick={() => {
            mapRef.current?.easeTo({ bearing: 0, pitch: 0, duration: 500 });
            setPitched(false);
          }}
          aria-label="Reset north"
          className={ctrl}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" style={{ transform: `rotate(${-bearing}deg)` }} aria-hidden>
            <path d="M12 3 16 12H8l4-9Z" fill="#dc2626" />
            <path d="m12 21-4-9h8l-4 9Z" fill="#94a3b8" />
          </svg>
        </button>
        <button type="button" onClick={locate} disabled={locating} aria-label="Show my location" className={ctrl}>
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" strokeLinecap="round" />
            <circle cx="12" cy="12" r="8" />
          </svg>
        </button>
      </div>
    </div>
  );
}
