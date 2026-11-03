import { describe, expect, it } from "vitest";
import { cn, formatDuration, humanize, minutesToText } from "./format";

describe("format utils", () => {
  it("humanizes enum values", () => expect(humanize("IN_PROGRESS")).toBe("In progress"));
  it("formats durations", () => {
    expect(formatDuration(45 * 60_000)).toBe("45m");
    expect(formatDuration(200 * 60_000)).toBe("3h 20m");
    expect(formatDuration(28 * 3_600_000)).toBe("1d 4h");
  });
  it("never shows negative durations", () => expect(formatDuration(-5000)).toBe("0m"));
  it("converts minutes to text", () => expect(minutesToText(120)).toBe("2h 0m"));
  it("joins only truthy class names", () => expect(cn("a", false, null, "b")).toBe("a b"));
});
