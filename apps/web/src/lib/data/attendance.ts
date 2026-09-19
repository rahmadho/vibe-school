import "server-only";
import { prisma } from "@/lib/prisma";
import type { AttendanceStatusValue } from "@/lib/validations/attendance";

/**
 * Query layer Absensi.
 * Isolasi tenant: semua query difilter schoolId dari sesi.
 *
 * Konvensi tanggal: absensi harian disimpan dengan `date` berupa tanggal murni
 * (kolom DB bertipe DATE). Untuk membentuknya dipakai tengah malam UTC agar
 * tidak bergeser karena zona waktu server.
 */

/** Ubah "YYYY-MM-DD" menjadi Date tengah malam UTC. */
export function parseDateOnly(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Ubah Date menjadi "YYYY-MM-DD" (UTC). */
export function toDateOnly(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
    d.getUTCDate(),
  ).padStart(2, "0")}`;
}

/** Tanggal hari ini dalam bentuk ISO (YYYY-MM-DD). */
export function todayIso(): string {
  return toDateOnly(new Date());
}

/** Daftar siswa aktif satu kelas, urut nama. */
export async function listClassStudents(schoolId: string, classId: string) {
  return prisma.student.findMany({
    where: { schoolId, classId, deletedAt: null },
    orderBy: { fullName: "asc" },
    select: { id: true, fullName: true, nis: true, nisn: true },
  });
}

/** Absensi satu kelas pada satu tanggal (harian, tanpa scheduleId). */
export async function getClassAttendance(
  schoolId: string,
  classId: string,
  dateIso: string,
) {
  return prisma.attendance.findMany({
    where: {
      schoolId, // isolasi tenant
      classId,
      date: parseDateOnly(dateIso),
      scheduleId: null,
      studentId: { not: null },
    },
    select: { studentId: true, status: true, note: true },
  });
}

/** Absensi satu jadwal (per-mapel) pada satu tanggal. */
export async function getScheduleAttendance(
  schoolId: string,
  scheduleId: string,
  dateIso: string,
) {
  return prisma.attendance.findMany({
    where: {
      schoolId,
      scheduleId,
      date: parseDateOnly(dateIso),
      studentId: { not: null },
    },
    select: { studentId: true, status: true, note: true },
  });
}

/** Catatan absensi seluruh siswa satu kelas dalam rentang tanggal. */
export async function listClassAttendanceRange(
  schoolId: string,
  classId: string,
  fromIso: string,
  toIso: string,
) {
  return prisma.attendance.findMany({
    where: {
      schoolId, // isolasi tenant
      classId,
      scheduleId: null,
      studentId: { not: null },
      date: { gte: parseDateOnly(fromIso), lte: parseDateOnly(toIso) },
    },
    select: { studentId: true, status: true, date: true },
    orderBy: { date: "asc" },
  });
}

/** Catatan absensi seorang siswa (untuk halaman detail / rapor). */
export async function listStudentAttendance(
  schoolId: string,
  studentId: string,
  fromIso?: string,
  toIso?: string,
) {
  return prisma.attendance.findMany({
    where: {
      schoolId,
      studentId,
      ...(fromIso && toIso
        ? { date: { gte: parseDateOnly(fromIso), lte: parseDateOnly(toIso) } }
        : {}),
    },
    select: { status: true, date: true, note: true },
    orderBy: { date: "asc" },
  });
}

/** Statistik ringkas absensi hari ini untuk dasbor. */
export async function getAttendanceStats(schoolId: string, dateIso: string) {
  const rows = await prisma.attendance.groupBy({
    by: ["status"],
    where: {
      schoolId,
      date: parseDateOnly(dateIso),
      studentId: { not: null },
    },
    _count: { _all: true },
  });

  const counts: Record<string, number> = {};
  let total = 0;
  for (const r of rows) {
    counts[r.status] = r._count._all;
    total += r._count._all;
  }
  return { counts, total, date: dateIso };
}

/** Berapa kelas yang sudah mengisi absen pada tanggal tertentu. */
export async function getClassesWithAttendance(
  schoolId: string,
  dateIso: string,
): Promise<Set<string>> {
  const rows = await prisma.attendance.findMany({
    where: {
      schoolId,
      date: parseDateOnly(dateIso),
      scheduleId: null,
      studentId: { not: null },
      classId: { not: null },
    },
    select: { classId: true },
    distinct: ["classId"],
  });
  return new Set(rows.map((r) => r.classId).filter((c): c is string => Boolean(c)));
}

/** Jenis status yang tersimpan (untuk pemeriksaan tipe di UI). */
export type StoredStatus = AttendanceStatusValue;
