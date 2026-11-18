"use client";

import { useMemo, useState } from "react";
import type { Panitia, Status } from "@/lib/types";

type Pending = Panitia & { status: Status | null };

const STATUS_LABEL: Record<Status, string> = {
  hadir: "Hadir",
  izin: "Izin",
  alfa: "Alfa",
};

/**
 * Pending members for the day, filterable by division. The dashboard fetches
 * every row once; this narrows the view without another round trip.
 */
export function PendingList({
  members,
  total,
}: {
  members: Pending[];
  total: number;
}) {
  const divisions = useMemo(
    () => [...new Set(members.map((m) => m.divisi))].sort(),
    [members],
  );
  const [division, setDivision] = useState("");

  const visible = useMemo(
    () => (division ? members.filter((m) => m.divisi === division) : members),
    [members, division],
  );

  if (members.length === 0) {
    return (
      <p className="panel px-5 py-8 text-center text-[0.875rem] text-ink-muted">
        Everyone is accounted for.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <select
          className="field w-auto max-w-64"
          aria-label="Filter by division"
          value={division}
          onChange={(e) => setDivision(e.target.value)}
        >
          <option value="">All divisions ({members.length})</option>
          {divisions.map((d) => (
            <option key={d} value={d}>
              {d} ({members.filter((m) => m.divisi === d).length})
            </option>
          ))}
        </select>

        <p className="text-[0.8125rem] text-ink-faint">
          {visible.length} of {total}
        </p>
      </div>

      {visible.length === 0 ? (
        <p className="panel px-5 py-8 text-center text-[0.875rem] text-ink-muted">
          No members from this division still need to check in.
        </p>
      ) : (
        <ul className="panel divide-y divide-line overflow-hidden">
          {visible.map((member) => (
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
                {member.status ? STATUS_LABEL[member.status] : "Belum"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
