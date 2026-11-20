"use client";

import { useMemo, useState } from "react";
import {
  createPanitia,
  deletePanitia,
  updatePanitia,
} from "./actions";
import type { Panitia } from "@/lib/types";

type Draft = Pick<Panitia, "nama" | "divisi" | "prodi" | "angkatan">;
type Editing = { id: string } | "new" | null;

const EMPTY: Draft = { nama: "", divisi: "", prodi: "", angkatan: new Date().getFullYear() };

export function PanitiaTable({
  members,
  divisions,
}: {
  members: Panitia[];
  divisions: string[];
}) {
  const [query, setQuery] = useState("");
  const [division, setDivision] = useState("");
  const [editing, setEditing] = useState<Editing>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members.filter(
      (m) =>
        (!division || m.divisi === division) &&
        (!q ||
          m.nama.toLowerCase().includes(q) ||
          m.divisi.toLowerCase().includes(q) ||
          m.prodi.toLowerCase().includes(q)),
    );
  }, [members, query, division]);

  function startCreate() {
    setError(null);
    setDraft({ ...EMPTY, divisi: divisions[0] ?? "" });
    setEditing("new");
  }

  function startEdit(member: Panitia) {
    setError(null);
    setDraft({
      nama: member.nama,
      divisi: member.divisi,
      prodi: member.prodi,
      angkatan: member.angkatan,
    });
    setEditing({ id: member.id });
  }

  function cancel() {
    setEditing(null);
    setError(null);
  }

  async function submit(formData: FormData) {
    setError(null);
    try {
      if (editing === "new") await createPanitia(formData);
      else if (editing) {
        formData.set("id", editing.id);
        await updatePanitia(formData);
      }
      cancel();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    }
  }

  async function remove(member: Panitia) {
    if (!window.confirm(`Delete ${member.nama}? Their attendance history is removed too.`)) {
      return;
    }
    setError(null);
    try {
      const formData = new FormData();
      formData.set("id", member.id);
      await deletePanitia(formData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          className="field max-w-64 flex-1"
          type="search"
          placeholder="Search name, division…"
          aria-label="Search committee"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className="field w-auto max-w-56"
          aria-label="Filter by division"
          value={division}
          onChange={(e) => setDivision(e.target.value)}
        >
          <option value="">All divisions</option>
          {divisions.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <button className="btn btn-primary ml-auto" type="button" onClick={startCreate}>
          Add member
        </button>
      </div>

      {error ? (
        <p role="alert" className="rounded-md bg-alfa-soft px-3 py-2 text-[0.8125rem] font-medium text-alfa">
          {error}
        </p>
      ) : null}

      {editing ? (
        <MemberForm
          draft={draft}
          setDraft={setDraft}
          divisions={divisions}
          submit={submit}
          cancel={cancel}
          isCreate={editing === "new"}
        />
      ) : null}

      {visible.length === 0 ? (
        <p className="panel px-5 py-8 text-center text-[0.875rem] text-ink-muted">
          No members match your filters.
        </p>
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse">
            <thead>
              <tr>
                <th className="th">Name</th>
                <th className="th">Division</th>
                <th className="th">Programme</th>
                <th className="th text-right">Year</th>
                <th className="th text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((member) => (
                <tr key={member.id} className="hover:bg-surface-muted">
                  <td className="td font-medium text-ink">{member.nama}</td>
                  <td className="td text-ink-muted">{member.divisi}</td>
                  <td className="td text-ink-muted">{member.prodi}</td>
                  <td className="td text-right text-ink-muted">{member.angkatan}</td>
                  <td className="td text-right whitespace-nowrap">
                    <button
                      className="btn btn-quiet"
                      type="button"
                      onClick={() => startEdit(member)}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-danger ml-1"
                      type="button"
                      onClick={() => remove(member)}
                    >
                      Delete
                    </button>
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

function MemberForm({
  draft,
  setDraft,
  divisions,
  submit,
  cancel,
  isCreate,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  divisions: string[];
  submit: (formData: FormData) => Promise<void>;
  cancel: () => void;
  isCreate: boolean;
}) {
  return (
    <form action={submit} className="panel flex flex-col gap-4 p-5" noValidate>
      <h2 className="text-[1rem] font-semibold tracking-tight text-ink">
        {isCreate ? "Add member" : "Edit member"}
      </h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="nama">
            Full name
          </label>
          <input
            className="field"
            id="nama"
            name="nama"
            value={draft.nama}
            onChange={(e) => setDraft({ ...draft, nama: e.target.value })}
            required
          />
        </div>

        <div>
          <label className="label" htmlFor="divisi">
            Division
          </label>
          <input
            className="field"
            id="divisi"
            name="divisi"
            list="division-options"
            value={draft.divisi}
            onChange={(e) => setDraft({ ...draft, divisi: e.target.value })}
            required
          />
          <datalist id="division-options">
            {divisions.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
        </div>

        <div>
          <label className="label" htmlFor="angkatan">
            Entry year
          </label>
          <input
            className="field"
            id="angkatan"
            name="angkatan"
            type="number"
            inputMode="numeric"
            value={draft.angkatan}
            onChange={(e) => setDraft({ ...draft, angkatan: Number(e.target.value) })}
            required
          />
        </div>

        <div className="sm:col-span-2">
          <label className="label" htmlFor="prodi">
            Study programme
          </label>
          <input
            className="field"
            id="prodi"
            name="prodi"
            value={draft.prodi}
            onChange={(e) => setDraft({ ...draft, prodi: e.target.value })}
            required
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button className="btn btn-primary" type="submit">
          {isCreate ? "Add member" : "Save changes"}
        </button>
        <button className="btn btn-quiet" type="button" onClick={cancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
