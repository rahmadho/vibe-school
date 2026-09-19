import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { UserFilter } from "@/lib/validations/user";

/**
 * Query layer Pengguna (User).
 * Isolasi tenant: list & detail admin sekolah WAJIB difilter schoolId.
 */

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  phone: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

export type UserListItem = Prisma.UserGetPayload<{ select: typeof userSelect }>;

export async function listUsers(schoolId: string, filter: UserFilter) {
  const { q, role, active, page, perPage } = filter;

  const where: Prisma.UserWhereInput = {
    schoolId, // isolasi tenant
    deletedAt: null,
    ...(role ? { role } : {}),
    ...(active === "1" ? { isActive: true } : {}),
    ...(active === "0" ? { isActive: false } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: userSelect,
      orderBy: [{ role: "asc" }, { name: "asc" }],
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.user.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    perPage,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  };
}

export async function getUser(schoolId: string, id: string) {
  return prisma.user.findFirst({
    where: { id, schoolId, deletedAt: null },
    select: { ...userSelect, studentId: true, teacherId: true, staffId: true },
  });
}

export async function getUserStats(schoolId: string) {
  const base = { schoolId, deletedAt: null } satisfies Prisma.UserWhereInput;
  const [total, active, admins, teachers] = await Promise.all([
    prisma.user.count({ where: base }),
    prisma.user.count({ where: { ...base, isActive: true } }),
    prisma.user.count({
      where: { ...base, role: { in: ["SCHOOL_ADMIN", "PRINCIPAL"] } },
    }),
    prisma.user.count({ where: { ...base, role: "TEACHER" } }),
  ]);
  return { total, active, admins, teachers };
}

/** Cek email sudah dipakai (unik global). */
export async function emailExists(email: string, exceptId?: string) {
  const found = await prisma.user.findFirst({
    where: { email: email.toLowerCase(), ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true },
  });
  return Boolean(found);
}
