/**
 * Logika keuangan — MURNI (tanpa DB) agar mudah diuji.
 *
 * Semua nominal dalam RUPIAH INTEGER (tidak ada pecahan sen). Ini penting:
 * uang tidak boleh disimpan sebagai float karena pembulatan akan membuat
 * total tagihan tidak pernah cocok dengan jumlah pembayaran.
 */

export type InvoiceStatusValue =
  | "UNPAID"
  | "PARTIAL"
  | "PAID"
  | "OVERDUE"
  | "CANCELLED"
  | "REFUNDED";

export const INVOICE_STATUS_LABEL: Record<InvoiceStatusValue, string> = {
  UNPAID: "Belum bayar",
  PARTIAL: "Bayar sebagian",
  PAID: "Lunas",
  OVERDUE: "Terlambat",
  CANCELLED: "Dibatalkan",
  REFUNDED: "Dikembalikan",
};

/**
 * Tentukan status tagihan berdasarkan jumlah dibayar & jatuh tempo.
 *
 * Aturan:
 *  - Dibatalkan/dikembalikan → status tidak diubah (final).
 *  - Sudah dibayar penuh → PAID.
 *  - Dibayar sebagian tapi belum jatuh tempo → PARTIAL.
 *  - Dibayar sebagian & sudah lewat jatuh tempo → OVERDUE (tetap terlihat
 *    sebagai tunggakan; ini yang ditagih ke orang tua).
 *  - Belum dibayar sama sekali → UNPAID atau OVERDUE.
 *
 * @param total   total tagihan
 * @param paid    jumlah sudah dibayar
 * @param dueDate jatuh tempo
 * @param now     waktu acuan (untuk pengujian)
 */
export function resolveInvoiceStatus(
  total: number,
  paid: number,
  dueDate: Date,
  now: Date = new Date(),
  current?: InvoiceStatusValue,
): InvoiceStatusValue {
  // Status final — jangan diubah otomatis.
  if (current === "CANCELLED" || current === "REFUNDED") return current;

  if (paid >= total && total > 0) return "PAID";

  const overdue = dueDate.getTime() < now.getTime();
  if (overdue) return "OVERDUE";
  if (paid > 0) return "PARTIAL";
  return "UNPAID";
}

/** Sisa tagihan yang harus dibayar (tidak pernah negatif). */
export function remainingAmount(total: number, paid: number): number {
  return Math.max(0, total - paid);
}

/**
 * Validasi pembayaran baru terhadap tagihan.
 * Mengembalikan pesan kesalahan, atau null bila sah.
 */
export function validatePayment(
  total: number,
  alreadyPaid: number,
  amount: number,
): string | null {
  if (!Number.isInteger(amount)) {
    return "Nominal pembayaran harus bilangan bulat (Rupiah).";
  }
  if (amount <= 0) {
    return "Nominal pembayaran harus lebih dari nol.";
  }
  const sisa = remainingAmount(total, alreadyPaid);
  if (sisa === 0) {
    return "Tagihan ini sudah lunas.";
  }
  if (amount > sisa) {
    return `Nominal melebihi sisa tagihan (${formatRupiah(sisa)}).`;
  }
  return null;
}

/** Format Rupiah tanpa Intl (aman & konsisten di server maupun klien). */
export function formatRupiah(amount: number): string {
  const neg = amount < 0;
  const digits = String(Math.abs(Math.trunc(amount)));
  let out = "";
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += ".";
    out += digits[i];
  }
  return `${neg ? "-" : ""}Rp${out}`;
}

/**
 * Bentuk nomor tagihan: PREFIX/YYYYMM/URUT
 * Contoh: SPP-01/202510/0007  → tidak dipakai raw sebagai identifier unik;
 * keunikannya dijamin oleh kolom `invoiceNo` (unique) di database.
 */
export function buildInvoiceNumber(
  prefix: string,
  date: Date,
  sequence: number,
  pad = 4,
): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const seq = String(sequence).padStart(pad, "0");
  return `${prefix}/${y}${m}/${seq}`;
}

/**
 * Ringkas daftar tagihan.
 * `today` dipakai untuk menghitung berapa yang sudah lewat jatuh tempo.
 */
export function summarizeInvoices(
  invoices: { totalAmount: number; paidAmount: number; dueDate: Date; status: string }[],
  today: Date = new Date(),
): {
  count: number;
  billed: number;
  collected: number;
  outstanding: number;
  overdueCount: number;
  overdueAmount: number;
  paidCount: number;
  collectionRate: number;
} {
  let billed = 0;
  let collected = 0;
  let outstanding = 0;
  let overdueCount = 0;
  let overdueAmount = 0;
  let paidCount = 0;

  for (const inv of invoices) {
    billed += inv.totalAmount;
    collected += inv.paidAmount;
    const sisa = remainingAmount(inv.totalAmount, inv.paidAmount);
    outstanding += sisa;

    if (inv.status === "PAID") paidCount += 1;

    // Tunggakan: masih ada sisa DAN sudah lewat jatuh tempo.
    const isCancelled = inv.status === "CANCELLED" || inv.status === "REFUNDED";
    if (!isCancelled && sisa > 0 && inv.dueDate.getTime() < today.getTime()) {
      overdueCount += 1;
      overdueAmount += sisa;
    }
  }

  return {
    count: invoices.length,
    billed,
    collected,
    outstanding,
    overdueCount,
    overdueAmount,
    paidCount,
    collectionRate:
      billed === 0 ? 0 : Math.round((collected / billed) * 1000) / 10,
  };
}

/**
 * Status pembayaran gateway → status tagihan.
 * Dipakai saat memproses webhook.
 */
export function gatewayStatusToInvoicePaid(
  total: number,
  alreadyPaid: number,
  gatewayAmount: number,
): { newPaid: number; shouldRecord: boolean } {
  const sisa = remainingAmount(total, alreadyPaid);
  if (sisa === 0) return { newPaid: alreadyPaid, shouldRecord: false };
  // Jangan pernah mencatat lebih dari sisa tagihan, meskipun provider
  // melaporkan nominal yang lebih besar.
  const applied = Math.min(gatewayAmount, sisa);
  return { newPaid: alreadyPaid + applied, shouldRecord: applied > 0 };
}
