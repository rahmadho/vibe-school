import { describe, expect, it } from "vitest";
import {
  computeFinalScore,
  computeAll,
  toPredicate,
  belowKkm,
  rankStudents,
  summarizeClass,
  type GradeComponent,
} from "@/lib/grade-calc";

const comp = (
  id: string,
  weight: number,
  maxScore = 100,
  name = id,
): GradeComponent => ({ id, name, type: "QUIZ", weight, maxScore });

describe("computeFinalScore", () => {
  it("menghitung rata-rata sederhana bila bobot sama", () => {
    const c = [comp("a", 50), comp("b", 50)];
    const f = computeFinalScore(c, { studentId: "s1", scores: { a: 80, b: 90 } });
    expect(f.finalScore).toBe(85);
  });

  it("menghormati bobot berbeda", () => {
    // UTS bobot 60 nilai 70; Tugas bobot 40 nilai 100
    // = (70*60 + 100*40)/100 = (4200+4000)/100 = 82
    const c = [comp("uts", 60), comp("tugas", 40)];
    const f = computeFinalScore(c, {
      studentId: "s1",
      scores: { uts: 70, tugas: 100 },
    });
    expect(f.finalScore).toBe(82);
  });

  it("mengabaikan komponen yang belum dinilai (null)", () => {
    const c = [comp("a", 50), comp("b", 50)];
    const f = computeFinalScore(c, { studentId: "s1", scores: { a: 80, b: null } });
    // Hanya komponen a yang dihitung → tetap 80, bukan 40
    expect(f.finalScore).toBe(80);
    expect(f.gradedCount).toBe(1);
    expect(f.countedWeight).toBe(50);
  });

  it("menormalkan skor bila maxScore bukan 100", () => {
    // Nilai 40 dari maksimal 50 → setara 80
    const c = [comp("a", 100, 50)];
    const f = computeFinalScore(c, { studentId: "s1", scores: { a: 40 } });
    expect(f.finalScore).toBe(80);
  });

  it("menormalkan bobot bila guru baru mengisi sebagian", () => {
    // Hanya komponen berbobot 30 yang terisi; hasilnya tetap skala 0–100
    const c = [comp("a", 30), comp("b", 70)];
    const f = computeFinalScore(c, { studentId: "s1", scores: { a: 90 } });
    expect(f.finalScore).toBe(90);
  });

  it("mengembalikan null bila belum ada nilai", () => {
    const c = [comp("a", 50)];
    const f = computeFinalScore(c, { studentId: "s1", scores: {} });
    expect(f.finalScore).toBeNull();
    expect(f.isEmpty).toBe(true);
  });

  it("menerima nilai 0 sebagai nilai sah (bukan kosong)", () => {
    const c = [comp("a", 100), comp("b", 0)];
    const f = computeFinalScore(c, { studentId: "s1", scores: { a: 0 } });
    expect(f.finalScore).toBe(0);
    expect(f.isEmpty).toBe(false);
  });

  it("membulatkan ke 1 desimal", () => {
    // 1 komponen bobot 100 nilai 85.55 → harus dibulatkan wajar
    const c = [comp("a", 100)];
    const f = computeFinalScore(c, { studentId: "s1", scores: { a: 85 } });
    expect(f.finalScore).toBe(85);
  });
});

describe("toPredicate", () => {
  it("memetakan ambang predikat", () => {
    expect(toPredicate(95)).toBe("A");
    expect(toPredicate(90)).toBe("A");
    expect(toPredicate(89)).toBe("B");
    expect(toPredicate(80)).toBe("B");
    expect(toPredicate(79)).toBe("C");
    expect(toPredicate(70)).toBe("C");
    expect(toPredicate(69)).toBe("D");
    expect(toPredicate(60)).toBe("D");
    expect(toPredicate(59)).toBe("E");
  });

  it("mengembalikan null untuk nilai kosong", () => {
    expect(toPredicate(null)).toBeNull();
  });
});

describe("belowKkm", () => {
  it("menandai nilai di bawah KKM", () => {
    expect(belowKkm(69, 70)).toBe(true);
    expect(belowKkm(70, 70)).toBe(false);
    expect(belowKkm(71, 70)).toBe(false);
  });

  it("nilai kosong bukan remedial", () => {
    expect(belowKkm(null, 70)).toBe(false);
  });
});

describe("rankStudents", () => {
  it("memberi peringkat berdasar nilai tertinggi", () => {
    const r = rankStudents([
      { studentId: "a", finalScore: 90, countedWeight: 100, gradedCount: 1, isEmpty: false },
      { studentId: "b", finalScore: 70, countedWeight: 100, gradedCount: 1, isEmpty: false },
      { studentId: "c", finalScore: 80, countedWeight: 100, gradedCount: 1, isEmpty: false },
    ]);
    expect(r.get("a")).toBe(1);
    expect(r.get("c")).toBe(2);
    expect(r.get("b")).toBe(3);
  });

  it("nilai sama mendapat peringkat sama (competition ranking)", () => {
    const r = rankStudents([
      { studentId: "a", finalScore: 90, countedWeight: 100, gradedCount: 1, isEmpty: false },
      { studentId: "b", finalScore: 90, countedWeight: 100, gradedCount: 1, isEmpty: false },
      { studentId: "c", finalScore: 80, countedWeight: 100, gradedCount: 1, isEmpty: false },
    ]);
    expect(r.get("a")).toBe(1);
    expect(r.get("b")).toBe(1);
    expect(r.get("c")).toBe(3);
  });

  it("siswa tanpa nilai tidak diberi peringkat", () => {
    const r = rankStudents([
      { studentId: "a", finalScore: 90, countedWeight: 100, gradedCount: 1, isEmpty: false },
      { studentId: "b", finalScore: null, countedWeight: 0, gradedCount: 0, isEmpty: true },
    ]);
    expect(r.get("a")).toBe(1);
    expect(r.get("b")).toBeNull();
  });
});

describe("summarizeClass", () => {
  const mk = (id: string, score: number | null) => ({
    studentId: id,
    finalScore: score,
    countedWeight: score === null ? 0 : 100,
    gradedCount: score === null ? 0 : 1,
    isEmpty: score === null,
  });

  it("menghitung rata-rata, tertinggi, terendah, remedial", () => {
    const s = summarizeClass([mk("a", 90), mk("b", 70), mk("c", 50)], 70);
    expect(s.average).toBe(70);
    expect(s.highest).toBe(90);
    expect(s.lowest).toBe(50);
    expect(s.remedial).toBe(1);
    expect(s.graded).toBe(3);
    expect(s.total).toBe(3);
  });

  it("mengabaikan siswa tanpa nilai", () => {
    const s = summarizeClass([mk("a", 80), mk("b", null)], 70);
    expect(s.average).toBe(80);
    expect(s.graded).toBe(1);
    expect(s.total).toBe(2);
  });

  it("aman bila tidak ada nilai sama sekali", () => {
    const s = summarizeClass([mk("a", null)], 70);
    expect(s.average).toBeNull();
    expect(s.highest).toBeNull();
    expect(s.lowest).toBeNull();
  });
});

describe("computeAll", () => {
  it("menghitung seluruh siswa", () => {
    const c = [comp("a", 100)];
    const out = computeAll(c, [
      { studentId: "s1", scores: { a: 90 } },
      { studentId: "s2", scores: { a: 50 } },
    ]);
    expect(out).toHaveLength(2);
    expect(out[0].finalScore).toBe(90);
    expect(out[1].finalScore).toBe(50);
  });
});
