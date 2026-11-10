"use client";

import { useEffect, useRef, useState } from "react";
import type { GeoJSONSource, Map as MlMap, Popup as MlPopup } from "maplibre-gl";
import type { ReportSummary } from "@/lib/reports";
import { createMap } from "@/lib/map";
import { STATUS_COLOR, STATUS_LABEL } from "@/lib/status";

interface Props {
  reports: ReportSummary[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  className?: string;
}

function toGeoJSON(reports: ReportSummary[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: reports.map((r) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [r.lng, r.lat] },
      properties: { id: r.id, status: r.status },
    })),
  };
}

function popupNode(r: ReportSummary): HTMLElement {
  const root = document.createElement("div");
  root.style.maxWidth = "220px";

  const status = document.createElement("div");
  status.textContent = STATUS_LABEL[r.status];
  status.style.cssText = `font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:${STATUS_COLOR[r.status]}`;

  const title = document.createElement("div");
  title.textContent = r.title;
  title.style.cssText = "font-weight:600;margin:2px 0 4px;color:#0f172a";

  const meta = document.createElement("div");
  meta.textContent = [r.categoryName, r.barangay].filter(Boolean).join(" · ");
  meta.style.cssText = "font-size:12px;color:#64748b;margin-bottom:6px";

  const link = document.createElement("a");
  link.href = `/reports/${r.id}`;
  link.textContent = "View details →";
  link.style.cssText = "font-size:13px;font-weight:600;color:#0f766e";

  root.append(status, title, meta, link);
  return root;
}

export default function ReportsMap({ reports, selectedId, onSelect, className }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const popupRef = useRef<MlPopup | null>(null);
  const reportsRef = useRef(reports);
  const onSelectRef = useRef(onSelect);
  const [ready, setReady] = useState(false);

  reportsRef.current = reports;
  onSelectRef.current = onSelect;

  // Create the map once.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!el.current) return;
      const map = await createMap(el.current);
      if (cancelled) {
        map.remove();
        return;
      }
      mapRef.current = map;

      map.on("load", () => {
        map.addSource("reports", { type: "geojson", data: toGeoJSON(reportsRef.current) });
        map.addLayer({
          id: "report-selected",
          type: "circle",
          source: "reports",
          filter: ["==", ["get", "id"], ""],
          paint: {
            "circle-radius": 17,
            "circle-color": "#0f766e",
            "circle-opacity": 0.18,
            "circle-stroke-width": 2,
            "circle-stroke-color": "#0f766e",
          },
        });
        map.addLayer({
          id: "report-points",
          type: "circle",
          source: "reports",
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 5, 15, 9],
            "circle-color": [
              "match",
              ["get", "status"],
              "verified",
              STATUS_COLOR.verified,
              "in_progress",
              STATUS_COLOR.in_progress,
              "resolved",
              STATUS_COLOR.resolved,
              "#64748b",
            ],
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffffff",
          },
        });

        map.on("click", "report-points", (e) => {
          const id = e.features?.[0]?.properties?.id as string | undefined;
          if (id) onSelectRef.current(id);
        });
        map.on("mouseenter", "report-points", () => (map.getCanvas().style.cursor = "pointer"));
        map.on("mouseleave", "report-points", () => (map.getCanvas().style.cursor = ""));
        setReady(true);
      });
    })();

    return () => {
      cancelled = true;
      popupRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, []);

  // Push new data into the map.
  useEffect(() => {
    if (!ready) return;
    (mapRef.current?.getSource("reports") as GeoJSONSource | undefined)?.setData(toGeoJSON(reports));
  }, [reports, ready]);

  // Highlight the selected report and show its popup.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;

    map.setFilter("report-selected", ["==", ["get", "id"], selectedId ?? ""]);

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
      const popup = new Popup({ offset: 14, closeButton: true, maxWidth: "240px" })
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
      mapRef.current.easeTo({
        center: [report.lng, report.lat],
        zoom: Math.max(mapRef.current.getZoom(), 14),
        duration: 500,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId, ready, reports]);

  return <div ref={el} className={className} role="application" aria-label="Map of reported issues" />;
}
