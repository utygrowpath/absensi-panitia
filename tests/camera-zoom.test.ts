import { describe, expect, it } from "vitest";
import { readZoomRange, type ZoomCapability } from "../lib/camera-zoom";

function capability(overrides: Partial<ZoomCapability> = {}): ZoomCapability {
  return {
    isSupported: () => true,
    min: () => 1,
    max: () => 5,
    step: () => 0.1,
    value: () => 1,
    apply: () => Promise.resolve(),
    ...overrides,
  };
}

describe("readZoomRange", () => {
  it("reads a normal zoom range", () => {
    expect(readZoomRange(capability({ value: () => 2.5 }))).toEqual({
      min: 1,
      max: 5,
      step: 0.1,
      value: 2.5,
    });
  });

  it("returns null when the track exposes no capabilities", () => {
    expect(readZoomRange(capability({ isSupported: () => false }))).toBeNull();
  });

  it("returns null when reading the range throws", () => {
    expect(
      readZoomRange(
        capability({
          min: () => {
            throw new Error("zoom capability not supported");
          },
        }),
      ),
    ).toBeNull();
  });

  it("returns null when the range is degenerate", () => {
    expect(readZoomRange(capability({ min: () => 3, max: () => 3 }))).toBeNull();
    expect(readZoomRange(capability({ max: () => 1, min: () => 5 }))).toBeNull();
  });

  it("returns null when a bound is not finite", () => {
    expect(readZoomRange(capability({ min: () => Number.NaN }))).toBeNull();
    expect(readZoomRange(capability({ max: () => Number.POSITIVE_INFINITY }))).toBeNull();
  });

  it("falls back to min when no current value is reported", () => {
    expect(readZoomRange(capability({ value: () => null }))?.value).toBe(1);
    expect(readZoomRange(capability({ value: () => Number.NaN }))?.value).toBe(1);
  });

  it("clamps a reported value into the range", () => {
    expect(readZoomRange(capability({ value: () => 99 }))?.value).toBe(5);
    expect(readZoomRange(capability({ value: () => -4 }))?.value).toBe(1);
  });

  it("replaces a zero or negative step", () => {
    expect(readZoomRange(capability({ step: () => 0 }))?.step).toBe(0.1);
    expect(readZoomRange(capability({ step: () => -1 }))?.step).toBe(0.1);
    expect(readZoomRange(capability({ step: () => Number.NaN }))?.step).toBe(0.1);
  });

  it("replaces a step that spans the whole range", () => {
    // min 1, max 5, step 5 would only ever reach 1.
    expect(readZoomRange(capability({ step: () => 5 }))?.step).toBeCloseTo(0.1, 6);
  });

  it("keeps a narrow range usable when the step is too coarse", () => {
    // min 1, max 1.05, step 1 leaves one position; shrink it to fit.
    const range = readZoomRange(capability({ min: () => 1, max: () => 1.05, step: () => 1 }));
    expect(range?.step).toBeCloseTo(0.005, 6);
    expect(range?.step).toBeLessThan(0.05);
  });

  it("keeps a valid step that fits the range", () => {
    expect(readZoomRange(capability({ step: () => 0.5 }))?.step).toBe(0.5);
  });
});
