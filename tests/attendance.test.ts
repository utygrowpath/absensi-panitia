import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;

/**
 * State shared with the mock below. `vi.mock` is hoisted above imports, so the
 * holder is created through `vi.hoisted` to stay reachable from the factory.
 */
const db = vi.hoisted(() => {
  const state: { people: Row[]; attendance: Row[] } = {
    people: [],
    attendance: [],
  };

  type TableName = "panitia" | "attendance";

  function table(name: TableName) {
    const rows = () => (name === "panitia" ? state.people : state.attendance);
    const filters: ((r: Row) => boolean)[] = [];
    let wantSingle = false;
    let wantCount = false;

    const matched = () => rows().filter((r) => filters.every((f) => f(r)));

    // Supabase returns serialized copies, so reads must not alias live rows.
    const copies = (list: Row[]) => list.map((r) => ({ ...r }));

    const result = () => {
      const out = matched();
      if (wantCount) return { count: out.length, data: null, error: null };
      if (wantSingle) return { data: out[0] ? { ...out[0] } : null, error: null };
      return { data: copies(out), error: null };
    };

    const api: Record<string, unknown> & {
      select: (cols: string, opts?: { head?: boolean }) => typeof api;
      eq: (column: string, value: unknown) => typeof api;
      order: () => typeof api;
      maybeSingle: () => Promise<unknown>;
      insert: (payload: Row | Row[]) => Promise<{ error: null }>;
      update: (payload: Row) => {
        eq: (column: string, value: unknown) => Promise<{ error: null }>;
      };
      then: (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) => Promise<unknown>;
    } = {
      select(_cols: string, opts?: { head?: boolean }) {
        wantCount = Boolean(opts?.head);
        return api;
      },
      eq(column: string, value: unknown) {
        filters.push((r) => r[column] === value);
        return api;
      },
      order() {
        return api;
      },
      maybeSingle() {
        wantSingle = true;
        return Promise.resolve(result());
      },
      insert(payload: Row | Row[]) {
        const list = Array.isArray(payload) ? payload : [payload];
        for (const item of list) rows().push({ id: `gen-${rows().length + 1}`, ...item });
        return Promise.resolve({ error: null });
      },
      update(payload: Row) {
        return {
          eq: (column: string, value: unknown) => {
            const hit = rows().find(
              (r) => r[column] === value && filters.every((f) => f(r)),
            );
            if (hit) Object.assign(hit, payload);
            return Promise.resolve({ error: null });
          },
        };
      },
      then(onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
        return Promise.resolve(result()).then(onFulfilled, onRejected);
      },
    };

    return api;
  }

  return { state, from: table };
});

vi.mock("../lib/supabase", () => ({
  supabaseAdmin: () => db,
}));

const PERSON = {
  id: "p1",
  qr_token: "token-1",
  nama: "Syamil Ahmad Mudzakkir",
  divisi: "Formatur",
  prodi: "Hubungan Internasional",
  angkatan: 2024,
};

beforeEach(() => {
  db.state.people = [{ ...PERSON }];
  db.state.attendance = [];
});

async function load() {
  return await import("../lib/attendance");
}

