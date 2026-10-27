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
import { bolehFitur } from "@/lib/entitlement";
import {
  PLAN_ORDER_STATUS_LABEL,
  bolehTransisi,
  hitungExpiresBaru,
} from "@/lib/plan-order";

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
  // Domain sendiri = add-on. Saat CREATE sekolah baru belum punya langganan,
  // jadi tidak mungkin membeli add-on — isian domain ditolak dengan pesan
  // yang jelas (bukan 500). Daftarkan setelah paket + add-on aktif.
  if (d.customDomain) {
    return {
      ok: false,
      error:
        "Domain sendiri adalah add-on berbayar (White-label) dan baru bisa didaftarkan " +
        "setelah sekolah punya paket + add-on. Simpan sekolah dulu, lalu atur domain di halaman Ubah.",
      fieldErrors: { customDomain: ["Perlu add-on White-label"] },
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
        // customDomain sengaja null: domain pendaftaran lewat alur verifikasi
        // (domain-actions.ts), bukan formulir sekolah.
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

  // Domain sendiri = ADD-ON berbayar (whiteLabel). Gerbangnya di sini, bukan di
  // formulir: Server Action bisa dipanggil langsung, dan menyembunyikan input
  // bukan penegakan. Menghapus domain (mengosongkan field) tetap diperbolehkan
  // walau add-on sudah berakhir — pelanggan tidak boleh terjebak memegang domain.
  const domainBerubah = Boolean(d.customDomain) && d.customDomain !== existing.customDomain;
  if (domainBerubah && !(await bolehFitur(id, "whiteLabel"))) {
    return {
      ok: false,
      error:
        "Domain sendiri adalah add-on berbayar (White-label) dan tidak termasuk paket sekolah ini. " +
        "Tambahkan sebagai add-on dari halaman Langganan.",
      fieldErrors: { customDomain: ["Perlu add-on White-label"] },
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
      // Domain hanya diubah bila memang berubah; perubahan sudah lolos gerbang
      // whiteLabel di atas. Domain yang dikosongkan = dihapus (diperbolehkan).
      ...(domainBerubah ? { customDomain: d.customDomain ?? null } : {}),
      ...(domainBerubah && !d.customDomain
        ? { domainVerifyStatus: "UNVERIFIED" as const, domainVerifiedAt: null }
        : {}),
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

/* ============================================================
 * PESANAN PAKET — persetujuan super-admin
 * ============================================================ */

/**
 * Setujui pesanan paket: perpanjang `Subscription.expiresAt` sebanyak `months`.
 *
 * INI yang membuat MODE MANUAL tetap jalan. Kredensial gateway boleh belum
 * ada sama sekali; sekolah tetap bisa mengajukan, dan super-admin
 * mengaktifkannya di sini. Tanpa jalur ini, permintaan manual hanya akan
 * menumpuk sebagai baris PENDING tanpa akibat.
 *
 * Berlaku untuk pesanan PENDING (manual) maupun PAID (sudah dibayar lewat
 * gateway). APPROVED bersifat final — menyetujui dua kali akan memperpanjang
 * dua kali, jadi ditolak oleh `bolehTransisi`.
 */
export async function approvePlanOrder(formData: FormData): Promise<ActionResult> {
  const g = await guard("billing", "manage");
  if ("fail" in g) return g.fail;

  const orderId = String(formData.get("orderId") ?? "");
  if (!orderId) return { ok: false, error: "Pesanan tidak dikenali." };

  const order = await prisma.planOrder.findUnique({
    where: { id: orderId },
    include: { plan: { select: { name: true } } },
  });
  if (!order) return { ok: false, error: "Pesanan tidak ditemukan." };
  if (!bolehTransisi(order.status, "APPROVED")) {
    return {
      ok: false,
      error: `Pesanan berstatus "${PLAN_ORDER_STATUS_LABEL[order.status]}" tidak bisa disetujui lagi.`,
    };
  }

  const sub = await prisma.subscription.findUnique({ where: { schoolId: order.schoolId } });
  const expiresAt = hitungExpiresBaru(sub?.expiresAt ?? null, order.months);
  const sekarang = new Date();
  const meta = await requestMeta();

  // Satu transaksi: status pesanan & langganan harus berubah bersama. Kalau
  // pesanan sudah APPROVED tetapi langganan gagal diperpanjang, tagihan sudah
  // dianggap selesai padahal sekolah tidak mendapat apa pun.
  await prisma.$transaction(async (tx) => {
    await tx.planOrder.update({
      where: { id: order.id },
      data: {
        status: "APPROVED",
        approvedByUserId: g.ctx.userId,
        approvedAt: sekarang,
        // Pesanan manual yang disetujui berarti sudah dibayar (transfer/kesepakatan).
        paidAt: order.paidAt ?? sekarang,
      },
    });

    // Paket mengikuti pesanan: upgrade & perpanjangan adalah alur yang sama.
    await tx.subscription.upsert({
      where: { schoolId: order.schoolId },
      create: {
        schoolId: order.schoolId,
        planId: order.planId,
        status: "ACTIVE",
        startedAt: sekarang,
        expiresAt,
      },
      update: { planId: order.planId, status: "ACTIVE", expiresAt },
    });
  });

  await recordAudit({
    schoolId: order.schoolId,
    userId: g.ctx.userId,
    action: "UPDATE",
    entity: "PlanOrder",
    entityId: order.id,
    before: { status: order.status, expiresAt: sub?.expiresAt.toISOString() ?? null },
    after: {
      status: "APPROVED",
      plan: order.plan.name,
      months: order.months,
      expiresAt: expiresAt.toISOString(),
    },
    ...meta,
  });

  revalidatePath(`/dashboard/schools/${order.schoolId}`);
  revalidatePath("/dashboard/schools");
  return {
    ok: true,
    message: `Pesanan ${order.plan.name} (${order.months} bulan) disetujui. Langganan berlaku sampai ${formatTanggal(expiresAt)}.`,
  };
}

/** Batalkan pesanan yang belum dibayar (manual maupun gateway). */
export async function cancelPlanOrder(formData: FormData): Promise<ActionResult> {
  const g = await guard("billing", "manage");
  if ("fail" in g) return g.fail;

  const orderId = String(formData.get("orderId") ?? "");
  const order = await prisma.planOrder.findUnique({
    where: { id: orderId },
    select: { id: true, schoolId: true, status: true },
  });
  if (!order) return { ok: false, error: "Pesanan tidak ditemukan." };
  if (!bolehTransisi(order.status, "CANCELLED")) {
    return { ok: false, error: "Pesanan ini tidak bisa dibatalkan." };
  }

  const meta = await requestMeta();
  await prisma.planOrder.update({
    where: { id: order.id },
    data: { status: "CANCELLED" },
  });
  await recordAudit({
    schoolId: order.schoolId,
    userId: g.ctx.userId,
    action: "UPDATE",
    entity: "PlanOrder",
    entityId: order.id,
    before: { status: order.status },
    after: { status: "CANCELLED" },
    ...meta,
  });

  revalidatePath(`/dashboard/schools/${order.schoolId}`);
  return { ok: true, message: "Pesanan dibatalkan." };
}

function formatTanggal(d: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
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
