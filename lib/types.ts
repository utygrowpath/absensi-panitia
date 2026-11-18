export type Panitia = {
  id: string;
  qr_token: string;
  nama: string;
  divisi: string;
  prodi: string;
  angkatan: number;
};

export type Status = "hadir" | "izin" | "alfa";

export type Attendance = {
  id: string;
  panitia_id: string;
  attendance_date: string;
  status: Status;
  checked_in_at: string | null;
  updated_at: string;
};

/** Parse `data_panitia.csv` into rows. Throws when a row is malformed. */
export function parsePanitiaCsv(text: string): Omit<Panitia, "id" | "qr_token">[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) throw new Error("CSV has no data rows");

  const header = lines[0].split(",").map((cell) => cell.trim());
  const expected = ["nama", "divisi", "prodi", "angkatan"];
  if (header.join("|") !== expected.join("|")) {
    throw new Error(`Unexpected CSV header: ${header.join(", ")}`);
  }

  return lines.slice(1).map((line, index) => {
    const cells = line.split(",").map((cell) => cell.trim());
    if (cells.length !== expected.length) {
      throw new Error(`Row ${index + 2} has ${cells.length} columns, expected 4`);
    }
    const [nama, divisi, prodi, angkatan] = cells;
    if (!nama || !divisi || !prodi) {
      throw new Error(`Row ${index + 2} has an empty required field`);
    }
    const year = Number(angkatan);
    if (!Number.isInteger(year)) {
      throw new Error(`Row ${index + 2} has a non-numeric angkatan: ${angkatan}`);
    }
    return { nama, divisi, prodi, angkatan: year };
  });
}
