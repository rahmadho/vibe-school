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
  opts: { academicYearId?: string; q?: string } = {},
) {
  const where: Prisma.ClassWhereInput = {
    schoolId,
    deletedAt: null,
    ...(opts.academicYearId ? { academicYearId: opts.academicYearId } : {}),
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
  opts: { q?: string } = {},
) {
  const where: Prisma.SubjectWhereInput = {
    schoolId,
    deletedAt: null,
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
      _count: { select: { teachers: true } },
    },
    orderBy: { name: "asc" },
  });
}

export async function getSubject(schoolId: string, id: string) {
  return prisma.subject.findFirst({
    where: { id, schoolId, deletedAt: null },
    include: {
      teachers: {
        include: { teacher: { select: { id: true, fullName: true } } },
      },
    },
  });
}

/** Opsi tahun ajaran untuk dropdown. */
export async function getAcademicYearOptions(schoolId: string) {
  return prisma.academicYear.findMany({
    where: { schoolId },
    select: { id: true, name: true, isActive: true },
    orderBy: { startDate: "desc" },
  });
}
