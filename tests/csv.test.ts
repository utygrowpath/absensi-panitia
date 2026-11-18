import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parsePanitiaCsv } from "../lib/types";

const csv = readFileSync(new URL("../data_panitia.csv", import.meta.url), "utf8");

describe("parsePanitiaCsv", () => {
  it("parses every committed row", () => {
    const rows = parsePanitiaCsv(csv);
    expect(rows).toHaveLength(70);
    expect(rows[0]).toEqual({
      nama: "Syamil Ahmad Mudzakkir",
      divisi: "Formatur",
      prodi: "Hubungan Internasional",
      angkatan: 2024,
    });
    expect(rows[rows.length - 1].nama).toBe("Nur Romadhoni");
  });

  it("keeps names containing punctuation intact", () => {
    const rows = parsePanitiaCsv(csv);
    const member = rows.find((r) => r.nama.includes("Fa'iz"));
    expect(member?.nama).toBe("Muh Fa'iz Al-Hafidz");
  });

  it("reads all ten divisions", () => {
    const rows = parsePanitiaCsv(csv);
    const divisions = new Set(rows.map((r) => r.divisi));
    expect(divisions.size).toBe(10);
    expect(divisions.has("Equipment & Logistic Operations")).toBe(true);
  });

  it("reads entry years as numbers", () => {
    const rows = parsePanitiaCsv(csv);
    expect(rows.every((r) => Number.isInteger(r.angkatan))).toBe(true);
    expect(rows.some((r) => r.angkatan === 2026)).toBe(true);
  });

  it("rejects a wrong header", () => {
    expect(() => parsePanitiaCsv("name,division\nA,B\n")).toThrow(/header/i);
  });

  it("rejects a short row", () => {
    expect(() => parsePanitiaCsv("nama,divisi,prodi,angkatan\nA,B,C\n")).toThrow(
      /3 columns/,
    );
  });

  it("rejects a non-numeric angkatan", () => {
    expect(() =>
      parsePanitiaCsv("nama,divisi,prodi,angkatan\nA,B,C,twenty\n"),
    ).toThrow(/non-numeric/);
  });
});
