import { describe, expect, it } from "vitest";
import { CATEGORY_ICON, iconPathFor } from "@/lib/categoryIcons";
import { CATEGORIES } from "@/lib/setup";
import { STATUSES, STATUS_COLOR, STATUS_TEXT } from "@/lib/status";

/** WCAG 2.x relative luminance and contrast ratio. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
/** `color` at `alpha` over white, as the badge background (`${color}1a`) renders. */
function tint(color: string, alpha: number): string {
  return "#" + [1, 3, 5].map((i) => Math.round(parseInt(color.slice(i, i + 2), 16) * alpha + 255 * (1 - alpha)).toString(16).padStart(2, "0")).join("");
}

describe("colour contrast (WCAG 2.2 AA, 4.5:1 for body text)", () => {
  it.each(STATUSES)("status text for %s is readable on white and on its badge tint", (s) => {
    expect(contrast(STATUS_TEXT[s], "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(contrast(STATUS_TEXT[s], tint(STATUS_COLOR[s], 0x1a / 255))).toBeGreaterThanOrEqual(4.5);
  });

  it("the raw status colours are not used as text: two of them fail AA", () => {
    // Guards the reason STATUS_TEXT exists. If these ever pass, the two maps could be merged.
    expect(contrast(STATUS_COLOR.verified, "#ffffff")).toBeLessThan(4.5);
    expect(contrast(STATUS_COLOR.resolved, "#ffffff")).toBeLessThan(4.5);
  });

  it.each([
    ["primary button (white on ink-700)", "#ffffff", "#1d3557"],
    ["report button (white on signal-600)", "#ffffff", "#c2410c"],
    ["eyebrow / secondary text (slate-600 on the page canvas)", "#45556c", "#f5f7fa"],
    ["link (ink-700 on white)", "#1d3557", "#ffffff"],
  ])("%s", (_l, fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("category icons", () => {
  it("every seeded category has its own icon (no fallback pin)", () => {
    for (const [slug] of CATEGORIES) expect(CATEGORY_ICON[slug], slug).toBeTruthy();
  });

  it("falls back to a pin for unknown categories", () => {
    expect(iconPathFor("not-a-category")).toMatch(/^M12 21/);
  });

  it("icon paths contain only SVG path commands, so they are safe to inline into pin markup", () => {
    for (const d of Object.values(CATEGORY_ICON)) expect(d).toMatch(/^[MmLlHhVvCcSsQqTtAaZz0-9.,\s-]+$/);
  });
});
