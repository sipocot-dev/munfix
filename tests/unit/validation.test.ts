import { describe, expect, it } from "vitest";
import { deleteAccountSchema, loginSchema, reportSchema, transitionSchema } from "@/lib/validation";

const validReport = {
  title: "Large pothole",
  description: "A deep pothole near the market entrance.",
  categorySlug: "roads",
  lat: "13.81",
  lng: 122.95,
};

describe("reportSchema", () => {
  it("accepts a valid report and coerces coordinates from strings", () => {
    const parsed = reportSchema.parse(validReport);
    expect(parsed.lat).toBe(13.81);
    expect(parsed.lng).toBe(122.95);
  });

  it("rejects a short title and a short description", () => {
    expect(() => reportSchema.parse({ ...validReport, title: "abc" })).toThrow();
    expect(() => reportSchema.parse({ ...validReport, description: "short" })).toThrow();
  });

  it("rejects out-of-range coordinates", () => {
    expect(() => reportSchema.parse({ ...validReport, lat: 91 })).toThrow();
    expect(() => reportSchema.parse({ ...validReport, lng: "abc" })).toThrow();
  });

  it("turns blank optional text into undefined", () => {
    expect(reportSchema.parse({ ...validReport, barangay: "   " }).barangay).toBeUndefined();
    expect(reportSchema.parse({ ...validReport, address: null }).address).toBeUndefined();
  });
});

describe("account schemas", () => {
  it("normalises login email case and whitespace", () => {
    expect(loginSchema.parse({ email: "  Carl@Example.COM ", password: "x" }).email).toBe("carl@example.com");
  });

  it("rejects an invalid email", () => {
    expect(() => loginSchema.parse({ email: "not-an-email", password: "x" })).toThrow();
  });

  it("requires the exact word DELETE to delete an account", () => {
    expect(deleteAccountSchema.safeParse({ confirm: "delete" }).success).toBe(false);
    expect(deleteAccountSchema.safeParse({ confirm: "DELETE" }).success).toBe(true);
  });
});

describe("transitionSchema", () => {
  it("accepts known statuses and rejects unknown ones", () => {
    expect(transitionSchema.safeParse({ to: "resolved" }).success).toBe(true);
    expect(transitionSchema.safeParse({ to: "closed" }).success).toBe(false);
  });

  it("requires a UUID for duplicateOf", () => {
    expect(transitionSchema.safeParse({ to: "duplicate", duplicateOf: "nope" }).success).toBe(false);
  });
});
