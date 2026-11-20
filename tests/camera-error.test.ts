import { describe, expect, it } from "vitest";
import { describeCameraError } from "../lib/camera-error";

describe("describeCameraError", () => {
  it("maps a permission rejection to a recovery instruction", () => {
    expect(describeCameraError("NotAllowedError: Permission denied")).toMatch(
      /permission denied/i,
    );
    expect(describeCameraError("Error getting userMedia, error = NotAllowedError")).toMatch(
      /allow camera access/i,
    );
  });

  it("maps a missing camera", () => {
    expect(describeCameraError("NotFoundError: Requested device not found")).toMatch(
      /no camera was found/i,
    );
  });

  it("maps a busy camera", () => {
    expect(describeCameraError("NotReadableError: Could not start video source")).toMatch(
      /in use by another app/i,
    );
  });

  it("maps an insecure context", () => {
    expect(describeCameraError("The device doesn't support navigator.mediaDevices")).toMatch(
      /browser cannot start/i,
    );
    expect(describeCameraError("insecureContextCameraQueryError")).toMatch(
      /secure connection/i,
    );
  });

  it("passes through an informative string from the library", () => {
    expect(describeCameraError("videoConstraints should be defined")).toBe(
      "videoConstraints should be defined",
    );
  });

  it("reads the message off a real Error", () => {
    expect(describeCameraError(new Error("boom"))).toBe("boom");
  });

  it("falls back when there is nothing usable to show", () => {
    expect(describeCameraError(null)).toMatch(/type the code instead/i);
    expect(describeCameraError({})).toMatch(/type the code instead/i);
    expect(describeCameraError("")).toMatch(/type the code instead/i);
  });
});
