/**
 * ============================================================
 * IDENTITAS LOGIN — bagian MURNI (tanpa DB / Next.js)
 * ============================================================
 *
 * Dipisahkan agar keputusan yang menentukan isolasi tenant bisa diuji tanpa
 * database. Bagian yang menyentuh DB ada di `login-identitas-server.ts`.
 *
 * Bahaya yang dijaga berkas ini:
 *   NIS TIDAK unik antar sekolah. "2024001" bisa ada di SMP A dan SMP B.
 *   Kalau server menebak sekolah — atau memakai sekolah pertama yang ditemukan
 *   — seseorang bisa masuk ke akun sekolah lain hanya dengan menebak NIS.
 */

export type JenisIdentitas = "email" | "nis" | "tidak_valid";

/**
 * Klasifikasi teks yang diketik di kolom "NIS atau Email".
 *
 * Aturan:
 *   - mengandung "@" dan berbentuk email wajar → "email"
 *   - bukan email, tapi berisi karakter wajar untuk NIS → "nis"
 *   - selain itu → "tidak_valid" (ditolak sebelum menyentuh DB)
 */
export function klasifikasiIdentitas(mentah: string): JenisIdentitas {
  const t = (mentah ?? "").trim();
  if (!t) return "tidak_valid";

  if (t.includes("@")) {
    // Pemeriksaan bentuk yang longgar tapi cukup: ada teks, "@", lalu domain
    // ber-titik. Tidak memakai regex panjang agar mudah dibaca.
    const [lokal, domain, ...sisa] = t.split("@");
    if (sisa.length > 0) return "tidak_valid";
    if (!lokal || !domain) return "tidak_valid";
    if (!domain.includes(".")) return "tidak_valid";
    if (domain.startsWith(".") || domain.endsWith(".")) return "tidak_valid";
    return "email";
  }

  // NIS: huruf/angka, boleh ada tanda hubung atau titik (mis. "2024.001").
  // Dibatasi 3–32 karakter agar tidak ada input aneh yang lolos ke query.
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{2,31}$/.test(t)) return "tidak_valid";
  return "nis";
}

/** Bentuk identitas yang sudah dinormalkan untuk dicari di database. */
export type IdentitasLogin =
  | { jenis: "email"; nilai: string }
  | { jenis: "nis"; nilai: string };

/**
 * Normalkan identitas login. Mengembalikan null bila tidak valid.
 *
 * Email → huruf kecil (database menyimpan huruf kecil).
 * NIS   → apa adanya setelah trim: NIS peka huruf besar/kecil di sebagian
 *         sekolah (mis. "A2024" vs "a2024"), jadi JANGAN diubah tanpa dasar.
 */
export function normalkanIdentitas(mentah: string): IdentitasLogin | null {
  const jenis = klasifikasiIdentitas(mentah);
  const t = (mentah ?? "").trim();
  if (jenis === "email") return { jenis: "email", nilai: t.toLowerCase() };
  if (jenis === "nis") return { jenis: "nis", nilai: t };
  return null;
}

/**
 * Apakah slug sekolah layak dipakai untuk mencari tenant?
 *
 * Slug kosong/aneh TIDAK boleh dianggap "cocok dengan sekolah mana pun" —
 * itu justru membuka pintu. Ketat di sini lebih baik.
 */
export function slugSekolahValid(slug: unknown): slug is string {
  if (typeof slug !== "string") return false;
  const t = slug.trim();
  if (t.length < 2 || t.length > 63) return false;
  return /^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(t);
}
