const JAKARTA = "Asia/Jakarta";

/** Today's date in Asia/Jakarta as `YYYY-MM-DD`. */
export function todayInJakarta(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: JAKARTA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Format a timestamp as `HH:MM` in Asia/Jakarta, or an em dash when absent. */
export function formatTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: JAKARTA,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

/** Format a date as `18 Nov 2026` in Asia/Jakarta. */
export function formatDate(value: string | Date): string {
  const date = typeof value === "string" ? new Date(`${value}T00:00:00`) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: JAKARTA,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}
