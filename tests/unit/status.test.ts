import { describe, expect, it } from "vitest";
import { CITIZEN_EDITABLE, isPublicStatus, isStatus, PUBLIC_STATUSES, REASON_REQUIRED, STATUSES, TRANSITIONS } from "@/lib/status";

describe("status state machine", () => {
  it("has a transition entry for every status", () => {
    expect(Object.keys(TRANSITIONS).sort()).toEqual([...STATUSES].sort());
  });

  it("keeps terminal statuses terminal", () => {
    expect(TRANSITIONS.rejected).toEqual([]);
    expect(TRANSITIONS.duplicate).toEqual([]);
    expect(TRANSITIONS.withdrawn).toEqual([]);
  });

  it("lets moderators hide any public report, and only restore a hidden one by publishing it", () => {
    for (const s of PUBLIC_STATUSES) expect(TRANSITIONS[s]).toContain("hidden");
    expect(TRANSITIONS.hidden).toEqual(["verified"]);
  });

  it("only allows reopening a resolved report to in progress (or hiding it)", () => {
    expect(TRANSITIONS.resolved).toEqual(["in_progress", "hidden"]);
  });

  it("publishes reports, including those under review; hidden, rejected and pre-publication ones stay private", () => {
    expect(PUBLIC_STATUSES).toEqual(["verified", "under_review", "in_progress", "resolved"]);
    for (const s of ["submitted", "hidden", "rejected", "duplicate", "withdrawn"] as const) expect(isPublicStatus(s)).toBe(false);
  });

  it("requires a reason to hide or reject, because the reporter is told", () => {
    expect(REASON_REQUIRED).toEqual(["rejected", "hidden"]);
  });

  it("lets reporters edit only until work starts", () => {
    expect(CITIZEN_EDITABLE).toEqual(["submitted", "verified", "under_review"]);
  });

  it("validates unknown values", () => {
    expect(isStatus("hidden")).toBe(true);
    expect(isStatus("closed")).toBe(false);
    expect(isStatus(42)).toBe(false);
  });
});
