"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as MlMap, Marker as MlMarker } from "maplibre-gl";
import { MUNICIPALITY, withinBounds } from "@/lib/config";
import { createMap } from "@/lib/map";

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
      const marker = new Marker({ color: "#0f766e", draggable: true })
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
      () => {
        setLocating(false);
        setGeoError("Could not get your location. Click the map to place the pin instead.");
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  const outside = value ? !withinBounds(value.lng, value.lat) : false;

  return (
    <div>
      <div ref={el} className="h-80 w-full overflow-hidden rounded-xl border border-slate-300" />
      <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
        <button type="button" onClick={useMyLocation} disabled={locating} className="btn btn-secondary !py-1.5">
          {locating ? "Locating…" : "Use my location"}
        </button>
        <span className="text-slate-600">
          {value ? `Pin at ${value.lat.toFixed(5)}, ${value.lng.toFixed(5)} — drag to adjust` : "Click the map to drop a pin on the problem"}
        </span>
      </div>
      {(geoError || outside) && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {outside ? `That spot is outside ${MUNICIPALITY.name}. Move the pin inside the city.` : geoError}
        </p>
      )}
    </div>
  );
}
