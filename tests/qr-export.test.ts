import { describe, expect, it } from "vitest";
import { Workbook } from "exceljs";
import { buildQrWorkbook } from "../lib/qr-export";
import type { Panitia } from "../lib/types";

const members: Panitia[] = [
  {
    id: "a",
    qr_token: "token-one",
    nama: "Ayu Lestari",
    divisi: "Acara",
    prodi: "Teknik Informatika",
    angkatan: 2023,
  },
  {
    id: "b",
    qr_token: "token-two",
    nama: "Budi Santoso",
    divisi: "Dana",
    prodi: "Sistem Informasi",
    angkatan: 2022,
  },
];

/** Write the workbook, then read it back so the test checks the real file. */
async function readBack(bytes: Awaited<ReturnType<typeof buildQrWorkbook>>) {
  const workbook = new Workbook();
  await workbook.xlsx.load(bytes);
  const sheet = workbook.getWorksheet("QR codes");
  if (!sheet) throw new Error("worksheet missing");
  return sheet;
}

describe("buildQrWorkbook", () => {
  it("lists every member under a heading row", async () => {
    const sheet = await readBack(await buildQrWorkbook(members));

    expect(sheet.getRow(1).values).toMatchObject({
      1: "No",
      2: "Nama",
      3: "Divisi",
      4: "Prodi",
      5: "Angkatan",
      6: "QR",
    });
    expect(sheet.getRow(2).values).toMatchObject({
      1: 1,
      2: "Ayu Lestari",
      3: "Acara",
      4: "Teknik Informatika",
      5: 2023,
    });
    expect(sheet.getRow(3).values).toMatchObject({ 1: 2, 2: "Budi Santoso" });
  });

  it("embeds one code per member", async () => {
    const sheet = await readBack(await buildQrWorkbook(members));
    expect(sheet.getImages()).toHaveLength(members.length);
  });

  it("keeps the heading in view on a long roster", async () => {
    const sheet = await readBack(await buildQrWorkbook(members));
    expect(sheet.views).toMatchObject([{ state: "frozen", ySplit: 1 }]);
  });

  it("still produces a usable sheet when there is nobody to list", async () => {
    const sheet = await readBack(await buildQrWorkbook([]));

    expect(sheet.getRow(1).values).toMatchObject({ 2: "Nama" });
    expect(sheet.rowCount).toBe(1);
    expect(sheet.getImages()).toHaveLength(0);
  });
});
