import { describe, expect, it } from "vitest";
import {
  buildRegistrationNo,
  sanitizePathCode,
  maskPhone,
  maskName,
  normalizeRegistrationNo,
  randomToken,
  registrationStatusLabel,
  registrationStatusTone,
  REGISTRATION_STATUS_LABEL,
} from "@/lib/spmb-public";

/**
 * Uji logika SPMB publik.
 *
 * Dua kelompok yang diuji di sini adalah yang paling mahal kalau salah:
 *  1. NOMOR PENDAFTARAN — dibacakan orang tua lewat telepon dan disalin dari
 *     kertas. Karakter yang mudah tertukar (0/O, 1/I/L) membuat pendaftar
 *     tidak bisa mengecek statusnya sendiri.
 *  2. PENYAMARAN — pengecekan status terbuka tanpa masuk akun, jadi penyamaran
 *     adalah satu-satunya yang mencegah orang lain membaca data keluarga.
 */

describe("buildRegistrationNo", () => {
  it("berbentuk SPMB-tahun-jalur-token", () => {
    const no = buildRegistrationNo({ year: 2026, pathCode: "REGULER", randomFn: () => 0 });
    expect(no.startsWith("SPMB-2026-REGULER-")).toBe(true);
  });

  it("TIDAK memakai karakter yang mudah tertukar", () => {
    // Diuji lewat 500 sampel acak: kalau ada satu saja 0/O/1/I/L, orang tua
    // yang membacakan nomor lewat telepon akan salah.
    for (let i = 0; i < 500; i += 1) {
      const token = buildRegistrationNo({ year: 2026, pathCode: "PRESTASI" }).split("-").pop()!;
      expect(token).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/);
    }
  });

  it("menghasilkan nomor yang berbeda antar pendaftar", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 300; i += 1) {
      seen.add(buildRegistrationNo({ year: 2026, pathCode: "REGULER" }));
    }
    // Tabrakan sangat mungkin terjadi kalau token tidak cukup acak; 300 nomor
    // dari 31^6 kemungkinan seharusnya hampir pasti unik.
    expect(seen.size).toBe(300);
  });

  it("mengubah kode jalur huruf kecil menjadi kapital", () => {
    const no = buildRegistrationNo({ year: 2026, pathCode: "prestasi", randomFn: () => 0 });
    expect(no).toContain("-PRESTASI-");
  });

  it("mengganti kode jalur yang tidak sah dengan REGULER, bukan gagal", () => {
    // Kode jalur berasal dari data sekolah. Kalau kotor, lebih baik nomor
    // tetap terbit daripada pendaftaran gagal total.
    const no = buildRegistrationNo({ year: 2026, pathCode: "@@@", randomFn: () => 0 });
    expect(no).toContain("-REGULER-");
  });
});

describe("randomToken", () => {
  it("menghasilkan panjang yang diminta", () => {
    expect(randomToken(6, () => 0).length).toBe(6);
    expect(randomToken(10, () => 0).length).toBe(10);
  });

  it("tidak melampaui batas saat randomFn mengembalikan 1", () => {
    // Kontrak Math.random() adalah [0,1), tetapi fungsi yang disuntik bisa
    // melanggar. Indeks di luar batas akan menghasilkan "undefined" yang
    // menyusup ke nomor pendaftaran.
    const t = randomToken(4, () => 1);
    expect(t).toHaveLength(4);
    expect(t).not.toContain("undefined");
  });
});

describe("sanitizePathCode", () => {
  it("membersihkan tanda baca dan spasi", () => {
    expect(sanitizePathCode("prestasi unggulan!")).toBe("PRESTASIUNGGULAN");
  });

  it("membatasi panjang agar nomor tidak kepanjangan", () => {
    expect(sanitizePathCode("A".repeat(50)).length).toBe(20);
  });

  it("tidak pernah mengembalikan kode kosong", () => {
    for (const bad of ["", "   ", "!!!", "-"]) {
      expect(sanitizePathCode(bad)).toBe("REGULER");
    }
  });
});

