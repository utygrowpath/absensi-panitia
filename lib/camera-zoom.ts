/**
 * Read the camera's zoom range from html5-qrcode's RangeCameraCapability.
 *
 * The capability has three distinct failure modes, so each needs its own
 * guard: isSupported() returns false when the track exposes no capabilities at
 * all (iOS Safari), min()/max()/step() throw a real Error through
 * failIfNotSupported(), and value() can report null or a stale reading.
 */

export type ZoomRange = {
  min: number;
  max: number;
  /** Usable increment for the slider. Never zero, never the whole span. */
  step: number;
  /** Current zoom, clamped into [min, max]. */
  value: number;
};

/** Structural shape of html5-qrcode's RangeCameraCapability. */
export type ZoomCapability = {
  isSupported(): boolean;
  min(): number;
  max(): number;
  step(): number;
  value(): number | null;
  /** Applies the value to the camera track. Rejects when refused. */
  apply(value: number): Promise<void>;
};

export function readZoomRange(capability: ZoomCapability): ZoomRange | null {
  try {
    if (!capability.isSupported()) return null;

    const min = capability.min();
    const max = capability.max();
    const reportedStep = capability.step();
    if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return null;

    // A step of zero, or one at least as large as the whole range, would leave
    // the slider with a single reachable position.
    const span = max - min;
    let step = Number.isFinite(reportedStep) && reportedStep > 0 ? reportedStep : 0.1;
    if (step >= span) step = Math.min(0.1, span / 10);

    const reported = capability.value();
    const value =
      reported !== null && Number.isFinite(reported) ? Math.min(Math.max(reported, min), max) : min;

    return { min, max, step, value };
  } catch {
    // min()/max()/step() throw when the capability is absent.
    return null;
  }
}
