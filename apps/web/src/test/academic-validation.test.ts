import { describe, expect, it } from "vitest";
import {
  academicYearCreateSchema,
  classCreateSchema,
  subjectCreateSchema,
  bulkProgressionSchema,
} from "@/lib/validations/academic";

describe("academicYearCreateSchema", () => {
  const base = {
    name: "2025/2026",
    startDate: "2025-07-01",
    endDate: "2026-06-30",
  };

  it("menerima tahun ajaran valid", () => {
    const r = academicYearCreateSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.startDate).toBeInstanceOf(Date);
      expect(r.data.endDate).toBeInstanceOf(Date);
    }
  });

  it("menolak format nama yang salah", () => {
    const r = academicYearCreateSchema.safeParse({ ...base, name: "2025-2026" });
    expect(r.success).toBe(false);
  });

  it("menolak tanggal selesai sebelum mulai", () => {
    const r = academicYearCreateSchema.safeParse({
      ...base,
      startDate: "2026-07-01",
      endDate: "2025-06-30",
    });
    expect(r.success).toBe(false);
  });

  it("menolak tanggal tidak valid", () => {
    const r = academicYearCreateSchema.safeParse({
      ...base,
      startDate: "bukan-tanggal",
    });
    expect(r.success).toBe(false);
  });
});

describe("classCreateSchema", () => {
  const base = { name: "7A", level: "7", academicYearId: "ay1" };

  it("menerima input minimal dan default kapasitas 32", () => {
    const r = classCreateSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.level).toBe(7);
      expect(r.data.capacity).toBe(32);
      expect(r.data.homeroomTeacherId).toBeUndefined();
    }
  });

  it("menolak tingkat di luar 1..12", () => {
    expect(classCreateSchema.safeParse({ ...base, level: "13" }).success).toBe(false);
    expect(classCreateSchema.safeParse({ ...base, level: "0" }).success).toBe(false);
  });

  it("mengubah homeroomTeacherId kosong menjadi undefined", () => {
    const r = classCreateSchema.safeParse({ ...base, homeroomTeacherId: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.homeroomTeacherId).toBeUndefined();
  });

  it("menolak nama kelas kosong", () => {
    expect(classCreateSchema.safeParse({ ...base, name: "" }).success).toBe(false);
  });
});

describe("subjectCreateSchema", () => {
  it("mengubah kode menjadi huruf besar", () => {
    const r = subjectCreateSchema.safeParse({ code: "mtk", name: "Matematika" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.code).toBe("MTK");
      expect(r.data.kkm).toBe(70);
    }
  });

  it("menerima KKM kustom", () => {
    const r = subjectCreateSchema.safeParse({
      code: "IPA",
      name: "Ilmu Pengetahuan Alam",
      kkm: "75",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.kkm).toBe(75);
  });

  it("menolak KKM di luar 0..100", () => {
    expect(
      subjectCreateSchema.safeParse({ code: "X", name: "Test", kkm: "150" }).success,
    ).toBe(false);
  });

  it("menolak nama terlalu pendek", () => {
    expect(subjectCreateSchema.safeParse({ code: "X", name: "A" }).success).toBe(false);
  });
});

describe("bulkProgressionSchema", () => {
  it("menerima data kenaikan kelas lengkap", () => {
    const r = bulkProgressionSchema.safeParse({
      sourceClassId: "cls_source",
      sourceAcademicYearId: "ay_2023",
      targetAcademicYearId: "ay_2024",
      items: [
        { studentId: "std_1", result: "NAIK", targetClassId: "cls_target_8a" },
        { studentId: "std_2", result: "TINGGAL", targetClassId: "cls_source" },
        { studentId: "std_3", result: "LULUS" },
      ],
    });
    expect(r.success).toBe(true);
  });

  it("menolak jika items kosong", () => {
    const r = bulkProgressionSchema.safeParse({
      sourceClassId: "cls_source",
      sourceAcademicYearId: "ay_2023",
      targetAcademicYearId: "ay_2024",
      items: [],
    });
    expect(r.success).toBe(false);
  });
});
