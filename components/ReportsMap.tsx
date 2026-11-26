"use client";

import { useEffect, useRef, useState } from "react";
import type { GeoJSONSource, Map as MlMap, Marker as MlMarker, Popup as MlPopup } from "maplibre-gl";
import { useRouter } from "next/navigation";
import type { Category, ReportSummary } from "@/lib/reports";
import { iconPathFor } from "@/lib/categoryIcons";
import { withinBounds } from "@/lib/config";
import { formatDate } from "@/lib/format";
import { BASEMAP_UNAVAILABLE, createMap } from "@/lib/map";
import { PUBLIC_STATUSES, STATUS_COLOR, STATUS_LABEL, STATUS_TEXT, STATUS_TEXT_DARK } from "@/lib/status";
import Icon from "./ui/Icon";
import { CategoryIcon } from "./ui/Icon";

interface Props {
  reports: ReportSummary[];
  categories: Category[];
  selectedId: string | null;
  /** Report hovered in the list: its pin is raised so the two are visibly linked. */
  highlightId?: string | null;
  onSelect: (id: string | null) => void;
  /** Ids of the reports inside the current view, after every move. */
  onViewChange?: (ids: Set<string>) => void;
  className?: string;
}

const SOURCE = "reports";
const TERRAIN_SOURCE = "terrain-dem";
/** Above this zoom every report is its own pin. */
const CLUSTER_MAX_ZOOM = 14;

/* ----------------------------- DOM builders (MapLibre markers live outside React) ----------------------------- */

export function pinSvg(r: Pick<ReportSummary, "status" | "categorySlug">): string {
  // Category icon (24px grid) scaled into the pin's white disc; fill = status colour.
  return `<svg class="pin-svg" viewBox="0 0 32 42" width="32" height="42" style="display:block;transform-origin:50% 100%;filter:drop-shadow(0 1px 2px rgba(15,23,42,.35))" aria-hidden="true" focusable="false">
    <path d="M16 41S2 27 2 15a14 14 0 0 1 28 0c0 12-14 26-14 26Z" fill="${STATUS_COLOR[r.status]}" stroke="#fff" stroke-width="2"/>
    <circle cx="16" cy="15" r="9.5" fill="#fff"/>
    <g transform="translate(9.5 8.5) scale(.54)" fill="none" stroke="${STATUS_TEXT[r.status]}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="${iconPathFor(r.categorySlug)}"/></g>
  </svg>`;
}

function pinElement(r: ReportSummary, quiet: boolean): HTMLButtonElement {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "pin";
  el.title = r.title;
  el.setAttribute("aria-label", `${r.title}. ${STATUS_LABEL[r.status]}, ${r.categoryName}. Show details`);
  // Keep position:absolute: MapLibre places markers with transform, and a static element drifts on zoom.
  el.style.cssText = "position:absolute;top:0;left:0;margin:0;padding:0;border:0;background:none;cursor:pointer;display:block;width:32px;height:42px";
  if (quiet) el.dataset.quiet = "";
  el.innerHTML = pinSvg(r);
  return el;
}

/** Diameter for a cluster of `count` reports: bigger groups read as bigger, without covering half the map. */
export function clusterSize(count: number): number {
  return count < 10 ? 36 : count < 100 ? 44 : 52;
}

/** Short count for the bubble: 999 fits; larger numbers become "1.2k" (the full number is in the label). */
export function clusterLabel(count: number): string {
  return count < 1000 ? String(count) : `${(count / 1000).toFixed(count < 10_000 ? 1 : 0).replace(/\.0$/, "")}k`;
}

/**
 * A cluster marker. MapLibre positions the root with `transform: translate(...)`, so the root itself must
 * never change size or transform: CSS `scale` on it would also scale that translation and make the marker
 * jump. All hover, focus and pressed styling happens on the inner disc (see .cluster in globals.css).
 */
