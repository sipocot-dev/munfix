import { describe, expect, it } from "vitest";
import { allowedTransitions, canViewUnpublished, isStaffRole, viewableStatuses } from "@/lib/permissions";
import { TRANSITIONS, type Status } from "@/lib/status";

describe("allowedTransitions", () => {
  it("gives citizens no transitions", () => {
    expect(allowedTransitions("citizen", "submitted")).toEqual([]);
    expect(allowedTransitions(null, "verified")).toEqual([]);
  });

  it("limits moderators to review decisions", () => {
    expect(allowedTransitions("moderator", "submitted")).toEqual(["under_review", "verified", "rejected", "duplicate"]);
    expect(allowedTransitions("moderator", "verified")).toEqual(["rejected"]);
  });

  it("limits field staff to in progress and resolved", () => {
    expect(allowedTransitions("staff", "verified")).toEqual(["in_progress", "resolved"]);
    expect(allowedTransitions("staff", "resolved")).toEqual(["in_progress"]);
    expect(allowedTransitions("staff", "submitted")).toEqual([]);
  });

  it("gives admins every legal transition", () => {
    for (const from of Object.keys(TRANSITIONS) as Status[]) {
      expect(allowedTransitions("admin", from)).toEqual([...TRANSITIONS[from]]);
    }
  });

  it("never offers a transition the state machine forbids", () => {
    for (const role of ["moderator", "staff", "admin"] as const) {
      for (const from of Object.keys(TRANSITIONS) as Status[]) {
        for (const to of allowedTransitions(role, from)) {
          expect(TRANSITIONS[from]).toContain(to);
        }
      }
    }
  });
});

describe("visibility", () => {
  it("keeps unreviewed reports away from staff", () => {
    expect(viewableStatuses("staff")).not.toContain("submitted");
    expect(viewableStatuses("staff")).not.toContain("under_review");
    expect(canViewUnpublished("staff")).toBe(false);
  });

  it("lets moderators and admins see unpublished reports", () => {
    expect(viewableStatuses("moderator")).toContain("submitted");
    expect(canViewUnpublished("admin")).toBe(true);
  });

  it("treats only moderator, staff and admin as staff roles", () => {
    expect(isStaffRole("citizen")).toBe(false);
    expect(isStaffRole(null)).toBe(false);
    expect(isStaffRole("staff")).toBe(true);
  });
});
