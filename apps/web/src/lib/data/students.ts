import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { StudentFilter } from "@/lib/validations/student";

/**
 * Query layer Siswa.
 *
 * CATATAN ISOLASI TENANT:
 * Setiap fungsi WAJIB menerima `schoolId` dan memasukkannya ke `where`.
 * schoolId SELALU berasal dari sesi (lihat requireSchoolSession()), bukan input
 * pengguna. Ini pola untuk query dengan relasi/include yang lebih kaya daripada
 * yang nyaman dilakukan lewat proxy scopedDb.
 */

const studentListSelect = {
  id: true,
  nis: true,
  nisn: true,
  fullName: true,
  gender: true,
  status: true,
  entryYear: true,
  createdAt: true,
  class: { select: { id: true, name: true } },
  major: { select: { id: true, code: true, name: true } },
} satisfies Prisma.StudentSelect;

export type StudentListItem = Prisma.StudentGetPayload<{
  select: typeof studentListSelect;
}>;

export async function listStudents(schoolId: string, filter: StudentFilter) {
  const { q, classId, majorId, status, page, perPage } = filter;

  const where: Prisma.StudentWhereInput = {
    schoolId, // ← isolasi tenant (WAJIB)
    deletedAt: null,
    ...(status ? { status } : {}),
    ...(classId ? { classId } : {}),
    ...(majorId ? { majorId } : {}),
    ...(q
      ? {
          OR: [
            { fullName: { contains: q, mode: "insensitive" } },
            { nis: { contains: q, mode: "insensitive" } },
            { nisn: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.student.findMany({
      where,
      select: studentListSelect,
      orderBy: [{ fullName: "asc" }],
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.student.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    perPage,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  };
}

export async function getStudent(schoolId: string, id: string) {
  return prisma.student.findFirst({
    where: { id, schoolId, deletedAt: null }, // ← isolasi tenant
    include: {
      class: { select: { id: true, name: true } },
      major: { select: { id: true, code: true, name: true } },
      parents: { orderBy: { isPrimary: "desc" } },
    },
  });
}

export async function getStudentStats(schoolId: string) {
  const base = { schoolId, deletedAt: null } satisfies Prisma.StudentWhereInput;
  const [total, active, male, female] = await Promise.all([
    prisma.student.count({ where: base }),
    prisma.student.count({ where: { ...base, status: "ACTIVE" } }),
    prisma.student.count({ where: { ...base, gender: "MALE" } }),
    prisma.student.count({ where: { ...base, gender: "FEMALE" } }),
  ]);
  return { total, active, male, female };
}

/** Opsi kelas untuk dropdown filter/form (bisa difilter tahun ajaran). */
export async function getClassOptions(schoolId: string, academicYearId?: string) {
  return prisma.class.findMany({
    where: {
      schoolId,
      deletedAt: null,
      ...(academicYearId ? { academicYearId } : {}),
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

/** Cek duplikat NIS dalam satu sekolah (bukan lintas sekolah). */
export async function nisExists(
  schoolId: string,
  nis: string,
  exceptId?: string,
) {
  const found = await prisma.student.findFirst({
    where: {
      schoolId,
      nis,
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
    select: { id: true },
  });
  return Boolean(found);
}
