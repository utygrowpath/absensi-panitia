import { describe, expect, it } from "vitest";
import { DECODE_WIDTH, computeScanGeometry } from "../lib/scan-geometry";

describe("computeScanGeometry", () => {
  it("shrinks a decode surface wider than the panel", () => {
    const g = computeScanGeometry(DECODE_WIDTH, 360, 720);
    expect(g.scale).toBeCloseTo(360 / 1280, 6);
    // 720 * (360/1280) = 202.5, rounded to fit the panel exactly
    expect(g.height).toBe(203);
    expect(g.minHeight).toBe("0px");
  });

  it("fills a panel as wide as the decode surface without scaling", () => {
    const g = computeScanGeometry(DECODE_WIDTH, DECODE_WIDTH, 720);
    expect(g.scale).toBe(1);
    expect(g.height).toBe(720);
  });

  it("keeps the panel at its placeholder height before the video exists", () => {
    const g = computeScanGeometry(DECODE_WIDTH, 360, 0);
    expect(g.scale).toBeCloseTo(360 / 1280, 6);
    expect(g.height).toBeNull();
    expect(g.minHeight).toBe("");
  });

  it("falls back to an unscaled surface when the panel has no width yet", () => {
    const g = computeScanGeometry(DECODE_WIDTH, 0, 720);
    expect(g.scale).toBe(1);
    expect(g.height).toBeNull();
    expect(g.minHeight).toBe("");
  });

  it("never divides by a zero decode width", () => {
    const g = computeScanGeometry(0, 360, 720);
    expect(g.scale).toBe(1);
    expect(g.height).toBeNull();
  });

  it("produces a height that matches the scaled content", () => {
    // The invariant the aiming brackets depend on: panel height == video height
    // after scaling, so a centred guide lands on the video.
    const content = 960;
    const panelWidth = 480;
    const g = computeScanGeometry(DECODE_WIDTH, panelWidth, content);
    expect(g.height).toBe(Math.round(content * (panelWidth / DECODE_WIDTH)));
  });
});
