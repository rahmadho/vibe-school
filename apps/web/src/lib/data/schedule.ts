import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ScheduleEntry } from "@/lib/schedule-conflict";

/**
 * Query layer Jam Pelajaran & Jadwal.
 * Isolasi tenant: semua query difilter schoolId dari sesi.
 */

/* ============================================================
 * JAM PELAJARAN
 * ============================================================ */
export async function listTimeSlots(schoolId: string) {
  return prisma.timeSlot.findMany({
    where: { schoolId }, // isolasi tenant
    orderBy: { slotNumber: "asc" },
    include: { _count: { select: { schedules: true } } },
  });
}

export async function getTimeSlot(schoolId: string, id: string) {
  return prisma.timeSlot.findFirst({
    where: { id, schoolId },
  });
}

/* ============================================================
 * JADWAL
 * ============================================================ */
const scheduleInclude = {
  class: { select: { id: true, name: true } },
  subject: { select: { id: true, name: true, code: true } },
  teacher: { select: { id: true, fullName: true } },
  timeSlot: {
    select: { id: true, slotNumber: true, startTime: true, endTime: true, label: true },
  },
} satisfies Prisma.ScheduleInclude;

export type ScheduleRow = Prisma.ScheduleGetPayload<{
  include: typeof scheduleInclude;
}>;

/** Ambil semua jadwal sekolah (untuk cek bentrok & tampilan grid). */
export async function listSchedules(
  schoolId: string,
  opts: { classId?: string; teacherId?: string } = {},
) {
  return prisma.schedule.findMany({
    where: {
      schoolId, // isolasi tenant
      ...(opts.classId ? { classId: opts.classId } : {}),
      ...(opts.teacherId ? { teacherId: opts.teacherId } : {}),
    },
    include: scheduleInclude,
    orderBy: [{ dayOfWeek: "asc" }, { timeSlot: { slotNumber: "asc" } }],
  });
}

export async function getSchedule(schoolId: string, id: string) {
  return prisma.schedule.findFirst({
    where: { id, schoolId },
    include: scheduleInclude,
  });
}

/** Ubah baris jadwal menjadi bentuk ringkas untuk cek bentrok. */
export function toEntries(rows: ScheduleRow[]): ScheduleEntry[] {
  return rows.map((r) => ({
    id: r.id,
    classId: r.classId,
    className: r.class.name,
    subjectId: r.subjectId,
    subjectName: r.subject.name,
    teacherId: r.teacherId,
    teacherName: r.teacher.fullName,
    dayOfWeek: r.dayOfWeek,
    timeSlotId: r.timeSlotId ?? "",
  }));
}

export async function getScheduleStats(schoolId: string) {
  const [total, classes, teachers, slots] = await Promise.all([
    prisma.schedule.count({ where: { schoolId } }),
    prisma.class.count({ where: { schoolId, deletedAt: null } }),
    prisma.teacher.count({ where: { schoolId, deletedAt: null, isActive: true } }),
    prisma.timeSlot.count({ where: { schoolId } }),
  ]);
  return { total, classes, teachers, slots };
}

/** Cek apakah sebuah jam sudah dipakai (agar tak bisa dihapus sembarangan). */
export async function timeSlotUsage(schoolId: string, timeSlotId: string) {
  return prisma.schedule.count({ where: { schoolId, timeSlotId } });
}
