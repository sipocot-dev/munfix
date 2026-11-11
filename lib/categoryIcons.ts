/** Emoji glyph shown inside each map pin, by category slug. */
export const CATEGORY_GLYPH: Record<string, string> = {
  roads: "🚧",
  streetlights: "💡",
  drainage: "🌊",
  garbage: "🗑️",
  water: "💧",
  electricity: "⚡",
  bridges: "🌉",
  signage: "🚸",
  "public-facilities": "🏛️",
  other: "❓",
};

export const glyphFor = (slug: string): string => CATEGORY_GLYPH[slug] ?? "📍";
