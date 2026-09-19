"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { guard, requestMeta, flattenZodErrors } from "@/lib/action-guard";
import type { ActionResult } from "@/lib/action-result";
import { timeSlotCreateSchema } from "@/lib/validations/schedule";

/**
 * Server Actions Jam Pelajaran (TimeSlot).
 * Jam pelajaran adalah master data per sekolah — akses via modul "academic".
 */

export async function createTimeSlot(
  formData: FormData,
): Promise<ActionResult> {
  const g = await guard("academic", "manage");
  if ("fail" in g) return g.fail;
  const { schoolId, userId } = g.ctx;

  const parsed = timeSlotCreateSchema.safeParse(
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

  // Nomor jam harus unik per sekolah.
  const dup = await prisma.timeSlot.findFirst({
    where: { schoolId, slotNumber: d.slotNumber },
    select: { id: true },
  });
  if (dup) {
    return {
      ok: false,
      error: `Jam ke-${d.slotNumber} sudah ada.`,
      fieldErrors: { slotNumber: ["Nomor jam sudah dipakai"] },
    };
  }

  const meta = await requestMeta();
  const created = await prisma.timeSlot.create({
    data: {
      schoolId, // isolasi tenant
      slotNumber: d.slotNumber,
      startTime: d.startTime,
      endTime: d.endTime,
      label: d.label ?? null,
    },
    select: { id: true },
  });

  await recordAudit({
    schoolId,
    userId,
    action: "CREATE",
    entity: "TimeSlot",
    entityId: created.id,
    after: {
      slotNumber: d.slotNumber,
      startTime: d.startTime,
      endTime: d.endTime,
    },
    ...meta,
  });

  revalidatePath("/dashboard/academic/time-slots");
  return { ok: true, id: created.id, message: "Jam pelajaran ditambahkan." };
}

export async function updateTimeSlot(
  formData: FormData,
): Promise<ActionResult> {
  const g = await guard("academic", "manage");
  if ("fail" in g) return g.fail;
  const { schoolId, userId } = g.ctx;

  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "ID jam pelajaran tidak ada." };

  const parsed = timeSlotCreateSchema.safeParse(
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

  const existing = await prisma.timeSlot.findFirst({
    where: { id, schoolId },
  });
  if (!existing) return { ok: false, error: "Jam pelajaran tidak ditemukan." };

  const dup = await prisma.timeSlot.findFirst({
    where: { schoolId, slotNumber: d.slotNumber, id: { not: id } },
    select: { id: true },
  });
  if (dup) {
    return {
      ok: false,
      error: `Jam ke-${d.slotNumber} sudah ada.`,
      fieldErrors: { slotNumber: ["Nomor jam sudah dipakai"] },
    };
  }

  const meta = await requestMeta();
  await prisma.timeSlot.update({
    where: { id },
    data: {
      slotNumber: d.slotNumber,
      startTime: d.startTime,
      endTime: d.endTime,
      label: d.label ?? null,
    },
  });

  await recordAudit({
    schoolId,
    userId,
    action: "UPDATE",
    entity: "TimeSlot",
    entityId: id,
    before: { slotNumber: existing.slotNumber, startTime: existing.startTime },
    after: { slotNumber: d.slotNumber, startTime: d.startTime },
    ...meta,
  });

  revalidatePath("/dashboard/academic/time-slots");
  revalidatePath("/dashboard/academic/schedules");
  return { ok: true, id, message: "Jam pelajaran disimpan." };
}

export async function deleteTimeSlot(id: string): Promise<ActionResult> {
  const g = await guard("academic", "manage");
  if ("fail" in g) return g.fail;
  const { schoolId, userId } = g.ctx;

  const existing = await prisma.timeSlot.findFirst({
    where: { id, schoolId },
  });
  if (!existing) return { ok: false, error: "Jam pelajaran tidak ditemukan." };

  // Tolak hapus bila masih dipakai jadwal — cegah jadwal menggantung.
  const used = await prisma.schedule.count({ where: { schoolId, timeSlotId: id } });
  if (used > 0) {
    return {
      ok: false,
      error: `Masih dipakai ${used} jadwal. Hapus atau ubah jadwal itu dulu.`,
    };
  }

  const meta = await requestMeta();
  await prisma.timeSlot.delete({ where: { id } });

  await recordAudit({
    schoolId,
    userId,
    action: "DELETE",
    entity: "TimeSlot",
    entityId: id,
    before: { slotNumber: existing.slotNumber },
    ...meta,
  });

  revalidatePath("/dashboard/academic/time-slots");
  return { ok: true, message: "Jam pelajaran dihapus." };
}

/** Buat jam pelajaran standar (mis. 8 jam × 45 menit) sekali klik. */
export async function seedDefaultTimeSlots(): Promise<ActionResult> {
  const g = await guard("academic", "manage");
  if ("fail" in g) return g.fail;
  const { schoolId, userId } = g.ctx;

  const existingCount = await prisma.timeSlot.count({ where: { schoolId } });
  if (existingCount > 0) {
    return {
      ok: false,
      error: "Jam pelajaran sudah ada. Hapus semuanya dulu bila ingin membuat ulang.",
    };
  }

  // 07:00 mulai, 45 menit per jam, tanpa jeda otomatis.
  const startHour = 7;
  const durationMin = 45;
  const count = 8;

  const rows = Array.from({ length: count }, (_, i) => {
    const startTotal = startHour * 60 + i * durationMin;
    const endTotal = startTotal + durationMin;
    const fmt = (m: number) =>
      `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    return {
      schoolId,
      slotNumber: i + 1,
      startTime: fmt(startTotal),
      endTime: fmt(endTotal),
      label: null,
    };
  });

  await prisma.timeSlot.createMany({ data: rows });

  const meta = await requestMeta();
  await recordAudit({
    schoolId,
    userId,
    action: "CREATE",
    entity: "TimeSlot",
    after: { created: count, pattern: `${startHour}:00 + ${durationMin} menit` },
    ...meta,
  });

  revalidatePath("/dashboard/academic/time-slots");
  return { ok: true, message: `${count} jam pelajaran dibuat.` };
}
