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

export async function createMap(
  container: HTMLElement,
  opts: { center?: [number, number]; zoom?: number; interactive?: boolean } = {},
): Promise<MlMap> {
  const { Map, NavigationControl } = await import("maplibre-gl");
  const [minLng, minLat, maxLng, maxLat] = MUNICIPALITY.bounds;
  const pad = 0.1;
  const map = new Map({
    container,
    style: baseStyle(),
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
  if (opts.interactive !== false) {
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");
  }
  return map;
}