export function clusterElement(count: number): HTMLButtonElement {
  const size = clusterSize(count);
  const el = document.createElement("button");
  el.type = "button";
  el.className = "cluster";
  el.setAttribute("aria-label", `${count} reports in this area. Zoom in to see them`);
  el.style.cssText = `width:${size}px;height:${size}px`;
  const disc = document.createElement("span");
  disc.className = "cluster-disc";
  disc.setAttribute("aria-hidden", "true");
  disc.textContent = clusterLabel(count);
  el.append(disc);
  return el;
}

/** Preview card for a selected report. Built with textContent only: report text is user input. */
function previewNode(r: ReportSummary, open: (href: string) => void): HTMLElement {
  const root = document.createElement("div");
  root.style.cssText = "width:260px;max-width:calc(100vw - 48px)";
  if (r.thumb) {
    const img = document.createElement("img");
    img.src = r.thumb;
    img.alt = "";
    img.loading = "lazy";
    img.style.cssText = "display:block;width:100%;height:132px;object-fit:cover;background:var(--color-surface-3)";
    root.append(img);
  }
  const body = document.createElement("div");
  body.style.cssText = "padding:12px 14px 14px";
  const status = document.createElement("div");
  status.textContent = STATUS_LABEL[r.status];
  status.className = "status-text";
  status.style.cssText = `--st:${STATUS_TEXT[r.status]};--st-d:${STATUS_TEXT_DARK[r.status]};display:inline-block;font-size:12px;font-weight:700;background:${STATUS_COLOR[r.status]}1a;border-radius:999px;padding:2px 9px`;
  const title = document.createElement("div");
  title.textContent = r.title;
  title.style.cssText = "font-weight:700;font-size:15px;line-height:1.3;margin:8px 0 4px;color:var(--color-fg)";
  const meta = document.createElement("div");
  meta.textContent = [r.categoryName, r.problemType, r.barangay, `Reported ${formatDate(r.createdAt)}`].filter(Boolean).join(" · ");
  meta.style.cssText = "font-size:13px;line-height:1.45;color:var(--color-fg-muted);margin-bottom:12px";
  const href = `/reports/${r.id}`;
  const link = document.createElement("a");
  link.href = href;
  link.textContent = "View report →";
  link.style.cssText = "display:inline-flex;align-items:center;min-height:36px;background:var(--color-primary);color:#fff;padding:0 14px;border-radius:8px;font-weight:600;font-size:14px;text-decoration:none";
  link.addEventListener("click", (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    open(href);
  });
  body.append(status, title, meta, link);
  root.append(body);
  return root;
}

function reportHereNode(lng: number, lat: number): HTMLElement {
  const inside = withinBounds(lng, lat);
  const root = document.createElement("div");
  root.style.cssText = "padding:12px 14px;min-width:210px";
  const head = document.createElement("div");
  head.textContent = inside ? "Report a problem here?" : "Outside the municipality";
  head.style.cssText = "font-weight:700;color:var(--color-fg)";
  const coords = document.createElement("div");
  coords.textContent = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  coords.style.cssText = "font-size:12px;color:var(--color-fg-muted);margin:2px 0 10px;font-variant-numeric:tabular-nums";
  root.append(head, coords);
  if (inside) {
    const a = document.createElement("a");
    a.href = `/report/new?lat=${lat}&lng=${lng}`;
    a.textContent = "+ Report an issue here";
    a.style.cssText = "display:inline-flex;align-items:center;min-height:36px;background:#c2410c;color:#fff;padding:0 12px;border-radius:8px;font-weight:600;font-size:14px;text-decoration:none";
    root.append(a);
  } else {
    const note = document.createElement("div");
    note.textContent = "Reports can only be placed inside the municipality.";
    note.style.cssText = "font-size:13px;color:var(--color-fg-muted)";
    root.append(note);
  }
  return root;
}

