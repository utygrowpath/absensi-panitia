"use client";

import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import type { Panitia } from "@/lib/types";

type Filter = { divisi: string };

export function QrSheet({ members }: { members: Panitia[] }) {
  const divisions = [...new Set(members.map((m) => m.divisi))].sort();
  const [filter, setFilter] = useState<Filter["divisi"]>("");

  const visible = filter ? members.filter((m) => m.divisi === filter) : members;

  return (
    <div className="flex flex-col gap-5">
      <div className="no-print flex flex-wrap items-center gap-3">
        <select
          className="field w-auto max-w-64"
          aria-label="Filter by division"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="">All divisions ({members.length})</option>
          {divisions.map((d) => (
            <option key={d} value={d}>
              {d} ({members.filter((m) => m.divisi === d).length})
            </option>
          ))}
        </select>
        <p className="text-[0.8125rem] text-ink-faint">{visible.length} codes</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {visible.map((member) => (
          <figure
            key={member.id}
            className="flex flex-col items-center gap-2 rounded-xl border border-line bg-surface p-4 text-center break-inside-avoid"
          >
            <QRCodeSVG
              value={member.qr_token}
              size={112}
              level="M"
              marginSize={0}
              bgColor="#ffffff"
              fgColor="#18181b"
            />
            <figcaption className="w-full">
              <p className="text-[0.75rem] leading-tight font-semibold text-ink">
                {member.nama}
              </p>
              <p className="mt-1 text-[0.6875rem] leading-tight text-ink-muted">
                {member.divisi}
              </p>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
