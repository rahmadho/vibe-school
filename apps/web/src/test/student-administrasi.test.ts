import { describe, expect, it } from "vitest";
import { studentCreateSchema } from "@/lib/validations/student";

/**
 * ============================================================
 * VALIDASI SISWA — field data administrasi
 * ============================================================
 *
 * Dua hal yang diuji:
 *  1. Field baru TERIKIRIM BENAR lewat FormData ↔ skema Zod.
 *  2. Field baru TIDAK MERUSAK form lama. Ini yang paling penting: form HTML
 *     selalu mengirim SEMUA field, dan `<select>` kosong mengirim "" — bukan
 *     menghilangkan field. Kalau satu dropdown kosong menggagalkan seluruh
 *     form, operator tidak bisa menyimpan siswa sama sekali.
 */

/** FormData tiruan seperti yang dikirim peramban. */
function fd(isi: Record<string, string>): Record<string, string> {
  return {
    nis: "2024001",
    fullName: "Ahmad Fauzi",
    gender: "MALE",
    entryYear: "2024",
    // Semua field opsional dikirim sebagai "" — persis seperti peramban.
    nisn: "",
    nik: "",
    kkNumber: "",
    birthPlace: "",
    birthDate: "",
    religion: "",
    address: "",
    village: "",
    district: "",
    city: "",
    province: "",
    postalCode: "",
    villageCode: "",
    residenceType: "",
    transportation: "",
    livingWith: "",
    distanceKm: "",
    bloodType: "",
    heightCm: "",
    weightKg: "",
    isKipRecipient: "",
    phone: "",
    classId: "",
    majorId: "",
    status: "ACTIVE",
    parentName: "",
    parentRelation: "",
    parentPhone: "",
    ...isi,
  };
}

describe("siswa — hanya field wajib", () => {
  it("menyimpan siswa dengan SEMUA field opsional kosong", () => {
    // Ini kondisi nyata: operator mau input cepat, tidak mengisi Dapodik dulu.
    const h = studentCreateSchema.safeParse(fd({}));
    expect(h.success).toBe(true);
  });

  it("field opsional kosong jadi undefined, bukan string kosong", () => {
    // Kalau "" tersimpan, database penuh string kosong dan query
    // "belum diisi" (IS NULL) tidak menemukan apa pun.
    const h = studentCreateSchema.safeParse(fd({}));
    if (h.success) {
      expect(h.data.nik).toBeUndefined();
      expect(h.data.village).toBeUndefined();
      expect(h.data.residenceType).toBeUndefined();
      expect(h.data.distanceKm).toBeUndefined();
    }
  });
});

describe("NIK", () => {
  it("menerima NIK sah", () => {
    // Wilayah 137102, lahir 7 Maret 2012, urut 0001 (laki-laki).
    const h = studentCreateSchema.safeParse(fd({ nik: "1371020703120001" }));
    expect(h.success).toBe(true);
  });

  it("menolak NIK yang tanggalnya tidak ada", () => {
    const h = studentCreateSchema.safeParse(fd({ nik: "1371023102120001" }));
    expect(h.success).toBe(false);
    if (!h.success) {
      const pesan = JSON.stringify(h.error.issues);
      expect(pesan).toMatch(/tidak ada|tidak sah/i);
    }
  });

  it("menolak NIK kurang dari 16 digit", () => {
    const h = studentCreateSchema.safeParse(fd({ nik: "1371020703" }));
    expect(h.success).toBe(false);
  });

  it("NIK kosong tetap boleh (data lama & input cepat)", () => {
    expect(studentCreateSchema.safeParse(fd({ nik: "" })).success).toBe(true);
  });
});

describe("nomor KK & kode wilayah", () => {
  it("menerima KK 16 digit", () => {
    expect(
      studentCreateSchema.safeParse(fd({ kkNumber: "1371020112345678" })).success,
    ).toBe(true);
  });

  it("menolak KK yang bukan 16 digit", () => {
    expect(
      studentCreateSchema.safeParse(fd({ kkNumber: "137102" })).success,
    ).toBe(false);
  });

  it("menerima kode wilayah 10 digit, menolak yang lain", () => {
    expect(
      studentCreateSchema.safeParse(fd({ villageCode: "1371020001" })).success,
    ).toBe(true);
    expect(
      studentCreateSchema.safeParse(fd({ villageCode: "137102" })).success,
    ).toBe(false);
  });
});

