"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { recordAudit } from "@/lib/audit";
import { requestMeta } from "@/lib/action-guard";
import { batalkanKwitansi } from "@/lib/kwitansi";
import type { ActionResult } from "@/lib/action-result";

/**
 * Batalkan kwitansi.
 *
 * Kwitansi TIDAK dihapus dan nomornya TIDAK dipakai ulang — jejak audit harus
 * utuh. Cetakan lama yang sudah dipegang orang tua tetap bisa dicetak ulang
 * dengan tanda "DIBATALKAN", supaya tidak bisa dipakai mengeklaim pembayaran
 * yang sama dua kali.
 *
 * Hanya role dengan izin `finance: manage` yang boleh membatalkan.
 */
export async function batalkanKwitansiAksi(
  formData: FormData,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.schoolId) {
    return { ok: false, error: "Sesi tidak ditemukan." };
  }
  if (!can(session.user.role, "finance", "manage", session.user.permissions)) {
    return { ok: false, error: "Anda tidak berwenang membatalkan kwitansi." };
  }

  const receiptId = String(formData.get("receiptId") ?? "");
  const alasan = String(formData.get("alasan") ?? "");

  if (!receiptId) return { ok: false, error: "Kwitansi tidak diketahui." };
  // Alasan WAJIB: pembatalan dokumen resmi tanpa alasan membuat audit tidak
  // berguna saat pemeriksaan.
  if (alasan.trim().length < 5) {
    return {
      ok: false,
      error: "Alasan pembatalan wajib diisi (minimal 5 karakter).",
      fieldErrors: { alasan: ["Alasan terlalu pendek"] },
    };
  }

  const schoolId = session.user.schoolId;

  // Pastikan kwitansi milik sekolah ini sebelum dibatalkan.
  const ada = await prisma.receipt.findFirst({
    where: { id: receiptId, schoolId },
    select: { id: true, receiptNo: true, cancelledAt: true },
  });
  if (!ada) return { ok: false, error: "Kwitansi tidak ditemukan." };
  if (ada.cancelledAt) {
    return { ok: false, error: "Kwitansi ini sudah dibatalkan." };
  }

  const hasil = await batalkanKwitansi({ schoolId, receiptId, alasan });
  if (!hasil.ok) return { ok: false, error: hasil.error ?? "Gagal membatalkan." };

  const meta = await requestMeta();
  await recordAudit({
    schoolId,
    userId: session.user.id,
    action: "UPDATE",
    entity: "Receipt",
    entityId: receiptId,
    before: { cancelledAt: null },
    after: { cancelledAt: new Date().toISOString(), alasan: alasan.trim() },
    ...meta,
  });

  revalidatePath("/dashboard/finance/invoices");
  return { ok: true, message: `Kwitansi ${ada.receiptNo} dibatalkan.` };
}
