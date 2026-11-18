"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  onToken: (token: string) => void;
  disabled?: boolean;
};

type Scanner = InstanceType<Awaited<ReturnType<typeof loadScanner>>>;

async function loadScanner() {
  const { Html5Qrcode } = await import("html5-qrcode");
  return Html5Qrcode;
}

/**
 * Camera QR scanner built on html5-qrcode. Kept client-only because the
 * library reads `window` at import time.
 */
export default function QrScanner({ onToken, disabled }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<Scanner | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);
  const [active, setActive] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      const Html5Qrcode = await loadScanner();
      if (cancelled || !hostRef.current) return;

      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;

      try {
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (text) => onToken(text),
          () => {},
        );
        if (!cancelled) {
          setActive(true);
          setStarting(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error && e.message
              ? e.message
              : "Camera unavailable. Grant permission, or type the code instead.",
          );
          setStarting(false);
        }
      }
    }

    void boot();

    return () => {
      cancelled = true;
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (scanner) void scanner.stop().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative aspect-[4/3] w-full bg-ink">
      <div id="qr-reader" ref={hostRef} className="h-full w-full" />

      {starting ? (
        <p className="absolute inset-0 flex items-center justify-center text-[0.8125rem] text-surface">
          Starting camera…
        </p>
      ) : null}

      {error ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink px-6 text-center">
          <p className="text-[0.875rem] leading-relaxed text-surface">{error}</p>
          <p className="text-[0.75rem] text-line-strong">
            Camera access needs HTTPS or localhost.
          </p>
        </div>
      ) : null}

      {/* Framing guide, only while the camera is live. */}
      {active && !disabled ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <div className="h-56 w-56 rounded-2xl border-2 border-surface/70 shadow-[0_0_0_9999px_rgba(24,24,27,0.35)]" />
        </div>
      ) : null}
    </div>
  );
}
