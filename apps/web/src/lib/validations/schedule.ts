import { z } from "zod";
import { optionalText, optionalId } from "./common";

/**
 * Validasi Jam Pelajaran (TimeSlot) & Jadwal (Schedule).
 */

/* ============================================================
 * JAM PELAJARAN
 * ============================================================ */

/** Format "HH:MM" 24 jam. */
const timeField = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Format jam: HH:MM (contoh 07:30)");

export const timeSlotCreateSchema = z
  .object({
    slotNumber: z.coerce
      .number()
      .int("Jam ke- harus bilangan bulat")
      .min(1, "Minimal jam ke-1")
      .max(20, "Maksimal jam ke-20"),
    startTime: timeField,
    endTime: timeField,
    label: optionalText(40),
  })
  .refine((d) => d.endTime > d.startTime, {
    message: "Jam selesai harus setelah jam mulai",
    path: ["endTime"],
  });

export const timeSlotUpdateSchema = timeSlotCreateSchema;

export type TimeSlotInput = z.infer<typeof timeSlotCreateSchema>;

/* ============================================================
 * JADWAL
 * ============================================================ */

/** 1=Senin … 7=Minggu. Sekolah umumnya Senin–Sabtu. */
export const DAYS = [1, 2, 3, 4, 5, 6, 7] as const;
export type DayOfWeek = (typeof DAYS)[number];

export const DAY_LABEL: Record<DayOfWeek, string> = {
  1: "Senin",
  2: "Selasa",
  3: "Rabu",
  4: "Kamis",
  5: "Jumat",
  6: "Sabtu",
  7: "Minggu",
};

export const DAY_SHORT: Record<DayOfWeek, string> = {
  1: "Sen",
  2: "Sel",
  3: "Rab",
  4: "Kam",
  5: "Jum",
  6: "Sab",
  7: "Min",
};

export const scheduleCreateSchema = z.object({
  classId: z.string().min(1, "Pilih kelas"),
  subjectId: z.string().min(1, "Pilih mata pelajaran"),
  teacherId: z.string().min(1, "Pilih guru pengampu"),
  dayOfWeek: z.coerce.number().int().min(1).max(7),
  timeSlotId: z.string().min(1, "Pilih jam pelajaran"),
  room: optionalText(40),
});

export const scheduleUpdateSchema = scheduleCreateSchema.extend({
  id: z.string().min(1),
});

export type ScheduleInput = z.infer<typeof scheduleCreateSchema>;

/** Filter tampilan jadwal. */
export const scheduleViewSchema = z.object({
  classId: optionalId,
  teacherId: optionalId,
});
