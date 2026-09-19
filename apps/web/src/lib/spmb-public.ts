/**
 * Util MURNI pendaftaran SPMB publik — tanpa DB, sehingga dapat diuji.
 *
 * Dipisah dari `lib/data/*` (yang menyentuh DB) karena berkas ini dipakai di
 * dalam Server Action DAN diuji langsung oleh vitest. Aturan AGENTS.md #10
 * (TypeScript ketat) menuntut setiap nilai yang keluar dari Action punya bentuk
 * yang jelas — mendefinisikannya di sini membuat halaman, form, dan aksi
 * memakai satu sumber kebenaran yang sama.
 */

/* ============================================================
 * NOMOR PENDAFTARAN
 * ============================================================ */

/**
 * Bangun nomor pendaftaran yang ramah dibaca manusia.
 *
 * Bentuk: `SPMB-<TAHUN>-<JALUR>-<AWALAN>`
 *   SPMB-2026-REGULER-7K3QF9
 *
 * Kenapa begini, bukan sekadar cuid acak:
 *  - Orang tua sering menyebut nomornya lewat telepon. Nomor yang memuat
 *    tahun & jalur langsung memberi tahu panitia siapa yang sedang bicara.
 *  - Awalannya diambil dari karakter tanpa makna ganda (tanpa 0/O, 1/I/L)
 *    supaya tidak salah dengar — kesalahan ketik satu huruf membuat orang tua
 *    gagal mengecek status anaknya dan menelepon panitia.
 *
 * `randomFn` disuntik agar dapat diuji deterministik.
 */
export function buildRegistrationNo(input: {
  year: number;
  pathCode: string;
  randomFn?: () => number;
}): string {
  const randomFn = input.randomFn ?? Math.random;
  const code = sanitizePathCode(input.pathCode);
  const suffix = randomToken(6, randomFn);
  return `SPMB-${input.year}-${code}-${suffix}`;
}

/** Karakter aman untuk nomor pendaftaran (tanpa 0/O/1/I/L yang mudah tertukar). */
const SAFE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** Hasilkan token acak dari alfabet aman. */
export function randomToken(length: number, randomFn: () => number = Math.random): string {
  let out = "";
  for (let i = 0; i < length; i += 1) {
    const idx = Math.floor(randomFn() * SAFE_ALPHABET.length);
    // `Math.random()` bisa mengembalikan tepat angka 1 (secara praktis tidak,
    // tetapi kontraknya [0,1)). Jaga-jaga agar indeks tidak keluar batas.
    out += SAFE_ALPHABET[Math.min(idx, SAFE_ALPHABET.length - 1)];
  }
  return out;
}

/** Normalkan kode jalur agar layak jadi bagian nomor pendaftaran. */
export function sanitizePathCode(code: string): string {
  const cleaned = code
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 20);
  return cleaned || "REGULER";
}

/* ============================================================
 * PRIVASI PENGECEKAN STATUS
 * ============================================================ */

/**
 * Sembunyikan sebagian nomor HP untuk ditampilkan.
 *
 * Pengecekan status dapat diakses tanpa masuk (memakai nomor pendaftaran +
 * nomor HP). Bila nomor HP dikembalikan utuh, siapa pun yang menebak satu
 * nomor pendaftaran bisa membaca data keluarga orang lain. Karena itu nomor
 * ditutup sebagian, dan hanya nomor itu sendiri yang menjadi kunci tambahan.
 */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length <= 4) return "••••";
  const head = digits.slice(0, 4);
  const tail = digits.slice(-2);
  return `${head}${"•".repeat(Math.max(3, digits.length - 6))}${tail}`;
}

/** Sembunyikan sebagian nama (mis. "Ahmad Fauzi" → "Ahmad F."). */
export function maskName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1].charAt(0).toUpperCase()}.`;
}

/* ============================================================
 * NORMALISASI KUNCI PENGECEKAN
 * ============================================================ */

/**
 * Samakan bentuk nomor pendaftaran untuk pencarian.
 *
 * Nomor pendaftaran disimpan dengan tanda hubung (`SPMB-2026-REGULER-ABC234`),
 * tetapi orang tua sering menulisnya ulang dari kertas atau membacanya lewat
 * telepon: spasi menggantikan tanda hubung, huruf jadi kecil, kadang tanda
 * hubung ikut terbuang.
 *
 * Karena itu SEMUA pemisah dibuang, bukan hanya spasi. Membuang spasi tanda
 * hubung saja menghasilkan `SPMB2026REGULERABC234` yang tidak akan pernah
 * cocok dengan apa pun di database — dan pendaftar yang sah akan diberi tahu
 * "data tidak ditemukan" padahal nomornya benar.
 *
 * Fungsi ini dipakai untuk MEMBANDINGKAN, bukan untuk menyimpan: nilai asli
 * dengan tanda hubung tetap yang disimpan dan ditampilkan.
 */
export function normalizeRegistrationNo(input: string): string {
  return input.trim().toUpperCase().replace(/[\s-]+/g, "");
}

/* ============================================================
 * LABEL STATUS
 * ============================================================ */

/** Label bahasa Indonesia untuk `RegistrationStatus`, dengan nada yang tepat. */
export const REGISTRATION_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Belum dikirim",
  PENDING: "Menunggu verifikasi",
  VERIFIED: "Dokumen lengkap",
  TESTED: "Sudah mengikuti seleksi",
  ACCEPTED: "Diterima",
  REJECTED: "Belum diterima",
  WAITLIST: "Cadangan",
  WITHDRAWN: "Mengundurkan diri",
};

/**
 * Nada status untuk pewarnaan di UI.
 *
 * "REJECTED" memakai nada netral (bukan merah menyala): bagi orang tua, kata
 * "belum diterima" sudah cukup keras; warna merah menyala pada halaman hasil
 * terasa menghakimi dan membuat mereka enggan menghubungi sekolah.
 */
export type StatusTone = "neutral" | "progress" | "good" | "warn";

export const REGISTRATION_STATUS_TONE: Record<string, StatusTone> = {
  DRAFT: "neutral",
  PENDING: "progress",
  VERIFIED: "progress",
  TESTED: "progress",
  ACCEPTED: "good",
  REJECTED: "warn",
  WAITLIST: "warn",
  WITHDRAWN: "neutral",
};

export function registrationStatusLabel(status: string): string {
  return REGISTRATION_STATUS_LABEL[status] ?? status;
}

export function registrationStatusTone(status: string): StatusTone {
  return REGISTRATION_STATUS_TONE[status] ?? "neutral";
}
