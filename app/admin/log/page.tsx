import { supabaseAdmin } from "@/lib/supabase";
import { formatDate, formatTime } from "@/lib/time";
import type { Status } from "@/lib/types";
import { LogFilters } from "./log-filters";

// These routes read live attendance rows, so they block instead of prerendering.
export const instant = false;

type LogRow = {
  attendance_date: string;
  status: Status;
  checked_in_at: string | null;
  updated_at: string;
  panitia: { nama: string; divisi: string } | null;
};

const STATUS_LABEL: Record<Status, string> = {
  hadir: "Hadir",
  izin: "Izin",
  alfa: "Alfa",
};

async function loadLog(date?: string, division?: string): Promise<LogRow[]> {
  let query = supabaseAdmin()
    .from("attendance")
    .select("attendance_date, status, checked_in_at, updated_at, panitia(nama, divisi)")
    .order("attendance_date", { ascending: false })
    .order("checked_in_at", { ascending: false, nullsFirst: false });

  if (date) query = query.eq("attendance_date", date);
  if (division) query = query.eq("panitia.divisi", division);

  const { data, error } = await query;
  if (error) throw new Error(`Could not load log: ${error.message}`);
  return (data ?? []) as unknown as LogRow[];
}

async function loadDivisions(): Promise<string[]> {
  const { data, error } = await supabaseAdmin()
    .from("panitia")
    .select("divisi")
    .order("divisi");
  if (error) throw new Error(`Could not load divisions: ${error.message}`);
  return [...new Set((data ?? []).map((r) => r.divisi))];
}

export default async function LogPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; divisi?: string }>;
}) {
  const params = await searchParams;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.date ?? "") ? params.date : undefined;
  const division = params.divisi || undefined;

  const [rows, divisions] = await Promise.all([loadLog(date, division), loadDivisions()]);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-[1.75rem] font-semibold tracking-tight text-ink">
          Attendance log
        </h1>
        <p className="mt-1 text-[0.875rem] text-ink-muted">
          {rows.length} record{rows.length === 1 ? "" : "s"}
          {date ? ` on ${formatDate(date)}` : ""}.
        </p>
      </header>

      <LogFilters divisions={divisions} />

      {rows.length === 0 ? (
        <p className="panel px-5 py-8 text-center text-[0.875rem] text-ink-muted">
          No attendance recorded for this filter.
        </p>
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse">
            <thead>
              <tr>
                <th className="th">Name</th>
                <th className="th">Division</th>
                <th className="th">Date</th>
                <th className="th">Time</th>
                <th className="th">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={`${row.attendance_date}-${row.panitia?.nama}-${i}`} className="hover:bg-surface-muted">
                  <td className="td font-medium text-ink">{row.panitia?.nama ?? "—"}</td>
                  <td className="td text-ink-muted">{row.panitia?.divisi ?? "—"}</td>
                  <td className="td text-ink-muted">{formatDate(row.attendance_date)}</td>
                  <td className="td font-mono text-[0.75rem] text-ink">
                    {row.status === "hadir" ? formatTime(row.checked_in_at) : "—"}
                  </td>
                  <td className="td">
                    <span
                      className={`chip ${
                        row.status === "hadir"
                          ? "chip-hadir"
                          : row.status === "izin"
                            ? "chip-izin"
                            : "chip-alfa"
                      }`}
                    >
                      {STATUS_LABEL[row.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
