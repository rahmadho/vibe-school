import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { TeacherFilter } from "@/lib/validations/personnel";

/**
 * Query layer untuk Guru & Staf.
 * Isolasi tenant: SEMUA query menerima schoolId dari sesi dan memfilternya.
 */

/* ============================================================
 * GURU
 * ============================================================ */
const teacherSelect = {
  id: true,
  nip: true,
  fullName: true,
  gender: true,
  phone: true,
  email: true,
  isActive: true,
  _count: { select: { subjects: true, homeroomOf: true } },
} satisfies Prisma.TeacherSelect;

export type TeacherListItem = Prisma.TeacherGetPayload<{
  select: typeof teacherSelect;
}>;

export async function listTeachers(schoolId: string, filter: TeacherFilter) {
  const { q, active, page, perPage } = filter;

  const where: Prisma.TeacherWhereInput = {
    schoolId, // isolasi tenant
    deletedAt: null,
    ...(active === "1" ? { isActive: true } : {}),
    ...(active === "0" ? { isActive: false } : {}),
    ...(q
      ? {
          OR: [
            { fullName: { contains: q, mode: "insensitive" } },
            { nip: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.teacher.findMany({
      where,
      select: teacherSelect,
      orderBy: { fullName: "asc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.teacher.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    perPage,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  };
}

export async function getTeacher(schoolId: string, id: string) {
  return prisma.teacher.findFirst({
    where: { id, schoolId, deletedAt: null },
    include: {
      subjects: { include: { subject: { select: { id: true, name: true, code: true } } } },
      homeroomOf: {
        where: { deletedAt: null },
        select: { id: true, name: true },
      },
    },
  });
}

export async function getTeacherStats(schoolId: string) {
  const base = { schoolId, deletedAt: null } satisfies Prisma.TeacherWhereInput;
  const [total, active, male, female] = await Promise.all([
    prisma.teacher.count({ where: base }),
    prisma.teacher.count({ where: { ...base, isActive: true } }),
    prisma.teacher.count({ where: { ...base, gender: "MALE" } }),
    prisma.teacher.count({ where: { ...base, gender: "FEMALE" } }),
  ]);
  return { total, active, male, female };
}

/* ============================================================
 * STAF
 * ============================================================ */
const staffSelect = {
  id: true,
  nip: true,
  fullName: true,
  position: true,
  phone: true,
  email: true,
  isActive: true,
} satisfies Prisma.StaffSelect;

export async function listStaffs(schoolId: string, filter: TeacherFilter) {
  const { q, active, page, perPage } = filter;

  const where: Prisma.StaffWhereInput = {
    schoolId,
    deletedAt: null,
    ...(active === "1" ? { isActive: true } : {}),
    ...(active === "0" ? { isActive: false } : {}),
    ...(q
      ? {
          OR: [
            { fullName: { contains: q, mode: "insensitive" } },
            { nip: { contains: q, mode: "insensitive" } },
            { position: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.staff.findMany({
      where,
      select: staffSelect,
      orderBy: { fullName: "asc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.staff.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    perPage,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  };
}

export async function getStaff(schoolId: string, id: string) {
  return prisma.staff.findFirst({ where: { id, schoolId, deletedAt: null } });
}

/** Opsi guru untuk dropdown (wali kelas, dll). */
export async function getTeacherOptions(schoolId: string) {
  return prisma.teacher.findMany({
    where: { schoolId, deletedAt: null, isActive: true },
    select: { id: true, fullName: true },
    orderBy: { fullName: "asc" },
  });
}

export async function getSubjectOptions(schoolId: string) {
  return prisma.subject.findMany({
    where: { schoolId, deletedAt: null },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  });
}
