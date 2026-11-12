import { describe, expect, it } from "vitest";
import { isPublicStatus, isStatus, PUBLIC_STATUSES, STATUSES, TRANSITIONS } from "@/lib/status";

describe("status state machine", () => {
  it("has a transition entry for every status", () => {
    expect(Object.keys(TRANSITIONS).sort()).toEqual([...STATUSES].sort());
  });

  it("keeps terminal statuses terminal", () => {
    expect(TRANSITIONS.rejected).toEqual([]);
    expect(TRANSITIONS.duplicate).toEqual([]);
    expect(TRANSITIONS.withdrawn).toEqual([]);
  });

  it("only allows reopening a resolved report to in progress", () => {
    expect(TRANSITIONS.resolved).toEqual(["in_progress"]);
  });

  it("exposes only verified, in progress and resolved reports publicly", () => {
    expect(PUBLIC_STATUSES).toEqual(["verified", "in_progress", "resolved"]);
    expect(isPublicStatus("submitted")).toBe(false);
    expect(isPublicStatus("resolved")).toBe(true);
  });

  it("validates unknown values", () => {
    expect(isStatus("resolved")).toBe(true);
    expect(isStatus("closed")).toBe(false);
    expect(isStatus(42)).toBe(false);
  });
});