describe("enum opsional (tempat tinggal, transportasi, dll)", () => {
  it("menerima pilihan yang sah", () => {
    const h = studentCreateSchema.safeParse(
      fd({
        residenceType: "BERSAMA_ORANG_TUA",
        transportation: "SEPEDA_MOTOR",
        livingWith: "ORANG_TUA",
        bloodType: "O",
      }),
    );
    expect(h.success).toBe(true);
    if (h.success) {
      expect(h.data.residenceType).toBe("BERSAMA_ORANG_TUA");
      expect(h.data.transportation).toBe("SEPEDA_MOTOR");
      expect(h.data.bloodType).toBe("O");
    }
  });

  it("menolak nilai enum yang tidak dikenal", () => {
    expect(
      studentCreateSchema.safeParse(fd({ transportation: "TERBANG" })).success,
    ).toBe(false);
  });

  it("dropdown kosong TIDAK menggagalkan seluruh form", () => {
    // Regresi penting: `z.enum` biasa menolak "" dan membuat form mustahil
    // disimpan bila satu dropdown dibiarkan kosong.
    const h = studentCreateSchema.safeParse(
      fd({ residenceType: "", transportation: "", bloodType: "" }),
    );
    expect(h.success).toBe(true);
  });
});

describe("angka (jarak, tinggi, berat)", () => {
  it("mengubah teks jadi angka integer", () => {
    const h = studentCreateSchema.safeParse(
      fd({ distanceKm: "5", heightCm: "160", weightKg: "55" }),
    );
    expect(h.success).toBe(true);
    if (h.success) {
      expect(h.data.distanceKm).toBe(5);
      expect(h.data.heightCm).toBe(160);
      expect(h.data.weightKg).toBe(55);
    }
  });

  it("menolak angka tidak wajar", () => {
    // Tinggi 5 cm atau jarak 9000 km pasti salah ketik.
    expect(studentCreateSchema.safeParse(fd({ heightCm: "5" })).success).toBe(false);
    expect(studentCreateSchema.safeParse(fd({ distanceKm: "9000" })).success).toBe(false);
  });

  it("string kosong jadi undefined, bukan NaN atau 0", () => {
    // `z.coerce.number()` pada "" menghasilkan 0 — itu BUKAN "tidak diisi",
    // dan akan tersimpan sebagai jarak 0 km yang tampak seperti data nyata.
    const h = studentCreateSchema.safeParse(fd({ distanceKm: "", heightCm: "" }));
    expect(h.success).toBe(true);
    if (h.success) {
      expect(h.data.distanceKm).toBeUndefined();
      expect(h.data.heightCm).toBeUndefined();
    }
  });
});

describe("penerima KIP", () => {
  it('checkbox tercentang ("on") jadi true', () => {
    const h = studentCreateSchema.safeParse(fd({ isKipRecipient: "on" }));
    expect(h.success && h.data.isKipRecipient).toBe(true);
  });

  it("tidak tercentang jadi false, bukan undefined", () => {
    // Boolean di skema punya default false; undefined akan membingungkan
    // laporan "berapa siswa penerima KIP".
    const h = studentCreateSchema.safeParse(fd({ isKipRecipient: "" }));
    expect(h.success && h.data.isKipRecipient).toBe(false);
  });
});

describe("alamat berjenjang", () => {
  it("menerima alamat lengkap", () => {
    const h = studentCreateSchema.safeParse(
      fd({
        address: "Jl. Merdeka No. 5, RT 02/RW 03",
        village: "Kampung Baru",
        district: "Padang Barat",
        city: "Kota Padang",
        province: "Sumatera Barat",
        postalCode: "25118",
      }),
    );
    expect(h.success).toBe(true);
    if (h.success) {
      expect(h.data.village).toBe("Kampung Baru");
      expect(h.data.city).toBe("Kota Padang");
    }
  });

  it("alamat lama satu baris tetap diterima (tidak ada data yang hilang)", () => {
    const h = studentCreateSchema.safeParse(
      fd({ address: "Jl. Sudirman No. 1, Padang" }),
    );
    expect(h.success).toBe(true);
    if (h.success) {
      expect(h.data.address).toBe("Jl. Sudirman No. 1, Padang");
    }
  });
});
