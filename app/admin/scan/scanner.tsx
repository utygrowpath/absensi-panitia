"use client";

import dynamic from "next/dynamic";
import { useCallback, useRef, useState } from "react";
import { scanAttendance } from "../actions";

// html5-qrcode touches `window` at import time, so it must load on the client only.
const QrScanner = dynamic(() => import("./qr-scanner"), { ssr: false });

type Result =
  | { tone: "ok"; title: string; detail: string }
  | { tone: "warn"; title: string; detail: string }
  | { tone: "error"; title: string; detail: string };

const OUTCOME_TEXT = {
  marked: { tone: "ok", title: "Checked in" },
  already: { tone: "warn", title: "Already checked in" },
  corrected: { tone: "ok", title: "Status corrected" },
  unknown: { tone: "error", title: "QR not recognised" },
} as const;

export function Scanner() {
  const [result, setResult] = useState<Result | null>(null);
  const [manual, setManual] = useState("");
  const [busy, setBusy] = useState(false);
  const lockRef = useRef(false);

  const handleToken = useCallback(async (token: string) => {
    if (lockRef.current) return;
    lockRef.current = true;
    setBusy(true);
    try {
      const outcome = await scanAttendance(token);
      const meta = OUTCOME_TEXT[outcome.kind];
      const detail =
        outcome.kind === "unknown"
          ? "This code is not in the committee list."
          : outcome.kind === "already"
            ? `${outcome.nama} · ${outcome.divisi} · first scan at ${formatClock(outcome.at)}`
            : outcome.kind === "corrected"
              ? `${outcome.nama} · ${outcome.divisi} · was ${outcome.from}`
              : `${outcome.nama} · ${outcome.divisi}`;
      setResult({ tone: meta.tone, title: meta.title, detail });
    } catch (e) {
      setResult({
        tone: "error",
        title: "Scan failed",
        detail: e instanceof Error ? e.message : "Please try again.",
      });
    } finally {
      setBusy(false);
      setTimeout(() => {
        lockRef.current = false;
      }, 1500);
    }
  }, []);

  function submitManual(event: React.FormEvent) {
    event.preventDefault();
    const token = manual.trim();
    if (!token) return;
    setManual("");
    void handleToken(token);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="panel overflow-hidden">
          <QrScanner onToken={handleToken} disabled={busy} />
        </div>

        <div className="flex flex-col gap-5">
          <section className="flex flex-col gap-3">
            <h2 className="text-[1rem] font-semibold tracking-tight text-ink">
              Result
            </h2>

            {result ? (
              <div
                role="status"
                aria-live="polite"
                className={`rounded-xl border px-4 py-4 ${
                  result.tone === "ok"
                    ? "border-hadir-line bg-hadir-soft"
                    : result.tone === "warn"
                      ? "border-izin-line bg-izin-soft"
                      : "border-alfa-line bg-alfa-soft"
                }`}
              >
                <p
                  className={`text-[0.9375rem] font-semibold ${
                    result.tone === "ok"
                      ? "text-hadir"
                      : result.tone === "warn"
                        ? "text-izin"
                        : "text-alfa"
                  }`}
                >
                  {result.title}
                </p>
                <p className="mt-1 text-[0.8125rem] leading-relaxed text-ink-muted">
                  {result.detail}
                </p>
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-line-strong px-4 py-6 text-center text-[0.8125rem] leading-relaxed text-ink-faint">
                Point the camera at a committee QR code.
              </p>
            )}
          </section>

          <form onSubmit={submitManual} className="flex flex-col gap-2">
            <label className="label" htmlFor="manual-token">
              Or type the code
            </label>
            <input
              className="field font-mono text-[0.8125rem]"
              id="manual-token"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="paste QR content"
              autoComplete="off"
            />
            <button className="btn btn-outline" type="submit" disabled={busy || !manual.trim()}>
              Check in
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function formatClock(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}
