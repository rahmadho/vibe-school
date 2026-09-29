import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseStudentWorkbook } from "@/lib/import/students";

/**
 * ============================================================
 * IMPOR SISWA — kolom data administrasi
 * ============================================================
 *
 * Dua hal yang diuji:
 *  1. Kolom baru (NIK, alamat berjenjang, data ortu) ikut terbaca.
 *  2. Berkas LAMA yang belum punya kolom baru TETAP BISA diimpor.
 *
 * Nomor 2 yang paling penting: sekolah sudah punya berkas Excel yang dibuat
 * sebelum kolom ini ada. Kalau impor menuntut kolom baru, seluruh berkas lama
 * mendadak gagal — padahal datanya benar.
 */

/** Bangun workbook .xlsx nyata dari baris data, lalu uraikan. */
function parse(rows: Record<string, unknown>[]) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Siswa");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return parseStudentWorkbook(buf);
}

/** Kolom yang selalu ada di berkas sekolah. */
const BARIS_DASAR = {
  nis: "2024001",
  fullName: "Ahmad Fauzi",
  gender: "L",
  entryYear: 2024,
};

describe("impor siswa — berkas LAMA tetap bisa dipakai", () => {
  it("menerima berkas tanpa kolom NIK & alamat berjenjang", () => {
    // Ini bentuk berkas yang sudah beredar di sekolah.
    const hasil = parse([BARIS_DASAR]);
    expect(hasil.headerErrors).toEqual([]);
    expect(hasil.validCount).toBe(1);
  });

  it("menerima berkas dengan HANYA kolom wajib", () => {
    // nis, fullName, gender, entryYear — tidak ada yang lain.
    const hasil = parse([BARIS_DASAR]);
    expect(hasil.invalidCount).toBe(0);
  });
});

describe("impor siswa — kolom administrasi terbaca", () => {
  it("membaca NIK, KK, dan alamat berjenjang", () => {
    const hasil = parse([
      {
        ...BARIS_DASAR,
        nik: "1371020703120001",
        kkNumber: "1371020112345678",
        village: "Kampung Baru",
        district: "Padang Barat",
        city: "Kota Padang",
        province: "Sumatera Barat",
        postalCode: "25118",
      },
    ]);

    expect(hasil.validCount).toBe(1);
    const d = hasil.rows[0].data;
    expect(d?.nik).toBe("1371020703120001");
    expect(d?.village).toBe("Kampung Baru");
    expect(d?.city).toBe("Kota Padang");
  });

  it("membaca kolom wali (wali utama dibuat dari sini)", () => {
    const hasil = parse([
      {
        ...BARIS_DASAR,
        parentName: "Budi Santoso",
        parentRelation: "Ayah",
        parentPhone: "081234567890",
        parentNik: "1371020101850002",
        parentOccupation: "Petani",
      },
    ]);

    expect(hasil.validCount).toBe(1);
    expect(hasil.rows[0].data?.parentName).toBe("Budi Santoso");
    expect(hasil.rows[0].data?.parentNik).toBe("1371020101850002");
  });
});

describe("impor siswa — NIK salah ditolak dengan alasan jelas", () => {
  it("menolak NIK yang tanggalnya tidak ada (31 Februari)", () => {
    const hasil = parse([{ ...BARIS_DASAR, nik: "1371023102120001" }]);
    expect(hasil.invalidCount).toBe(1);
    const pesan = JSON.stringify(hasil.rows[0].errors);
    expect(pesan).toMatch(/tidak ada|tidak sah/i);
  });

  it("menolak NIK yang kurang digit", () => {
    const hasil = parse([{ ...BARIS_DASAR, nik: "137102" }]);
    expect(hasil.invalidCount).toBe(1);
  });

  it("NIK kosong tetap boleh — operator melengkapi nanti", () => {
    const hasil = parse([{ ...BARIS_DASAR, nik: "" }]);
    expect(hasil.validCount).toBe(1);
  });

  it("sel NIK yang kosong (tidak ada kolomnya) tidak dianggap salah", () => {
    // Peramban/spreadsheet mengirim sel kosong sebagai undefined, bukan "".
    const hasil = parse([{ ...BARIS_DASAR, nik: undefined }]);
    expect(hasil.validCount).toBe(1);
  });
});

describe("impor siswa — pesan kesalahan menyebut baris", () => {
  it("pelaporan tetap per baris walau ada kolom baru", () => {
    const hasil = parse([
      BARIS_DASAR,
      { ...BARIS_DASAR, nis: "2024002", nik: "9999999999999999" },
    ]);
    expect(hasil.validCount).toBe(1);
    expect(hasil.invalidCount).toBe(1);
    expect(hasil.rows[1].rowNumber).toBe(3); // baris 1 = header
  });
});
