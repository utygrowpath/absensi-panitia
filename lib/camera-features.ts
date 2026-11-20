/**
 * Camera selection, torch and focus helpers for html5-qrcode.
 *
 * Two traps live here. First, Html5Qrcode.start() ignores its first argument
 * whenever `videoConstraints` is set in the config, so a deviceId passed there
 * is silently dropped and the camera never switches: the device has to go into
 * videoConstraints itself. Second, neither the library nor TypeScript's DOM
 * typings know about focusMode, so reading it needs a defensive lookup.
 */

export type TorchCapability = {
  isSupported(): boolean;
  value(): boolean | null;
  apply(on: boolean): Promise<void>;
};

/** The constraints used for every start, pinned to one device when given. */
export function buildVideoConstraints(deviceId?: string): MediaTrackConstraints {
  const base = { width: { ideal: 1280 }, height: { ideal: 720 } };
  return deviceId
    ? // An exact device must not also carry facingMode: the two can conflict
      // and getUserMedia then rejects with OverconstrainedError.
      { ...base, deviceId: { exact: deviceId } }
    : { ...base, facingMode: "environment" };
}

export type CameraChoice = { id: string; label: string };

/** What the running stream reports about itself. */
export type TrackInfo = {
  deviceId: string | null;
  width: number;
  height: number;
};

/** Keep real, identifiable video inputs and name the ones without a label. */
export function toCameraList(
  devices: readonly { kind: string; deviceId: string; label: string }[],
): CameraChoice[] {
  const cameras: CameraChoice[] = [];
  for (const device of devices) {
    if (device.kind !== "videoinput" || !device.deviceId) continue;
    cameras.push({
      id: device.deviceId,
      label: device.label || `Camera ${cameras.length + 1}`,
    });
  }
  return cameras;
}

/**
 * Short badge for a capture width, the way camera apps label resolution.
 * Returns an empty string when the stream reports nothing usable, so the chip
 * is hidden rather than showing a made-up value.
 */
export function resolutionLabel(width: number): string {
  if (!Number.isFinite(width) || width <= 0) return "";
  if (width >= 3840) return "4K";
  if (width >= 2560) return "QHD";
  if (width >= 1920) return "FHD";
  if (width >= 1280) return "HD";
  if (width >= 640) return "SD";
  return "";
}

/**
 * Whether a tap can re-trigger autofocus. Only a camera reporting an `auto`
 * focus mode has something to ask for; one stuck on `manual` alone, or with no
 * focusMode at all (most browsers), leaves nothing to change.
 */
export function supportsAutoFocus(capabilities: unknown): boolean {
  if (capabilities === null || typeof capabilities !== "object") return false;
  const modes = (capabilities as { focusMode?: unknown }).focusMode;
  return Array.isArray(modes) && modes.includes("auto");
}
