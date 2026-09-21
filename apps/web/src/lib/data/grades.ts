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

/* ============================================================
 * RAPOR PER SISWA (SEMUA MAPEL, DIKELOMPOKKAN)
 * ============================================================ */

/**
 * Susun bahan rapor satu kelas untuk satu semester: nilai akhir SETIAP siswa
 * pada SEMUA mapel, sudah dikelompokkan menurut `Subject.group`.
 *
 * KENAPA SATU FUNGSI BESAR, BUKAN SATU QUERY PER SISWA:
 * Satu kelas berisi ~32 siswa dan satu semester memuat ~15 mapel. Query per
 * siswa berarti ~32 kali bolak-balik ke database hanya untuk menggambar satu
 * halaman cetak. Di sini seluruh nilai kelas diambil SEKALI, lalu dihitung di
 * memori — pola yang sama dipakai lembar nilai.
 *
 * Mapel tanpa komponen nilai tetap ditampilkan dengan nilai kosong: rapor
 * yang menghilangkan mapel membuat wali kelas mengira mapel itu tidak ada.
 */
export async function getClassReportData(
  schoolId: string,
  opts: { classId: string; semesterId: string },
) {
  const semester = await prisma.semester.findFirst({
    where: { id: opts.semesterId, academicYear: { schoolId } },
    select: {
      id: true,
      name: true,
      type: true,
      academicYear: { select: { id: true, name: true } },
    },
  });
  if (!semester) return null;

  const [klass, students] = await Promise.all([
    prisma.class.findFirst({
      where: { id: opts.classId, schoolId, deletedAt: null },
      select: {
        id: true,
        name: true,
        level: true,
        major: { select: { id: true, code: true, name: true } },
        homeroomTeacher: { select: { id: true, fullName: true } },
      },
    }),
    prisma.student.findMany({
      where: { schoolId, classId: opts.classId, deletedAt: null },
      select: { id: true, nis: true, nisn: true, fullName: true },
      orderBy: { fullName: "asc" },
    }),
  ]);
  if (!klass) return null;

  const studentIds = students.map((s) => s.id);

  // Semua komponen nilai pada tahun ajaran semester ini, beserta mapelnya.
  const items = await prisma.gradeItem.findMany({
    where: {
      schoolId,
      academicYearId: semester.academicYear.id,
      subject: { deletedAt: null },
    },
    select: {
      id: true,
      name: true,
      type: true,
      weight: true,
      maxScore: true,
      subject: {
        select: { id: true, code: true, name: true, kkm: true, group: true },
      },
    },
    orderBy: [{ subject: { name: "asc" } }, { createdAt: "asc" }],
  });

  const grades = studentIds.length
    ? await prisma.grade.findMany({
        where: {
          schoolId,
          studentId: { in: studentIds },
          gradeItemId: { in: items.map((i) => i.id) },
        },
        select: { studentId: true, gradeItemId: true, score: true },
      })
    : [];

  // Mapel → komponen. Mapel tanpa komponen tetap muncul (lihat catatan di atas).
  const subjectsById = new Map<
    string,
    {
      id: string;
      code: string;
      name: string;
      kkm: number;
      group: string;
      components: { id: string; name: string; type: string; weight: number; maxScore: number }[];
    }
  >();

  for (const it of items) {
    const s = subjectsById.get(it.subject.id) ?? {
      ...it.subject,
      components: [],
    };
    s.components.push({
      id: it.id,
      name: it.name,
      type: it.type,
      weight: it.weight,
      maxScore: it.maxScore,
    });
    subjectsById.set(it.subject.id, s);
  }

  // Skor per siswa → per komponen.
  const scoresByStudent = new Map<string, Record<string, number>>();
  for (const g of grades) {
    const rec = scoresByStudent.get(g.studentId) ?? {};
    rec[g.gradeItemId] = g.score;
    scoresByStudent.set(g.studentId, rec);
  }

  return {
    semester,
    klass,
    students,
    subjects: Array.from(subjectsById.values()),
    scoresByStudent,
  };
}
