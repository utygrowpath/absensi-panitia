"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useRef } from "react";

export function LogFilters({ divisions }: { divisions: string[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);

  function apply() {
    const data = new FormData(formRef.current!);
    const next = new URLSearchParams();
    const date = String(data.get("date") ?? "");
    const divisi = String(data.get("divisi") ?? "");
    if (date) next.set("date", date);
    if (divisi) next.set("divisi", divisi);
    router.push(`/admin/log${next.size ? `?${next}` : ""}`);
  }

  return (
    <form
      ref={formRef}
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        apply();
      }}
    >
      <div>
        <label className="label" htmlFor="log-date">
          Date
        </label>
        <input
          className="field w-auto"
          id="log-date"
          name="date"
          type="date"
          defaultValue={params.get("date") ?? ""}
        />
      </div>

      <div>
        <label className="label" htmlFor="log-division">
          Division
        </label>
        <select
          className="field w-auto max-w-56"
          id="log-division"
          name="divisi"
          defaultValue={params.get("divisi") ?? ""}
        >
          <option value="">All divisions</option>
          {divisions.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>

      <button className="btn btn-outline" type="submit">
        Apply
      </button>
      <button
        className="btn btn-quiet"
        type="button"
        onClick={() => router.push("/admin/log")}
      >
        Clear
      </button>
    </form>
  );
}
