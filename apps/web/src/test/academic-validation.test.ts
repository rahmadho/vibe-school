import { describe, expect, it } from "vitest";
import {
  academicYearCreateSchema,
  classCreateSchema,
  subjectCreateSchema,
  bulkProgressionSchema,
  majorCreateSchema,
  internshipCreateSchema,
  competencyTestCreateSchema,
  SUBJECT_GROUPS,
  INTERNSHIP_STATUSES,
  COMPETENCY_RESULTS,
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

describe("majorCreateSchema", () => {
  const base = { code: "RPL", name: "Rekayasa Perangkat Lunak" };

  it("menerima jurusan valid", () => {
    const r = majorCreateSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.code).toBe("RPL");
  });

  it("menormalkan kode menjadi huruf besar", () => {
    const r = majorCreateSchema.safeParse({ ...base, code: "tkj" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.code).toBe("TKJ");
  });

  it("menolak nama terlalu pendek", () => {
    expect(majorCreateSchema.safeParse({ ...base, name: "A" }).success).toBe(false);
  });

  it("mengubah ketua program kosong menjadi undefined", () => {
    const r = majorCreateSchema.safeParse({ ...base, headTeacherId: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.headTeacherId).toBeUndefined();
  });
});

describe("subjectCreateSchema — kelompok mapel", () => {
  it("memakai UMUM sebagai kelompok bawaan", () => {
    const r = subjectCreateSchema.safeParse({ code: "MAT", name: "Matematika" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.group).toBe("UMUM");
  });

  it("menerima semua kelompok yang dikenal", () => {
    for (const g of SUBJECT_GROUPS) {
      const r = subjectCreateSchema.safeParse({ code: "X", name: "Mapel", group: g });
      expect(r.success, `kelompok ${g} seharusnya valid`).toBe(true);
    }
  });

  it("menolak kelompok tak dikenal", () => {
    const r = subjectCreateSchema.safeParse({
      code: "X",
      name: "Mapel",
      group: "KARANGAN",
    });
    expect(r.success).toBe(false);
  });
});

describe("classCreateSchema — nama kelas panjang", () => {
  it("menerima nama kelas SMK yang panjang", () => {
    // "XII Teknik Komputer dan Jaringan 1" = 33 karakter. Batas lama (20)
    // menolaknya, sehingga sekolah SMK tidak bisa menulis nama kelas wajar.
    const r = classCreateSchema.safeParse({
      name: "XII Teknik Komputer dan Jaringan 1",
      level: "12",
      academicYearId: "ay1",
    });
    expect(r.success).toBe(true);
  });
});

describe("internshipCreateSchema", () => {
  const base = {
    studentId: "std1",
    academicYearId: "ay1",
    industryName: "PT Telkom Indonesia",
    startDate: "2026-01-05",
    endDate: "2026-04-05",
  };

  it("menerima data PKL minimal", () => {
    const r = internshipCreateSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.status).toBe("PLANNED");
  });

  it("menolak tanggal selesai sebelum tanggal mulai", () => {
    const r = internshipCreateSchema.safeParse({
      ...base,
      endDate: "2026-01-01",
    });
    expect(r.success).toBe(false);
  });

  it("menerima semua status PKL", () => {
    for (const s of INTERNSHIP_STATUSES) {
      const r = internshipCreateSchema.safeParse({ ...base, status: s });
      expect(r.success, `status ${s} seharusnya valid`).toBe(true);
    }
  });

  it("menolak nilai di luar 0..100", () => {
    const r = internshipCreateSchema.safeParse({ ...base, score: 120 });
    expect(r.success).toBe(false);
  });

  it("mengubah nilai kosong menjadi undefined", () => {
    const r = internshipCreateSchema.safeParse({ ...base, score: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.score).toBeUndefined();
  });
});

describe("competencyTestCreateSchema", () => {
  const base = {
    studentId: "std1",
    academicYearId: "ay1",
    majorId: "maj1",
    examinerName: "Budi Santoso",
    testDate: "2026-05-10",
    result: "COMPETENT",
  };

  it("menerima hasil UKK valid", () => {
    const r = competencyTestCreateSchema.safeParse(base);
    expect(r.success).toBe(true);
  });

  it("menerima semua hasil yang dikenal", () => {
    for (const res of COMPETENCY_RESULTS) {
      const r = competencyTestCreateSchema.safeParse({ ...base, result: res });
      expect(r.success, `hasil ${res} seharusnya valid`).toBe(true);
    }
  });

  it("mewajibkan jurusan", () => {
    const r = competencyTestCreateSchema.safeParse({ ...base, majorId: "" });
    expect(r.success).toBe(false);
  });

  it("mewajibkan nama penguji", () => {
    const r = competencyTestCreateSchema.safeParse({ ...base, examinerName: "" });
    expect(r.success).toBe(false);
  });

  it("menolak hasil tak dikenal", () => {
    const r = competencyTestCreateSchema.safeParse({ ...base, result: "MUNGKIN" });
    expect(r.success).toBe(false);
  });
});
