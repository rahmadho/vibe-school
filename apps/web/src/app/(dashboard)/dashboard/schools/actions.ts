"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { recordAudit } from "@/lib/audit";
import { guard, requirePermission, requestMeta, flattenZodErrors } from "@/lib/action-guard";
import type { ActionResult } from "@/lib/action-result";
import {
  schoolCreateSchema,
  schoolUpdateSchema,
} from "@/lib/validations/school";
import { slugExists, domainExists } from "@/lib/data/schools";

/**
 * Server Actions Sekolah — KHUSUS SUPER_ADMIN.
 *
 * Ini satu-satunya tempat yang boleh membuat sekolah lintas-tenant. Karena itu
 * guard memakai modul "schools" (hanya SUPER_ADMIN yang punya izin manage).
 *
 * Penting: operasi ini TIDAK memakai scopedDb karena schoolId belum ada saat
 * sekolah baru dibuat.
 */

export async function createSchool(
  formData: FormData,
): Promise<ActionResult> {
  const g = await guard("schools", "manage");
  if ("fail" in g) return g.fail;

  const parsed = schoolCreateSchema.safeParse(
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

  if (await slugExists(d.slug)) {
    return {
      ok: false,
      error: "Slug sudah dipakai sekolah lain.",
      fieldErrors: { slug: ["Slug sudah dipakai"] },
    };
  }
  if (d.customDomain && (await domainExists(d.customDomain))) {
    return {
      ok: false,
      error: "Domain sudah dipakai sekolah lain.",
      fieldErrors: { customDomain: ["Domain sudah dipakai"] },
    };
  }

  // Admin pertama wajib lengkap ketiganya bila diisi sebagian.
  const hasAdminPartial = Boolean(d.adminName || d.adminEmail || d.adminPassword);
  const hasAdminFull = Boolean(d.adminName && d.adminEmail && d.adminPassword);
  if (hasAdminPartial && !hasAdminFull) {
    return {
      ok: false,
      error:
        "Bila membuat akun admin, isi nama, email, dan password sekaligus.",
    };
  }

  const meta = await requestMeta();

  const result = await prisma.$transaction(async (tx) => {
    const school = await tx.school.create({
      data: {
        name: d.name,
        slug: d.slug,
        npsn: d.npsn ?? null,
        level: d.level,
        address: d.address ?? null,
        phone: d.phone ?? null,
        email: d.email ?? null,
        timezone: d.timezone,
        themeColor: d.themeColor ?? null,
        customDomain: d.customDomain ?? null,
        waSenderName: d.waSenderName ?? null,
      },
      select: { id: true },
    });

    let adminId: string | null = null;
    if (hasAdminFull) {
      const admin = await tx.user.create({
        data: {
          schoolId: school.id,
          name: d.adminName!,
          email: d.adminEmail!,
          passwordHash: await hashPassword(d.adminPassword!),
          role: "SCHOOL_ADMIN",
          isActive: true,
        },
        select: { id: true },
      });
      adminId = admin.id;
    }

    return { schoolId: school.id, adminId };
  });

  await recordAudit({
    schoolId: result.schoolId,
    userId: g.ctx.userId,
    action: "CREATE",
    entity: "School",
    entityId: result.schoolId,
    after: {
      name: d.name,
      slug: d.slug,
      level: d.level,
      adminDibuat: Boolean(result.adminId),
    },
    ...meta,
  });

  revalidatePath("/dashboard/schools");
  return { ok: true, id: result.schoolId, message: "Sekolah dibuat." };
}

export async function updateSchool(
  formData: FormData,
): Promise<ActionResult> {
  const g = await guard("schools", "manage");
  if ("fail" in g) return g.fail;

  const parsed = schoolUpdateSchema.safeParse(
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

  const existing = await prisma.school.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) return { ok: false, error: "Sekolah tidak ditemukan." };

  if (d.customDomain && (await domainExists(d.customDomain, id))) {
    return {
      ok: false,
      error: "Domain sudah dipakai sekolah lain.",
      fieldErrors: { customDomain: ["Domain sudah dipakai"] },
    };
  }

  const meta = await requestMeta();
  await prisma.school.update({
    where: { id },
    data: {
      name: d.name,
      npsn: d.npsn ?? null,
      level: d.level,
      address: d.address ?? null,
      phone: d.phone ?? null,
      email: d.email ?? null,
      timezone: d.timezone,
      themeColor: d.themeColor ?? null,
      customDomain: d.customDomain ?? null,
      waSenderName: d.waSenderName ?? null,
      isActive: d.isActive,
    },
  });

  await recordAudit({
    schoolId: id,
    userId: g.ctx.userId,
    action: "UPDATE",
    entity: "School",
    entityId: id,
    before: { name: existing.name, themeColor: existing.themeColor },
    after: { name: d.name, themeColor: d.themeColor ?? null },
    ...meta,
  });

  revalidatePath("/dashboard/schools");
  revalidatePath(`/dashboard/schools/${id}`);
  return { ok: true, id, message: "Data sekolah disimpan." };
}

/** Aktifkan / nonaktifkan sekolah. */
export async function toggleSchoolActive(id: string): Promise<ActionResult> {
  const g = await guard("schools", "manage");
  if ("fail" in g) return g.fail;

  const existing = await prisma.school.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, name: true, isActive: true },
  });
  if (!existing) return { ok: false, error: "Sekolah tidak ditemukan." };

  const meta = await requestMeta();
  await prisma.school.update({
    where: { id },
    data: { isActive: !existing.isActive },
  });

  await recordAudit({
    schoolId: id,
    userId: g.ctx.userId,
    action: "UPDATE",
    entity: "School",
    entityId: id,
    before: { isActive: existing.isActive },
    after: { isActive: !existing.isActive },
    ...meta,
  });

  revalidatePath("/dashboard/schools");
  revalidatePath(`/dashboard/schools/${id}`);
  return {
    ok: true,
    message: !existing.isActive
      ? `${existing.name} diaktifkan.`
      : `${existing.name} dinonaktifkan.`,
  };
}

