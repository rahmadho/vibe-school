import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Query layer akademik: Tahun Ajaran, Kelas, Mapel.
 * Isolasi tenant: semua query menerima schoolId dari sesi.
 */

/* ============================================================
 * TAHUN AJARAN
 * ============================================================ */
export async function listAcademicYears(schoolId: string) {
  return prisma.academicYear.findMany({
    where: { schoolId },
    include: { _count: { select: { classes: true, semesters: true } } },
    orderBy: { startDate: "desc" },
  });
}

export async function getAcademicYear(schoolId: string, id: string) {
  return prisma.academicYear.findFirst({
    where: { id, schoolId },
    include: {
      semesters: { orderBy: { startDate: "asc" } },
      _count: { select: { classes: true } },
    },
  });
}

export async function getActiveAcademicYear(schoolId: string) {
  return prisma.academicYear.findFirst({
    where: { schoolId, isActive: true },
    include: { semesters: true },
  });
}

/* ============================================================
 * KELAS
 * ============================================================ */
export async function listClasses(
  schoolId: string,
  opts: { academicYearId?: string; majorId?: string; q?: string } = {},
) {
  const where: Prisma.ClassWhereInput = {
    schoolId,
    deletedAt: null,
    ...(opts.academicYearId ? { academicYearId: opts.academicYearId } : {}),
    ...(opts.majorId ? { majorId: opts.majorId } : {}),
    ...(opts.q
      ? { name: { contains: opts.q, mode: "insensitive" } }
      : {}),
  };

  return prisma.class.findMany({
    where,
    select: {
      id: true,
      name: true,
      level: true,
      capacity: true,
      academicYear: { select: { id: true, name: true } },
      homeroomTeacher: { select: { id: true, fullName: true } },
      major: { select: { id: true, code: true, name: true } },
      _count: { select: { students: true } },
    },
    orderBy: [{ level: "asc" }, { name: "asc" }],
  });
}

export async function getClass(schoolId: string, id: string) {
  return prisma.class.findFirst({
    where: { id, schoolId, deletedAt: null },
    include: {
      academicYear: { select: { id: true, name: true } },
      homeroomTeacher: { select: { id: true, fullName: true } },
      major: { select: { id: true, code: true, name: true } },
      students: {
        where: { deletedAt: null },
        select: { id: true, nis: true, fullName: true, gender: true },
        orderBy: { fullName: "asc" },
      },
    },
  });
}

/* ============================================================
 * MAPEL
 * ============================================================ */
