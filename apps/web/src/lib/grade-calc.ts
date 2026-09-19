/**
 * Perhitungan nilai — logika MURNI (tanpa DB) agar mudah diuji.
 *
 * Aturan:
 *  - Nilai akhir = rata-rata BERBOBOT dari komponen yang sudah dinilai.
 *  - Komponen yang belum dinilai (score null) TIDAK dihitung, dan bobotnya
 *    juga tidak diperhitungkan — sehingga nilai akhir tidak jatuh hanya karena
 *    guru belum selesai menginput.
 *  - Bila total bobot yang dinilai < 100, hasilnya dinormalkan (dibagi total
 *    bobot yang ada) supaya tetap berada di skala 0–100.
 */

export type GradeComponent = {
  id: string;
  name: string;
  type: string;
  weight: number;
  maxScore: number;
};

export type StudentGradeInput = {
  studentId: string;
  /** Peta gradeItemId → skor mentah (null/undefined = belum dinilai). */
  scores: Record<string, number | null | undefined>;
};

export type FinalGrade = {
  studentId: string;
  /** Nilai akhir 0–100 (sudah dinormalkan & dibulatkan). */
  finalScore: number | null;
  /** Total bobot komponen yang sudah dinilai. */
  countedWeight: number;
  /** Jumlah komponen yang sudah dinilai. */
  gradedCount: number;
  /** Benar bila belum ada satu pun komponen yang dinilai. */
  isEmpty: boolean;
};

/**
 * Hitung nilai akhir seorang siswa dari komponen yang sudah dinilai.
 *
 * @param components daftar komponen nilai (dengan bobot)
 * @param input      skor mentah siswa per komponen
 */
export function computeFinalScore(
  components: GradeComponent[],
  input: StudentGradeInput,
): FinalGrade {
  let weightedSum = 0;
  let countedWeight = 0;
  let gradedCount = 0;

  for (const c of components) {
    const raw = input.scores[c.id];
    if (raw === null || raw === undefined) continue;
    if (!Number.isFinite(raw)) continue;

    // Normalkan skor ke skala 0–100 bila maxScore bukan 100.
    const normalized = (raw / c.maxScore) * 100;
    weightedSum += normalized * c.weight;
    countedWeight += c.weight;
    gradedCount += 1;
  }

  if (countedWeight === 0) {
    return {
      studentId: input.studentId,
      finalScore: null,
      countedWeight: 0,
      gradedCount: 0,
      isEmpty: true,
    };
  }

  // Normalkan: bila guru baru mengisi sebagian bobot, hasil tetap di 0–100.
  const finalScore = Math.round((weightedSum / countedWeight) * 10) / 10;

  return {
    studentId: input.studentId,
    finalScore,
    countedWeight,
    gradedCount,
    isEmpty: false,
  };
}

/** Hitung nilai akhir untuk banyak siswa. */
export function computeAll(
  components: GradeComponent[],
  inputs: StudentGradeInput[],
): FinalGrade[] {
  return inputs.map((i) => computeFinalScore(components, i));
}

/**
 * Predikat huruf dari nilai akhir, mengikuti ambang yang umum dipakai:
 * A ≥ 90, B ≥ 80, C ≥ 70, D ≥ 60, sisanya E.
 */
export function toPredicate(score: number | null): string | null {
  if (score === null) return null;
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "E";
}

/** Apakah nilai di bawah KKM (perlu remedial). */
export function belowKkm(score: number | null, kkm: number): boolean {
  if (score === null) return false;
  return score < kkm;
}

/**
 * Peringkat kelas berdasarkan nilai akhir.
 * Siswa tanpa nilai akhir ditempatkan di akhir tanpa peringkat.
 * Nilai sama mendapat peringkat sama (metode "competition ranking").
 */
export function rankStudents(
  finals: FinalGrade[],
): Map<string, number | null> {
  const ranked = finals
    .filter((f) => f.finalScore !== null)
    .sort((a, b) => (b.finalScore ?? 0) - (a.finalScore ?? 0));

  const out = new Map<string, number | null>();
  let lastScore: number | null = null;
  let lastRank = 0;

  ranked.forEach((f, i) => {
    const score = f.finalScore ?? 0;
    const rank = score === lastScore ? lastRank : i + 1;
    out.set(f.studentId, rank);
    lastScore = score;
    lastRank = rank;
  });

  for (const f of finals) {
    if (!out.has(f.studentId)) out.set(f.studentId, null);
  }
  return out;
}

/** Ringkasan satu kelas: rata-rata, tertinggi, terendah, jumlah remedial. */
export function summarizeClass(
  finals: FinalGrade[],
  kkm: number,
): {
  average: number | null;
  highest: number | null;
  lowest: number | null;
  graded: number;
  remedial: number;
  total: number;
} {
  const scored = finals.filter((f) => f.finalScore !== null);
  const values = scored.map((f) => f.finalScore as number);

  return {
    average:
      values.length === 0
        ? null
        : Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10,
    highest: values.length === 0 ? null : Math.max(...values),
    lowest: values.length === 0 ? null : Math.min(...values),
    graded: scored.length,
    remedial: values.filter((v) => v < kkm).length,
    total: finals.length,
  };
}
