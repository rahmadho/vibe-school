import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Data daftar publikasi nilai (Fase 5).
 * Semua query difilter `schoolId` dari sesi.
 */

/** Kelas + semester yang bisa dipublikasikan, beserta status terkini. */
export async function daftarPublikasiNilai(schoolId: string) {
  const [classes, semesters, rows] = await Promise.all([
    prisma.class.findMany({
      where: { schoolId, deletedAt: null },
      select: { id: true, name: true, level: true },
      orderBy: [{ level: "asc" }, { name: "asc" }],
    }),
    prisma.semester.findMany({
      where: { academicYear: { schoolId } },
      select: { id: true, name: true, academicYear: { select: { name: true } } },
      orderBy: [{ academicYear: { startDate: "desc" } }, { name: "asc" }],
    }),
    prisma.gradePublication.findMany({
      where: { schoolId },
      select: {
        id: true,
        classId: true,
        semesterId: true,
        status: true,
        publishedAt: true,
        studentCount: true,
        recipientCount: true,
      },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  // Siswa ber-rapor per semester. ReportCard tidak punya relasi `student`
  // maupun `classId`, jadi diperiksa lewat studentId yang dikumpulkan dulu.
  const studentIds = await prisma.student.findMany({
    where: { schoolId, classId: { in: classes.map((c) => c.id) }, deletedAt: null },
    select: { id: true },
  });
  const rapor = await prisma.reportCard.findMany({
    where: { schoolId, studentId: { in: studentIds.map((s) => s.id) } },
    select: { semesterId: true, studentId: true },
  });
  const raporPerSemester = new Map<string, Set<string>>();
  for (const r of rapor) {
    const set = raporPerSemester.get(r.semesterId) ?? new Set<string>();
    set.add(r.studentId);
    raporPerSemester.set(r.semesterId, set);
  }

  return {
    classes,
    semesters,
    publications: rows,
    raporPerSemester,
  };
}

/**
 * ID semester yang SUDAH dipublikasikan untuk satu siswa — dipakai portal
 * supaya orang tua hanya melihat nilai yang memang dibagikan sekolah.
 */
export async function semesterTerpublikasi(
  studentId: string,
  schoolId: string,
): Promise<Set<string>> {
  const student = await prisma.student.findFirst({
    where: { id: studentId, schoolId },
    select: { classId: true },
  });
  if (!student?.classId) return new Set();

  const rows = await prisma.gradePublication.findMany({
    where: { schoolId, classId: student.classId, status: "PUBLISHED" },
    select: { semesterId: true },
  });
  return new Set(rows.map((r) => r.semesterId));
}
