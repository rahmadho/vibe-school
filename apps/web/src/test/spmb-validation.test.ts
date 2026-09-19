import { describe, expect, it } from "vitest";
import {
  admissionBatchCreateSchema,
  admissionPathCreateSchema,
  admissionPathUpdateSchema,
  registrationReviewSchema,
} from "@/lib/validations/site";

/**
 * Uji validasi SPMB multi-jalur.
 *
 * Fokus pada hal-hal yang kalau salah baru ketahuan saat pendaftaran sudah
 * dibuka — dan saat itu sudah terlambat: sekolah harus mengumumkan perbaikan.
 */

describe("admissionBatchCreateSchema", () => {
  const valid = {
    academicYearId: "ay_1",
    name: "SPMB 2026/2027 Gelombang 1",
    openDate: "2026-05-01",
    closeDate: "2026-06-30",
    quota: 120,
  };

  it("menerima gelombang yang wajar", () => {
    expect(admissionBatchCreateSchema.safeParse(valid).success).toBe(true);
  });

  it("menolak bila tanggal tutup sebelum tanggal buka", () => {
    // Kesalahan paling mudah terjadi dan paling membingungkan bagi orang tua.
    const r = admissionBatchCreateSchema.safeParse({
      ...valid,
      openDate: "2026-06-30",
      closeDate: "2026-05-01",
    });
    expect(r.success).toBe(false);
  });

  it("menolak tanggal tutup sama dengan tanggal buka (tidak ada waktu mendaftar)", () => {
    const r = admissionBatchCreateSchema.safeParse({
      ...valid,
      openDate: "2026-05-01",
      closeDate: "2026-05-01",
    });
    expect(r.success).toBe(false);
  });

  it("kuota boleh 0 (gelombang dibuka hanya untuk data) tetapi tidak negatif", () => {
    // Kuota 0 sah: sekolah kadang membuka gelombang untuk menampung daftar
    // tunggu atau sekadar mengumpulkan data tanpa menerima siapa pun dulu.
    expect(admissionBatchCreateSchema.safeParse({ ...valid, quota: 0 }).success).toBe(true);
    expect(admissionBatchCreateSchema.safeParse({ ...valid, quota: -5 }).success).toBe(false);
  });

  it("menolak nama kosong", () => {
    expect(admissionBatchCreateSchema.safeParse({ ...valid, name: "  " }).success).toBe(false);
  });
});

