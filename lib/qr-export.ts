import { Workbook } from "exceljs";
import type { Borders, Row } from "exceljs";
import QRCode from "qrcode";
import type { Panitia } from "@/lib/types";

/** QR edge in pixels: large enough to scan off a sheet, small enough for one row. */
const QR_PX = 96;
/** The QR column is F, which is column index 5 with A = 0. */
const QR_COL = 5;
/** Horizontal offset that centres the code inside the QR column. */
const QR_COL_OFFSET = 0.3;
/** Vertical offset that drops the code just below the row's top rule. */
const QR_ROW_OFFSET = 0.15;

const HEADER_FILL = "FFF4F4F5";
const COLUMNS = 6;

const BORDER: Partial<Borders> = {
  top: { style: "thin" },
  bottom: { style: "thin" },
  left: { style: "thin" },
  right: { style: "thin" },
};

/** Box every column explicitly: a floating image leaves its cell unset. */
function boxRow(row: Row): void {
  for (let column = 1; column <= COLUMNS; column += 1) {
    const cell = row.getCell(column);
    cell.border = BORDER;
    cell.alignment = { vertical: "middle" };
  }
}

/**
 * One sheet per committee: identity columns plus the code itself as an image,
 * so the export can be read as a roster and reprinted as cards without a
 * separate QR page.
 */
export async function buildQrWorkbook(members: Panitia[]) {
  const workbook = new Workbook();
  const sheet = workbook.addWorksheet("QR codes");

  sheet.columns = [
    { header: "No", key: "no", width: 6 },
    { header: "Nama", key: "nama", width: 28 },
    { header: "Divisi", key: "divisi", width: 18 },
    { header: "Prodi", key: "prodi", width: 24 },
    { header: "Angkatan", key: "angkatan", width: 10 },
    { header: "QR", key: "qr", width: 20 },
  ];

  // Frozen so a long roster keeps its headings in view.
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  const header = sheet.getRow(1);
  header.font = { bold: true };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
  header.height = 22;
  boxRow(header);

  for (const [index, member] of members.entries()) {
    const row = sheet.addRow({
      no: index + 1,
      nama: member.nama,
      divisi: member.divisi,
      prodi: member.prodi,
      angkatan: member.angkatan,
    });
    // Excel row heights are points; the code is pixels.
    row.height = QR_PX * 0.75 + 8;
    boxRow(row);

    // exceljs wants raw base64 rather than the data-URI wrapper.
    const dataUrl = await QRCode.toDataURL(member.qr_token, {
      width: QR_PX,
      margin: 1,
      errorCorrectionLevel: "M",
    });
    const imageId = workbook.addImage({
      base64: dataUrl.slice(dataUrl.indexOf(",") + 1),
      extension: "png",
    });
    sheet.addImage(imageId, {
      tl: {
        col: QR_COL + QR_COL_OFFSET,
        row: row.number - 1 + QR_ROW_OFFSET,
      },
      ext: { width: QR_PX, height: QR_PX },
    });
  }

  return workbook.xlsx.writeBuffer();
}
