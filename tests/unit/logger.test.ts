import { describe, expect, it } from "vitest";
import { formatLog } from "@/lib/logger";

describe("formatLog", () => {
  it("writes one JSON object per line with level, message and fields", () => {
    const line = formatLog("info", "report created", { requestId: "abc", count: 2 });
    expect(line).not.toContain("\n");
    const parsed = JSON.parse(line);
    expect(parsed).toMatchObject({ level: "info", msg: "report created", requestId: "abc", count: 2 });
    expect(typeof parsed.time).toBe("string");
  });

  it("keeps the name, message and stack of an error", () => {
    const parsed = JSON.parse(formatLog("error", "boom", { err: new TypeError("bad input") }));
    expect(parsed.err).toMatchObject({ name: "TypeError", message: "bad input" });
    expect(parsed.err.stack).toContain("bad input");
  });
});
