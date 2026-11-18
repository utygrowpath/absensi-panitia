"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { describeCameraError } from "@/lib/camera-error";

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
 * Camera QR scanner built on html5-qrcode. Kept client-only because the
 * library reads `window` at import time.
 */
export default function QrScanner({ onToken, disabled }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<Scanner | null>(null);
  const onTokenRef = useRef(onToken);
  const timerRef = useRef<number | null>(null);
  const cancelledRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);
  const [active, setActive] = useState(false);

  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  const startCamera = useCallback(async () => {
    cancelledRef.current = false;
    if (!hostRef.current) return;

    // Tear down whatever is running before touching state. The first await
    // below keeps the mount effect from setting state synchronously.
    const previous = scannerRef.current;
    scannerRef.current = null;
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

    setActive(true);
    setStarting(false);

    // start() resolves before `playing` fires, and iOS rejects play() without a
    // user gesture while reporting no error. Catch that silent black frame.
    timerRef.current = window.setTimeout(() => {
      if (scannerRef.current !== scanner) return;
      if (!scanner.isScanning) {
        setError("Camera did not start. Tap Try again to relaunch it.");
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
      stopQuietly(scanner);
      releaseTracks(host);
    };
  }, [startCamera]);

  return (
    <div className="relative flex min-h-64 w-full items-center justify-center overflow-hidden bg-ink">
      <div id="qr-reader" ref={hostRef} className="w-full" />

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
  );
}
