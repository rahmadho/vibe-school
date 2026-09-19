import { z } from "zod";

/**
 * Validasi Absensi.
 *
 * Model input: guru/admin memilih kelas + tanggal, lalu seluruh siswa di kelas
 * itu ditampilkan dan statusnya diisi sekaligus (absensi massal). Ini lebih
 * cepat daripada menyimpan satu per satu.
 */

export const ATTENDANCE_STATUSES = [
  "PRESENT",
  "LATE",
  "SICK",
  "EXCUSED",
  "ABSENT",
] as const;

export type AttendanceStatusValue = (typeof ATTENDANCE_STATUSES)[number];

export const ATTENDANCE_LABEL: Record<AttendanceStatusValue, string> = {
  PRESENT: "Hadir",
  LATE: "Terlambat",
  SICK: "Sakit",
  EXCUSED: "Izin",
  ABSENT: "Alpa",
};

/** Singkatan 1 huruf untuk tampilan ringkas (H/T/S/I/A). */
export const ATTENDANCE_CODE: Record<AttendanceStatusValue, string> = {
  PRESENT: "H",
  LATE: "T",
  SICK: "S",
  EXCUSED: "I",
  ABSENT: "A",
};

/** Status yang dianggap "tidak hadir" — dasar peringatan ke orang tua. */
export const NOT_PRESENT: AttendanceStatusValue[] = ["SICK", "EXCUSED", "ABSENT"];

/** Status yang perlu diberitahukan ke orang tua (alpa tanpa kabar). */
export const NEEDS_NOTIFICATION: AttendanceStatusValue[] = ["ABSENT", "LATE"];

/** Satu baris isian absensi. */
export const attendanceEntrySchema = z.object({
  studentId: z.string().min(1),
  status: z.enum(ATTENDANCE_STATUSES),
  note: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
});

/** Payload simpan absensi massal satu kelas pada satu tanggal. */
export const attendanceBulkSchema = z.object({
  classId: z.string().min(1, "Pilih kelas"),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal: YYYY-MM-DD"),
  scheduleId: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v === "" || v === undefined ? undefined : v)),
  entries: z.array(attendanceEntrySchema).min(1, "Tidak ada siswa untuk disimpan"),
});

export type AttendanceBulkInput = z.infer<typeof attendanceBulkSchema>;

/** Filter rekap absensi. */
export const attendanceFilterSchema = z.object({
  classId: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v === "" || v === undefined ? undefined : v)),
  from: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v === "" || v === undefined ? undefined : v)),
  to: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v === "" || v === undefined ? undefined : v)),
});
