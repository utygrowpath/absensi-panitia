"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { describeCameraError } from "@/lib/camera-error";
import {
  buildVideoConstraints,
  supportsAutoFocus,
  toCameraList,
  type CameraChoice,
  type TorchCapability,
} from "@/lib/camera-features";
import { readZoomRange, type ZoomCapability, type ZoomRange } from "@/lib/camera-zoom";
import { DECODE_WIDTH, computeScanGeometry, type ScanGeometry } from "@/lib/scan-geometry";

type Props = {
  onToken: (token: string) => void;
  disabled?: boolean;
};

type Scanner = InstanceType<Awaited<ReturnType<typeof loadScanner>>>;

async function loadScanner() {
  const { Html5Qrcode } = await import("html5-qrcode");
  return Html5Qrcode;
}

const SCAN_FPS = 15;
/** start() resolves before the video plays, so allow time for the stream. */
const STREAM_TIMEOUT_MS = 3000;
/** Long enough for the focus ring animation to finish before it is removed. */
const FOCUS_VISIBLE_MS = 700;
/** Room for the control bar so the aiming brackets clear it. */
const CONTROLS_INSET = "5rem";

/**
 * Stop every stream and drop every video in the host. start() clears the
 * element before it appends, so two overlapping starts both get to append and
 * the page ends up with two live cameras; sweeping the host first is what
 * keeps that from happening.
 */
function clearHost(host: HTMLElement | null) {
  if (!host) return;
  for (const video of Array.from(host.querySelectorAll("video"))) {
    const stream = video.srcObject;
    if (stream instanceof MediaStream) {
      for (const track of stream.getTracks()) track.stop();
    }
    video.remove();
  }
}

function stopQuietly(scanner: Scanner | null) {
  if (!scanner) return;
  try {
    // stop() throws a string when the scanner never started.
    void scanner.stop().catch(() => {});
  } catch {
    // Ignore: nothing was running to stop.
  }
}

/**
 * List cameras without touching the running stream. Html5Qrcode.getCameras()
 * opens and closes a second getUserMedia, which can knock out the camera that
 * is already scanning; enumerateDevices() is safe because permission has
 * already been granted by the time this runs.
 */
async function enumerateCameras(): Promise<CameraChoice[]> {
  try {
    return toCameraList(Array.from(await navigator.mediaDevices.enumerateDevices()));
  } catch {
    return [];
  }
}

function probeZoom(scanner: Scanner): { range: ZoomRange; capability: ZoomCapability } | null {
  try {
    const capability = scanner.getRunningTrackCameraCapabilities().zoomFeature();
    const range = readZoomRange(capability);
    return range ? { range, capability } : null;
  } catch {
    return null;
  }
}

function probeTorch(scanner: Scanner): { capability: TorchCapability; on: boolean } | null {
  try {
    const capability = scanner.getRunningTrackCameraCapabilities().torchFeature();
    if (!capability.isSupported()) return null;
    return { capability, on: capability.value() ?? false };
  } catch {
    return null;
  }
}

function readDeviceId(scanner: Scanner): string | null {
  try {
    return scanner.getRunningTrackSettings().deviceId ?? null;
  } catch {
    return null;
  }
}

/**
 * Restart the camera's autofocus pass. The web platform exposes no
 * point-of-interest focus, so re-requesting `auto` is the only lever there is;
 * it helps where the driver re-runs autofocus on a repeat request, and is a
 * harmless no-op where it does not.
 */
function retriggerAutofocus(scanner: Scanner) {
  try {
    if (!supportsAutoFocus(scanner.getRunningTrackCapabilities())) return;
    void scanner
      .applyVideoConstraints({ focusMode: "auto" } as unknown as MediaTrackConstraints)
      .catch(() => {});
  } catch {
    // The camera stopped, or it exposes no focus controls at all.
  }
}

/**
 * Camera QR scanner built on html5-qrcode. Kept client-only because the
 * library reads `window` at import time.
 */
