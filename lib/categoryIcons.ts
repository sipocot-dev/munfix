/**
 * Category icons as 24×24 stroke paths (drawn for MunFix, stroke-width 2, round caps). Plain strings so the
 * same shapes render in React (CategoryIcon) and inside the map's DOM pins, which are built outside React.
 * Emoji were used before; they render differently on every platform and read as informal.
 */
export const CATEGORY_ICON: Record<string, string> = {
  // Road with lane markings
  roads: "M5 21 9 3M19 21 15 3M12 4v2.5M12 10.5v3M12 17.5V20",
  // Light bulb
  streetlights: "M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.3 1.1 2.2h5c.1-.9.5-1.7 1.1-2.2A6 6 0 0 0 12 3Z",
  // Waves
  drainage: "M2 7c2 0 2-1.5 4-1.5S8 7 10 7s2-1.5 4-1.5S16 7 18 7s2-1.5 4-1.5M2 12.5c2 0 2-1.5 4-1.5s2 1.5 4 1.5 2-1.5 4-1.5 2 1.5 4 1.5 2-1.5 4-1.5M2 18c2 0 2-1.5 4-1.5S8 18 10 18s2-1.5 4-1.5 2 1.5 4 1.5 2-1.5 4-1.5",
  // Bin
  garbage: "M4 6h16M9 6V4h6v2M6 6l1 14h10l1-14M10 10v6M14 10v6",
  // Droplet
  water: "M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z",
  // Lightning
  electricity: "M13 2 4 14h7l-1 8 9-12h-7l1-8Z",
  // Bridge
  bridges: "M2 17h20M4 17v-4M20 17v-4M2 13c3-5 17-5 20 0M8 17v-5.2M12 17v-6M16 17v-5.2",
  // Sign post
  signage: "M12 3v18M8 21h8M5 6h11l3 2.5L16 11H5Z",
  // Public building
  "public-facilities": "M3 21h18M5 18h14M6 18v-7M10 18v-7M14 18v-7M18 18v-7M3 11 12 4l9 7Z",
  // Question mark in a circle
  other: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM9.5 9.2a2.6 2.6 0 0 1 5 .8c0 1.8-2.5 2.3-2.5 3.8M12 17h.01",
};

/** Map pin, used when a category has no icon of its own. */
const FALLBACK = "M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11ZM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z";

export const iconPathFor = (slug: string): string => CATEGORY_ICON[slug] ?? FALLBACK;
