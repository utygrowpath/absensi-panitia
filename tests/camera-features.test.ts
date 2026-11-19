import { describe, expect, it } from "vitest";
import {
  buildVideoConstraints,
  resolutionLabel,
  supportsAutoFocus,
  toCameraList,
} from "../lib/camera-features";

describe("buildVideoConstraints", () => {
  it("prefers the rear camera when no device is chosen", () => {
    const constraints = buildVideoConstraints();
    expect(constraints.facingMode).toBe("environment");
    expect(constraints.deviceId).toBeUndefined();
  });

  it("pins the chosen device without a conflicting facing mode", () => {
    // facingMode alongside an exact device makes getUserMedia reject when the
    // device is a front camera, so the switch would silently fall back.
    const constraints = buildVideoConstraints("device-abc");
    expect(constraints.deviceId).toEqual({ exact: "device-abc" });
    expect(constraints.facingMode).toBeUndefined();
  });

  it("keeps requesting a decode-friendly resolution", () => {
    expect(buildVideoConstraints().width).toEqual({ ideal: 1280 });
    expect(buildVideoConstraints("x").height).toEqual({ ideal: 720 });
  });
});

describe("toCameraList", () => {
  it("keeps video inputs that carry an id", () => {
    const list = toCameraList([
      { kind: "videoinput", deviceId: "back", label: "Back camera" },
      { kind: "audioinput", deviceId: "mic", label: "Microphone" },
      { kind: "videoinput", deviceId: "", label: "No id" },
    ]);
    expect(list).toEqual([{ id: "back", label: "Back camera" }]);
  });

  it("names a camera when the label is missing", () => {
    // Labels stay empty until camera permission has been granted once.
    expect(
      toCameraList([
        { kind: "videoinput", deviceId: "a", label: "" },
        { kind: "videoinput", deviceId: "b", label: "" },
      ]),
    ).toEqual([
      { id: "a", label: "Camera 1" },
      { id: "b", label: "Camera 2" },
    ]);
  });

  it("returns nothing when the browser withholds devices", () => {
    expect(toCameraList([])).toEqual([]);
  });
});

describe("supportsAutoFocus", () => {
  it("accepts cameras that report an auto mode", () => {
    expect(supportsAutoFocus({ focusMode: ["auto"] })).toBe(true);
    expect(supportsAutoFocus({ focusMode: ["auto", "manual"] })).toBe(true);
  });

  it("rejects cameras with nothing to re-trigger", () => {
    expect(supportsAutoFocus({})).toBe(false);
    expect(supportsAutoFocus({ focusMode: ["manual"] })).toBe(false);
    expect(supportsAutoFocus({ focusMode: "auto" })).toBe(false);
  });

  it("rejects when the browser exposes no capabilities at all", () => {
    expect(supportsAutoFocus(undefined)).toBe(false);
    expect(supportsAutoFocus(null)).toBe(false);
    expect(supportsAutoFocus("zoom")).toBe(false);
  });
});

describe("resolutionLabel", () => {
  it("names the common capture widths", () => {
    expect(resolutionLabel(3840)).toBe("4K");
    expect(resolutionLabel(2560)).toBe("QHD");
    expect(resolutionLabel(1920)).toBe("FHD");
    expect(resolutionLabel(1280)).toBe("HD");
    expect(resolutionLabel(640)).toBe("SD");
  });

  it("hides the chip when the stream reports nothing usable", () => {
    // Before metadata loads the track reports 0, and a badge would be a lie.
    expect(resolutionLabel(0)).toBe("");
    expect(resolutionLabel(-1)).toBe("");
    expect(resolutionLabel(Number.NaN)).toBe("");
  });
});
