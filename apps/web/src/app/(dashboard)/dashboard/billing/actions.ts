"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { requestMeta } from "@/lib/action-guard";
import type { ActionResult } from "@/lib/action-result";
import { buatPesananPaket, normalisasiBulan } from "@/lib/plan-order";

/**
 * Aksi halaman Langganan (admin sekolah).
 *
 * `schoolId` SELALU dari sesi, tidak pernah dari input form: kalau dibaca dari
 * form, satu sekolah bisa mengajukan perpanjangan atas nama sekolah lain.
 *
 * RBAC: `billing:read` cukup untuk MENGAJUKAN pesanan. Ini sengaja berbeda
 * dari `assignSubscription` (super-admin) yang langsung mengubah paket —
 * mengajukan bukan menyetujui. Persetujuan tetap di tangan super-admin
 * (`approvePlanOrder`), baik lewat gateway maupun manual.
 */
export async function orderPlan(formData: FormData): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Sesi berakhir. Silakan masuk lagi." };
  if (!session.user.schoolId) {
    return { ok: false, error: "Akun ini tidak terhubung ke sekolah." };
  }
  if (!can(session.user.role, "billing", "read", session.user.permissions)) {
    return { ok: false, error: "Anda tidak punya izin untuk tindakan ini." };
  }

  const schoolId = session.user.schoolId;
  const planId = String(formData.get("planId") ?? "");
  if (!planId) return { ok: false, error: "Paket belum dipilih." };
  const months = normalisasiBulan(formData.get("months"));

  const school = await prisma.school.findFirst({
    where: { id: schoolId, deletedAt: null },
    select: { name: true, email: true, phone: true },
  });
  if (!school) return { ok: false, error: "Sekolah tidak ditemukan." };

  const hasil = await buatPesananPaket({
    schoolId,
    planId,
    months,
    userId: session.user.id,
    schoolName: school.name,
    contactEmail: school.email,
    contactPhone: school.phone,
  });

  if (!hasil.ok) return { ok: false, error: hasil.error };

  const meta = await requestMeta();
  await recordAudit({
    schoolId,
    userId: session.user.id,
    action: "CREATE",
    entity: "PlanOrder",
    entityId: hasil.orderId,
    after: { planId, months, mode: hasil.mode },
    ...meta,
  });

  revalidatePath("/dashboard/billing");
  return { ok: true, id: hasil.orderId, message: hasil.message };
}