describe("markHadir", () => {
  it("creates a record for a first scan", async () => {
    const { markHadir } = await load();
    const outcome = await markHadir("token-1", "2026-11-18");

    expect(outcome).toEqual({ kind: "marked", nama: PERSON.nama, divisi: PERSON.divisi });
    expect(db.state.attendance).toHaveLength(1);
    expect(db.state.attendance[0]).toMatchObject({
      panitia_id: "p1",
      attendance_date: "2026-11-18",
      status: "hadir",
    });
    expect(db.state.attendance[0].checked_in_at).toBeTruthy();
  });

  it("keeps the original time when scanned twice", async () => {
    db.state.attendance.push({
      id: "a1",
      panitia_id: "p1",
      attendance_date: "2026-11-18",
      status: "hadir",
      checked_in_at: "2026-11-18T01:00:00.000Z",
    });
    const { markHadir } = await load();

    const outcome = await markHadir("token-1", "2026-11-18");
    expect(outcome).toEqual({
      kind: "already",
      nama: PERSON.nama,
      divisi: PERSON.divisi,
      at: "2026-11-18T01:00:00.000Z",
    });
    expect(db.state.attendance).toHaveLength(1);
    expect(db.state.attendance[0].checked_in_at).toBe("2026-11-18T01:00:00.000Z");
  });

  it("corrects an izin record to hadir", async () => {
    db.state.attendance.push({
      id: "a1",
      panitia_id: "p1",
      attendance_date: "2026-11-18",
      status: "izin",
      checked_in_at: null,
    });
    const { markHadir } = await load();

    const outcome = await markHadir("token-1", "2026-11-18");
    expect(outcome).toEqual({
      kind: "corrected",
      nama: PERSON.nama,
      divisi: PERSON.divisi,
      from: "izin",
    });
    expect(db.state.attendance[0].status).toBe("hadir");
    expect(db.state.attendance[0].checked_in_at).toBeTruthy();
  });

  it("returns unknown for an unrecognised token", async () => {
    const { markHadir } = await load();
    expect(await markHadir("nope", "2026-11-18")).toEqual({ kind: "unknown" });
  });

  it("scopes records to the given date", async () => {
    db.state.attendance.push({
      id: "old",
      panitia_id: "p1",
      attendance_date: "2026-11-17",
      status: "hadir",
      checked_in_at: "2026-11-17T01:00:00.000Z",
    });
    const { markHadir } = await load();

    const outcome = await markHadir("token-1", "2026-11-18");
    expect(outcome.kind).toBe("marked");
    expect(db.state.attendance).toHaveLength(2);
  });
});

describe("daySummary", () => {
  it("counts each status and derives the not-yet-present total", async () => {
    db.state.people = [{ id: "p1" }, { id: "p2" }, { id: "p3" }, { id: "p4" }];
    db.state.attendance = [
      { panitia_id: "p1", status: "hadir", attendance_date: "2026-11-18" },
      { panitia_id: "p2", status: "izin", attendance_date: "2026-11-18" },
      { panitia_id: "p3", status: "alfa", attendance_date: "2026-11-18" },
    ];
    const { daySummary } = await load();

    expect(await daySummary("2026-11-18")).toEqual({
      total: 4,
      hadir: 1,
      izin: 1,
      alfa: 1,
      belum: 1,
    });
  });

  it("reports everyone as belum before any scan", async () => {
    db.state.people = [{ id: "p1" }, { id: "p2" }];
    db.state.attendance = [];
    const { daySummary } = await load();

    const summary = await daySummary("2026-11-18");
    expect(summary.belum).toBe(2);
    expect(summary.hadir).toBe(0);
  });
});

describe("setStatus", () => {
  it("updates an existing record", async () => {
    db.state.attendance.push({
      id: "a1",
      panitia_id: "p1",
      attendance_date: "2026-11-18",
      status: "hadir",
      checked_in_at: "2026-11-18T01:00:00.000Z",
    });
    const { setStatus } = await load();

    await setStatus("p1", "alfa", "2026-11-18");
    expect(db.state.attendance[0].status).toBe("alfa");
    expect(db.state.attendance[0].checked_in_at).toBeNull();
  });

  it("creates a record when none exists", async () => {
    const { setStatus } = await load();

    await setStatus("p1", "izin", "2026-11-18");
    expect(db.state.attendance).toHaveLength(1);
    expect(db.state.attendance[0].status).toBe("izin");
    expect(db.state.attendance[0].checked_in_at).toBeNull();
  });

  it("keeps a timestamp only for hadir", async () => {
    const { setStatus } = await load();

    await setStatus("p1", "hadir", "2026-11-18");
    expect(db.state.attendance[0].checked_in_at).toBeTruthy();
  });
});
