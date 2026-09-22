import { describe, expect, it } from "vitest";
import {
  studentCreateSchema,
  studentFilterSchema,
  normalizePhone,
  CLASS_FILTER_NONE,
} from "@/lib/validations/student";

/**
 * Test validasi siswa. Fokus aturan yang mudah salah:
 * normalisasi telepon, kolom opsional kosong, tanggal, dan koersi angka.
 */

describe("normalizePhone", () => {
  it("mengubah 08 menjadi 628", () => {
    expect(normalizePhone("081234567890")).toBe("6281234567890");
  });
  it("membiarkan 62 apa adanya", () => {
    expect(normalizePhone("6281234567890")).toBe("6281234567890");
  });
  it("menambahkan 62 pada nomor yang mulai 8", () => {
    expect(normalizePhone("81234567890")).toBe("6281234567890");
  });
  it("membuang spasi, tanda hubung, dan +", () => {
    expect(normalizePhone("+62 812-3456-7890")).toBe("6281234567890");
  });
  it("mengembalikan undefined untuk input kosong", () => {
    expect(normalizePhone("")).toBeUndefined();
    expect(normalizePhone("abc")).toBeUndefined();
  });
});

describe("studentCreateSchema", () => {
  const base = {
    nis: "2025001",
    fullName: "Ani Contoh",
    gender: "FEMALE",
    entryYear: "2025",
    status: "ACTIVE",
  };

  it("menerima input minimal yang valid", () => {
    const r = studentCreateSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.entryYear).toBe(2025); // koersi string → number
      expect(r.data.status).toBe("ACTIVE");
    }
  });

  it("menolak NIS kosong", () => {
    const r = studentCreateSchema.safeParse({ ...base, nis: "" });
    expect(r.success).toBe(false);
  });

  it("menolak gender tak dikenal", () => {
    const r = studentCreateSchema.safeParse({ ...base, gender: "X" });
    expect(r.success).toBe(false);
  });

  it("menolak tahun masuk yang tidak masuk akal", () => {
    const r = studentCreateSchema.safeParse({ ...base, entryYear: "1800" });
    expect(r.success).toBe(false);
  });

  it("mengubah string kosong opsional menjadi undefined", () => {
    const r = studentCreateSchema.safeParse({
      ...base,
      nisn: "",
      birthPlace: "",
      address: "",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.nisn).toBeUndefined();
      expect(r.data.birthPlace).toBeUndefined();
      expect(r.data.address).toBeUndefined();
    }
  });

  it("menormalkan nomor telepon", () => {
    const r = studentCreateSchema.safeParse({ ...base, phone: "081234567890" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.phone).toBe("6281234567890");
  });

  it("menolak nomor telepon tidak valid", () => {
    const r = studentCreateSchema.safeParse({ ...base, phone: "123" });
    expect(r.success).toBe(false);
  });

  it("mengurai tanggal lahir menjadi Date", () => {
    const r = studentCreateSchema.safeParse({
      ...base,
      birthDate: "2012-05-17",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.birthDate).toBeInstanceOf(Date);
      expect(r.data.birthDate?.getUTCFullYear()).toBe(2012);
    }
  });

  it("menolak tanggal lahir tidak valid", () => {
    const r = studentCreateSchema.safeParse({
      ...base,
      birthDate: "bukan-tanggal",
    });
    expect(r.success).toBe(false);
  });
});

describe("studentFilterSchema", () => {
  it("memberi default page & perPage", () => {
    const r = studentFilterSchema.parse({});
    expect(r.page).toBe(1);
    expect(r.perPage).toBe(20);
  });

  it("membatasi perPage maksimum 100", () => {
    const r = studentFilterSchema.safeParse({ perPage: "500" });
    expect(r.success).toBe(false);
  });

  it("menolak status tak dikenal", () => {
    const r = studentFilterSchema.safeParse({ status: "NGAWUR" });
    expect(r.success).toBe(false);
  });

  it("menerima filter tahun ajaran", () => {
    const r = studentFilterSchema.safeParse({ academicYearId: "ay_2025" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.academicYearId).toBe("ay_2025");
  });

  it("menerima nilai khusus 'none' untuk kelas", () => {
    // "none" = siswa yang belum ditempatkan. Nilainya harus lolos validasi,
    // sebab tanpa itu siswa baru hasil konversi SPMB tidak bisa dicari.
    const r = studentFilterSchema.safeParse({ classId: CLASS_FILTER_NONE });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.classId).toBe("none");
  });

  it("CLASS_FILTER_NONE bukan bentuk id Prisma", () => {
    // Id Prisma berupa cuid (berawalan "c" + karakter acak), jadi "none"
    // tidak mungkin bertabrakan dengan id kelas sungguhan.
    expect(CLASS_FILTER_NONE).toBe("none");
    expect(CLASS_FILTER_NONE).not.toMatch(/^c[a-z0-9]{20,}$/);
  });
});
