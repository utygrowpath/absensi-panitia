"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { describeCameraError } from "@/lib/camera-error";
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

/**
 * stop() throws before closing the stream whenever scanning never began, and
 * that is exactly the case where iOS blocks play() after getUserMedia already
 * opened the camera. Release any live track so a retry can reopen it.
 */
function releaseTracks(host: HTMLElement | null) {
  if (!host) return;
  for (const video of Array.from(host.querySelectorAll("video"))) {
    const stream = video.srcObject;
    if (stream instanceof MediaStream) {
      for (const track of stream.getTracks()) track.stop();
    }
    video.srcObject = null;
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
 * Read the zoom range from a running scanner. Both the capability lookup and
 * the range read can throw, so treat a failure as "no zoom available" rather
 * than letting it break the camera.
 */
function probeZoom(scanner: Scanner): { range: ZoomRange; capability: ZoomCapability } | null {
  try {
    const capability = scanner.getRunningTrackCameraCapabilities().zoomFeature();
    const range = readZoomRange(capability);
    return range ? { range, capability } : null;
  } catch {
    return null;
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
  const onTokenRef = useRef(onToken);
  const timerRef = useRef<number | null>(null);
  const cancelledRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);
  const [active, setActive] = useState(false);
  const [zoom, setZoom] = useState<{ range: ZoomRange; value: number } | null>(null);
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

  const startCamera = useCallback(async () => {
    cancelledRef.current = false;
    if (!hostRef.current) return;

    // Tear down whatever is running before touching state. The first await
    // below keeps the mount effect from setting state synchronously.
    const previous = scannerRef.current;
    scannerRef.current = null;
    zoomCapRef.current = null;
    if (previous) {
      try {
        await previous.stop();
      } catch {
        // Never reached a running state, so stop() throws a string instead.
      }
    }
    releaseTracks(hostRef.current);
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    const Html5Qrcode = await loadScanner();
    if (cancelledRef.current || !hostRef.current) return;

    setError(null);
    setStarting(true);
    setActive(false);

    const scanner = new Html5Qrcode("qr-reader");
    scannerRef.current = scanner;

    try {
      // No qrbox: the whole frame is decoded, so a code that is off-centre or
      // held at an angle still reads. The constraints are ideal, not exact, so
      // a device without a rear camera or a 720p mode still starts.
      await scanner.start(
        { facingMode: "environment" },
        {
          fps: SCAN_FPS,
          videoConstraints: {
            facingMode: "environment",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        },
        (text) => onTokenRef.current(text),
        () => {},
      );
    } catch (e) {
      if (cancelledRef.current) return;
      setError(describeCameraError(e));
      setStarting(false);
      return;
    }

    // Navigating away mid-start would otherwise leave the camera running.
    if (cancelledRef.current) {
      stopQuietly(scanner);
      releaseTracks(hostRef.current);
      return;
    }

    // renderedCamera is assigned before start() resolves, so this is safe.
    const zoomProbe = probeZoom(scanner);
    if (zoomProbe) {
      zoomCapRef.current = zoomProbe.capability;
      // Defer past the effect body so the slider state does not trigger a
      // cascading render from inside the mount effect.
      queueMicrotask(() => setZoom({ range: zoomProbe.range, value: zoomProbe.range.value }));
    }

    setActive(true);
    setStarting(false);

    // start() resolves before `playing` fires, and iOS rejects play() without a
    // user gesture while reporting no error. Catch that silent black frame.
    timerRef.current = window.setTimeout(() => {
      if (scannerRef.current !== scanner) return;
      if (!scanner.isScanning) {
        setError("Camera did not start. Tap Try again to relaunch it.");
        setZoom(null);
        zoomCapRef.current = null;
      }
    }, STREAM_TIMEOUT_MS);
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    void startCamera();
    return () => {
      cancelledRef.current = true;
      if (timerRef.current) window.clearTimeout(timerRef.current);
      const scanner = scannerRef.current;
      scannerRef.current = null;
      zoomCapRef.current = null;
      stopQuietly(scanner);
      releaseTracks(host);
    };
  }, [startCamera]);

  return (
    <div className="w-full">
      <div
        ref={panelRef}
        className="relative min-h-64 w-full overflow-hidden bg-ink"
        style={{
          height: geom.height ?? undefined,
          minHeight: geom.minHeight || undefined,
        }}
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

        {/* Aiming brackets. Detection covers the whole frame, so this only hints. */}
        {active && !error && !disabled ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
          >
            <div className="relative aspect-square h-[60%] max-h-64">
              <span className="absolute left-0 top-0 h-6 w-6 border-l-2 border-t-2 border-surface/80" />
              <span className="absolute right-0 top-0 h-6 w-6 border-r-2 border-t-2 border-surface/80" />
              <span className="absolute bottom-0 left-0 h-6 w-6 border-b-2 border-l-2 border-surface/80" />
              <span className="absolute bottom-0 right-0 h-6 w-6 border-b-2 border-r-2 border-surface/80" />
            </div>
          </div>
        ) : null}
      </div>

      {/* Zoom is only offered when the camera actually exposes the capability. */}
      {zoom && !error ? (
        <div className="flex items-center gap-3 border-t border-line px-4 py-3">
          <label
            htmlFor="qr-zoom"
            className="shrink-0 text-[0.75rem] font-medium text-ink-muted"
          >
            Zoom
          </label>
          <input
            id="qr-zoom"
            type="range"
            className="zoom-slider min-w-0 flex-1"
            min={zoom.range.min}
            max={zoom.range.max}
            step={zoom.range.step}
            value={zoom.value}
            onChange={(event) => applyZoom(Number(event.target.value))}
          />
          <span className="w-10 shrink-0 text-right text-[0.75rem] font-medium tabular-nums text-ink">
            {zoom.value.toFixed(1)}×
          </span>
        </div>
      ) : null}
    </div>
  );
}
