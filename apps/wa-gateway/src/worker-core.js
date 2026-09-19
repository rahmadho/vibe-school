/**
 * Logika murni worker — TANPA impor Baileys/Prisma.
 *
 * Dipisah dari worker.js agar dapat diuji tanpa memasang Baileys atau
 * menyambung ke database. Harus SELARAS dengan
 * apps/web/src/lib/notification.ts (backoffMinutes & isPermanentFailure).
 */

export const MAX_ATTEMPTS = 4;

/** Jeda antar percobaan (menit): 1, 5, 15, 60. */
export const BACKOFF_MINUTES = [1, 5, 15, 60];

export function backoffMinutes(attempt) {
  const idx = Math.max(0, Math.min(attempt - 1, BACKOFF_MINUTES.length - 1));
  return BACKOFF_MINUTES[idx];
}

/** Waktu percobaan berikutnya, atau null bila jatah habis. */
export function nextAttemptAt(attempt, now = new Date()) {
  if (attempt >= MAX_ATTEMPTS) return null;
  return new Date(now.getTime() + backoffMinutes(attempt + 1) * 60_000);
}

/**
 * Apakah galat bersifat permanen (nomor tidak ada) sehingga tidak perlu
 * dicoba ulang.
 *
 * PENTING: pesan galat dari wa.js kita sendiri berbahasa INDONESIA, sedangkan
 * galat Baileys berbahasa Inggris. Keduanya harus dikenali — kalau tidak,
 * nomor yang sudah tidak aktif akan dicoba berulang kali dan membuang kuota.
 */
export function isPermanentFailure(error) {
  const e = String(error ?? "").toLowerCase();
  return (
    // Indonesia — pesan dari wa.js
    e.includes("tidak terdaftar") ||
    e.includes("nomor tidak valid") ||
    e.includes("bukan nomor") ||
    // Inggris — pesan dari Baileys
    e.includes("not registered") ||
    e.includes("invalid number") ||
    e.includes("not on whatsapp") ||
    e.includes("phone number does not exist")
  );
}

/** Tentukan tindakan setelah kegagalan: ulangi atau menyerah. */
export function failureOutcome(error, attempts) {
  const permanent = isPermanentFailure(error);
  const exhausted = attempts >= MAX_ATTEMPTS;
  if (permanent || exhausted) {
    return {
      retry: false,
      permanent,
      exhausted,
      status: "FAILED",
      error: permanent ? `Permanen: ${error}` : error,
    };
  }
  // `attempts` = jumlah percobaan yang SUDAH dilakukan. Jeda dihitung untuk
  // percobaan BERIKUTNYA, karena itu backoffMinutes(attempts + 1).
  const waitMinutes = backoffMinutes(attempts + 1);
  return { retry: true, permanent: false, exhausted: false, waitMinutes, status: "QUEUED" };
}
