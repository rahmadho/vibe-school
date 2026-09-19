import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseStudentWorkbook, buildStudentTemplate } from "@/lib/import/students";

/**
 * Test parser import XLSX. Membuat workbook langsung dengan SheetJS,
 * lalu memastikan mapping kolom, normalisasi nilai, dan laporan galat benar.
 */

function makeWorkbook(rows: Array<Record<string, unknown>>): ArrayBuffer {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Siswa");
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return buf;
}

describe("parseStudentWorkbook", () => {
  it("menerima baris valid dan menormalkan nilai", () => {
    const buf = makeWorkbook([
      {
        nis: "2025001",
        fullName: "Ani Contoh",
        gender: "P",
        entryYear: 2025,
        status: "Aktif",
        parentName: "Budi",
        parentRelation: "Ayah",
        parentPhone: "081298765432",
      },
    ]);
    const res = parseStudentWorkbook(buf);
    expect(res.headerErrors).toHaveLength(0);
    expect(res.validCount).toBe(1);
    expect(res.invalidCount).toBe(0);

    const row = res.rows[0];
    expect(row.ok).toBe(true);
    expect(row.data?.gender).toBe("FEMALE"); // "P" → FEMALE
    expect(row.data?.status).toBe("ACTIVE"); // "Aktif" → ACTIVE
    expect(row.data?.parentRelation).toBe("FATHER"); // "Ayah" → FATHER
    expect(row.data?.parentPhone).toBe("6281298765432"); // dinormalkan
  });

  it("menandai baris tanpa NIS sebagai tidak valid", () => {
    const buf = makeWorkbook([
      { nis: "", fullName: "Tanpa NIS", gender: "L", entryYear: 2025 },
    ]);
    const res = parseStudentWorkbook(buf);
    expect(res.validCount).toBe(0);
    expect(res.invalidCount).toBe(1);
    expect(res.rows[0].errors?.join(" ")).toMatch(/nis/i);
  });

  it("melaporkan kolom wajib yang hilang", () => {
    const buf = makeWorkbook([{ nama: "Salah header", kelas: "7A" }]);
    const res = parseStudentWorkbook(buf);
    expect(res.headerErrors.length).toBeGreaterThan(0);
    expect(res.headerErrors.join(" ")).toMatch(/nis/i);
  });

  it("menerima header tanpa peduli besar/kecil huruf", () => {
    const buf = makeWorkbook([
      { NIS: "2025002", FULLNAME: "Huruf Besar", Gender: "L", EntryYear: 2025 },
    ]);
    const res = parseStudentWorkbook(buf);
    expect(res.validCount).toBe(1);
    expect(res.rows[0].data?.fullName).toBe("Huruf Besar");
  });

  it("menolak file tanpa sheet / kosong secara aman", () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet([]);
    XLSX.utils.book_append_sheet(wb, ws, "Kosong");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const res = parseStudentWorkbook(buf);
    expect(res.rows).toHaveLength(0);
    expect(res.headerErrors.join(" ")).toMatch(/kosong/i);
  });
});

describe("buildStudentTemplate", () => {
  it("menghasilkan file XLSX yang bisa dibaca kembali", () => {
    const buf = buildStudentTemplate();
    const wb = XLSX.read(buf, { type: "buffer" });
    expect(wb.SheetNames).toContain("Siswa");
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
      wb.Sheets[wb.SheetNames[0]],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveProperty("nis");
    expect(rows[0]).toHaveProperty("fullName");
  });
});
