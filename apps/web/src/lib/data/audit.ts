import "server-only";
import { Prisma } from "@prisma/client";
import type { AuditAction } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AuditFilter } from "@/lib/validations/audit";

/**
 * Query layer Log Aktivitas (AuditLog) — ter-scope per sekolah.
 *
 * Log ini menjadi tempat menjawab pertanyaan yang muncul saat ada selisih uang
 * atau nilai yang berubah tanpa sebab: SIAPA mengubah APA, KAPAN, dan dari
 * nilai berapa ke berapa. Karena itu `before` dan `after` ikut ditampilkan,
 * bukan hanya nama aksinya.
 */

/** Label aksi dalam bahasa Indonesia. */
export const AUDIT_ACTION_LABEL: Record<AuditAction, string> = {
  CREATE: "Tambah",
  UPDATE: "Ubah",
  DELETE: "Hapus",
  LOGIN: "Masuk",
  LOGOUT: "Keluar",
  EXPORT: "Ekspor",
  IMPORT: "Impor",
};

/** Nama model yang sering muncul, diterjemahkan untuk operator sekolah. */
const ENTITY_LABEL: Record<string, string> = {
  Student: "Siswa",
  Teacher: "Guru",
  Staff: "Staf",
  User: "Pengguna",
  Invoice: "Tagihan",
  Payment: "Pembayaran",
  Grade: "Nilai",
  GradeItem: "Komponen Nilai",
  Attendance: "Absensi",
  Class: "Kelas",
  Subject: "Mapel",
  Schedule: "Jadwal",
  AcademicYear: "Tahun Ajaran",
  Registration: "Pendaftaran SPMB",
  AdmissionBatch: "Gelombang SPMB",
  SiteBlock: "Blok Web",
  SiteTheme: "Tema Web",
  SiteConfig: "Pengaturan Web",
  Page: "Halaman Web",
  School: "Sekolah",
  WaSession: "Sesi WhatsApp",
  MessageTemplate: "Template Pesan",
  NavigationItem: "Menu Web",
  Post: "Berita",
};

export function entityLabel(entity: string): string {
  return ENTITY_LABEL[entity] ?? entity;
}

const auditSelect = {
  id: true,
  action: true,
  entity: true,
  entityId: true,
  before: true,
  after: true,
  ipAddress: true,
  createdAt: true,
  user: { select: { id: true, name: true, email: true, role: true } },
} satisfies Prisma.AuditLogSelect;

export type AuditRow = Prisma.AuditLogGetPayload<{ select: typeof auditSelect }>;

export async function listAuditLog(schoolId: string, filter: AuditFilter) {
  const { q, action, entity, from, to, page, perPage } = filter;

  const where: Prisma.AuditLogWhereInput = {
    schoolId,
    ...(action ? { action: action as AuditAction } : {}),
    ...(entity ? { entity } : {}),
    ...(from || to
      ? {
          createdAt: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
          },
        }
      : {}),
    ...(q
      ? {
          OR: [
            { entity: { contains: q, mode: "insensitive" as const } },
            { entityId: { contains: q, mode: "insensitive" as const } },
            { user: { name: { contains: q, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      select: auditSelect,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    perPage,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  };
}

/** Ringkasan: berapa aksi per jenis, untuk sorotan di atas halaman. */
export async function getAuditSummary(schoolId: string) {
  const [grouped, total, actors, since] = await Promise.all([
    prisma.auditLog.groupBy({
      by: ["action"],
      where: { schoolId },
      _count: { _all: true },
    }),
    prisma.auditLog.count({ where: { schoolId } }),
    // Pelaku berbeda — bukan jumlah baris, karena satu orang bisa ratusan aksi.
    prisma.auditLog.findMany({
      where: { schoolId, userId: { not: null } },
      select: { userId: true },
      distinct: ["userId"],
    }),
    prisma.auditLog.findFirst({
      where: { schoolId },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
  ]);

  const byAction: Record<string, number> = {};
  for (const g of grouped) byAction[g.action] = g._count._all;

  return {
    total,
    byAction,
    actors: actors.length,
    oldest: since?.createdAt ?? null,
  };
}

/** Entitas yang pernah muncul di log — untuk isi pilihan filter. */
export async function listAuditEntities(schoolId: string) {
  const rows = await prisma.auditLog.findMany({
    where: { schoolId },
    select: { entity: true },
    distinct: ["entity"],
    orderBy: { entity: "asc" },
  });
  return rows.map((r) => r.entity);
}
