"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { guard, requestMeta, flattenZodErrors } from "@/lib/action-guard";
import type { ActionResult } from "@/lib/action-result";
import {
  scheduleCreateSchema,
  scheduleUpdateSchema,
} from "@/lib/validations/schedule";
import { findConflicts } from "@/lib/schedule-conflict";
import { listSchedules, toEntries } from "@/lib/data/schedule";

/**
 * Server Actions Jadwal (Schedule).
 *
 * INTI FASE INI: setiap create/update WAJIB lewat pengecekan bentrok.
 * Guru yang sama tidak boleh mengajar dua kelas pada hari+jam yang sama,
 * dan satu kelas tidak boleh punya dua mapel pada hari+jam yang sama.
 */

/** Pastikan kelas, mapel, guru, dan jam pelajaran milik sekolah ini. */
async function validateRefs(
  schoolId: string,
  d: { classId: string; subjectId: string; teacherId: string; timeSlotId: string },
): Promise<string | null> {
  const [cls, subject, teacher, slot] = await Promise.all([
    prisma.class.findFirst({
      where: { id: d.classId, schoolId, deletedAt: null },
      select: { id: true },
    }),
    prisma.subject.findFirst({
      where: { id: d.subjectId, schoolId, deletedAt: null },
      select: { id: true },
    }),
    prisma.teacher.findFirst({
      where: { id: d.teacherId, schoolId, deletedAt: null },
      select: { id: true },
    }),
    prisma.timeSlot.findFirst({
      where: { id: d.timeSlotId, schoolId },
      select: { id: true },
    }),
  ]);

  if (!cls) return "Kelas tidak ditemukan.";
  if (!subject) return "Mata pelajaran tidak ditemukan.";
  if (!teacher) return "Guru tidak ditemukan.";
  if (!slot) return "Jam pelajaran tidak ditemukan.";
  return null;
}

export async function createSchedule(
  formData: FormData,
): Promise<ActionResult> {
  const g = await guard("academic", "manage");
  if ("fail" in g) return g.fail;
  const { schoolId, userId } = g.ctx;

  const parsed = scheduleCreateSchema.safeParse(
    Object.fromEntries(formData.entries()),
  );
  if (!parsed.success) {
    return {
      ok: false,
      error: "Periksa kembali isian yang ditandai.",
      fieldErrors: flattenZodErrors(parsed.error),
    };
  }
  const d = parsed.data;

  const refError = await validateRefs(schoolId, d);
  if (refError) return { ok: false, error: refError };

  // ==== CEK BENTROK ====
  const all = await listSchedules(schoolId);
  const conflicts = findConflicts(
    {
      classId: d.classId,
      teacherId: d.teacherId,
      dayOfWeek: d.dayOfWeek,
      timeSlotId: d.timeSlotId,
    },
    toEntries(all),
  );
  if (conflicts.length > 0) {
    return {
      ok: false,
      error: conflicts.map((c) => c.message).join(" "),
      fieldErrors: {
        teacherId: conflicts.some((c) => c.type === "TEACHER")
          ? ["Bentrok jadwal guru"]
          : [],
        timeSlotId: conflicts.some((c) => c.type === "CLASS")
          ? ["Bentrok jadwal kelas"]
          : [],
      },
    };
  }

  const meta = await requestMeta();
  const created = await prisma.schedule.create({
    data: {
      schoolId, // isolasi tenant
      classId: d.classId,
      subjectId: d.subjectId,
      teacherId: d.teacherId,
      dayOfWeek: d.dayOfWeek,
      timeSlotId: d.timeSlotId,
      room: d.room ?? null,
    },
    select: { id: true },
  });

  await recordAudit({
    schoolId,
    userId,
    action: "CREATE",
    entity: "Schedule",
    entityId: created.id,
    after: { ...d },
    ...meta,
  });

  revalidatePath("/dashboard/academic/schedules");
  return { ok: true, id: created.id, message: "Jadwal ditambahkan." };
}

export async function updateSchedule(
  formData: FormData,
): Promise<ActionResult> {
  const g = await guard("academic", "manage");
  if ("fail" in g) return g.fail;
  const { schoolId, userId } = g.ctx;

  const parsed = scheduleUpdateSchema.safeParse(
    Object.fromEntries(formData.entries()),
  );
  if (!parsed.success) {
    return {
      ok: false,
      error: "Periksa kembali isian yang ditandai.",
      fieldErrors: flattenZodErrors(parsed.error),
    };
  }
  const { id, ...d } = parsed.data;

  const existing = await prisma.schedule.findFirst({
    where: { id, schoolId },
  });
  if (!existing) return { ok: false, error: "Jadwal tidak ditemukan." };

  const refError = await validateRefs(schoolId, d);
  if (refError) return { ok: false, error: refError };

  // Cek bentrok, mengabaikan entri ini sendiri.
  const all = await listSchedules(schoolId);
  const conflicts = findConflicts(
    {
      id,
      classId: d.classId,
      teacherId: d.teacherId,
      dayOfWeek: d.dayOfWeek,
      timeSlotId: d.timeSlotId,
    },
    toEntries(all),
  );
  if (conflicts.length > 0) {
    return {
      ok: false,
      error: conflicts.map((c) => c.message).join(" "),
    };
  }

  const meta = await requestMeta();
  await prisma.schedule.update({
    where: { id },
    data: {
      classId: d.classId,
      subjectId: d.subjectId,
      teacherId: d.teacherId,
      dayOfWeek: d.dayOfWeek,
      timeSlotId: d.timeSlotId,
      room: d.room ?? null,
    },
  });

  await recordAudit({
    schoolId,
    userId,
    action: "UPDATE",
    entity: "Schedule",
    entityId: id,
    before: {
      classId: existing.classId,
      dayOfWeek: existing.dayOfWeek,
      timeSlotId: existing.timeSlotId,
    },
    after: { ...d },
    ...meta,
  });

  revalidatePath("/dashboard/academic/schedules");
  return { ok: true, id, message: "Jadwal disimpan." };
}

export async function deleteSchedule(id: string): Promise<ActionResult> {
  const g = await guard("academic", "manage");
  if ("fail" in g) return g.fail;
  const { schoolId, userId } = g.ctx;

  const existing = await prisma.schedule.findFirst({
    where: { id, schoolId },
    include: {
      class: { select: { name: true } },
      subject: { select: { name: true } },
      timeSlot: { select: { slotNumber: true } },
    },
  });
  if (!existing) return { ok: false, error: "Jadwal tidak ditemukan." };

  const meta = await requestMeta();
  await prisma.schedule.delete({ where: { id } });

  await recordAudit({
    schoolId,
    userId,
    action: "DELETE",
    entity: "Schedule",
    entityId: id,
    before: {
      class: existing.class.name,
      subject: existing.subject.name,
      slot: existing.timeSlot?.slotNumber,
    },
    ...meta,
  });

  revalidatePath("/dashboard/academic/schedules");
  return { ok: true, message: "Jadwal dihapus." };
}
