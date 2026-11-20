"use server";

import { revalidatePath } from "next/cache";
import { markHadir, setStatus } from "@/lib/attendance";
import { requireAdmin } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import type { Status } from "@/lib/types";

function revalidateAdmin() {
  revalidatePath("/admin", "layout");
}

function fail(message: string): never {
  throw new Error(message);
}

const STATUSES: Status[] = ["hadir", "izin", "alfa"];

function parseStatus(value: FormDataEntryValue | null): Status {
  const status = String(value ?? "");
  if (!STATUSES.includes(status as Status)) fail("Invalid status.");
  return status as Status;
}

function parseDate(value: FormDataEntryValue | null): string {
  const date = String(value ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail("Invalid date.");
  return date;
}

function requireText(value: FormDataEntryValue | null, field: string, max: number): string {
  const text = String(value ?? "").trim();
  if (!text) fail(`${field} is required.`);
  if (text.length > max) fail(`${field} is too long.`);
  return text;
}

/** Check a scanned QR token in as present for today. */
export async function scanAttendance(qrToken: string) {
  await requireAdmin();
  const token = qrToken.trim();
  if (!token) fail("Empty QR token.");

  const outcome = await markHadir(token);
  revalidateAdmin();
  return outcome;
}

/** Set one member's status for a given day. */
export async function setAttendanceStatus(formData: FormData) {
  await requireAdmin();

  const panitiaId = requireText(formData.get("panitiaId"), "Member id", 64);
  const status = parseStatus(formData.get("status"));
  const date = formData.get("date") ? parseDate(formData.get("date")) : undefined;

  await setStatus(panitiaId, status, date);
  revalidateAdmin();
}

/** Create a committee member with a freshly generated QR token. */
export async function createPanitia(formData: FormData) {
  await requireAdmin();

  const nama = requireText(formData.get("nama"), "Name", 120);
  const divisi = requireText(formData.get("divisi"), "Division", 120);
  const prodi = requireText(formData.get("prodi"), "Study programme", 160);
  const angkatan = Number(formData.get("angkatan"));
  if (!Number.isInteger(angkatan) || angkatan < 1900 || angkatan > 2100) {
    fail("Enter a valid graduation year.");
  }

  const { error } = await supabaseAdmin().from("panitia").insert({
    nama,
    divisi,
    prodi,
    angkatan,
    qr_token: crypto.randomUUID(),
  });
  if (error) fail(`Could not save: ${error.message}`);

  revalidateAdmin();
}

/** Update one committee member's details (QR token is left untouched). */
export async function updatePanitia(formData: FormData) {
  await requireAdmin();

  const id = requireText(formData.get("id"), "Member id", 64);
  const nama = requireText(formData.get("nama"), "Name", 120);
  const divisi = requireText(formData.get("divisi"), "Division", 120);
  const prodi = requireText(formData.get("prodi"), "Study programme", 160);
  const angkatan = Number(formData.get("angkatan"));
  if (!Number.isInteger(angkatan) || angkatan < 1900 || angkatan > 2100) {
    fail("Enter a valid graduation year.");
  }

  const { error } = await supabaseAdmin()
    .from("panitia")
    .update({ nama, divisi, prodi, angkatan })
    .eq("id", id);
  if (error) fail(`Could not save: ${error.message}`);

  revalidateAdmin();
}

/** Remove a committee member and their attendance history. */
export async function deletePanitia(formData: FormData) {
  await requireAdmin();

  const id = requireText(formData.get("id"), "Member id", 64);
  const { error } = await supabaseAdmin().from("panitia").delete().eq("id", id);
  if (error) fail(`Could not delete: ${error.message}`);

  revalidateAdmin();
}
