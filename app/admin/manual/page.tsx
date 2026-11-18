import { connection } from "next/server";
import { daySummary, supabaseDayStatuses } from "@/lib/attendance";
import { supabaseAdmin } from "@/lib/supabase";
import { formatDate, todayInJakarta } from "@/lib/time";
import { ManualTable } from "./manual-table";

// These routes read live attendance rows, so they block instead of prerendering.
export const instant = false;

async function loadAll(date: string) {
  const [summary, statuses, { data, error }] = await Promise.all([
    daySummary(date),
    supabaseDayStatuses(date),
    supabaseAdmin()
      .from("panitia")
      .select("*")
      .order("divisi")
      .order("nama"),
  ]);
  if (error) throw new Error(`Could not load committee: ${error.message}`);

  const rows = (data ?? []).map((m) => ({ ...m, status: statuses.get(m.id) ?? null }));
  return { rows, summary };
}

export default async function ManualPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;
  // Falls back to the current date, which only exists at request time.
  await connection();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.date ?? "")
    ? params.date!
    : todayInJakarta();
  const { rows, summary } = await loadAll(date);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.75rem] font-semibold tracking-tight text-ink">
            Manual check-in
          </h1>
          <p className="mt-1 text-[0.875rem] text-ink-muted">{formatDate(date)}</p>
        </div>
        <p className="text-[0.8125rem] text-ink-faint">
          {summary.hadir} hadir · {summary.izin} izin · {summary.alfa} alfa ·{" "}
          {summary.belum} belum
        </p>
      </header>

      <ManualTable rows={rows} date={date} />
    </div>
  );
}
