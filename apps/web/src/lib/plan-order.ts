import "server-only";
import type { PlanOrderStatus } from "@prisma/client";
import { loadActiveGateway, createGatewayCharge } from "@/lib/gateway-client";
import { prisma } from "@/lib/prisma";

/**
 * ============================================================
 * PESANAN PAKET LANGGANAN — LOGIKA MURNI
 * ============================================================
 *
 * Dipisah dari Server Action supaya bisa dipakai ulang (super-admin,
 * halaman billing, kelak webhook) dan diuji tanpa DB.
 *
 * ATURAN STATUS (jangan dilonggarkan):
 *
 *   PENDING ──bayar──▶ PAID ──setujui──▶ APPROVED
 *      │                 │
 *      └──batal/lewat────┴──gagal──▶ CANCELLED / EXPIRED / FAILED
 *
 * APPROVED bersifat FINAL: perpanjangan langganan sudah dijalankan. Menyetujui
 * ulang akan memperpanjang DUA kali, jadi transisi keluar dari APPROVED
 * ditolak.
 */

/** Batas bulan agar salah input tidak membuat tagihan tak masuk akal. */
export const MONTHS_MIN = 1;
export const MONTHS_MAX = 36;

export function hitungAmount(pricePerMonth: number, months: number): number {
  const m = Math.min(MONTHS_MAX, Math.max(MONTHS_MIN, Math.trunc(months)));
  // Uang selalu integer rupiah (AGENTS.md aturan #6).
  return Math.round(pricePerMonth) * m;
}

export function normalisasiBulan(months: unknown): number {
  const n = Number(months);
  if (!Number.isFinite(n)) return 12;
  return Math.min(MONTHS_MAX, Math.max(MONTHS_MIN, Math.trunc(n)));
}

export const PLAN_ORDER_STATUS_LABEL: Record<PlanOrderStatus, string> = {
  PENDING: "Menunggu pembayaran",
  PAID: "Sudah dibayar",
  APPROVED: "Disetujui",
  FAILED: "Gagal",
  EXPIRED: "Kedaluwarsa",
  CANCELLED: "Dibatalkan",
};

/** Transisi yang diizinkan. */
const TRANSISI: Record<PlanOrderStatus, PlanOrderStatus[]> = {
  PENDING: ["PAID", "APPROVED", "FAILED", "EXPIRED", "CANCELLED"],
  PAID: ["APPROVED", "CANCELLED"],
  APPROVED: [],
  FAILED: ["PENDING"],
  EXPIRED: ["PENDING"],
  CANCELLED: [],
};

export function bolehTransisi(dari: PlanOrderStatus, ke: PlanOrderStatus): boolean {
  return TRANSISI[dari]?.includes(ke) ?? false;
}

/** Tambah bulan dengan aman pada akhir bulan (31 Jan + 1 bln = 28/29 Feb). */
export function tambahBulan(mulai: Date, months: number): Date {
  const hasil = new Date(mulai);
  const tanggal = hasil.getDate();
  hasil.setMonth(hasil.getMonth() + months);
  // setMonth menggeser ke bulan berikutnya bila tanggal tidak ada (31 Feb →
  // 3 Mar). Kembalikan ke hari terakhir bulan tujuan.
  if (hasil.getDate() !== tanggal) hasil.setDate(0);
  return hasil;
}

/**
 * Tanggal berakhir langganan setelah pesanan disetujui.
 *
 * Mulai dari `expiresAt` LAMA bila masih di masa depan (perpanjangan tidak
 * boleh memotong sisa waktu yang sudah dibayar), atau dari hari ini bila
 * sudah lewat / belum ada langganan.
 */
export function hitungExpiresBaru(
  expiresAtLama: Date | null,
  months: number,
  sekarang: Date = new Date(),
): Date {
  const dasar =
    expiresAtLama && expiresAtLama.getTime() > sekarang.getTime() ? expiresAtLama : sekarang;
  return tambahBulan(dasar, months);
}

/* ============================================================
 * PEMBUATAN PESANAN (gateway atau manual)
 * ============================================================ */

export type HasilPesanan =
  | { ok: true; orderId: string; mode: "GATEWAY"; paymentLink?: string; message: string }
  | { ok: true; orderId: string; mode: "MANUAL"; message: string }
  | { ok: false; error: string };

