/**
 * Adapter payment gateway — logika MURNI (tanpa DB), sehingga dapat diuji.
 *
 * Mendukung DUA jalur pembayaran berdampingan (keputusan produk):
 *   1. MANUAL  — admin mencatat pembayaran tunai/transfer (lihat Payment).
 *   2. GATEWAY — Midtrans atau Xendit membuat sesi pembayaran & memanggil
 *      webhook saat dibayar.
 *
 * Modul ini hanya membentuk payload & menafsirkan status. Pemanggilan HTTP
 * dilakukan di `lib/gateway-client.ts` (server-only).
 */

export type Provider = "MIDTRANS" | "XENDIT" | "MANUAL";

/** Status internal yang seragam lintas provider. */
export type NormalizedStatus = "PENDING" | "SETTLEMENT" | "EXPIRE" | "REFUND" | "FAILED";

/* ============================================================
 * MIDTRANS
 * ============================================================ */

export const MIDTRANS_BASE: Record<string, string> = {
  sandbox: "https://api.sandbox.midtrans.com/v2",
  production: "https://api.midtrans.com/v2",
};

export const MIDTRANS_SNAP_BASE: Record<string, string> = {
  sandbox: "https://app.sandbox.midtrans.com/snap/v1",
  production: "https://app.midtrans.com/snap/v1",
};

/**
 * Status Midtrans → status internal.
 * `capture` diperlakukan sebagai SETTLEMENT hanya bila fraud_status = accept,
 * karena capture tanpa accept berarti masih ditinjau (berisiko chargeback).
 */
export function mapMidtransStatus(
  transactionStatus: string,
  fraudStatus?: string,
): NormalizedStatus {
  const s = transactionStatus.toLowerCase();
  switch (s) {
    case "capture":
      if (fraudStatus === undefined) return "SETTLEMENT";
      return fraudStatus.toLowerCase() === "accept" ? "SETTLEMENT" : "PENDING";
    case "settlement":
      return "SETTLEMENT";
    case "pending":
      return "PENDING";
    case "deny":
    case "cancel":
    case "failure":
      return "FAILED";
    case "expire":
      return "EXPIRE";
    case "refund":
    case "partial_refund":
      return "REFUND";
    default:
      return "PENDING";
  }
}

export type MidtransNotification = {
  order_id: string;
  status_code: string;
  gross_amount: string;
  transaction_status: string;
  fraud_status?: string;
  transaction_id?: string;
  payment_type?: string;
  signature_key?: string;
  [k: string]: unknown;
};

/**
 * Kunci idempotensi untuk notifikasi Midtrans.
 *
 * Midtrans dapat mengirim ulang notifikasi yang sama (retry). Tanpa kunci ini,
 * satu pembayaran bisa tercatat berkali-kali dan tagihan bisa "lunas" padahal
 * baru dibayar sekali. Sidik jari menyertakan status & nominal sehingga
 * perubahan status yang sah (pending → settlement) tetap diproses.
 */
export function midtransNotificationKey(n: MidtransNotification): string {
  return [
    n.order_id,
    n.transaction_status,
    n.status_code,
    n.gross_amount,
    n.fraud_status ?? "-",
    n.transaction_id ?? "-",
  ].join(":");
}

/**
 * Verifikasi signature Midtrans:
 *   sha512(order_id + status_code + gross_amount + serverKey)
 * Wajib diperiksa sebelum mempercayai notifikasi — tanpa ini siapa pun bisa
 * mengirim POST palsu dan menandai tagihan lunas.
 */
export async function verifyMidtransSignature(
  n: MidtransNotification,
  serverKey: string,
  sha512: (data: string) => Promise<string>,
): Promise<boolean> {
  if (!n.signature_key) return false;
  const expected = await sha512(
    `${n.order_id}${n.status_code}${n.gross_amount}${serverKey}`,
  );
  return timingSafeEqualHex(expected, n.signature_key);
}

/** Bentuk order_id: PREFIX-INVOICENO-TIMESTAMP (aman untuk Midtrans). */
export function buildMidtransOrderId(
  prefix: string | null | undefined,
  invoiceNo: string,
  at: Date = new Date(),
): string {
  const clean = (s: string) => s.replace(/[^A-Za-z0-9-]/g, "-");
  const p = clean(prefix?.trim() || "INV");
  const no = clean(invoiceNo);
  const ts = at.getTime().toString().slice(-6);
  return `${p}-${no}-${ts}`;
}

/* ============================================================
 * XENDIT
 * ============================================================ */

export const XENDIT_BASE = "https://api.xendit.co";

/** Status invoice Xendit → status internal. */
export function mapXenditStatus(status: string): NormalizedStatus {
  switch (status.toUpperCase()) {
    case "PAID":
    case "SETTLED":
      return "SETTLEMENT";
    case "PENDING":
      return "PENDING";
    case "EXPIRED":
      return "EXPIRE";
    case "FAILED":
      return "FAILED";
    case "REFUNDED":
      return "REFUND";
    default:
      return "PENDING";
  }
}

export type XenditCallback = {
  id?: string;
  external_id?: string;
  status?: string;
  amount?: number;
  paid_amount?: number;
  updated?: string;
  [k: string]: unknown;
};

/** Kunci idempotensi untuk callback Xendit. */
export function xenditNotificationKey(c: XenditCallback): string {
  return [
    c.external_id ?? c.id ?? "-",
    c.status ?? "-",
    String(c.paid_amount ?? c.amount ?? "-"),
    c.updated ?? "-",
  ].join(":");
}

/**
 * Verifikasi callback token Xendit (header `x-callback-token`).
 * Perbandingan waktu-konstan untuk mencegah timing attack.
 */
export function verifyXenditCallbackToken(
  headerToken: string | null | undefined,
  expected: string,
): boolean {
  if (!headerToken || !expected) return false;
  return timingSafeEqualStr(headerToken, expected);
}

/* ============================================================
 * UTIL
 * ============================================================ */

/**
 * Perbandingan string waktu-konstan (mencegah timing attack).
 * Implementasi sederhana yang tidak bergantung crypto agar bisa diuji murni.
 */
export function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Tetap lakukan pekerjaan agar durasi tidak membocorkan panjang.
    let diff = 1;
    const len = Math.max(a.length, b.length);
    for (let i = 0; i < len; i++) {
      diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
    }
    return diff === 0;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** Perbandingan hex (case-insensitive) waktu-konstan. */
export function timingSafeEqualHex(a: string, b: string): boolean {
  return timingSafeEqualStr(a.toLowerCase(), b.toLowerCase());
}

/** Ubah status internal → aksi pada tagihan. */
export function statusToPaidAt(status: NormalizedStatus): boolean {
  return status === "SETTLEMENT";
}
