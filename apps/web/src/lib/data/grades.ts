import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Query layer Penilaian.
 * Isolasi tenant: semua query difilter schoolId dari sesi.
 */

/* ============================================================
 * SEMESTER AKTIF
 * ============================================================ */

/** Ambil tahun ajaran aktif milik sekolah. */
export async function getActiveAcademicYear(schoolId: string) {
  return prisma.academicYear.findFirst({
    where: { schoolId, isActive: true },
    select: { id: true, name: true },
  });
}

/** Ambil semester aktif (berdasarkan tahun ajaran aktif). */
export async function getActiveSemester(schoolId: string) {
  const year = await getActiveAcademicYear(schoolId);
  if (!year) return null;
  return prisma.semester.findFirst({
    where: { academicYearId: year.id, isActive: true },
    select: { id: true, name: true, type: true, academicYearId: true },
  });
}

/** Daftar semester milik tahun ajaran aktif. */
export async function listSemestersOfActiveYear(schoolId: string) {
  const year = await getActiveAcademicYear(schoolId);
  if (!year) return [];
  return prisma.semester.findMany({
    where: { academicYearId: year.id },
    orderBy: { startDate: "asc" },
    select: { id: true, name: true, type: true, academicYearId: true },
  });
}

/* ============================================================
 * KOMPONEN NILAI
 * ============================================================ */

export async function listGradeItems(
  schoolId: string,
  filter: { subjectId: string; academicYearId?: string },
) {
  return prisma.gradeItem.findMany({
    where: {
      schoolId, // isolasi tenant
      subjectId: filter.subjectId,
      ...(filter.academicYearId ? { academicYearId: filter.academicYearId } : {}),
    },
    orderBy: [{ type: "asc" }, { createdAt: "asc" }],
    include: {
      teacher: { select: { id: true, fullName: true } },
      _count: { select: { grades: true } },
    },
  });
}

export async function getGradeItem(schoolId: string, id: string) {
  return prisma.gradeItem.findFirst({
    where: { id, schoolId },
    include: {
      subject: { select: { id: true, name: true, kkm: true, code: true } },
      teacher: { select: { id: true, fullName: true } },
    },
  });
}

/* ============================================================
 * NILAI SISWA
 * ============================================================ */

/**
 * Ambil seluruh nilai untuk sekumpulan komponen.
 * Dipakai untuk membentuk matriks siswa × komponen.
 */
export async function listGradesForItems(schoolId: string, gradeItemIds: string[]) {
  if (gradeItemIds.length === 0) return [];
  return prisma.grade.findMany({
    where: {
      schoolId, // isolasi tenant
      gradeItemId: { in: gradeItemIds },
    },
    select: {
      id: true,
      gradeItemId: true,
      studentId: true,
      score: true,
      note: true,
    },
  });
}

/** Nilai satu siswa untuk banyak komponen (untuk rekap per siswa). */
export async function listStudentGrades(
  schoolId: string,
  studentId: string,
  subjectId?: string,
) {
  return prisma.grade.findMany({
    where: {
      schoolId,
      studentId,
      ...(subjectId ? { subjectId } : {}),
    },
    select: {
      id: true,
      score: true,
      note: true,
      subjectId: true,
      gradeItem: {
        select: { id: true, name: true, type: true, weight: true, maxScore: true },
      },
      subject: { select: { id: true, name: true, kkm: true } },
    },
    orderBy: { gradeItem: { createdAt: "asc" } },
  });
}

/* ============================================================
 * DATA PENDUKUNG
 * ============================================================ */

/** Rapor tersimpan (nilai akhir per mapel per semester). */
export async function listReportCards(schoolId: string, studentId: string, semesterId: string) {
  return prisma.reportCard.findMany({
    where: { schoolId, studentId, semesterId },
    select: {
      id: true,
      subjectId: true,
      finalScore: true,
      predicate: true,
      note: true,
      homeroomNote: true,
    },
  });
}

export async function getSubject(schoolId: string, subjectId: string) {
  return prisma.subject.findFirst({
    where: { id: subjectId, schoolId, deletedAt: null },
    select: { id: true, name: true, code: true, kkm: true },
  });
}

/** Statistik ringkas penilaian: berapa komponen & nilai di sekolah. */
export async function getGradeStats(schoolId: string) {
  const [items, grades, reports] = await Promise.all([
    prisma.gradeItem.count({ where: { schoolId } }),
    prisma.grade.count({ where: { schoolId } }),
    prisma.reportCard.count({ where: { schoolId } }),
  ]);
  return { items, grades, reports };
}