function toFeatures(reports: ReportSummary[]): GeoJSON.FeatureCollection<GeoJSON.Point, { id: string }> {
  return {
    type: "FeatureCollection",
    features: reports.map((r) => ({ type: "Feature", geometry: { type: "Point", coordinates: [r.lng, r.lat] }, properties: { id: r.id } })),
  };
}

function geoMessage(err: GeolocationPositionError): string {
  if (err.code === err.PERMISSION_DENIED) return "Location access is blocked. Allow it in your browser settings, or move the map yourself.";
  if (err.code === err.TIMEOUT) return "Finding your location took too long. Try again outdoors or move the map yourself.";
  return "Your location is not available right now.";
}

const ctrl =
  "grid h-11 w-11 place-items-center bg-surface text-fg-muted hover:bg-surface-2 hover:text-fg disabled:opacity-50 aria-pressed:bg-primary aria-pressed:text-white";

/* ----------------------------- Component ----------------------------- */

export default function ReportsMap({ reports, categories, selectedId, highlightId, onSelect, onViewChange, className }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const popupRef = useRef<MlPopup | null>(null);
  const markersRef = useRef<Map<string, { marker: MlMarker; el: HTMLElement }>>(new Map());
  const meRef = useRef<MlMarker | null>(null);
  const reportsRef = useRef(reports);
  const onSelectRef = useRef(onSelect);
  const onViewRef = useRef(onViewChange);
  const firstPaint = useRef(true);
  const router = useRouter();
  const routerRef = useRef(router);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [tileErrors, setTileErrors] = useState(0);
  const [pitched, setPitched] = useState(false);
  const [terrain, setTerrain] = useState(false);
  const [bearing, setBearing] = useState(0);
  const [legend, setLegend] = useState(false);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  reportsRef.current = reports;
  onSelectRef.current = onSelect;
  onViewRef.current = onViewChange;
  routerRef.current = router;

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    const markers = markersRef.current;

    /** Rebuilds the visible markers from the clustered source: one per cluster, one per lone report. */
    function sync(map: MlMap) {
      if (!map.getSource(SOURCE)) return;
      const byId = new Map(reportsRef.current.map((r) => [r.id, r]));
      const seen = new Set<string>();
      const inView = new Set<string>();
      const bounds = map.getBounds();
      for (const r of reportsRef.current) if (bounds.contains([r.lng, r.lat])) inView.add(r.id);

      import("maplibre-gl").then(({ Marker }) => {
        if (!mapRef.current) return;
        for (const f of map.querySourceFeatures(SOURCE)) {
          const p = f.properties as { cluster?: boolean; cluster_id?: number; point_count?: number; id?: string };
          const [lng, lat] = (f.geometry as GeoJSON.Point).coordinates;
          if (p.cluster) {
            const key = `cluster:${p.cluster_id}`;
            if (seen.has(key)) continue;
            seen.add(key);
            if (markers.has(key)) continue;
            const node = clusterElement(p.point_count ?? 0);
            node.addEventListener("click", async (e) => {
              e.stopPropagation();
              const zoom = await (map.getSource(SOURCE) as GeoJSONSource).getClusterExpansionZoom(p.cluster_id!);
              map.easeTo({ center: [lng, lat], zoom: Math.min(zoom, CLUSTER_MAX_ZOOM + 1), duration: 450 });
            });
            markers.set(key, { marker: new Marker({ element: node }).setLngLat([lng, lat]).addTo(map), el: node });
          } else if (p.id && byId.has(p.id)) {
            if (seen.has(p.id)) continue;
            seen.add(p.id);
            if (markers.has(p.id)) continue;
            const r = byId.get(p.id)!;
            const node = pinElement(r, !firstPaint.current);
            node.addEventListener("click", (e) => {
              e.stopPropagation();
              onSelectRef.current(r.id);
            });
            markers.set(r.id, { marker: new Marker({ element: node, anchor: "bottom" }).setLngLat([r.lng, r.lat]).addTo(map), el: node });
          }
        }
        for (const [key, m] of markers) {
          if (!seen.has(key)) {
            m.marker.remove();
            markers.delete(key);
          }
        }
        if (seen.size > 0) firstPaint.current = false;
        markSelection();
        onViewRef.current?.(inView);
      });
    }

    (async () => {
      if (!el.current) return;
      let map: MlMap;
      try {
        map = await createMap(el.current, { controls: false });
      } catch (err) {
        // No WebGL (old phones, some locked-down browsers): the list stays usable.
        console.error("[map] could not start:", err);
        if (!cancelled) setFailed(true);
        return;
      }
      if (cancelled) {
        map.remove();
        return;
      }
      mapRef.current = map;
      // The tile service failed and the map switched to a plain background: say so (pins still work).
      el.current!.addEventListener(BASEMAP_UNAVAILABLE, () => setTileErrors(99));
      // The map is display:none in the phone list view; redraw at the right size when it comes back.
      const resize = new ResizeObserver(() => map.resize());
      resize.observe(el.current!);
      map.once("remove", () => resize.disconnect());
      map.on("error", (e) => {
        if ((e as unknown as { tile?: unknown }).tile) setTileErrors((n) => n + 1);
      });
      map.on("rotate", () => setBearing(map.getBearing()));
      map.on("moveend", () => sync(map));
      map.on("sourcedata", (e) => {
        if (e.sourceId === SOURCE && e.isSourceLoaded) sync(map);
      });
      map.on("click", (e) => {
        // Pin and cluster clicks stop propagating, so this only fires on open map.
        onSelectRef.current(null);
        import("maplibre-gl").then(({ Popup }) => {
          if (!mapRef.current) return;
          popupRef.current?.remove();
          popupRef.current = new Popup({ offset: 8, maxWidth: "280px" })
            .setLngLat(e.lngLat)
            .setDOMContent(reportHereNode(e.lngLat.lng, e.lngLat.lat))
            .addTo(mapRef.current);
        });
      });
      const addSource = () => {
        if (map.getSource(SOURCE)) return;
        map.addSource(SOURCE, { type: "geojson", data: toFeatures(reportsRef.current), cluster: true, clusterRadius: 46, clusterMaxZoom: CLUSTER_MAX_ZOOM });
        // Invisible layer: a source only loads tiles (and answers querySourceFeatures) while a layer uses it.
        map.addLayer({ id: `${SOURCE}-hit`, type: "circle", source: SOURCE, paint: { "circle-radius": 0, "circle-opacity": 0 } });
        setReady(true);
      };
      // style.load also fires after the vector style falls back to raster, which drops every source.
      map.on("style.load", addSource);
      if (map.isStyleLoaded()) addSource();
    })();

    return () => {
      cancelled = true;
      popupRef.current = null;
      markers.forEach((m) => m.marker.remove());
      markers.clear();
      meRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Reflects selection and list hover on the pin elements. */
  function markSelection() {
    markersRef.current.forEach((m, id) => {
      m.el.dataset.selected = id === selectedRef.current ? "1" : "";
      m.el.dataset.hover = id === highlightRef.current ? "1" : "";
      m.el.style.zIndex = id === selectedRef.current ? "5" : id === highlightRef.current ? "4" : "";
    });
  }
  const selectedRef = useRef(selectedId);
  const highlightRef = useRef(highlightId);
  selectedRef.current = selectedId;
  highlightRef.current = highlightId;

  // New results: replace the source data; clusters and pins rebuild from it.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    // Cluster ids change with the data, so cluster markers cannot be reused.
    for (const [key, m] of markersRef.current) {
      if (key.startsWith("cluster:")) {
        m.marker.remove();
        markersRef.current.delete(key);
      }
    }
    (map.getSource(SOURCE) as GeoJSONSource | undefined)?.setData(toFeatures(reports));
  }, [reports, ready]);

  useEffect(() => {
    if (ready) markSelection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightId, ready]);

  // Selected report: raise its pin, open the preview and bring it into view.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    markSelection();
    if (popupRef.current) {
      const old = popupRef.current;
      popupRef.current = null;
      old.remove();
    }
    // Read through the ref: a filter change must not re-open the popup or move the map.
    const report = selectedId ? reportsRef.current.find((r) => r.id === selectedId) : undefined;
    if (!report) return;
    let cancelled = false;
    import("maplibre-gl").then(({ Popup }) => {
      if (cancelled || !mapRef.current) return;
      const popup = new Popup({ offset: [0, -40], maxWidth: "300px", focusAfterOpen: true })
        .setLngLat([report.lng, report.lat])
        .setDOMContent(previewNode(report, (href) => routerRef.current.push(href)))
        .addTo(mapRef.current);
      popup.on("close", () => {
        if (popupRef.current === popup) {
          popupRef.current = null;
          onSelectRef.current(null);
        }
      });
      popupRef.current = popup;
      mapRef.current.easeTo({ center: [report.lng, report.lat], zoom: Math.max(mapRef.current.getZoom(), CLUSTER_MAX_ZOOM + 1), duration: 500 });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, ready]);

  function toggle3d() {
    const map = mapRef.current;
    if (!map) return;
    const next = !pitched;
    setPitched(next);
    map.easeTo({ pitch: next ? 60 : 0, bearing: next ? map.getBearing() : 0, duration: 600 });
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
    if (!navigator.geolocation) return setGeoError("This browser cannot share your location. Move the map yourself.");
    setLocating(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setLocating(false);
        const map = mapRef.current;
        if (!map) return;
        const here: [number, number] = [pos.coords.longitude, pos.coords.latitude];
        if (!withinBounds(here[0], here[1])) {
          setGeoError("You appear to be outside the municipality, so the map stays where it is.");
          return;
        }
        const { Marker } = await import("maplibre-gl");
        meRef.current?.remove();
        const dot = document.createElement("div");
        dot.setAttribute("aria-label", "Your location");
        dot.style.cssText = "width:18px;height:18px;border-radius:50%;background:#2563eb;border:3px solid #fff;box-shadow:0 0 0 6px rgb(37 99 235 / .25)";
        meRef.current = new Marker({ element: dot }).setLngLat(here).addTo(map);
        map.flyTo({ center: here, zoom: 16 });
      },
      (err) => {
        setLocating(false);
        setGeoError(geoMessage(err));
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  if (failed) {
    return (
      <div className={`grid place-items-center bg-surface-3 p-6 text-center ${className ?? ""}`}>
        <div className="max-w-xs">
          <Icon name="map" className="mx-auto h-8 w-8 text-fg-subtle" />
          <p className="mt-3 font-semibold text-fg">The map cannot be shown on this device</p>
          <p className="mt-1 text-sm text-fg-muted">Every report is still in the list.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden ${className ?? ""}`}>
      <div ref={el} className="h-full w-full bg-surface-3" role="region" aria-label="Map of reported issues. Use the list for a keyboard-friendly view." />

      {!ready && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-surface-3" role="status">
          <span className="flex items-center gap-2 rounded-lg bg-surface px-3 py-2 text-sm font-medium text-fg-muted shadow-[var(--shadow-panel)]">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-line-strong border-t-primary" aria-hidden />
            Loading map…
          </span>
        </div>
      )}

      {tileErrors >= 3 && (
        <p role="status" className="absolute left-1/2 top-3 max-w-[calc(100%-6rem)] -translate-x-1/2 rounded-lg bg-surface/95 px-3 py-2 text-center text-xs text-fg-muted shadow-[var(--shadow-panel)]">
          The street map is slow to load. Report pins are still shown.
        </p>
      )}

      {geoError && (
        <div role="alert" className="absolute left-3 right-16 top-3 flex items-start gap-2 rounded-lg bg-surface px-3 py-2 text-sm text-danger shadow-[var(--shadow-panel)] sm:left-auto sm:right-16 sm:max-w-xs">
          <Icon name="alert" className="mt-0.5 h-4 w-4 flex-none" />
          <span className="flex-1">{geoError}</span>
          <button type="button" onClick={() => setGeoError(null)} aria-label="Dismiss" className="-mr-1 grid h-6 w-6 place-items-center rounded text-fg-muted hover:bg-surface-3">
            <Icon name="x" className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="absolute bottom-20 left-3 flex flex-col items-start gap-2 lg:bottom-8">
        {legend && (
          <div id="map-legend" className="panel animate-fade-up max-h-[50svh] w-64 overflow-y-auto p-4 text-sm">
            <p className="eyebrow mb-2">Pin colour: status</p>
            <ul className="space-y-1.5">
              {PUBLIC_STATUSES.map((s) => (
                <li key={s} className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full ring-2 ring-surface" style={{ backgroundColor: STATUS_COLOR[s] }} aria-hidden />
                  {STATUS_LABEL[s]}
                </li>
              ))}
              <li className="flex items-center gap-2">
                <span className="grid h-4 w-4 place-items-center rounded-full bg-primary text-[8px] font-bold text-white" aria-hidden>
                  3
                </span>
                Group of nearby reports
              </li>
            </ul>
            <p className="eyebrow mb-2 mt-4">Pin icon: category</p>
            <ul className="space-y-1.5">
              {categories.map((c) => (
                <li key={c.slug} className="flex items-center gap-2">
                  <CategoryIcon slug={c.slug} className="h-4 w-4 text-fg-muted" />
                  {c.name}
                </li>
              ))}
            </ul>
          </div>
        )}
        <button type="button" onClick={() => setLegend((v) => !v)} aria-expanded={legend} aria-controls="map-legend" className="panel inline-flex h-11 items-center gap-2 px-3.5 text-sm font-semibold text-fg hover:bg-surface-2">
          <Icon name="layers" className="h-4.5 w-4.5" />
          Legend
        </button>
      </div>

      <div className="absolute bottom-20 right-3 flex flex-col gap-2 lg:bottom-8">
        <div className="panel flex flex-col divide-y divide-line overflow-hidden">
          <button type="button" onClick={() => mapRef.current?.zoomIn()} aria-label="Zoom in" className={ctrl}>
            <Icon name="plus" />
          </button>
          <button type="button" onClick={() => mapRef.current?.zoomOut()} aria-label="Zoom out" className={ctrl}>
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M5 12h14" />
            </svg>
          </button>
        </div>
        <div className="panel flex flex-col divide-y divide-line overflow-hidden">
          <button type="button" onClick={locate} disabled={locating} aria-label="Show my location" className={ctrl}>
            {locating ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-line-strong border-t-primary" aria-hidden /> : <Icon name="locate" />}
          </button>
          <button
            type="button"
            onClick={() => {
              mapRef.current?.easeTo({ bearing: 0, pitch: 0, duration: 500 });
              setPitched(false);
            }}
            aria-label="Reset the view to north"
            className={ctrl}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" style={{ transform: `rotate(${-bearing}deg)` }} aria-hidden>
              <path d="M12 3 16 12H8l4-9Z" fill="#b91c1c" />
              <path d="m12 21-4-9h8l-4 9Z" fill="#94a3b8" />
            </svg>
          </button>
        </div>
        <div className="panel hidden flex-col divide-y divide-line overflow-hidden sm:flex">
          <button type="button" onClick={toggle3d} aria-pressed={pitched} aria-label="3D view" className={`${ctrl} text-sm font-bold`}>
            3D
          </button>
          <button type="button" onClick={toggleTerrain} aria-pressed={terrain} aria-label="Show terrain" className={ctrl}>
            <Icon name="mountain" />
          </button>
        </div>
      </div>
    </div>
  );
}
