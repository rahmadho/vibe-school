/**
 * Spesifikasi kolom isian untuk setiap blok halaman kustom — MURNI (tanpa DB).
 *
 * ============================================================
 * KENAPA DIPISAH DARI KOMPONEN
 * ============================================================
 * Penyusun blok perlu tahu "blok ini punya kolom apa saja" untuk menggambar
 * formnya. Kalau daftar itu ditulis langsung di dalam JSX, menambah satu kolom
 * berarti menyunting logika render — dan mudah salah. Di sini daftarnya berupa
 * data biasa, sehingga penyusunnya cukup membaca dan menggambar.
 *
 * Berkas ini juga bisa diuji tanpa merender apa pun.
 *
 * ============================================================
 * KENAPA BENTUKNYA BERBEDA DARI `BlockDefinition.fields`
 * ============================================================
 * `fields` di katalog hanya daftar NAMA (dipakai validasi). Di sini tiap kolom
 * punya label, jenis, dan petunjuk — karena operator sekolah perlu tahu apa
 * yang harus ditulis, bukan sekadar nama field bahasa Inggris.
 */

/** Cara menggambar satu kolom isian. */
export type PageFieldKind =
  | "text"
  | "textarea"
  | "richtext"
  | "image"
  | "url"
  | "list";

/** Satu kolom di dalam daftar berulang (mis. judul + isi sebuah langkah). */
export type PageListItemField = {
  key: string;
  label: string;
  kind?: "text" | "textarea" | "image";
  placeholder?: string;
};

export type PageBlockField = {
  /** Nama field di dalam `props`. */
  key: string;
  label: string;
  kind: PageFieldKind;
  hint?: string;
  placeholder?: string;
  /** Dipakai bila `kind` = "list". */
  itemFields?: PageListItemField[];
  /** Batas jumlah item untuk daftar. */
  maxItems?: number;
  /** Label untuk satu item, mis. "Langkah", "Baris", "Kartu". */
  itemLabel?: string;
};

/**
 * Kolom isian per jenis blok.
 *
 * Blok yang tidak ada di sini tetap bisa dipakai — penyusun akan menampilkan
 * pesan "belum ada form isian" alih-alih gagal. Itu penting karena blok inti
 * (hero, news, dst.) memang tidak dirancang untuk halaman kustom.
 */