const PESAN_MANUAL =
  "Permintaan perpanjangan dikirim. Admin layanan akan menghubungi Anda.";

/**
 * Buat pesanan paket untuk satu sekolah.
 *
 * FALLBACK MANUAL — ini inti "siap-isi kredensial":
 *  - Gateway sekolah belum aktif / kredensial kosong → pesanan tetap dibuat
 *    dengan provider NULL, status PENDING, dan pemesan diberi pesan sukses.
 *    TIDAK ada error.
 *  - Gateway ada tetapi panggilan API gagal (provider belum ACC, kunci salah)
 *    → juga jatuh ke manual, dengan catatan galatnya disimpan di `note`.
 *    Sekolah tidak boleh kehilangan kemampuan memperpanjang hanya karena
 *    integrasi pihak ketiga belum siap.
 */
export async function buatPesananPaket(input: {
  schoolId: string;
  planId: string;
  months: number;
  userId: string;
  schoolName: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
}): Promise<HasilPesanan> {
  const plan = await prisma.plan.findFirst({
    where: { id: input.planId, isActive: true },
    select: { id: true, name: true, pricePerMonth: true },
  });
  if (!plan) return { ok: false, error: "Paket tidak ditemukan atau sudah tidak dijual." };

  const months = normalisasiBulan(input.months);
  const amount = hitungAmount(plan.pricePerMonth, months);

  // Satu pesanan PENDING per sekolah: menekan tombol dua kali tidak boleh
  // menghasilkan dua tautan pembayaran yang keduanya bisa dibayar.
  const pending = await prisma.planOrder.findFirst({
    where: { schoolId: input.schoolId, status: "PENDING" },
    select: { id: true },
  });
  if (pending) {
    return {
      ok: false,
      error:
        "Sudah ada permintaan perpanjangan yang menunggu. Selesaikan atau tunggu " +
        "admin layanan menghubungi Anda.",
    };
  }

  const cfg = await loadActiveGateway(input.schoolId);

  if (cfg) {
    const charge = await createGatewayCharge(cfg, {
      invoiceNo: `PLAN-${Date.now().toString(36).toUpperCase()}`,
      totalAmount: amount,
      title: `Paket ${plan.name} ${months} bulan`,
      customerName: input.schoolName,
      customerEmail: input.contactEmail ?? null,
      customerPhone: input.contactPhone ?? null,
    });

    if (charge.ok && charge.externalId) {
      const order = await prisma.planOrder.create({
        data: {
          schoolId: input.schoolId,
          planId: plan.id,
          requestedByUserId: input.userId,
          months,
          amount,
          status: "PENDING",
          provider: cfg.provider,
          externalId: charge.externalId,
          paymentLink: charge.paymentLink ?? null,
          vaNumber: charge.vaNumber ?? null,
          // Tautan gateway biasanya berlaku 24 jam; setelah itu pesanan
          // kedaluwarsa dan sekolah perlu mengajukan ulang.
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
        select: { id: true },
      });
      return {
        ok: true,
        orderId: order.id,
        mode: "GATEWAY",
        paymentLink: charge.paymentLink,
        message: charge.paymentLink
          ? "Tautan pembayaran dibuat. Selesaikan pembayaran untuk mengaktifkan paket."
          : "Permintaan dikirim ke gateway. Ikuti instruksi pembayaran dari admin layanan.",
      };
    }

    // Gateway gagal → manual, BUKAN error.
    const order = await prisma.planOrder.create({
      data: {
        schoolId: input.schoolId,
        planId: plan.id,
        requestedByUserId: input.userId,
        months,
        amount,
        status: "PENDING",
        note: `Gateway ${cfg.provider} gagal: ${charge.error ?? "tidak diketahui"}`,
      },
      select: { id: true },
    });
    return { ok: true, orderId: order.id, mode: "MANUAL", message: PESAN_MANUAL };
  }

  const order = await prisma.planOrder.create({
    data: {
      schoolId: input.schoolId,
      planId: plan.id,
      requestedByUserId: input.userId,
      months,
      amount,
      status: "PENDING",
      note: "Mode manual: gateway sekolah belum aktif.",
    },
    select: { id: true },
  });
  return { ok: true, orderId: order.id, mode: "MANUAL", message: PESAN_MANUAL };
}

export { PESAN_MANUAL };