describe("admissionPathCreateSchema — inti fitur multi-jalur", () => {
  it("menerima lebih dari satu jalur pada gelombang yang sama", () => {
    // SMPN favorit: Reguler + Prestasi + Afirmasi pada satu gelombang.
    const paths = [
      { batchId: "b1", name: "Reguler", code: "REGULER", quota: 100, registrationFee: 0 },
      { batchId: "b1", name: "Prestasi", code: "PRESTASI", quota: 30, registrationFee: 150000 },
      { batchId: "b1", name: "Afirmasi", code: "AFIRMASI", quota: 20, registrationFee: 0 },
    ];
    for (const p of paths) {
      expect(admissionPathCreateSchema.safeParse(p).success, p.code).toBe(true);
    }
  });

  it("mengubah kode jalur menjadi HURUF KAPITAL", () => {
    const r = admissionPathCreateSchema.safeParse({
      batchId: "b1",
      name: "Prestasi",
      code: "prestasi",
      quota: 30,
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.code).toBe("PRESTASI");
  });

  it("menerima kode jalur yang ditulis huruf kecil maupun campuran", () => {
    // Operator mengetik "prestasi" atau "Prestasi" — keduanya harus diterima,
    // bukan ditolak dengan galat yang membingungkan.
    for (const code of ["prestasi", "Prestasi", "PRESTASI", "Prestasi2"]) {
      expect(admissionPathCreateSchema.safeParse({
        batchId: "b1",
        name: "X",
        code,
        quota: 10,
      }).success, code).toBe(true);
    }
  });

  it("menolak kode dengan spasi atau tanda baca", () => {
    for (const code of ["PRESTASI A", "PRESTASI-1", "PRESTASI_1", "PRE STASI"]) {
      expect(admissionPathCreateSchema.safeParse({
        batchId: "b1",
        name: "X",
        code,
        quota: 10,
      }).success, code).toBe(false);
    }
  });

  it("biaya boleh nol (jalur gratis) tetapi tidak negatif", () => {
    const base = { batchId: "b1", name: "Afirmasi", code: "AFIRMASI", quota: 20 };
    expect(admissionPathCreateSchema.safeParse({ ...base, registrationFee: 0 }).success).toBe(true);
    expect(admissionPathCreateSchema.safeParse({ ...base, registrationFee: -1 }).success).toBe(false);
  });

  it("kuota jalur WAJIB diisi (mencegah jalur tanpa batas daya tampung)", () => {
    // Kuota wajib: sekolah harus menyatakan daya tampung tiap jalur, karena
    // inilah yang menghalangi penerimaan melebihi kapasitas.
    const r = admissionPathCreateSchema.safeParse({
      batchId: "b1",
      name: "Reguler",
      code: "REGULER",
    });
    expect(r.success).toBe(false);
  });

  it("kuota boleh 0 (jalur ditutup sementara) tetapi tidak negatif", () => {
    const base = { batchId: "b1", name: "Reguler", code: "REGULER" };
    expect(admissionPathCreateSchema.safeParse({ ...base, quota: 0 }).success).toBe(true);
    expect(admissionPathCreateSchema.safeParse({ ...base, quota: -1 }).success).toBe(false);
  });

  it("menolak nama kosong dan kode terlalu pendek", () => {
    expect(admissionPathCreateSchema.safeParse({
      batchId: "b1",
      name: "",
      code: "REGULER",
      quota: 10,
    }).success).toBe(false);
    expect(admissionPathCreateSchema.safeParse({
      batchId: "b1",
      name: "X",
      code: "A",
      quota: 10,
    }).success).toBe(false);
  });
});

describe("admissionPathUpdateSchema", () => {
  it("menerima perubahan lengkap (form mengirim semua field)", () => {
    // Catatan: update mewarisi SEMUA field wajib dari create, jadi form ubah
    // harus mengirimnya lengkap — bukan hanya field yang berubah.
    const r = admissionPathUpdateSchema.safeParse({
      id: "p1",
      batchId: "b1",
      name: "Jalur Baru",
      code: "BARU",
      quota: 25,
    });
    expect(r.success).toBe(true);
  });

  it("menolak update tanpa field wajib", () => {
    expect(admissionPathUpdateSchema.safeParse({ id: "p1", name: "Jalur Baru" }).success).toBe(false);
  });

  it("tetap menormalkan kode ke huruf kapital", () => {
    const r = admissionPathUpdateSchema.safeParse({
      id: "p1",
      batchId: "b1",
      name: "Afirmasi",
      code: "afirmasi",
      quota: 20,
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.code).toBe("AFIRMASI");
  });
});

describe("registrationReviewSchema", () => {
  it("menerima setiap status yang ada di enum RegistrationStatus", () => {
    // Kalau daftar ini tidak cocok dengan schema.prisma, panitia akan mendapat
    // galat saat menyimpan keputusan — tepat di saat paling sibuk.
    for (const status of [
      "PENDING",
      "VERIFIED",
      "TESTED",
      "ACCEPTED",
      "REJECTED",
      "WAITLIST",
      "WITHDRAWN",
    ]) {
      expect(registrationReviewSchema.safeParse({ id: "r1", status }).success, status).toBe(true);
    }
  });

  it("menolak status yang tidak dikenal", () => {
    expect(registrationReviewSchema.safeParse({ id: "r1", status: "CANCELLED" }).success).toBe(false);
    expect(registrationReviewSchema.safeParse({ id: "r1", status: "diterima" }).success).toBe(false);
  });

  it("catatan opsional dan boleh kosong", () => {
    const r = registrationReviewSchema.safeParse({ id: "r1", status: "ACCEPTED" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.note).toBe("");
  });

  it("biaya daftar ulang boleh dikosongkan", () => {
    expect(registrationReviewSchema.safeParse({ id: "r1", status: "ACCEPTED" }).success).toBe(true);
    expect(
      registrationReviewSchema.safeParse({ id: "r1", status: "ACCEPTED", reRegistrationFee: 0 })
        .success,
    ).toBe(true);
  });

  it("menolak biaya daftar ulang negatif", () => {
    expect(
      registrationReviewSchema.safeParse({ id: "r1", status: "ACCEPTED", reRegistrationFee: -1 })
        .success,
    ).toBe(false);
  });
});