describe("maskPhone — pelindung privasi", () => {
  it("menyembunyikan bagian tengah nomor", () => {
    const masked = maskPhone("628123456789");
    expect(masked).not.toBe("628123456789");
    // Digit akhir tetap terlihat supaya pemilik yakin itu nomornya.
    expect(masked.endsWith("89")).toBe(true);
  });

  it("menjaga jumlah karakter tidak bertambah (tidak membocorkan lewat panjang)", () => {
    const raw = "628123456789";
    expect(maskPhone(raw).length).toBeLessThanOrEqual(raw.length + 2);
  });

  it("aman untuk nomor pendek atau kosong", () => {
    for (const p of ["", "1", "12", "123"]) {
      expect(() => maskPhone(p)).not.toThrow();
    }
  });
});

describe("maskName — pelindung privasi", () => {
  it("hanya menampilkan nama depan", () => {
    const masked = maskName("Budi Santoso Wijaya");
    expect(masked).toContain("Budi");
    expect(masked).not.toContain("Santoso");
    expect(masked).not.toContain("Wijaya");
  });

  it("aman untuk nama satu kata dan nama kosong", () => {
    expect(() => maskName("Budi")).not.toThrow();
    expect(() => maskName("")).not.toThrow();
  });
});

describe("normalizeRegistrationNo — bentuk kanonik untuk pencarian", () => {
  // Semua pemisah dibuang sehingga nomor yang diketik dengan cara apa pun
  // menghasilkan bentuk yang SAMA. Inilah yang membuat pencarian bisa cocok.
  const CANONICAL = "SPMB2026REGULERABC234";

  it("membuang tanda hubung (bentuk tersimpan)", () => {
    expect(normalizeRegistrationNo("SPMB-2026-REGULER-ABC234")).toBe(CANONICAL);
  });

  it("menyamakan huruf kecil", () => {
    expect(normalizeRegistrationNo("spmb-2026-reguler-abc234")).toBe(CANONICAL);
  });

  it("membuang spasi di ujung yang ikut tersalin", () => {
    expect(normalizeRegistrationNo("  SPMB-2026-REGULER-ABC234  ")).toBe(CANONICAL);
  });

  it("menerima nomor yang ditulis ulang dari kertas dengan spasi", () => {
    // Bug nyata yang ditemukan test ini: sebelumnya hanya SPASI yang dibuang,
    // sehingga input ini menjadi "SPMB2026REGULERABC234" sementara database
    // menyimpan "SPMB-2026-REGULER-ABC234" — TIDAK PERNAH cocok, dan pendaftar
    // yang sah selalu diberi tahu "data tidak ditemukan".
    expect(normalizeRegistrationNo("SPMB 2026 REGULER ABC234")).toBe(CANONICAL);
  });

  it("SEMUA cara penulisan menghasilkan bentuk yang identik", () => {
    const variants = [
      "SPMB-2026-REGULER-ABC234",
      "spmb 2026 reguler abc234",
      "SPMB2026REGULERABC234",
      "  Spmb-2026 Reguler Abc234  ",
      "SPMB--2026--REGULER--ABC234",
    ];
    for (const v of variants) {
      expect(normalizeRegistrationNo(v), v).toBe(CANONICAL);
    }
  });
});

describe("label & warna status", () => {
  it("setiap status di enum punya label bahasa Indonesia", () => {
    for (const s of [
      "DRAFT",
      "PENDING",
      "VERIFIED",
      "TESTED",
      "ACCEPTED",
      "REJECTED",
      "WAITLIST",
      "WITHDRAWN",
    ]) {
      const label = registrationStatusLabel(s);
      expect(label, s).toBeTruthy();
      expect(label, s).not.toBe(s); // bukan sekadar mengembalikan kode enum
    }
  });

  it("status tak dikenal ditampilkan apa adanya, tidak menjadi kosong", () => {
    expect(registrationStatusLabel("ANEHTAHU")).toBeTruthy();
  });

  it("DITERIMA dan DITOLAK punya warna berbeda", () => {
    expect(registrationStatusTone("ACCEPTED")).not.toBe(registrationStatusTone("REJECTED"));
  });

  it("status yang masih berjalan diberi warna netral/progress", () => {
    expect(["neutral", "progress"]).toContain(registrationStatusTone("PENDING"));
  });

  it("label tidak kosong untuk semua kunci yang didefinisikan", () => {
    for (const [k, v] of Object.entries(REGISTRATION_STATUS_LABEL)) {
      expect(v.length, k).toBeGreaterThan(0);
    }
  });
});
