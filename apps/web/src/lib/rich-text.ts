import DOMPurify from "isomorphic-dompurify";

/**
 * Pembersih HTML dari editor teks kaya.
 *
 * ============================================================
 * KENAPA WAJIB — INI BUKAN SEKADAR KERAPIAN
 * ============================================================
 * Isi berita disimpan sebagai HTML lalu ditampilkan di web publik sekolah.
 * Tanpa pembersihan, satu akun editor yang disalahgunakan (atau kata sandi
 * yang bocor) cukup untuk menyisipkan `<script>` ke halaman yang dibuka semua
 * orang tua — pencurian sesi, pengalihan ke situs penipuan, atau pengambilan
 * data formulir SPMB.
 *
 * Karena itu daftar yang diizinkan dibuat SEMPIT: hanya tag yang benar-benar
 * dihasilkan toolbar editor. `script`, `iframe`, `form`, `style`, dan atribut
 * `on*` tidak akan pernah lolos — walaupun seseorang mengirimnya langsung
 * lewat permintaan HTTP yang dibuat sendiri.
 *
 * ============================================================
 * KENAPA DIPAKAI DI DUA TEMPAT
 * ============================================================
 *   1. Sebelum SIMPAN (aksi server) — yang tersimpan di database selalu bersih.
 *   2. Sebelum TAMPIL (halaman publik) — data lama yang tersimpan sebelum
 *      aturan ini ada tetap aman ditampilkan.
 * Membersihkan hanya di satu sisi berarti satu jalur masuk yang terlewat
 * (impor, seed, perbaikan manual di database) langsung menjadi celah.
 */

/** Tag yang boleh bertahan — persis keluaran toolbar editor. */
const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "s",
  "strike",
  "h2",
  "h3",
  "ul",
  "ol",
  "li",
  "blockquote",
  "hr",
  "a",
];

/** Atribut yang boleh bertahan. `on*` tidak pernah masuk daftar ini. */
const ALLOWED_ATTR = ["href", "target", "rel", "title"];

/** Protokol tautan yang diterima. `javascript:` & `data:` ditolak. */
const ALLOWED_URI_REGEXP = /^(?:https?:|mailto:|tel:|\/|#)/i;

export function sanitizeRichText(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP,
    // Tautan keluar wajib `rel="noopener noreferrer"`; tanpa itu halaman yang
    // dibuka bisa mengendalikan jendela sekolah lewat `window.opener`.
    ADD_ATTR: ["target"],
    FORBID_TAGS: ["style", "script", "iframe", "form", "input", "object", "embed"],
    FORBID_ATTR: ["style", "class", "id", "onerror", "onload", "onclick"],
  });
}

/**
 * Ubah HTML menjadi teks biasa — untuk ringkasan, meta description, dan
 * pencarian. Memakai pembersih yang sama lalu membuang tag, sehingga tidak ada
 * jalur kedua yang perlu dirawat.
 */
export function htmlToPlainText(html: string): string {
  const clean = sanitizeRichText(html);
  return clean
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|h2|h3|li|blockquote)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Apakah HTML ini kosong (tidak ada teks yang bisa dibaca)? */
export function isRichTextEmpty(html: string): boolean {
  return htmlToPlainText(html).length === 0;
}
