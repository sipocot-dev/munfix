// Client-only MapLibre helpers. maplibre-gl touches `window`, so it is always
// imported dynamically from inside effects, never at module scope.
import type { Map as MlMap, StyleSpecification } from "maplibre-gl";
import { MUNICIPALITY } from "./config";

/*
 * Basemap (docs/map-tiles.md). Default: OpenFreeMap vector styles, free with no API key or request
 * limits, OpenStreetMap data. Light uses "liberty" (readable street names for placing a pin), dark uses
 * "fiord" (a blue-grey that stays in the brand's ink family). Any MapLibre style URL works, including a
 * self-hosted one; NEXT_PUBLIC_MAP_TILE_URL switches to a raster tile service instead.
 * The public tile.openstreetmap.org server is never used: its policy forbids production app traffic.
 */
export const MAP_STYLE_LIGHT = process.env.NEXT_PUBLIC_MAP_STYLE_URL || "https://tiles.openfreemap.org/styles/liberty";
export const MAP_STYLE_DARK = process.env.NEXT_PUBLIC_MAP_STYLE_URL_DARK || "https://tiles.openfreemap.org/styles/fiord";
const RASTER_TILES = process.env.NEXT_PUBLIC_MAP_TILE_URL || "";
const RASTER_ATTRIBUTION = process.env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION || "© OpenStreetMap contributors";

export type Theme = "light" | "dark";

export function currentTheme(): Theme {
  return typeof document !== "undefined" && document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

/** The style to load for a theme: a raster tile service if one is configured, otherwise a vector style URL. */
export function styleFor(theme: Theme): string | StyleSpecification {
  if (RASTER_TILES) {
    return {
      version: 8,
      sources: { basemap: { type: "raster", tiles: [RASTER_TILES], tileSize: 256, maxzoom: 19, attribution: RASTER_ATTRIBUTION } },
      layers: [{ id: "basemap", type: "raster", source: "basemap", paint: theme === "dark" ? { "raster-brightness-max": 0.75, "raster-saturation": -0.3 } : {} }],
    };
  }
  return theme === "dark" ? MAP_STYLE_DARK : MAP_STYLE_LIGHT;
}

/** No third-party request at all: a plain background. Used when the basemap cannot be loaded, so pins still work. */
export function fallbackStyle(theme: Theme): StyleSpecification {
  return { version: 8, sources: {}, layers: [{ id: "background", type: "background", paint: { "background-color": theme === "dark" ? "#16233a" : "#e8ecef" } }] };
}

/** Fired on the map container when the basemap is replaced by the plain fallback. */
export const BASEMAP_UNAVAILABLE = "munfix:basemap-unavailable";

export async function createMap(
  container: HTMLElement,
  opts: { center?: [number, number]; zoom?: number; interactive?: boolean; controls?: boolean } = {},
): Promise<MlMap> {
  const { Map, NavigationControl, setWorkerUrl } = await import("maplibre-gl");
  // Served from public/ (copied from node_modules/maplibre-gl/dist); MapLibre 6 loads its worker from a file.
  setWorkerUrl("/maplibre-gl-worker.mjs");
  const [minLng, minLat, maxLng, maxLat] = MUNICIPALITY.bounds;
  const pad = 0.1;
  let theme = currentTheme();
  const map = new Map({
    container,
    style: styleFor(theme),
    center: opts.center ?? MUNICIPALITY.center,
    zoom: opts.zoom ?? 11.5,
    minZoom: 9,
    maxBounds: [
      [minLng - pad, minLat - pad],
      [maxLng + pad, maxLat + pad],
    ],
    attributionControl: { compact: true },
    fadeDuration: 150,
    interactive: opts.interactive ?? true,
  });

  // If the tile service is slow, blocked or broken, switch to the plain background so the map (and its pins) still work.
  let fellBack = false;
  const fallback = () => {
    if (fellBack) return;
    fellBack = true;
    map.setStyle(fallbackStyle(theme));
    container.dispatchEvent(new Event(BASEMAP_UNAVAILABLE));
  };
  const timer = setTimeout(() => {
    if (!map.isStyleLoaded()) fallback();
  }, 8000);
  map.once("style.load", () => clearTimeout(timer));
  map.on("error", (e) => {
    const err = e as unknown as { error?: { status?: number; message?: string }; tile?: unknown; sourceId?: string };
    // Tile errors are counted by the caller; a style that fails to load at all means no basemap.
    if (!map.isStyleLoaded() && !err.tile) fallback();
  });

  // Follow the site theme (components/ThemeSwitcher sets data-theme on <html>). Pins are DOM markers and survive.
  const observer = new MutationObserver(() => {
    const next = currentTheme();
    if (next === theme) return;
    theme = next;
    map.setStyle(fellBack ? fallbackStyle(theme) : styleFor(theme));
  });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  map.once("remove", () => {
    observer.disconnect();
    clearTimeout(timer);
  });

  if (opts.interactive !== false && opts.controls !== false) {
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");
  }
  return map;
}
