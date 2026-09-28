"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { recordAudit } from "@/lib/audit";
import { requestMeta } from "@/lib/action-guard";
import { terbitkanKwitansi } from "@/lib/kwitansi";

/**
 * Terbitkan kwitansi untuk sebuah pembayaran (dipanggil tombol "Cetak").
 *
 * Aksi ini TIDAK mengembalikan berkas PDF — hanya nomornya. PDF-nya diunduh
 * dari route terpisah (`/api/kwitansi/[paymentId]`), supaya:
 *   - nomor sudah terkunci di DB sebelum berkas dibuat,
 *   - pengunduhan bisa diuji & diotorisasi sendiri,
 *   - halaman tidak perlu menahan proses pembuatan PDF.
 *
 * IDEMPOTEN: memanggil dua kali mengembalikan nomor yang SAMA.
 */
export async function terbitkanKwitansiAksi(paymentId: string): Promise<
  | { ok: true; receiptNo: string; sudahAda: boolean }
  | { ok: false; error: string }
> {
  const session = await auth();
  if (!session?.user?.schoolId) {
    return { ok: false, error: "Sesi tidak ditemukan." };
  }
  if (!can(session.user.role, "finance", "read", session.user.permissions)) {
    return { ok: false, error: "Anda tidak punya akses ke modul keuangan." };
  }

  const schoolId = session.user.schoolId;

  // Pastikan pembayaran ini milik sekolah pengguna — jangan sampai staf
  // sekolah A mencetak kwitansi sekolah B lewat ID yang ditebak.
  const bayar = await prisma.payment.findFirst({
    where: { id: paymentId, schoolId },
    select: { id: true, amount: true },
  });
  if (!bayar) return { ok: false, error: "Pembayaran tidak ditemukan." };
  if (bayar.amount <= 0) {
    return { ok: false, error: "Pembayaran bernilai nol tidak diterbitkan kwitansi." };
  }

  const hasil = await terbitkanKwitansi({
    schoolId,
    paymentId,
    userId: session.user.id,
  });
  if (!hasil.ok) return hasil;

  // Catat hanya saat kwitansi BARU terbit — mengulang cetak bukan kejadian
  // yang perlu memenuhi log audit.
  if (!hasil.sudahAda) {
    const meta = await requestMeta();
    await recordAudit({
      schoolId,
      userId: session.user.id,
      action: "CREATE",
      entity: "Receipt",
      entityId: hasil.id,
      after: { receiptNo: hasil.receiptNo, paymentId },
      ...meta,
    });
  }

  return { ok: true, receiptNo: hasil.receiptNo, sudahAda: hasil.sudahAda };
}
