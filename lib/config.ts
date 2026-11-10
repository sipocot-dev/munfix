// Municipality configuration. NEXT_PUBLIC_* values are inlined at build time.

function num(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return value !== undefined && value !== "" && Number.isFinite(n) ? n : fallback;
}

function parseBounds(value: string | undefined, center: [number, number]): [number, number, number, number] {
  const parts = (value ?? "").split(",").map(Number);
  if (parts.length === 4 && parts.every(Number.isFinite)) {
    return parts as [number, number, number, number];
  }
  const d = 0.3;
  return [center[0] - d, center[1] - d, center[0] + d, center[1] + d];
}

const center: [number, number] = [
  num(process.env.NEXT_PUBLIC_MAP_CENTER_LNG, 122.9833),
  num(process.env.NEXT_PUBLIC_MAP_CENTER_LAT, 13.7667),
];

export const MUNICIPALITY = {
  name: process.env.NEXT_PUBLIC_MUNICIPALITY_NAME ?? "Sipocot",
  province: process.env.NEXT_PUBLIC_PROVINCE_NAME ?? "Camarines Sur",
  center,
  /** [minLng, minLat, maxLng, maxLat] */
  bounds: parseBounds(process.env.NEXT_PUBLIC_MAP_BOUNDS, center),
  tileUrl: process.env.NEXT_PUBLIC_MAP_TILE_URL ?? "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
} as const;

export function withinBounds(lng: number, lat: number): boolean {
  const [minLng, minLat, maxLng, maxLat] = MUNICIPALITY.bounds;
  return lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat;
}