export default function QrScanner({ onToken, disabled }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<Scanner | null>(null);
  const zoomCapRef = useRef<ZoomCapability | null>(null);
  const torchCapRef = useRef<TorchCapability | null>(null);
  const onTokenRef = useRef(onToken);
  const timerRef = useRef<number | null>(null);
  const focusTimerRef = useRef<number | null>(null);
  const focusSeqRef = useRef(0);
  // Monotonic, unlike a boolean flag: StrictMode runs the mount effect twice
  // and the second run must invalidate the first, not clear its own cancel.
  const epochRef = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);
  const [active, setActive] = useState(false);
  const [zoom, setZoom] = useState<{ range: ZoomRange; value: number } | null>(null);
  const [cameras, setCameras] = useState<CameraChoice[]>([]);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState<boolean | null>(null);
  const [focus, setFocus] = useState<{ x: number; y: number; seq: number } | null>(null);
  const [geom, setGeom] = useState<ScanGeometry>({
    scale: 1,
    height: null,
    minHeight: "",
  });

  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  // The decode surface stays at DECODE_WIDTH and is scaled to fit, so the
  // canvas matches the camera stream instead of the much smaller CSS width.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    const host = hostRef.current;
    if (!panel || !host) return;

    const measure = () => {
      const next = computeScanGeometry(DECODE_WIDTH, panel.clientWidth, host.clientHeight);
      setGeom((prev) =>
        prev.scale === next.scale &&
        prev.height === next.height &&
        prev.minHeight === next.minHeight
          ? prev
          : next,
      );
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(panel);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  const applyZoom = useCallback((value: number) => {
    setZoom((prev) => (prev ? { ...prev, value } : prev));
    const capability = zoomCapRef.current;
    if (!capability) return;
    try {
      // apply() rejects when the track refuses the constraint; ignore it and
      // leave the slider where the user put it.
      void capability.apply(value).catch(() => {});
    } catch {
      // The track ended between the slider event and this call.
    }
  }, []);

  const toggleTorch = useCallback(() => {
    const capability = torchCapRef.current;
    if (!capability) return;
    const next = !(torchOn ?? false);
    try {
      // The camera may refuse (for example on a front lens); only commit the
      // new state once the track accepts it.
      void capability
        .apply(next)
        .then(() => setTorchOn(next))
        .catch(() => {});
    } catch {
      // The track ended between the click and this call.
    }
  }, [torchOn]);

  const handleStageClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!active || error) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const seq = ++focusSeqRef.current;
      setFocus({ x: event.clientX - rect.left, y: event.clientY - rect.top, seq });
      if (focusTimerRef.current) window.clearTimeout(focusTimerRef.current);
      focusTimerRef.current = window.setTimeout(() => setFocus(null), FOCUS_VISIBLE_MS);

      const scanner = scannerRef.current;
      if (scanner) retriggerAutofocus(scanner);
    },
    [active, error],
  );

  const startCamera = useCallback(async (nextDeviceId?: string) => {
    const epoch = ++epochRef.current;
    const isStale = () => epoch !== epochRef.current;

    if (!hostRef.current) return;

    // Tear down whatever is running before touching state. The first await
    // below keeps the mount effect from setting state synchronously.
    const previous = scannerRef.current;
    scannerRef.current = null;
    zoomCapRef.current = null;
    torchCapRef.current = null;
    if (previous) {
      try {
        await previous.stop();
      } catch {
        // Never reached a running state, so stop() throws a string instead.
      }
    }
    clearHost(hostRef.current);
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    const Html5Qrcode = await loadScanner();
    // A newer run took over while this one was loading the library.
    if (isStale() || !hostRef.current) return;

    // Sweep again: an earlier run can append its video after its own teardown
    // failed, and start() only clears what exists when it is called.
    clearHost(hostRef.current);

    setError(null);
    setStarting(true);
    setActive(false);
    setZoom(null);
    setTorchOn(null);
    setFocus(null);

    const scanner = new Html5Qrcode("qr-reader");
    scannerRef.current = scanner;

    // No qrbox: the whole frame is decoded, so a code that is off-centre or
    // held at an angle still reads. The chosen device has to live inside
    // videoConstraints: start() ignores its first argument whenever these are
    // set, so passing a deviceId there would silently do nothing.
    const startOnce = (id?: string) =>
      scanner.start(
        { facingMode: "environment" },
        { fps: SCAN_FPS, videoConstraints: buildVideoConstraints(id) },
        (text) => onTokenRef.current(text),
        () => {},
      );

    let startError: unknown = null;
    try {
      await startOnce(nextDeviceId);
    } catch (e) {
      startError = e;
    }

    // A remembered device can go stale after a reboot or a permission reset,
    // so fall back to the default camera rather than dead-ending on it.
    if (startError !== null && nextDeviceId) {
      try {
        await startOnce();
        startError = null;
      } catch (e) {
        startError = e;
      }
    }

    // A newer run owns the camera now; drop this one's stream instead of
    // leaving a second live camera behind.
    if (isStale()) {
      stopQuietly(scanner);
      return;
    }

    if (startError !== null) {
      setError(describeCameraError(startError));
      setStarting(false);
      return;
    }

    // renderedCamera is assigned before start() resolves, so these are safe.
    const zoomProbe = probeZoom(scanner);
    if (zoomProbe) zoomCapRef.current = zoomProbe.capability;

    const torchProbe = probeTorch(scanner);
    if (torchProbe) torchCapRef.current = torchProbe.capability;

    const foundDeviceId = readDeviceId(scanner);
    const foundCameras = await enumerateCameras();

    // Defer past the effect body so this batch does not trigger a cascading
    // render from inside the mount effect.
    queueMicrotask(() => {
      if (isStale()) return;
      setZoom(zoomProbe ? { range: zoomProbe.range, value: zoomProbe.range.value } : null);
      setTorchOn(torchProbe ? torchProbe.on : null);
      setDeviceId(foundDeviceId);
      setCameras(foundCameras);
      setActive(true);
      setStarting(false);
    });

    // start() resolves before `playing` fires, and iOS rejects play() without a
    // user gesture while reporting no error. Catch that silent black frame.
    timerRef.current = window.setTimeout(() => {
      if (scannerRef.current !== scanner || isStale()) return;
      if (!scanner.isScanning) {
        setError("Camera did not start. Tap Try again to relaunch it.");
        setZoom(null);
        setTorchOn(null);
        zoomCapRef.current = null;
        torchCapRef.current = null;
      }
    }, STREAM_TIMEOUT_MS);
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    void startCamera();
    return () => {
      // Invalidate any start still in flight so it tears itself down.
      epochRef.current += 1;
      if (timerRef.current) window.clearTimeout(timerRef.current);
      if (focusTimerRef.current) window.clearTimeout(focusTimerRef.current);
      const scanner = scannerRef.current;
      scannerRef.current = null;
      zoomCapRef.current = null;
      torchCapRef.current = null;
      stopQuietly(scanner);
      clearHost(host);
    };
  }, [startCamera]);

  const hasControls = cameras.length > 1 || torchOn !== null || zoom !== null;

  return (
    <div className="w-full">
      <div
        ref={panelRef}
        className="relative min-h-64 w-full cursor-crosshair overflow-hidden bg-ink"
        style={{
          height: geom.height ?? undefined,
          minHeight: geom.minHeight || undefined,
        }}
        onClick={handleStageClick}
      >
        <div
          id="qr-reader"
          ref={hostRef}
          className="origin-top-left"
          style={{ width: DECODE_WIDTH, transform: `scale(${geom.scale})` }}
        />

        {starting && !error ? (
          <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-[0.8125rem] text-surface">
            Starting camera…
          </p>
        ) : null}

        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink/95 px-6 text-center">
            <p className="max-w-xs text-[0.875rem] leading-relaxed text-surface">{error}</p>
            <button
              className="btn btn-outline"
              type="button"
              onClick={() => {
                setError(null);
                setStarting(true);
                setActive(false);
                setZoom(null);
                void startCamera();
              }}
            >
              Try again
            </button>
          </div>
        ) : null}

        {/* Aiming brackets. Detection covers the whole frame, so this only hints.
            Lifted above the control bar so the controls never cover them. */}
        {active && !error && !disabled ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-center"
            style={{ bottom: CONTROLS_INSET }}
          >
            <div className="relative aspect-square h-[60%] max-h-64">
              <span className="absolute left-0 top-0 h-6 w-6 border-l-2 border-t-2 border-surface/80" />
              <span className="absolute right-0 top-0 h-6 w-6 border-r-2 border-t-2 border-surface/80" />
              <span className="absolute bottom-0 left-0 h-6 w-6 border-b-2 border-l-2 border-surface/80" />
              <span className="absolute bottom-0 right-0 h-6 w-6 border-b-2 border-r-2 border-surface/80" />
            </div>
          </div>
        ) : null}

        {/* Marks where the user tapped to refocus. */}
        {focus ? (
          <span
            key={focus.seq}
            aria-hidden
            className="focus-reticle pointer-events-none"
            style={{ left: focus.x, top: focus.y }}
          />
        ) : null}

        {/* Controls sit over the feed so the camera keeps the whole panel. */}
        {active && !error && hasControls ? (
          <div
            className="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-2 border-t border-surface/20 bg-ink/90 px-3 py-2.5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              {cameras.length > 1 ? (
                <select
                  aria-label="Camera"
                  className="field h-8 min-w-0 flex-1 text-[0.75rem]"
                  value={deviceId ?? ""}
                  disabled={disabled}
                  onChange={(event) => void startCamera(event.target.value)}
                >
                  {cameras.map((camera) => (
                    <option key={camera.id} value={camera.id}>
                      {camera.label}
                    </option>
                  ))}
                </select>
              ) : null}

              {torchOn !== null ? (
                <button
                  type="button"
                  className={`btn h-8 shrink-0 px-3 text-[0.75rem] ${
                    torchOn ? "btn-primary" : "btn-outline"
                  }`}
                  aria-pressed={torchOn}
                  disabled={disabled}
                  onClick={toggleTorch}
                >
                  {torchOn ? "Flash on" : "Flash off"}
                </button>
              ) : null}
            </div>

            {zoom ? (
              <div className="flex items-center gap-2">
                <label
                  htmlFor="qr-zoom"
                  className="shrink-0 text-[0.6875rem] font-medium text-surface/70"
                >
                  Zoom
                </label>
                <input
                  id="qr-zoom"
                  type="range"
                  className="zoom-slider-invert min-w-0 flex-1"
                  min={zoom.range.min}
                  max={zoom.range.max}
                  step={zoom.range.step}
                  value={zoom.value}
                  disabled={disabled}
                  onChange={(event) => applyZoom(Number(event.target.value))}
                />
                <span className="w-9 shrink-0 text-right text-[0.6875rem] font-medium tabular-nums text-surface">
                  {zoom.value.toFixed(1)}×
                </span>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}