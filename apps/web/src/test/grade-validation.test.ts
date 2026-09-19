import { describe, expect, it } from "vitest";
import {
  gradeItemCreateSchema,
  gradeBulkSchema,
  gradeEntrySchema,
  GRADE_TYPES,
  GRADE_TYPE_LABEL,
} from "@/lib/validations/grade";

describe("gradeItemCreateSchema", () => {
  const base = {
    subjectId: "m1",
    academicYearId: "y1",
    teacherId: "t1",
    name: "UTS",
    type: "MIDTERM",
    weight: "60",
  };

  it("menerima input valid", () => {
    const r = gradeItemCreateSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.weight).toBe(60);
      expect(r.data.maxScore).toBe(100); // default
    }
  });

  it("menolak nama kosong", () => {
    expect(gradeItemCreateSchema.safeParse({ ...base, name: "" }).success).toBe(false);
  });

  it("menolak bobot di luar 1–100", () => {
    expect(gradeItemCreateSchema.safeParse({ ...base, weight: "0" }).success).toBe(false);
    expect(gradeItemCreateSchema.safeParse({ ...base, weight: "101" }).success).toBe(false);
  });

  it("menolak jenis nilai tak dikenal", () => {
    expect(
      gradeItemCreateSchema.safeParse({ ...base, type: "UJIAN_NASIONAL" }).success,
    ).toBe(false);
  });

  it("menolak bila mapel/tahun/guru kosong", () => {
    for (const k of ["subjectId", "academicYearId", "teacherId"]) {
      expect(
        gradeItemCreateSchema.safeParse({ ...base, [k]: "" }).success,
        k,
      ).toBe(false);
    }
  });

  it("menerima nilai maksimal khusus", () => {
    const r = gradeItemCreateSchema.safeParse({ ...base, maxScore: "50" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.maxScore).toBe(50);
  });
});

describe("gradeEntrySchema", () => {
  it("menerima skor bulat", () => {
    const r = gradeEntrySchema.safeParse({ studentId: "s1", score: 85 });
    expect(r.success).toBe(true);
  });

  it("menerima skor null (belum dinilai)", () => {
    const r = gradeEntrySchema.safeParse({ studentId: "s1", score: null });
    expect(r.success).toBe(true);
  });

  it("menerima skor 0 (sah, bukan kosong)", () => {
    const r = gradeEntrySchema.safeParse({ studentId: "s1", score: 0 });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.score).toBe(0);
  });

  it("menolak skor negatif", () => {
    expect(gradeEntrySchema.safeParse({ studentId: "s1", score: -5 }).success).toBe(false);
  });

  it("menolak skor pecahan", () => {
    expect(gradeEntrySchema.safeParse({ studentId: "s1", score: 85.5 }).success).toBe(false);
  });

  it("keterangan kosong menjadi undefined", () => {
    const r = gradeEntrySchema.safeParse({ studentId: "s1", score: 80, note: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.note).toBeUndefined();
  });
});

describe("gradeBulkSchema", () => {
  const entry = { studentId: "s1", score: 80 };

  it("menerima payload valid", () => {
    const r = gradeBulkSchema.safeParse({
      gradeItemId: "g1",
      classId: "c1",
      semesterId: "sem1",
      entries: [entry],
    });
    expect(r.success).toBe(true);
  });

  it("menolak tanpa daftar nilai", () => {
    const r = gradeBulkSchema.safeParse({
      gradeItemId: "g1",
      classId: "c1",
      semesterId: "sem1",
      entries: [],
    });
    expect(r.success).toBe(false);
  });

  it("menolak bila semester kosong", () => {
    const r = gradeBulkSchema.safeParse({
      gradeItemId: "g1",
      classId: "c1",
      semesterId: "",
      entries: [entry],
    });
    expect(r.success).toBe(false);
  });
});

describe("peta jenis nilai", () => {
  it("setiap jenis punya label bahasa Indonesia", () => {
    for (const t of GRADE_TYPES) {
      expect(GRADE_TYPE_LABEL[t]).toBeTruthy();
    }
  });
});
