import { Scanner } from "./scanner";

// These routes read live attendance rows, so they block instead of prerendering.
export const instant = false;

export default function ScanPage() {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-[1.75rem] font-semibold tracking-tight text-ink">
          Scan QR
        </h1>
        <p className="mt-1 text-[0.875rem] text-ink-muted">
          Point the camera at an ID-card QR to mark the member present.
        </p>
      </header>

      <Scanner />
    </div>
  );
}
