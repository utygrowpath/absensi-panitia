import { describe, expect, it } from "vitest";
import { formatDate, formatTime, todayInJakarta } from "../lib/time";

describe("todayInJakarta", () => {
  it("reports the Jakarta date, not the UTC date", () => {
    // 2026-11-18 20:00 UTC is already 2026-11-19 03:00 in Jakarta (UTC+7).
    expect(todayInJakarta(new Date("2026-11-18T20:00:00Z"))).toBe("2026-11-19");
    expect(todayInJakarta(new Date("2026-11-18T10:00:00Z"))).toBe("2026-11-18");
  });

  it("rolls over at Jakarta midnight, not UTC midnight", () => {
    // 17:00 UTC is exactly midnight in Jakarta.
    expect(todayInJakarta(new Date("2026-11-18T16:59:59Z"))).toBe("2026-11-18");
    expect(todayInJakarta(new Date("2026-11-18T17:00:00Z"))).toBe("2026-11-19");
  });

  it("returns YYYY-MM-DD", () => {
    expect(todayInJakarta(new Date("2026-01-05T00:00:00Z"))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("formatTime", () => {
  it("formats a timestamp as Jakarta wall-clock HH:MM", () => {
    expect(formatTime("2026-11-18T03:45:00Z")).toBe("10:45");
  });

  it("renders an em dash when there is no timestamp", () => {
    expect(formatTime(null)).toBe("—");
    expect(formatTime(undefined)).toBe("—");
    expect(formatTime("not-a-date")).toBe("—");
  });

  it("uses 24-hour time", () => {
    expect(formatTime("2026-11-18T17:05:00Z")).toBe("00:05");
  });
});

describe("formatDate", () => {
  it("formats a YYYY-MM-DD string", () => {
    expect(formatDate("2026-11-18")).toBe("18 Nov 2026");
  });

  it("renders an em dash for a bad value", () => {
    expect(formatDate("nope")).toBe("—");
  });
});