export async function listSubjects(
  schoolId: string,
  opts: { q?: string; group?: string; majorId?: string } = {},
) {
  const where: Prisma.SubjectWhereInput = {
    schoolId,
    deletedAt: null,
    ...(opts.group ? { group: opts.group as never } : {}),
    ...(opts.majorId ? { majorId: opts.majorId } : {}),
    ...(opts.q
      ? {
          OR: [
            { name: { contains: opts.q, mode: "insensitive" } },
            { code: { contains: opts.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  return prisma.subject.findMany({
    where,
    select: {
      id: true,
      code: true,
      name: true,
      kkm: true,
      group: true,
      major: { select: { id: true, code: true, name: true } },
      _count: { select: { teachers: true } },
    },
    orderBy: { name: "asc" },
  });
}

export async function getSubject(schoolId: string, id: string) {
  return prisma.subject.findFirst({
    where: { id, schoolId, deletedAt: null },
    include: {
      major: { select: { id: true, code: true, name: true } },
      teachers: {
        include: { teacher: { select: { id: true, fullName: true } } },
      },
    },
  });
}

/* ============================================================
 * JURUSAN / PEMINATAN
 * ============================================================ */
const majorSelect = {
  id: true,
  code: true,
  name: true,
  description: true,
  isActive: true,
  headTeacher: { select: { id: true, fullName: true } },
  _count: { select: { classes: true, students: true, subjects: true } },
} satisfies Prisma.MajorSelect;

export type MajorListItem = Prisma.MajorGetPayload<{ select: typeof majorSelect }>;

export async function listMajors(
  schoolId: string,
  opts: { q?: string; active?: string } = {},
) {
  const where: Prisma.MajorWhereInput = {
    schoolId,
    deletedAt: null,
    ...(opts.active === "1" ? { isActive: true } : {}),
    ...(opts.active === "0" ? { isActive: false } : {}),
    ...(opts.q
      ? {
          OR: [
            { name: { contains: opts.q, mode: "insensitive" } },
            { code: { contains: opts.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  return prisma.major.findMany({
    where,
    select: majorSelect,
    orderBy: [{ code: "asc" }],
  });
}

export async function getMajor(schoolId: string, id: string) {
  return prisma.major.findFirst({
    where: { id, schoolId, deletedAt: null },
    include: {
      headTeacher: { select: { id: true, fullName: true } },
      _count: { select: { classes: true, students: true, subjects: true } },
    },
  });
}

/** Opsi jurusan untuk dropdown (hanya yang aktif). */
export async function getMajorOptions(schoolId: string) {
  return prisma.major.findMany({
    where: { schoolId, deletedAt: null, isActive: true },
    select: { id: true, code: true, name: true },
    orderBy: { code: "asc" },
  });
}

/** Statistik jurusan untuk kartu ringkasan. */
export async function getMajorStats(schoolId: string) {
  const base = { schoolId, deletedAt: null } satisfies Prisma.MajorWhereInput;
  const [total, active] = await Promise.all([
    prisma.major.count({ where: base }),
    prisma.major.count({ where: { ...base, isActive: true } }),
  ]);
  return { total, active };
}

/** Opsi tahun ajaran untuk dropdown. */
export async function getAcademicYearOptions(schoolId: string) {
  return prisma.academicYear.findMany({
    where: { schoolId },
    select: { id: true, name: true, isActive: true },
    orderBy: { startDate: "desc" },
  });
}

/* ============================================================
 * RIWAYAT KENAIKAN KELAS
 * ============================================================ */
export async function getProgressionContext(
  schoolId: string,
  opts: { sourceClassId?: string; targetAcademicYearId?: string },
) {
  const [classes, academicYears] = await Promise.all([
    prisma.class.findMany({
      where: { schoolId, deletedAt: null },
      select: {
        id: true,
        name: true,
        level: true,
        academicYearId: true,
        academicYear: { select: { id: true, name: true, isActive: true } },
        _count: { select: { students: { where: { deletedAt: null, status: "ACTIVE" } } } },
      },
      orderBy: [{ level: "asc" }, { name: "asc" }],
    }),
    prisma.academicYear.findMany({
      where: { schoolId },
      select: { id: true, name: true, isActive: true },
      orderBy: { startDate: "desc" },
    }),
  ]);

  let students: Array<{
    id: string;
    nis: string;
    fullName: string;
    gender: string;
  }> = [];

  if (opts.sourceClassId) {
    const s = await prisma.student.findMany({
      where: {
        schoolId,
        classId: opts.sourceClassId,
        deletedAt: null,
        status: "ACTIVE",
      },
      select: { id: true, nis: true, fullName: true, gender: true },
      orderBy: { fullName: "asc" },
    });
    students = s;
  }

  return {
    classes,
    academicYears,
    students,
  };
}

/* ============================================================
 * PKL / PRAKERIN
 * ============================================================ */
const internshipSelect = {
  id: true,
  industryName: true,
  industryAddress: true,
  industryPhone: true,
  supervisorName: true,
  supervisorPhone: true,
  startDate: true,
  endDate: true,
  status: true,
  score: true,
  certificateNo: true,
  note: true,
  student: {
    select: {
      id: true,
      nis: true,
      fullName: true,
      class: { select: { id: true, name: true } },
      major: { select: { id: true, code: true, name: true } },
    },
  },
  academicYear: { select: { id: true, name: true } },
  teacher: { select: { id: true, fullName: true } },
} satisfies Prisma.InternshipSelect;

export type InternshipRow = Prisma.InternshipGetPayload<{ select: typeof internshipSelect }>;

export async function listInternships(
  schoolId: string,
  opts: {
    academicYearId?: string;
    majorId?: string;
    status?: string;
    q?: string;
  } = {},
) {
  const where: Prisma.InternshipWhereInput = {
    schoolId,
    ...(opts.academicYearId ? { academicYearId: opts.academicYearId } : {}),
    ...(opts.majorId ? { student: { majorId: opts.majorId } } : {}),
    ...(opts.status ? { status: opts.status as never } : {}),
    ...(opts.q
      ? {
          OR: [
            { industryName: { contains: opts.q, mode: "insensitive" } },
            { student: { fullName: { contains: opts.q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  return prisma.internship.findMany({
    where,
    select: internshipSelect,
    orderBy: [{ startDate: "desc" }],
  });
}

export async function getInternship(schoolId: string, id: string) {
  return prisma.internship.findFirst({
    where: { id, schoolId },
    include: {
      student: { select: { id: true, nis: true, fullName: true } },
      academicYear: { select: { id: true, name: true } },
      teacher: { select: { id: true, fullName: true } },
    },
  });
}

/** Ringkasan PKL: berapa siswa aktif yang sudah/belum punya penempatan. */
export async function getInternshipSummary(schoolId: string, academicYearId?: string) {
  const base: Prisma.InternshipWhereInput = {
    schoolId,
    ...(academicYearId ? { academicYearId } : {}),
  };

  const [total, ongoing, completed, planned] = await Promise.all([
    prisma.internship.count({ where: base }),
    prisma.internship.count({ where: { ...base, status: "ONGOING" } }),
    prisma.internship.count({ where: { ...base, status: "COMPLETED" } }),
    prisma.internship.count({ where: { ...base, status: "PLANNED" } }),
  ]);

  return { total, ongoing, completed, planned };
}

/* ============================================================
 * UKK — UJI KOMPETENSI KEAHLIAN
 * ============================================================ */
const competencyTestSelect = {
  id: true,
  examinerName: true,
  examinerOrg: true,
  testDate: true,
  result: true,
  score: true,
  certificateNo: true,
  note: true,
  student: {
    select: {
      id: true,
      nis: true,
      fullName: true,
      class: { select: { id: true, name: true } },
    },
  },
  academicYear: { select: { id: true, name: true } },
  major: { select: { id: true, code: true, name: true } },
} satisfies Prisma.CompetencyTestSelect;

export type CompetencyTestRow = Prisma.CompetencyTestGetPayload<{
  select: typeof competencyTestSelect;
}>;

export async function listCompetencyTests(
  schoolId: string,
  opts: {
    academicYearId?: string;
    majorId?: string;
    result?: string;
    q?: string;
  } = {},
) {
  const where: Prisma.CompetencyTestWhereInput = {
    schoolId,
    ...(opts.academicYearId ? { academicYearId: opts.academicYearId } : {}),
    ...(opts.majorId ? { majorId: opts.majorId } : {}),
    ...(opts.result ? { result: opts.result as never } : {}),
    ...(opts.q
      ? {
          OR: [
            { examinerName: { contains: opts.q, mode: "insensitive" } },
            { certificateNo: { contains: opts.q, mode: "insensitive" } },
            { student: { fullName: { contains: opts.q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  return prisma.competencyTest.findMany({
    where,
    select: competencyTestSelect,
    orderBy: [{ testDate: "desc" }],
  });
}

export async function getCompetencyTest(schoolId: string, id: string) {
  return prisma.competencyTest.findFirst({
    where: { id, schoolId },
    include: {
      student: { select: { id: true, nis: true, fullName: true } },
      academicYear: { select: { id: true, name: true } },
      major: { select: { id: true, code: true, name: true } },
    },
  });
}

/** Ringkasan UKK: kelulusan kompetensi per periode. */
export async function getCompetencySummary(schoolId: string, academicYearId?: string) {
  const base: Prisma.CompetencyTestWhereInput = {
    schoolId,
    ...(academicYearId ? { academicYearId } : {}),
  };

  const [total, competent, notCompetent] = await Promise.all([
    prisma.competencyTest.count({ where: base }),
    prisma.competencyTest.count({ where: { ...base, result: "COMPETENT" } }),
    prisma.competencyTest.count({ where: { ...base, result: "NOT_COMPETENT" } }),
  ]);

  return { total, competent, notCompetent };
}

/** Opsi siswa aktif untuk dropdown PKL & UKK. */
export async function getStudentOptions(
  schoolId: string,
  opts: { majorId?: string; academicYearId?: string } = {},
) {
  return prisma.student.findMany({
    where: {
      schoolId,
      deletedAt: null,
      status: "ACTIVE",
      ...(opts.majorId ? { majorId: opts.majorId } : {}),
      // PKL & UKK terikat periode. Tanpa filter ini, dropdown menampilkan
      // siswa angkatan lama yang tidak mungkin ikut kegiatan tahun ini.
      //
      // Siswa yang BELUM ditempatkan di kelas (classId null) tetap
      // ditampilkan: justru mereka yang sering perlu dicatat PKL-nya lebih
      // dulu, dan membuangnya membuat siswa baru tidak bisa dipilih sama sekali.
      ...(opts.academicYearId
        ? {
            OR: [
              { class: { academicYearId: opts.academicYearId } },
              { classId: null },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      nis: true,
      fullName: true,
      majorId: true,
      class: { select: { id: true, name: true } },
    },
    orderBy: [{ fullName: "asc" }],
  });
}

/** Opsi guru untuk dropdown pembimbing (PKL). */
export async function getTeacherOptions(schoolId: string) {
  return prisma.teacher.findMany({
    where: { schoolId, deletedAt: null, isActive: true },
    select: { id: true, fullName: true },
    orderBy: { fullName: "asc" },
  });
}