/** Tetapkan paket langganan ke sekolah. */
export async function assignSubscription(
  formData: FormData,
): Promise<ActionResult> {
  const g = await guard("billing", "manage");
  if ("fail" in g) return g.fail;

  const schoolId = String(formData.get("schoolId") ?? "");
  const planId = String(formData.get("planId") ?? "");
  const monthsRaw = Number(formData.get("months") ?? 12);

  if (!schoolId || !planId) {
    return { ok: false, error: "Sekolah dan paket wajib dipilih." };
  }
  const months = Number.isFinite(monthsRaw) && monthsRaw > 0 ? monthsRaw : 12;

  const [school, plan] = await Promise.all([
    prisma.school.findFirst({ where: { id: schoolId, deletedAt: null } }),
    prisma.plan.findFirst({ where: { id: planId, isActive: true } }),
  ]);
  if (!school) return { ok: false, error: "Sekolah tidak ditemukan." };
  if (!plan) return { ok: false, error: "Paket tidak ditemukan." };

  const startedAt = new Date();
  const expiresAt = new Date(startedAt);
  expiresAt.setMonth(expiresAt.getMonth() + months);

  const meta = await requestMeta();
  await prisma.subscription.upsert({
    where: { schoolId },
    create: {
      schoolId,
      planId,
      status: "ACTIVE",
      startedAt,
      expiresAt,
    },
    update: {
      planId,
      status: "ACTIVE",
      startedAt,
      expiresAt,
    },
  });

  await recordAudit({
    schoolId,
    userId: g.ctx.userId,
    action: "UPDATE",
    entity: "Subscription",
    entityId: schoolId,
    after: { plan: plan.code, months, expiresAt: expiresAt.toISOString() },
    ...meta,
  });

  revalidatePath(`/dashboard/schools/${schoolId}`);
  return {
    ok: true,
    message: `Paket ${plan.name} ditetapkan untuk ${months} bulan.`,
  };
}

/** Pastikan hanya super-admin (dipakai halaman untuk cek akses). */
export async function assertSuperAdmin(): Promise<boolean> {
  try {
    await requirePermission("schools", "manage");
    return true;
  } catch {
    return false;
  }
}
