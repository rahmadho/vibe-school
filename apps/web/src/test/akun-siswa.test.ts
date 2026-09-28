import { describe, expect, it } from "vitest";
import {
  tanggalLahirKePassword,
  usulanEmailSiswa,
  periksaKekuatanPassword,
} from "@/lib/akun-siswa-murni";

/**
 * ============================================================
 * AKUN SISWA — aturan MURNI
 * ============================================================
 *
 * Password awal akun siswa/wali = tanggal lahir (DDMMYYYY). Ini dipilih supaya
 * orang tua pasti tahu nilainya tanpa distribusi password terpisah. Karena itu
 * akun WAJIB bertanda mustChangePassword — dan test ini menjaga bahwa aturan
 * pembentukan & kekuatan password tetap masuk akal.
 */

describe("tanggalLahirKePassword", () => {
  it("membentuk DDMMYYYY", () => {
    // 7 Maret 2012 → 07032012
    expect(tanggalLahirKePassword(new Date(2012, 2, 7))).toBe("07032012");
    // 25 Desember 2008 → 25122008
    expect(tanggalLahirKePassword(new Date(2008, 11, 25))).toBe("25122008");
  });

  it("memberi angka nol di depan untuk tanggal/bulan satu digit", () => {
    expect(tanggalLahirKePassword(new Date(2010, 0, 5))).toBe("05012010");
    expect(tanggalLahirKePassword(new Date(2010, 8, 9))).toBe("09092010");
  });

  it("mengembalikan null bila data kosong atau tidak masuk akal", () => {
    // null = pemanggil memutuskan fallback (jatuh ke NIS). Sengaja BUKAN
    // string kosong: password kosong berarti akun tanpa kunci.
    expect(tanggalLahirKePassword(null)).toBeNull();
    expect(tanggalLahirKePassword(undefined)).toBeNull();
    expect(tanggalLahirKePassword(new Date("bukan tanggal"))).toBeNull();
    expect(tanggalLahirKePassword(new Date(1800, 0, 1))).toBeNull();
    expect(tanggalLahirKePassword(new Date(2200, 0, 1))).toBeNull();
  });
});

describe("usulanEmailSiswa", () => {
  it("membentuk email dari NIS + slug sekolah", () => {
    expect(usulanEmailSiswa("2024001", "smpn1-nusantara")).toBe(
      "siswa.2024001@smpn1-nusantara.sch.id",
    );
  });

  it("membersihkan NIS dari karakter yang tidak sah untuk email", () => {
    expect(usulanEmailSiswa("2024.001", "smpn1")).toBe(
      "siswa.2024001@smpn1.sch.id",
    );
    expect(usulanEmailSiswa("A-2024", "smpn1")).toBe(
      "siswa.a2024@smpn1.sch.id",
    );
  });

  it("menyertakan slug sekolah — NIS sama di dua sekolah tidak boleh bentrok", () => {
    // Ini alasan utama email memuat slug: User.email unik GLOBAL.
    const a = usulanEmailSiswa("2024001", "smpn1");
    const b = usulanEmailSiswa("2024001", "smpn2");
    expect(a).not.toBe(b);
  });
});

describe("periksaKekuatanPassword", () => {
  it("menerima password yang layak", () => {
    expect(periksaKekuatanPassword("rahasia2024").ok).toBe(true);
    expect(periksaKekuatanPassword("AnakKu99").ok).toBe(true);
  });

  it("menolak password terlalu pendek", () => {
    const h = periksaKekuatanPassword("ab1");
    expect(h.ok).toBe(false);
    expect(h.alasan).toMatch(/minimal 8/i);
  });

  it("menolak password tanpa huruf atau tanpa angka", () => {
    expect(periksaKekuatanPassword("abcdefghij").ok).toBe(false);
    expect(periksaKekuatanPassword("1234567890").ok).toBe(false);
  });

  it("menolak 8 angka — itu justru password awal (tanggal lahir)", () => {
    // Mengganti password ke bentuk yang sama dengan password awal tidak
    // meningkatkan keamanan apa pun; akun tetap mudah ditebak.
    const h = periksaKekuatanPassword("07032012");
    expect(h.ok).toBe(false);
    expect(h.alasan).toMatch(/tanggal/i);
  });

  it("menolak password yang sangat umum", () => {
    expect(periksaKekuatanPassword("password").ok).toBe(false);
    expect(periksaKekuatanPassword("Password").ok).toBe(false);
    expect(periksaKekuatanPassword("sekolah123").ok).toBe(false);
  });

  it("menolak password terlalu panjang dan input bukan teks", () => {
    expect(periksaKekuatanPassword("a1".repeat(100)).ok).toBe(false);
    expect(periksaKekuatanPassword(null as unknown as string).ok).toBe(false);
  });
});
