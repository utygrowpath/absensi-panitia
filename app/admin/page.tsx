import { connection } from "next/server";
import { daySummary, supabaseDayStatuses } from "@/lib/attendance";
import { supabaseAdmin } from "@/lib/supabase";
import { formatDate, todayInJakarta } from "@/lib/time";
import type { Panitia, Status } from "@/lib/types";

// These routes read live attendance rows, so they block instead of prerendering.
export const instant = false;

const STATUS_LABEL: Record<Status, string> = {
  hadir: "Hadir",
  izin: "Izin",
  alfa: "Alfa",
};

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

  const byDivision = new Map<string, typeof pending>();
  for (const member of pending) {
    const list = byDivision.get(member.divisi) ?? [];
    list.push(member);
    byDivision.set(member.divisi, list);
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.75rem] font-semibold tracking-tight text-ink">
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
        <div className="mb-3 flex items-baseline justify-between gap-4">
          <h2 className="text-[1.0625rem] font-semibold tracking-tight text-ink">
            Not yet checked in
          </h2>
          <p className="text-[0.8125rem] text-ink-faint">
            {pending.length} of {summary.total}
          </p>
        </div>

        {pending.length === 0 ? (
          <p className="panel px-5 py-8 text-center text-[0.875rem] text-ink-muted">
            Everyone is accounted for.
          </p>
        ) : (
          <div className="flex flex-col gap-6">
            {[...byDivision.entries()].map(([divisi, members]) => (
              <div key={divisi}>
                <h3 className="mb-2 text-[0.75rem] font-semibold uppercase tracking-[0.05em] text-ink-faint">
                  {divisi}
                </h3>
                <ul className="panel divide-y divide-line overflow-hidden">
                  {members.map((member) => (
                    <li
                      key={member.id}
                      className="flex items-center justify-between gap-4 px-4 py-2.5"
                    >
                      <span className="min-w-0 truncate text-[0.875rem] font-medium text-ink">
                        {member.nama}
                      </span>
                      <span
                        className={`chip ${
                          member.status === "izin"
                            ? "chip-izin"
                            : member.status === "alfa"
                              ? "chip-alfa"
                              : "chip-belum"
                        }`}
                      >
                        {member.status ? STATUS_LABEL[member.status] : "Belum"}                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
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
