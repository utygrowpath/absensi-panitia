"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setAttendanceStatus } from "../actions";
import type { Panitia, Status } from "@/lib/types";

type Row = Panitia & { status: Status };

const CHOICES: { value: Status; label: string; chip: string }[] = [
  { value: "hadir", label: "Hadir", chip: "chip-hadir" },
  { value: "izin", label: "Izin", chip: "chip-izin" },
  { value: "alfa", label: "Alfa", chip: "chip-alfa" },
];

export function ManualTable({ rows, date }: { rows: Row[]; date: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const q = query.trim().toLowerCase();
  const visible = rows.filter(
    (r) =>
      !q ||
      r.nama.toLowerCase().includes(q) ||
      r.divisi.toLowerCase().includes(q) ||
      r.prodi.toLowerCase().includes(q),
  );

  function setStatus(memberId: string, status: Status) {
    setError(null);
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("panitiaId", memberId);
        formData.set("status", status);
        formData.set("date", date);
        await setAttendanceStatus(formData);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not update attendance.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <input
        className="field max-w-64"
        type="search"
        placeholder="Search name, division…"
        aria-label="Search members"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {error ? (
        <p role="alert" className="rounded-md bg-alfa-soft px-3 py-2 text-[0.8125rem] font-medium text-alfa">
          {error}
        </p>
      ) : null}

      {visible.length === 0 ? (
        <p className="panel px-5 py-8 text-center text-[0.875rem] text-ink-muted">
          No members match your search.
        </p>
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full min-w-[44rem] border-collapse">
            <thead>
              <tr>
                <th className="th">Name</th>
                <th className="th">Division</th>
                <th className="th">Programme</th>
                <th className="th text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((member) => (
                <tr key={member.id} className="hover:bg-surface-muted">
                  <td className="td font-medium text-ink">{member.nama}</td>
                  <td className="td text-ink-muted">{member.divisi}</td>
                  <td className="td text-ink-muted">{member.prodi}</td>
                  <td className="td">
                    <div
                      className="flex justify-end gap-1.5"
                      role="group"
                      aria-label={`Status for ${member.nama}`}
                    >
                      {CHOICES.map((choice) => {
                        const active = member.status === choice.value;
                        return (
                          <button
                            key={choice.value}
                            type="button"
                            disabled={pending}
                            aria-pressed={active}
                            onClick={() => setStatus(member.id, choice.value)}
                            className={`btn h-7 px-2.5 text-[0.75rem] ${
                              active
                                ? `${choice.chip} border`
                                : "btn-quiet border border-transparent"
                            }`}
                          >
                            {choice.label}
                          </button>
                        );
                      })}
                    </div>
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
