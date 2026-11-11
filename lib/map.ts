// Client-only MapLibre helpers. maplibre-gl touches `window`, so it is always
// imported dynamically from inside effects, never at module scope.
import type { Map as MlMap, StyleSpecification } from "maplibre-gl";
import { MUNICIPALITY } from "./config";

export function baseStyle(): StyleSpecification {
  return {
    version: 8,
    sources: {
      basemap: {
        type: "raster",
        tiles: [MUNICIPALITY.tileUrl],
        tileSize: 256,
        maxzoom: 19,
        attribution: "© OpenStreetMap contributors",
      },
    },
    layers: [{ id: "basemap", type: "raster", source: "basemap" }],
  };
}

/** OpenFreeMap vector style (free, no key): detailed labels and 3D buildings. */
export const VECTOR_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

export async function createMap(
  container: HTMLElement,
  opts: { center?: [number, number]; zoom?: number; interactive?: boolean; controls?: boolean; vector?: boolean } = {},
): Promise<MlMap> {
  const { Map, NavigationControl } = await import("maplibre-gl");
  const [minLng, minLat, maxLng, maxLat] = MUNICIPALITY.bounds;
  const pad = 0.1;
  const map = new Map({
    container,
    style: opts.vector ? VECTOR_STYLE_URL : baseStyle(),
    center: opts.center ?? MUNICIPALITY.center,
    zoom: opts.zoom ?? 11.5,
    minZoom: 9,
    maxBounds: [
      [minLng - pad, minLat - pad],
      [maxLng + pad, maxLat + pad],
    ],
    attributionControl: { compact: true },
    interactive: opts.interactive ?? true,
  });
  if (opts.vector) {
    // If the vector style cannot be fetched, fall back to the plain OpenStreetMap tiles.
    let fell = false;
    map.on("error", (e) => {
      if (fell || map.isStyleLoaded()) return;
      const msg = String((e as { error?: Error }).error?.message ?? "");
      if (/style|fetch|Failed|NetworkError/i.test(msg)) {
        fell = true;
        map.setStyle(baseStyle());
      }
    });
  }
  if (opts.interactive !== false && opts.controls !== false) {
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");
  }
  return map;
}
