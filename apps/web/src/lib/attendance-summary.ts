/**
 * Perhitungan rekap absensi — logika MURNI (tanpa DB) agar mudah diuji.
 *
 * Rekap ini yang dipakai untuk: laporan ke orang tua, rapor, dan peringatan
 * dini siswa yang sering absen.
 */

import {
  ATTENDANCE_STATUSES,
  type AttendanceStatusValue,
} from "@/lib/validations/attendance";

export type AttendanceRecord = {
  studentId: string;
  status: AttendanceStatusValue;
};

export type StudentSummary = {
  studentId: string;
  /** Jumlah per status. */
  counts: Record<AttendanceStatusValue, number>;
  /** Total hari/pertemuan tercatat. */
  total: number;
  /** Hadir + terlambat dianggap "masuk sekolah". */
  presentEquivalent: number;
  /** Persentase kehadiran (0–100), dibulatkan 1 desimal. */
  attendanceRate: number;
};

/** Ringkas catatan absensi satu siswa. */
export function summarize(records: AttendanceRecord[]): StudentSummary {
  const counts = Object.fromEntries(
    ATTENDANCE_STATUSES.map((s) => [s, 0]),
  ) as Record<AttendanceStatusValue, number>;

  for (const r of records) {
    if (counts[r.status] !== undefined) counts[r.status] += 1;
  }

  const total = records.length;
  // Terlambat tetap hadir di sekolah; yang absen dari sekolah hanya
  // SICK/EXCUSED/ABSENT.
  const presentEquivalent = counts.PRESENT + counts.LATE;
  const attendanceRate =
    total === 0 ? 0 : Math.round((presentEquivalent / total) * 1000) / 10;

  return { studentId: records[0]?.studentId ?? "", counts, total, presentEquivalent, attendanceRate };
}

/** Rekap untuk banyak siswa sekaligus. */
export function summarizeAll(
  records: AttendanceRecord[],
): Map<string, StudentSummary> {
  const byStudent = new Map<string, AttendanceRecord[]>();
  for (const r of records) {
    const list = byStudent.get(r.studentId);
    if (list) list.push(r);
    else byStudent.set(r.studentId, [r]);
  }
  const out = new Map<string, StudentSummary>();
  byStudent.forEach((list, studentId) => {
    out.set(studentId, summarize(list));
  });
  return out;
}

/** Ringkasan kelas pada satu hari — untuk kartu statistik. */
export function summarizeDay(records: AttendanceRecord[]) {
  const counts = Object.fromEntries(
    ATTENDANCE_STATUSES.map((s) => [s, 0]),
  ) as Record<AttendanceStatusValue, number>;
  for (const r of records) {
    if (counts[r.status] !== undefined) counts[r.status] += 1;
  }
  const total = records.length;
  const rate =
    total === 0
      ? 0
      : Math.round(((counts.PRESENT + counts.LATE) / total) * 1000) / 10;
  return { counts, total, rate, recorded: total > 0 };
}

/**
 * Apakah siswa perlu diingatkan (sering absen).
 * Ambang: kehadiran < 80% DAN minimal 5 catatan (agar adil untuk data sedikit).
 */
export function needsAttention(s: StudentSummary): boolean {
  return s.total >= 5 && s.attendanceRate < 80;
}

/** Rentang tanggal default: awal bulan ini sampai hari ini (untuk rekap). */
export function defaultRange(today = new Date()): { from: string; to: string } {
  const y = today.getFullYear();
  const m = today.getMonth();
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate(),
    ).padStart(2, "0")}`;
  return { from: fmt(new Date(y, m, 1)), to: fmt(today) };
}
