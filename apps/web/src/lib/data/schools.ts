import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { SchoolFilter } from "@/lib/validations/school";

/**
 * Query layer Sekolah (khusus SUPER_ADMIN).
 * Ini satu-satunya tempat yang boleh query lintas-sekolah — dilindungi RBAC
 * modul "schools" (hanya SUPER_ADMIN).
 */

const schoolSelect = {
  id: true,
  name: true,
  slug: true,
  npsn: true,
  level: true,
  themeColor: true,
  customDomain: true,
  isActive: true,
  createdAt: true,
  _count: { select: { students: true, teachers: true, users: true } },
  subscription: {
    select: {
      status: true,
      expiresAt: true,
      plan: { select: { name: true, code: true } },
    },
  },
} satisfies Prisma.SchoolSelect;

export type SchoolListItem = Prisma.SchoolGetPayload<{
  select: typeof schoolSelect;
}>;

export async function listSchools(filter: SchoolFilter) {
  const { q, active, page, perPage } = filter;

  const where: Prisma.SchoolWhereInput = {
    deletedAt: null,
    ...(active === "1" ? { isActive: true } : {}),
    ...(active === "0" ? { isActive: false } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { slug: { contains: q, mode: "insensitive" } },
            { npsn: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.school.findMany({
      where,
      select: schoolSelect,
      orderBy: { name: "asc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.school.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    perPage,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  };
}

export async function getSchool(id: string) {
  return prisma.school.findFirst({
    where: { id, deletedAt: null },
    include: {
      subscription: { include: { plan: true } },
      _count: { select: { students: true, teachers: true, users: true, classes: true } },
    },
  });
}

/**
 * Pengguna milik SATU sekolah — dipakai super-admin untuk memilih akun yang
 * akan diperankan ("Masuk sebagai"). Dikecualikan akun nonaktif dan yang
 * sudah dihapus, karena keduanya akan ditolak provider impersonate.
 */
export async function listSchoolUsers(schoolId: string) {
  return prisma.user.findMany({
    where: { schoolId, deletedAt: null, isActive: true },
    select: { id: true, name: true, email: true, role: true },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });
}

export async function getSchoolStats() {
  const [schools, active, students, users] = await Promise.all([
    prisma.school.count({ where: { deletedAt: null } }),
    prisma.school.count({ where: { deletedAt: null, isActive: true } }),
    prisma.student.count({ where: { deletedAt: null } }),
    prisma.user.count({ where: { deletedAt: null } }),
  ]);
  return { schools, active, students, users };
}

export async function slugExists(slug: string, exceptId?: string) {
  const found = await prisma.school.findFirst({
    where: { slug, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true },
  });
  return Boolean(found);
}

export async function domainExists(domain: string, exceptId?: string) {
  const found = await prisma.school.findFirst({
    where: {
      customDomain: domain,
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
    select: { id: true },
  });
  return Boolean(found);
}

export async function listPlans() {
  return prisma.plan.findMany({
    where: { isActive: true },
    orderBy: { pricePerMonth: "asc" },
  });
}
