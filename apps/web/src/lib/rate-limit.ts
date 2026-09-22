import "server-only";
import { headers } from "next/headers";

/**
 * Pembatasan laju sederhana berbasis memori.
 *
 * ============================================================
 * KENAPA PERLU
 * ============================================================
 * Form pendaftaran SPMB terbuka untuk umum dan tidak memerlukan akun. Tanpa
 * pembatasan, satu skrip bisa mengirim ribuan pendaftaran palsu dalam
 * hitungan detik — memenuhi kuota gelombang, mengotori buku register, dan
 * mengirim ribuan pesan WA ke nomor asli.
 *
 * ============================================================
 * BATASAN YANG DISENGAJA
 * ============================================================
 * Penyimpanannya di MEMORI PROSES, bukan Redis. Konsekuensinya:
 *   - Hitungan hilang saat server dimulai ulang.
 *   - Tidak akurat bila aplikasi berjalan di beberapa proses sekaligus
 *     (setiap proses punya hitungan sendiri, jadi batas efektifnya berlipat).
 *
 * Keduanya dapat diterima di sini: tujuannya menahan penyalahgunaan kasar,
 * bukan penegakan yang presisi. Menambah Redis untuk kebutuhan ini berarti
 * menambah satu layanan yang harus dijaga hidup oleh staf sekolah — beban
 * operasional yang tidak sebanding dengan manfaatnya.
 *
 * Untuk aplikasi multi-proses, ganti isi berkas ini dengan penyimpanan
 * bersama; tanda tangannya sengaja dibuat tidak bergantung pada memori.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** Bersihkan entri kedaluwarsa agar peta tidak tumbuh tanpa batas. */
function sweep(now: number): void {
  if (buckets.size < 500) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

/**
 * Periksa apakah permintaan masih dalam batas.
 *
 * @returns `allowed: false` bila batas terlampaui; `retryAfterSec` untuk
 *          memberi tahu pengguna berapa lama harus menunggu.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  sweep(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSec: 0 };
  }

  if (bucket.count >= limit) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  bucket.count += 1;
  return { allowed: true, retryAfterSec: 0 };
}

/**
 * Alamat IP pengunjung dari header proxy.
 *
 * `x-forwarded-for` berisi daftar yang dipisah koma; yang pertama adalah
 * klien asli. Bila kosong (pengembangan lokal), dipakai "lokal" supaya
 * pembatasan tetap berjalan — bukan dimatikan.
 */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return h.get("x-real-ip") ?? "lokal";
}

/**
 * Periksa batas untuk sebuah aksi publik.
 *
 * @returns null bila boleh lanjut; pesan galat siap-tampil bila ditolak.
 */
export async function checkRateLimit(
  action: string,
  limit: number,
  windowMs: number,
): Promise<string | null> {
  const ip = await clientIp();
  const result = rateLimit(`${action}:${ip}`, limit, windowMs);
  if (result.allowed) return null;

  const menit = Math.ceil(result.retryAfterSec / 60);
  return result.retryAfterSec < 60
    ? `Terlalu banyak percobaan. Coba lagi dalam ${result.retryAfterSec} detik.`
    : `Terlalu banyak percobaan. Coba lagi dalam ${menit} menit.`;
}
