import { describe, expect, it } from "vitest";
import {
  klasifikasiIdentitas,
  normalkanIdentitas,
  slugSekolahValid,
} from "@/lib/login-identitas-murni";

/**
 * ============================================================
 * LOGIN DENGAN NIS — aturan isolasi tenant
 * ============================================================
 *
 * NIS tidak unik antar sekolah. Test ini mengunci keputusan yang mencegah
 * seseorang masuk ke akun sekolah lain hanya dengan menebak NIS.
 */

describe("klasifikasiIdentitas", () => {
  it("mengenali email biasa", () => {
    expect(klasifikasiIdentitas("admin@smpn1.sch.id")).toBe("email");
    expect(klasifikasiIdentitas("  guru@sekolah.id  ")).toBe("email");
    expect(klasifikasiIdentitas("a@b.co")).toBe("email");
  });

  it("mengenali NIS biasa", () => {
    expect(klasifikasiIdentitas("2024001")).toBe("nis");
    expect(klasifikasiIdentitas("2024.001")).toBe("nis");
    expect(klasifikasiIdentitas("SISWA-001")).toBe("nis");
    expect(klasifikasiIdentitas("  A2024  ")).toBe("nis");
  });

  it("menolak input kosong", () => {
    expect(klasifikasiIdentitas("")).toBe("tidak_valid");
    expect(klasifikasiIdentitas("   ")).toBe("tidak_valid");
  });

  it("menolak email cacat — jangan sampai lolos jadi NIS", () => {
    // Ini penting: "a@b" TIDAK boleh jatuh ke jalur NIS, karena query email
    // akan gagal lalu sistem "mencoba yang lain" — perilaku yang tak terduga.
    expect(klasifikasiIdentitas("a@b")).toBe("tidak_valid");
    expect(klasifikasiIdentitas("@sekolah.id")).toBe("tidak_valid");
    expect(klasifikasiIdentitas("guru@")).toBe("tidak_valid");
    expect(klasifikasiIdentitas("guru@@sekolah.id")).toBe("tidak_valid");
    expect(klasifikasiIdentitas("guru@sekolah.id.")).toBe("tidak_valid");
  });

  it("menolak NIS yang terlalu pendek atau berisi karakter aneh", () => {
    expect(klasifikasiIdentitas("12")).toBe("tidak_valid");
    expect(klasifikasiIdentitas("-2024001")).toBe("tidak_valid");
    expect(klasifikasiIdentitas("2024 001")).toBe("tidak_valid");
    expect(klasifikasiIdentitas("2024001'; DROP TABLE users;--")).toBe(
      "tidak_valid",
    );
    expect(klasifikasiIdentitas("a".repeat(33))).toBe("tidak_valid");
  });
});

describe("normalkanIdentitas", () => {
  it("email → huruf kecil (database menyimpan huruf kecil)", () => {
    expect(normalkanIdentitas("Admin@SMPN1.Sch.ID")).toEqual({
      jenis: "email",
      nilai: "admin@smpn1.sch.id",
    });
  });

  it("NIS → dibiarkan apa adanya (peka huruf besar/kecil)", () => {
    expect(normalkanIdentitas("A2024")).toEqual({
      jenis: "nis",
      nilai: "A2024",
    });
    expect(normalkanIdentitas(" 2024001 ")).toEqual({
      jenis: "nis",
      nilai: "2024001",
    });
  });

  it("mengembalikan null untuk input tidak valid", () => {
    expect(normalkanIdentitas("")).toBeNull();
    expect(normalkanIdentitas("a@b")).toBeNull();
    expect(normalkanIdentitas("ab")).toBeNull();
  });
});

describe("slugSekolahValid — penjaga sebelum menyentuh database", () => {
  it("menerima slug wajar", () => {
    expect(slugSekolahValid("smpn1-nusantara")).toBe(true);
    expect(slugSekolahValid("ab")).toBe(true);
    expect(slugSekolahValid("sekolah123")).toBe(true);
  });

  it("menolak slug kosong atau bukan teks — JANGAN dianggap cocok-semua", () => {
    // Bila slug kosong dianggap "cocok dengan sekolah mana pun", login NIS
    // akan memakai sekolah pertama yang ditemukan → kebocoran lintas tenant.
    expect(slugSekolahValid("")).toBe(false);
    expect(slugSekolahValid("   ")).toBe(false);
    expect(slugSekolahValid(null)).toBe(false);
    expect(slugSekolahValid(undefined)).toBe(false);
    expect(slugSekolahValid(123)).toBe(false);
    expect(slugSekolahValid({})).toBe(false);
  });

  it("menolak slug dengan karakter tak terduga", () => {
    expect(slugSekolahValid("SMPN1")).toBe(false); // huruf besar
    expect(slugSekolahValid("smpn 1")).toBe(false); // spasi
    expect(slugSekolahValid("-smpn1")).toBe(false);
    expect(slugSekolahValid("smpn1-")).toBe(false);
    expect(slugSekolahValid("smpn1/../lain")).toBe(false);
    expect(slugSekolahValid("smpn1.other.com")).toBe(false);
    expect(slugSekolahValid("a".repeat(64))).toBe(false);
  });
});
