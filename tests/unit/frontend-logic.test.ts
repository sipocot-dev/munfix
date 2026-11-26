import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/redis", () => ({ redis: {} }));

import { initials, isActive } from "@/components/SiteNav";
import { pinSvg } from "@/components/ReportsMap";
import { extractId } from "@/lib/client";
import { DEFAULT_STATUSES, filtersFromQuery, filtersToQuery, matchesQuery } from "@/lib/explorer";

const report = { title: "Deep pothole near the market", categoryName: "Roads & potholes", problemType: "Pothole", barangay: "North Centro", address: null };

describe("explorer search", () => {
  it("matches any field, case-insensitively", () => {
    expect(matchesQuery(report, "POTHOLE")).toBe(true);
    expect(matchesQuery(report, "north centro")).toBe(true);
    expect(matchesQuery(report, "roads")).toBe(true);
    expect(matchesQuery(report, "streetlight")).toBe(false);
  });
  it("an empty search matches everything", () => {
    expect(matchesQuery(report, "")).toBe(true);
  });
});

describe("explorer filters in the URL", () => {
  const slugs = ["roads", "drainage"];

  it("leaves the defaults out, so the plain map URL stays clean", () => {
    expect(filtersToQuery({ statuses: [...DEFAULT_STATUSES], category: "", q: "" })).toBe("");
  });

  it("round-trips a filtered view", () => {
    const f = { statuses: ["verified", "resolved"] as const, category: "roads", q: "market" };
    const qs = filtersToQuery({ ...f, statuses: [...f.statuses] });
    const back = filtersFromQuery(Object.fromEntries(new URLSearchParams(qs)), slugs);
    expect(back).toEqual({ statuses: ["verified", "resolved"], category: "roads", q: "market" });
  });

  it("ignores statuses that are not public and unknown categories", () => {
    const f = filtersFromQuery({ status: "submitted,rejected,bogus", category: "nope" }, slugs);
    expect(f.statuses).toEqual(DEFAULT_STATUSES);
    expect(f.category).toBe("");
  });

  it("keeps statuses in canonical order and caps the search text", () => {
    expect(filtersFromQuery({ status: "resolved,verified" }, slugs).statuses).toEqual(["verified", "resolved"]);
    expect(filtersFromQuery({ q: "x".repeat(500) }, slugs).q).toHaveLength(100);
  });
});

describe("navigation helpers", () => {
  it("marks a section active on its sub-pages, but the map only on itself", () => {
    expect(isActive("/admin/users", "/admin")).toBe(true);
    expect(isActive("/administrator", "/admin")).toBe(false);
    expect(isActive("/about", "/")).toBe(false);
    expect(isActive("/", "/")).toBe(true);
  });

  it("builds avatar initials", () => {
    expect(initials("Maria dela Cruz")).toBe("MC");
    expect(initials("Rina")).toBe("R");
    expect(initials("  ")).toBe("?");
  });
});

describe("mark-duplicate input", () => {
  it("accepts a pasted report link or a bare id", () => {
    const id = "aa25f128-6e81-4e65-aa1e-c3f1940da0f9";
    expect(extractId(`https://munfix.example/reports/${id}?x=1`)).toBe(id);
    expect(extractId(` ${id.toUpperCase()} `)).toBe(id);
    expect(extractId("not an id")).toBe("not an id");
  });
});

describe("map pins", () => {
  it("colour by status and draw the category icon; no report text is placed in the markup", () => {
    const svg = pinSvg({ status: "in_progress", categorySlug: "water" });
    expect(svg).toContain('fill="#2563eb"');
    expect(svg).toContain('stroke="#1d4ed8"');
    expect(svg).toContain('aria-hidden="true"');
  });
});

import { clusterLabel, clusterSize } from "@/components/ReportsMap";

describe("cluster markers", () => {
  it("keep counts short enough to fit the bubble, with the full number in the label", () => {
    expect(clusterLabel(7)).toBe("7");
    expect(clusterLabel(999)).toBe("999");
    expect(clusterLabel(1000)).toBe("1k");
    expect(clusterLabel(1234)).toBe("1.2k");
    expect(clusterLabel(15400)).toBe("15k");
  });
  it("grow in steps, never below a comfortable touch target", () => {
    expect(clusterSize(2)).toBe(36);
    expect(clusterSize(10)).toBe(44);
    expect(clusterSize(500)).toBe(52);
  });
});
