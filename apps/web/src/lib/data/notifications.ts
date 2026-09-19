import "server-only";
import { prisma } from "@/lib/prisma";
import { summarizeQueue, uniqueRecipients } from "@/lib/notification";
import { TEMPLATE_SEEDS } from "@/lib/templates-seed";

/**
 * Query layer Notifikasi (WA).
 * Isolasi tenant: semua query difilter schoolId dari sesi.
 */

/* ============================================================
 * ANTREAN
 * ============================================================ */

export type QueueFilter = {
  status?: string;
  search?: string;
  refType?: string;
  take?: number;
  skip?: number;
};

export async function listQueue(schoolId: string, filter: QueueFilter = {}) {
  const where: Record<string, unknown> = { schoolId, channel: "WHATSAPP" };
  if (filter.status && filter.status !== "ALL") where.status = filter.status;
  if (filter.refType) where.refType = filter.refType;
  if (filter.search) {
    where.OR = [
      { to: { contains: filter.search } },
      { recipientName: { contains: filter.search, mode: "insensitive" } },
      { body: { contains: filter.search, mode: "insensitive" } },
    ];
  }

  return prisma.notificationQueue.findMany({
    where,
    orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
    take: filter.take ?? 100,
    skip: filter.skip ?? 0,
  });
}

export async function getQueueStats(schoolId: string) {
  const rows = await prisma.notificationQueue.findMany({
    where: { schoolId, channel: "WHATSAPP" },
    select: { status: true, attempts: true },
  });
  return summarizeQueue(rows);
}

/** Ringkasan per jenis pemicu (absen/tagihan/nilai) untuk dasbor. */
export async function getQueueByRefType(schoolId: string) {
  const rows = await prisma.notificationQueue.groupBy({
    by: ["refType", "status"],
    where: { schoolId, channel: "WHATSAPP" },
    _count: { _all: true },
  });
  const out: Record<string, Record<string, number>> = {};
  for (const r of rows) {
    const key = r.refType ?? "LAINNYA";
    out[key] ??= {};
    out[key][r.status] = r._count._all;
  }
  return out;
}

/* ============================================================
 * TEMPLATE
 * ============================================================ */

export async function listTemplates(schoolId: string) {
  return prisma.messageTemplate.findMany({
    where: { schoolId },
    orderBy: [{ category: "asc" }, { key: "asc" }],
  });
}

export async function getTemplate(schoolId: string, id: string) {
  return prisma.messageTemplate.findFirst({ where: { id, schoolId } });
}

/** Cari template aktif berdasarkan kunci; dipakai saat membuat notifikasi. */
export async function findTemplateByKey(schoolId: string, key: string) {
  return prisma.messageTemplate.findFirst({
    where: { schoolId, key, isActive: true },
  });
}

/** Berapa template bawaan yang belum diimpor oleh sekolah ini. */
export async function countMissingSeedTemplates(schoolId: string) {
  const existing = await prisma.messageTemplate.findMany({
    where: { schoolId },
    select: { key: true },
  });
  const have = new Set(existing.map((e) => e.key));
  return TEMPLATE_SEEDS.filter((t) => !have.has(t.key)).length;
}

/* ============================================================
 * PENGUMUMAN
 * ============================================================ */

export async function listCampaigns(schoolId: string, take = 50) {
  return prisma.announcementCampaign.findMany({
    where: { schoolId },
    orderBy: { createdAt: "desc" },
    take,
    include: {
      audienceClass: { select: { name: true } },
      createdBy: { select: { name: true } },
    },
  });
}

export async function getCampaign(schoolId: string, id: string) {
  return prisma.announcementCampaign.findFirst({
    where: { id, schoolId },
    include: {
      audienceClass: { select: { name: true } },
      createdBy: { select: { name: true } },
    },
  });
}

/** Hitung berapa pesan yang akan dikirim untuk audiens tertentu. */
export async function estimateAudience(
  schoolId: string,
  audienceType: string,
  classId?: string | null,
): Promise<{ recipients: number; withPhone: number; withoutPhone: number }> {
  const targets = await resolveAudience(schoolId, audienceType, classId);
  const withPhone = uniqueRecipients(targets);
  return {
    recipients: targets.length,
    withPhone: withPhone.length,
    withoutPhone: targets.length - withPhone.length,
  };
}

/**
 * Susun daftar penerima sesuai audiens.
 * Semua jalur difilter schoolId agar tidak pernah bocor antar-sekolah.
 */
export async function resolveAudience(
  schoolId: string,
  audienceType: string,
  classId?: string | null,
): Promise<{ name: string; phone: string | null }[]> {
  if (audienceType === "TEACHERS") {
    const staff = await prisma.teacher.findMany({
      where: { schoolId, deletedAt: null, isActive: true },
      select: { fullName: true, phone: true },
    });
    return staff.map((s) => ({ name: s.fullName, phone: s.phone }));
  }

  const where: Record<string, unknown> = { schoolId, deletedAt: null };
  if (
    audienceType === "PARENTS_OF_CLASS" ||
    audienceType === "STUDENTS_OF_CLASS"
  ) {
    where.classId = classId ?? "__none__";
  }

  const students = await prisma.student.findMany({
    where,
    select: {
      fullName: true,
      phone: true,
      parents: { select: { fullName: true, phone: true, isPrimary: true } },
    },
  });

  if (audienceType === "STUDENTS_OF_CLASS") {
    return students.map((s) => ({ name: s.fullName, phone: s.phone }));
  }

  // Orang tua/wali: utamakan wali utama, lalu wali lain bila nomornya kosong.
  const out: { name: string; phone: string | null }[] = [];
  for (const s of students) {
    const primary = s.parents.find((p) => p.isPrimary) ?? s.parents[0];
    if (primary) {
      // Bila semua wali tidak punya nomor, pakai nomor siswa sebagai upaya terakhir.
      const phone =
        primary.phone ||
        s.parents.find((p) => p.phone)?.phone ||
        s.phone ||
        null;
      out.push({ name: primary.fullName || s.fullName, phone });
    } else {
      out.push({ name: s.fullName, phone: s.phone });
    }
  }
  return out;
}

/* ============================================================
 * SESI WHATSAPP
 * ============================================================ */

export async function getWaSession(schoolId: string) {
  return prisma.waSession.findFirst({ where: { schoolId } });
}

export async function listWaSessions() {
  return prisma.waSession.findMany({
    include: { school: { select: { name: true, slug: true } } },
    orderBy: { updatedAt: "desc" },
  });
}
