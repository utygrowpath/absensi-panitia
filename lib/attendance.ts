import { supabaseAdmin } from "./supabase";
import { todayInJakarta } from "./time";
import type { Status } from "./types";

export type DaySummary = {
  total: number;
  hadir: number;
  izin: number;
  alfa: number;
  belum: number;
};

export type ScanOutcome =
  | { kind: "marked"; nama: string; divisi: string }
  | { kind: "already"; nama: string; divisi: string; at: string | null }
  | { kind: "corrected"; nama: string; divisi: string; from: Status }
  | { kind: "unknown" };

function dayOf(date: string | null | undefined): string {
  return date ?? todayInJakarta();
}

/**
 * Record a scan as `hadir`. An existing `hadir` row keeps its original time so
 * double scans do not push the timestamp forward; `izin`/`alfa` are corrected.
 */
export async function markHadir(qrToken: string, date?: string): Promise<ScanOutcome> {
  const db = supabaseAdmin();
  const attendanceDate = dayOf(date);

  const { data: person, error: personError } = await db
    .from("panitia")
    .select("id, nama, divisi")
    .eq("qr_token", qrToken)
    .maybeSingle();
  if (personError) throw personError;
  if (!person) return { kind: "unknown" };

  const { data: existing, error: existingError } = await db
    .from("attendance")
    .select("id, status, checked_in_at")
    .eq("panitia_id", person.id)
    .eq("attendance_date", attendanceDate)
    .maybeSingle();
  if (existingError) throw existingError;

  const now = new Date().toISOString();

  if (!existing) {
    const { error } = await db.from("attendance").insert({
      panitia_id: person.id,
      attendance_date: attendanceDate,
      status: "hadir",
      checked_in_at: now,
      updated_at: now,
    });
    if (error) throw error;
    return { kind: "marked", nama: person.nama, divisi: person.divisi };
  }

  if (existing.status === "hadir") {
    return {
      kind: "already",
      nama: person.nama,
      divisi: person.divisi,
      at: existing.checked_in_at,
    };
  }

  const { error } = await db
    .from("attendance")
    .update({ status: "hadir", checked_in_at: now, updated_at: now })
    .eq("id", existing.id);
  if (error) throw error;
  return { kind: "corrected", nama: person.nama, divisi: person.divisi, from: existing.status };
}

/** Set (or change) a member's status for one day, keeping a timestamp on `hadir`. */
export async function setStatus(
  panitiaId: string,
  status: Status,
  date?: string,
): Promise<void> {
  const db = supabaseAdmin();
  const attendanceDate = dayOf(date);
  const now = new Date().toISOString();

  const { data: existing, error: existingError } = await db
    .from("attendance")
    .select("id")
    .eq("panitia_id", panitiaId)
    .eq("attendance_date", attendanceDate)
    .maybeSingle();
  if (existingError) throw existingError;

  if (existing) {
    const { error } = await db
      .from("attendance")
      .update({
        status,
        checked_in_at: status === "hadir" ? now : null,
        updated_at: now,
      })
      .eq("id", existing.id);
    if (error) throw error;
    return;
  }

  const { error } = await db.from("attendance").insert({
    panitia_id: panitiaId,
    attendance_date: attendanceDate,
    status,
    checked_in_at: status === "hadir" ? now : null,
    updated_at: now,
  });
  if (error) throw error;
}

/** Counts for one day, across every committee member. */
export async function daySummary(date?: string): Promise<DaySummary> {
  const db = supabaseAdmin();
  const attendanceDate = dayOf(date);

  const [{ count: total, error: totalError }, { data: rows, error: rowsError }] =
    await Promise.all([
      db.from("panitia").select("id", { count: "exact", head: true }),
      db.from("attendance").select("status").eq("attendance_date", attendanceDate),
    ]);
  if (totalError) throw totalError;
  if (rowsError) throw rowsError;

  const summary: DaySummary = { total: total ?? 0, hadir: 0, izin: 0, alfa: 0, belum: 0 };
  for (const row of rows ?? []) summary[row.status as Status]++;
  summary.belum = Math.max(0, summary.total - summary.hadir - summary.izin - summary.alfa);
  return summary;
}

/** Recorded status per member for one day. Members absent from the map have no record. */
export async function supabaseDayStatuses(
  date?: string,
): Promise<Map<string, Status>> {
  const db = supabaseAdmin();
  const attendanceDate = dayOf(date);
  const { data, error } = await db
    .from("attendance")
    .select("panitia_id, status")
    .eq("attendance_date", attendanceDate);
  if (error) throw error;
  return new Map((data ?? []).map((row) => [row.panitia_id, row.status as Status]));
}
