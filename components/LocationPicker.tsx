"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as MlMap, Marker as MlMarker } from "maplibre-gl";
import { MUNICIPALITY, withinBounds } from "@/lib/config";
import { createMap } from "@/lib/map";
import Alert from "./ui/Alert";
import Icon from "./ui/Icon";

export interface LngLat {
  lng: number;
  lat: number;
}

/** Click the map, drag the pin, or use the device location to choose where the issue is. */
export default function LocationPicker({ value, onChange }: { value: LngLat | null; onChange: (v: LngLat) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const markerRef = useRef<MlMarker | null>(null);
  const onChangeRef = useRef(onChange);
  const valueRef = useRef(value);
  const [ready, setReady] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  onChangeRef.current = onChange;
  valueRef.current = value;

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
      map.on("click", (e) => onChangeRef.current({ lng: e.lngLat.lng, lat: e.lngLat.lat }));
      map.getCanvas().style.cursor = "crosshair";
      setReady(true);
    })();
    return () => {
      cancelled = true;
      markerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, []);

  // Keep the pin in sync with `value`.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    let cancelled = false;
    (async () => {
      if (!value) {
        markerRef.current?.remove();
        markerRef.current = null;
        return;
      }
      if (markerRef.current) {
        markerRef.current.setLngLat([value.lng, value.lat]);
        return;
      }
      const { Marker } = await import("maplibre-gl");
      if (cancelled || markerRef.current || !mapRef.current) return;
      const marker = new Marker({ color: "#1d3557", draggable: true })
        .setLngLat([value.lng, value.lat])
        .addTo(mapRef.current);
      marker.on("dragend", () => {
        const p = marker.getLngLat();
        onChangeRef.current({ lng: p.lng, lat: p.lat });
      });
      markerRef.current = marker;
    })();
    return () => {
      cancelled = true;
    };
  }, [value, ready]);

  function useMyLocation() {
    setGeoError(null);
    if (!navigator.geolocation) {
      setGeoError("Your browser does not support location lookup.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const here = { lng: pos.coords.longitude, lat: pos.coords.latitude };
        if (!withinBounds(here.lng, here.lat)) {
          setGeoError(`Your current location is outside ${MUNICIPALITY.name}. Click the map to place the pin instead.`);
          return;
        }
        onChangeRef.current(here);
        mapRef.current?.easeTo({ center: [here.lng, here.lat], zoom: 16 });
      },
      (err) => {
        setLocating(false);
        setGeoError(
          err.code === err.PERMISSION_DENIED
            ? "Location access is blocked. Allow it in your browser settings, or click the map to place the pin."
            : "Could not get your location. Click the map to place the pin instead.",
        );
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  const outside = value ? !withinBounds(value.lng, value.lat) : false;

  return (
    <div>
      <div
        ref={el}
        role="region"
        aria-label="Map for choosing the problem location. Click to drop a pin, or use the buttons below."
        className="h-72 w-full overflow-hidden rounded-[10px] border border-slate-300 bg-[#e8ecef] sm:h-80"
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={useMyLocation} disabled={locating} className="btn btn-secondary btn-sm">
          <Icon name="locate" className="h-4 w-4" />
          {locating ? "Locating…" : "Use my location"}
        </button>
        {/* Keyboard and screen-reader users cannot click the map: pan it with the arrow keys, then pin the centre. */}
        <button
          type="button"
          disabled={!ready}
          onClick={() => {
            const c = mapRef.current?.getCenter();
            if (c) onChangeRef.current({ lng: c.lng, lat: c.lat });
          }}
          className="btn btn-secondary btn-sm"
        >
          <Icon name="pin" className="h-4 w-4" />
          Pin map centre
        </button>
      </div>
      <p className="mt-2 text-sm text-slate-600" aria-live="polite">
        {value ? (
          <>
            <span className="font-semibold text-slate-800">Pin placed</span> at <span className="font-mono">{value.lat.toFixed(5)}, {value.lng.toFixed(5)}</span>. Drag it to adjust.
          </>
        ) : (
          "No pin yet: click the map where the problem is."
        )}
      </p>
      {(geoError || outside) && (
        <Alert tone="danger" className="mt-2">
          {outside ? `That spot is outside ${MUNICIPALITY.name}. Move the pin inside the municipality.` : geoError}
        </Alert>
      )}
    </div>
  );
}
