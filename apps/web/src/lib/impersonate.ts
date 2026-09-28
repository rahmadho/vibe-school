import "server-only";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * ============================================================
 * IMPERSONATE — token sekali-pakai untuk "Masuk sebagai"
 * ============================================================
 *
 * KENAPA PERLU TOKEN, BUKAN LANGSUNG `signIn(userId)`:
 *
 * Provider `authorize()` di NextAuth berjalan TANPA akses ke sesi pemanggil —
 * ia hanya menerima kredensial mentah. Kalau kita memercayai `targetUserId`
 * apa adanya dari klien, siapa pun bisa mengirim userId sekolah lain dan masuk
 * sebagai adminnya. Celahnya jelas: kita memindahkan pemeriksaan hak dari sisi
 * server ke sisi yang bisa dipalsukan.
 *
 * Karena itu alurnya dua tahap:
 *   1. Server Action memverifikasi pemanggil (role SUPER_ADMIN) SEBELUM
 *      membuat token ini — di sanalah hak yang sebenarnya diperiksa.
 *   2. Token ditandatangani HMAC memakai NEXTAUTH_SECRET, berlaku sangat
 *      singkat (60 detik), dan memuat identitas aktor + target.
 *      `authorize()` cukup MEMVERIFIKASI TANDA TANGAN. Karena hanya server
 *      yang bisa membuat tanda tangan yang sah, `targetUserId` di dalamnya
 *      tidak bisa dipalsukan dari sisi klien.
 *
 * Token tidak disimpan di database: sifatnya sekali-pakai dan berumur pendek,
 * jadi penyimpanan hanya menambah permisalan. Yang WAJIB tercatat adalah
 * tindakan impersonasinya sendiri (lihat `recordAudit` di server action).
 */

/** Umur token: cukup untuk perjalanan satu round-trip signIn, tak lebih. */
const TOKEN_TTL_SECONDS = 60;

type ImpersonatePayload = {
  /** Super Admin yang melakukan impersonasi (id di database). */
  actorId: string;
  /** Nama aktor, agar header "kembali" bisa menyapa tanpa query tambahan. */
  actorName: string;
  /** Pengguna yang akan diperankan. */
  targetUserId: string;
  /** Waktu kedaluwarsa (epoch detik). */
  exp: number;
  /**
   * `to` = arah tukar sesi:
   *   "impersonate" → tukar sesi aktor menjadi sesi target (masuk sebagai).
   *   "restore"     → tukar sesi target kembali menjadi sesi aktor (kembali).
   *
   * Dipisah supaya tiket "kembali" tidak bisa disalahgunakan sebagai tiket
   * "masuk sebagai" (dan sebaliknya) — dua arah, dua tiket, dua pemeriksaan.
   */
  to: "impersonate" | "restore";
};

function secret(): string {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) {
    // Tanpa rahasia, tanda tangan tidak bermakna → lebih baik gagal keras
    // daripada menghasilkan token yang bisa dipalsukan.
    throw new Error("NEXTAUTH_SECRET belum diset; impersonate tidak aman.");
  }
  return s;
}

function sign(payloadB64: string): string {
  return createHmac("sha256", secret()).update(payloadB64).digest("base64url");
}

/** Membuat token bertanda tangan. Hanya dipanggil setelah hak diverifikasi. */
export function createImpersonateToken(input: {
  actorId: string;
  actorName: string;
  targetUserId: string;
}): string {
  return buildToken({ ...input, to: "impersonate" });
}

/**
 * Membuat tiket "kembali": menukar sesi target kembali menjadi sesi aktor.
 * Dibuat oleh server action `stopImpersonation` setelah memastikan sesi saat
 * ini memang sesi impersonasi (punya `impersonatedBy`).
 */
export function createRestoreToken(input: {
  actorId: string;
  actorName: string;
  targetUserId: string;
}): string {
  return buildToken({ ...input, to: "restore" });
}

function buildToken(input: {
  actorId: string;
  actorName: string;
  targetUserId: string;
  to: "impersonate" | "restore";
}): string {
  const payload: ImpersonatePayload = {
    ...input,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${payloadB64}.${sign(payloadB64)}`;
}

/**
 * Memverifikasi & mengurai token. Mengembalikan null bila tanda tangan tidak
 * cocok, bentuknya rusak, atau sudah kedaluwarsa — semua kasus itu diperlakukan
 * sama oleh pemanggil: tolak.
 */
export function verifyImpersonateToken(token: string): ImpersonatePayload | null {
  try {
    const [payloadB64, sig] = token.split(".");
    if (!payloadB64 || !sig) return null;

    // Perbandingan waktu-konstan: hindari membocorkan tanda tangan via timing.
    const expected = Buffer.from(sign(payloadB64));
    const given = Buffer.from(sig);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
      return null;
    }

    const payload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString(),
    ) as ImpersonatePayload;

    if (
      typeof payload.actorId !== "string" ||
      typeof payload.targetUserId !== "string" ||
      typeof payload.exp !== "number" ||
      (payload.to !== "impersonate" && payload.to !== "restore")
    ) {
      return null;
    }
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;

    return payload;
  } catch {
    return null;
  }
}

/** Umur token dalam detik — dipakai UI untuk menjelaskan masa berlaku. */
export const IMPERSONATE_TTL_SECONDS = TOKEN_TTL_SECONDS;