export const PAGE_BLOCK_FIELDS: Record<string, PageBlockField[]> = {
  richtext: [
    { key: "heading", label: "Judul bagian", kind: "text", placeholder: "Sambutan Kepala Sekolah" },
    {
      key: "body",
      label: "Isi teks",
      kind: "richtext",
      hint: "Boleh dikosongkan bila hanya ingin menampilkan judul.",
    },
  ],

  section: [
    { key: "heading", label: "Judul bagian", kind: "text", placeholder: "Visi & Misi" },
    { key: "subheading", label: "Anak judul", kind: "text", placeholder: "Arah pendidikan sekolah" },
  ],

  image: [
    { key: "imageUrl", label: "Gambar", kind: "image" },
    { key: "alt", label: "Teks alternatif", kind: "text", hint: "Dibaca pembaca layar. Isi bila gambarnya penting." },
    { key: "caption", label: "Keterangan", kind: "text", placeholder: "Gedung utama sekolah" },
  ],

  table: [
    { key: "heading", label: "Judul tabel", kind: "text" },
    {
      key: "columns",
      label: "Kolom",
      kind: "list",
      itemLabel: "Kolom",
      maxItems: 5,
      hint: "Maksimal 5 kolom agar tetap terbaca di ponsel.",
      itemFields: [{ key: "label", label: "Nama kolom", placeholder: "Jenis biaya" }],
    },
    {
      key: "rows",
      label: "Baris",
      kind: "list",
      itemLabel: "Baris",
      maxItems: 30,
      hint: "Isi sesuai urutan kolom di atas.",
      itemFields: [
        { key: "c0", label: "Kolom 1" },
        { key: "c1", label: "Kolom 2" },
        { key: "c2", label: "Kolom 3" },
        { key: "c3", label: "Kolom 4" },
        { key: "c4", label: "Kolom 5" },
      ],
    },
    { key: "footnote", label: "Catatan kaki", kind: "text", hint: "Mis. keterangan tambahan di bawah tabel." },
  ],

  steps: [
    { key: "heading", label: "Judul", kind: "text", placeholder: "Alur Pendaftaran" },
    {
      key: "items",
      label: "Langkah",
      kind: "list",
      itemLabel: "Langkah",
      maxItems: 12,
      itemFields: [
        { key: "title", label: "Nama langkah", placeholder: "Ambil formulir" },
        { key: "body", label: "Penjelasan", kind: "textarea" },
      ],
    },
  ],

  timeline: [
    { key: "heading", label: "Judul", kind: "text", placeholder: "Sejarah Sekolah" },
    {
      key: "items",
      label: "Peristiwa",
      kind: "list",
      itemLabel: "Peristiwa",
      maxItems: 20,
      itemFields: [
        { key: "year", label: "Tahun", placeholder: "1975" },
        { key: "title", label: "Peristiwa", placeholder: "Sekolah berdiri" },
        { key: "body", label: "Keterangan", kind: "textarea" },
      ],
    },
  ],

  cards: [
    { key: "heading", label: "Judul", kind: "text", placeholder: "Fasilitas" },
    {
      key: "items",
      label: "Kartu",
      kind: "list",
      itemLabel: "Kartu",
      maxItems: 12,
      itemFields: [
        { key: "title", label: "Nama", placeholder: "Laboratorium Komputer" },
        { key: "body", label: "Keterangan", kind: "textarea" },
        { key: "imageUrl", label: "Gambar", kind: "image" },
        { key: "value", label: "Angka besar", placeholder: "Untuk varian angka depan" },
      ],
    },
  ],

  downloads: [
    { key: "heading", label: "Judul", kind: "text", placeholder: "Unduhan" },
    {
      key: "items",
      label: "Berkas",
      kind: "list",
      itemLabel: "Berkas",
      maxItems: 20,
      itemFields: [
        { key: "title", label: "Nama berkas", placeholder: "Formulir Pendaftaran" },
        { key: "url", label: "Alamat berkas", kind: "text", placeholder: "https://…" },
        { key: "note", label: "Keterangan", kind: "text" },
        { key: "size", label: "Ukuran", placeholder: "240 KB" },
      ],
    },
  ],

  achievements: [
    { key: "heading", label: "Judul", kind: "text", placeholder: "Prestasi" },
    {
      key: "items",
      label: "Prestasi",
      kind: "list",
      itemLabel: "Prestasi",
      maxItems: 30,
      itemFields: [
        { key: "year", label: "Tahun", placeholder: "2026" },
        { key: "title", label: "Prestasi", placeholder: "Juara 1 OSN Matematika" },
        { key: "winner", label: "Peraih", placeholder: "Nama siswa" },
        { key: "level", label: "Tingkat", placeholder: "Kabupaten" },
      ],
    },
  ],

  quote: [
    { key: "quote", label: "Kutipan", kind: "textarea", placeholder: "Pendidikan adalah…" },
    { key: "attribution", label: "Nama", kind: "text", placeholder: "Drs. Bambang Sutrisno" },
    { key: "role", label: "Jabatan", kind: "text", placeholder: "Kepala Sekolah" },
    { key: "photoUrl", label: "Foto", kind: "image" },
  ],

  video: [
    { key: "heading", label: "Judul", kind: "text" },
    {
      key: "youtubeUrl",
      label: "Alamat YouTube",
      kind: "url",
      hint: "Tempel alamat apa adanya dari peramban — bentuk watch, youtu.be, dan shorts semuanya dikenali.",
      placeholder: "https://www.youtube.com/watch?v=…",
    },
    { key: "caption", label: "Keterangan", kind: "text" },
  ],

  divider: [
    {
      key: "label",
      label: "Teks di tengah",
      kind: "text",
      hint: "Hanya dipakai oleh varian \"Dengan label\".",
      placeholder: "Bagian berikutnya",
    },
  ],
};

/** Ambil kolom isian sebuah blok. Kosong bila belum didefinisikan. */
export function fieldsForBlock(blockKey: string): PageBlockField[] {
  return PAGE_BLOCK_FIELDS[blockKey] ?? [];
}
