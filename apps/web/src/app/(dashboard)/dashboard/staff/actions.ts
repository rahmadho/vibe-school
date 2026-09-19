"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { guard, requestMeta, flattenZodErrors } from "@/lib/action-guard";
import type { ActionResult } from "@/lib/action-result";
import {
  staffCreateSchema,
  staffUpdateSchema,
} from "@/lib/validations/personnel";

/** Server Actions Staf — pola sama dengan Guru (tanpa relasi mapel). */

export async function createStaff(formData: FormData): Promise<ActionResult> {
  const g = await guard("teachers", "manage");
  if ("fail" in g) return g.fail;
  const { schoolId, userId } = g.ctx;

  const raw = Object.fromEntries(formData.entries());
  const parsed = staffCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Periksa kembali isian yang ditandai.",
      fieldErrors: flattenZodErrors(parsed.error),
    };
  }
  const d = parsed.data;

  if (d.nip) {
    const dup = await prisma.staff.findFirst({
      where: { schoolId, nip: d.nip },
      select: { id: true },
    });
    if (dup) {
      return {
        ok: false,
        error: "NIP sudah dipakai staf lain.",
        fieldErrors: { nip: ["NIP sudah dipakai"] },
      };
    }
  }

  const meta = await requestMeta();
  const created = await prisma.staff.create({
    data: {
      schoolId,
      nip: d.nip ?? null,
      fullName: d.fullName,
      position: d.position ?? null,
      phone: d.phone ?? null,
      email: d.email ?? null,
      isActive: d.isActive,
    },
    select: { id: true },
  });

  await recordAudit({
    schoolId,
    userId,
    action: "CREATE",
    entity: "Staff",
    entityId: created.id,
    after: { fullName: d.fullName, position: d.position ?? null },
    ...meta,
  });

  revalidatePath("/dashboard/staff");
  return { ok: true, id: created.id, message: "Staf ditambahkan." };
}

export async function updateStaff(formData: FormData): Promise<ActionResult> {
  const g = await guard("teachers", "manage");
  if ("fail" in g) return g.fail;
  const { schoolId, userId } = g.ctx;

  const raw = Object.fromEntries(formData.entries());
  const parsed = staffUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Periksa kembali isian yang ditandai.",
      fieldErrors: flattenZodErrors(parsed.error),
    };
  }
  const { id, ...d } = parsed.data;

  const existing = await prisma.staff.findFirst({
    where: { id, schoolId, deletedAt: null },
  });
  if (!existing) return { ok: false, error: "Staf tidak ditemukan." };

  if (d.nip) {
    const dup = await prisma.staff.findFirst({
      where: { schoolId, nip: d.nip, id: { not: id } },
      select: { id: true },
    });
    if (dup) {
      return {
        ok: false,
        error: "NIP sudah dipakai staf lain.",
        fieldErrors: { nip: ["NIP sudah dipakai"] },
      };
    }
  }

  const meta = await requestMeta();
  await prisma.staff.update({
    where: { id },
    data: {
      nip: d.nip ?? null,
      fullName: d.fullName,
      position: d.position ?? null,
      phone: d.phone ?? null,
      email: d.email ?? null,
      isActive: d.isActive,
    },
  });

  await recordAudit({
    schoolId,
    userId,
    action: "UPDATE",
    entity: "Staff",
    entityId: id,
    before: { fullName: existing.fullName },
    after: { fullName: d.fullName },
    ...meta,
  });

  revalidatePath("/dashboard/staff");
  revalidatePath(`/dashboard/staff/${id}`);
  return { ok: true, id, message: "Perubahan disimpan." };
}

export async function softDeleteStaff(id: string): Promise<ActionResult> {
  const g = await guard("teachers", "manage");
  if ("fail" in g) return g.fail;

  const existing = await prisma.staff.findFirst({
    where: { id, schoolId: g.ctx.schoolId, deletedAt: null },
  });
  if (!existing) return { ok: false, error: "Staf tidak ditemukan." };

  const meta = await requestMeta();
  await prisma.staff.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  });

  await recordAudit({
    schoolId: g.ctx.schoolId,
    userId: g.ctx.userId,
    action: "DELETE",
    entity: "Staff",
    entityId: id,
    before: { fullName: existing.fullName },
    ...meta,
  });

  revalidatePath("/dashboard/staff");
  return { ok: true, message: "Staf dinonaktifkan." };
}
