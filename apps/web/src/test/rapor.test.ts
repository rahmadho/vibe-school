import { describe, expect, it } from "vitest";
import {
  belumTuntas,
  formatTanggalIndonesia,
  judulRapor,
  namaBerkasRapor,
  ringkasKehadiran,
  type DataRapor,
} from "@/lib/rapor-bentuk";

/**
 * ============================================================
 * RAPOR — format & aturan penyajian
 * ============================================================
 *
 * Rapor dipegang orang tua dan bisa dipakai mendaftar ke sekolah lanjutan.
 * Kesalahan di sini bukan sekadar tampilan buruk.
 */

function rapor(over: Partial<DataRapor> = {}): DataRapor {
  return {
    sekolah: {
      name: "SMP Negeri 1 Nusantara",
      npsn: "12345678",
      address: "Jl. Pendidikan No. 1",
      phone: "0751-123456",
      email: "info@smpn1.sch.id",
      logoUrl: null,
    },
    siswa: {
      fullName: "Ahmad Fauzi",
      nis: "2024001",
      nisn: "0099887766",
      gender: "MALE",
      birthPlace: "Padang",
      birthDate: new Date(2012, 2, 7),
    },
    kelas: "VII A",
    waliKelas: "Budi Santoso",
    semester: { nama: "Ganjil", jenis: "GANJIL", tahunAjaran: "2025/2026" },
    nilai: [],
    catatanWali: null,
    kehadiran: null,
    kepalaSekolah: null,
    waliKelasTtd: null,
    ...over,
  };
}

describe("formatTanggalIndonesia", () => {
  it("menulis tanggal dalam bahasa Indonesia", () => {
    expect(formatTanggalIndonesia(new Date(2026, 8, 20))).toBe("20 September 2026");
    expect(formatTanggalIndonesia(new Date(2012, 2, 7))).toBe("7 Maret 2012");
  });

  it("mengembalikan tanda pisah untuk tanggal kosong/tidak sah", () => {
    // PDF TIDAK BOLEH mencetak "Invalid Date" di dokumen yang dipegang ortu.
    expect(formatTanggalIndonesia(null)).toBe("—");
    expect(formatTanggalIndonesia(undefined)).toBe("—");
    expect(formatTanggalIndonesia(new Date("bukan tanggal"))).toBe("—");
  });
});

describe("belumTuntas", () => {
  it("nilai PERSIS KKM berarti TUNTAS", () => {
    // Salah menandai siswa yang tuntas sebagai belum tuntas adalah keluhan
    // yang paling sering muncul. Batasnya harus `<`, bukan `<=`.
    expect(belumTuntas(70, 70)).toBe(false);
    expect(belumTuntas(71, 70)).toBe(false);
  });

  it("nilai di bawah KKM berarti belum tuntas", () => {
    expect(belumTuntas(69, 70)).toBe(true);
    expect(belumTuntas(0, 70)).toBe(true);
  });
});

describe("ringkasKehadiran", () => {
  it("membentuk kalimat rekap", () => {
    const k = ringkasKehadiran({ hadir: 90, sakit: 3, izin: 2, alpa: 1 });
    expect(k).toContain("Hadir: 90");
    expect(k).toContain("Sakit: 3");
    expect(k).toContain("Izin: 2");
    expect(k).toContain("Tanpa keterangan: 1");
  });

  it("kehadiran kosong jadi tanda pisah, BUKAN '0 hari'", () => {
    // "Hadir 0 hari" akan membuat orang tua panik tanpa alasan — datanya
    // memang belum ada, bukan anaknya tidak pernah hadir.
    expect(ringkasKehadiran(null)).toBe("—");
  });
});

describe("namaBerkasRapor", () => {
  it("membentuk nama berkas yang rapi", () => {
    const n = namaBerkasRapor(rapor());
    expect(n).toBe("Rapor-Ahmad-Fauzi-VII-A-2025-2026.pdf");
  });

  it("membersihkan karakter yang tidak sah untuk nama berkas", () => {
    // Nama seperti "Ahmad/Muhammad" atau bertanda diakritik tidak boleh
    // merusak path berkas.
    const n = namaBerkasRapor(
      rapor({
        siswa: {
          ...rapor().siswa,
          fullName: "Ahmad/Muhammad Rizkié",
        },
      }),
    );
    expect(n).not.toContain("/");
    expect(n).toContain("Ahmad-Muhammad-Rizki");
    expect(n.endsWith(".pdf")).toBe(true);
  });

  it("tetap benar tanpa kelas", () => {
    const n = namaBerkasRapor(rapor({ kelas: null }));
    expect(n).toBe("Rapor-Ahmad-Fauzi-2025-2026.pdf");
    expect(n).not.toContain("--");
  });
});

describe("judulRapor", () => {
  it("memuat nama siswa dan semester (untuk judul tab peramban)", () => {
    const j = judulRapor(rapor());
    expect(j).toContain("Ahmad Fauzi");
    expect(j).toContain("Ganjil");
    expect(j).toContain("2025/2026");
  });
});
