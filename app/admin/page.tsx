import { connection } from "next/server";
import { daySummary, supabaseDayStatuses } from "@/lib/attendance";
import { supabaseAdmin } from "@/lib/supabase";
import { formatDate, todayInJakarta } from "@/lib/time";
import type { Panitia } from "@/lib/types";
import { PendingList } from "./pending-list";

// These routes read live attendance rows, so they block instead of prerendering.
export const instant = false;

export default async function DashboardPage() {
  // "Today" is per-request, so this route renders at request time.
  await connection();
  const date = todayInJakarta();
  const [summary, statuses, { data, error }] = await Promise.all([
    daySummary(date),
    supabaseDayStatuses(date),
    supabaseAdmin().from("panitia").select("*").order("divisi").order("nama"),
  ]);
  if (error) throw new Error(`Could not load committee: ${error.message}`);
  const people = (data ?? []) as Panitia[];

  // Everyone without a `hadir` record: either an explicit izin/alfa, or no record yet.
  const pending = people
    .filter((member) => statuses.get(member.id) !== "hadir")
    .map((member) => ({ ...member, status: statuses.get(member.id) ?? null }));

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-balance text-[1.75rem] font-semibold tracking-tight text-ink">
            Today&apos;s attendance
          </h1>
          <p className="mt-1 text-[0.875rem] text-ink-muted">{formatDate(date)}</p>
        </div>
        <p className="text-[0.8125rem] text-ink-faint">
          {summary.hadir} of {summary.total} present
        </p>
      </header>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
        <Metric label="Hadir" value={summary.hadir} tone="hadir" total={summary.total} />
        <Metric label="Izin" value={summary.izin} tone="izin" total={summary.total} />
        <Metric label="Alfa" value={summary.alfa} tone="alfa" total={summary.total} />
        <Metric label="Not checked in" value={summary.belum} tone="none" total={summary.total} />
      </dl>

      <section>
        <div className="mb-3">
          <h2 className="text-balance text-[1.0625rem] font-semibold tracking-tight text-ink">
            Not yet checked in
          </h2>
        </div>

        <PendingList members={pending} total={summary.total} />
      </section>
    </div>
  );
}

function Metric({
  label,
  value,
  total,
  tone,
}: {
  label: string;
  value: number;
  total: number;
  tone: "hadir" | "izin" | "alfa" | "none";
}) {
  const color =
    tone === "hadir"
      ? "text-hadir"
      : tone === "izin"
        ? "text-izin"
        : tone === "alfa"
          ? "text-alfa"
          : "text-ink";

  return (
    <div className="bg-surface px-4 py-4 sm:px-5 sm:py-5">
      <dd className={`text-[1.75rem] font-semibold leading-none tracking-tight ${color}`}>
        {value}
      </dd>
      <dt className="mt-2 flex flex-wrap items-baseline gap-x-2 text-[0.8125rem] text-ink-muted">
        {label}
        <span className="text-ink-faint">/ {total}</span>
      </dt>
    </div>
  );
}
