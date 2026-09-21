import type { BlockDefinition } from "./site-blocks";

/**
 * Blok GENERAL — dipakai halaman kustom, bukan halaman depan.
 *
 * ============================================================
 * KENAPA DIPISAH DARI site-blocks.ts
 * ============================================================
 * Katalog di `site-blocks.ts` dipakai halaman depan yang sudah berjalan.
 * Menyisipkan dua belas blok baru ke tengah berkas itu berarti menyentuh
 * berkas yang menopang halaman depan — dan satu salah tempel bisa
 * mematikannya. Berkas ini berdiri sendiri lalu digabung di ujung, sehingga
 * perubahan pada blok general tidak bisa merusak halaman depan.
 *
 * ============================================================
 * KENAPA IKONNYA BUKAN EMOJI
 * ============================================================
 * Blok lama memakai emoji sebagai ikon. Itu dilarang `AGENTS.md` — emoji
 * tampil berbeda di setiap sistem operasi, tidak bisa diwarnai, dan membuat
 * antarmuka terlihat seperti mainan. Di sini ikon disimpan sebagai NAMA, dan
 * komponen UI yang menggambarnya sebagai SVG sebaris. Nama tidak bergantung
 * pada bentuk gambar, jadi ikon bisa diganti tanpa menyentuh katalog.
 *
 * ============================================================
 * SEMUA BLOK DI SINI GENERAL
 * ============================================================
 * Tidak ada yang berbau "halaman depan". `requirement: "none"` berarti isinya
 * diisi manual oleh operator — tidak bergantung data berita, guru, atau SPMB.
 * Itu yang membuat blok ini aman dipakai di halaman mana pun, dalam urutan apa
 * pun, dan boleh muncul lebih dari sekali.
 */

export const GENERAL_BLOCK_DEFINITIONS: BlockDefinition[] = [
  /* ============================================================
   * 1. TEKS
   * ============================================================ */
  {
    key: "richtext",
    name: "Teks",
    description: "Paragraf bebas dengan format: judul, daftar, kutipan, tautan.",
    icon: "text",
    requirement: "none",
    allowMultiple: true,
    defaultVariant: "richtext.polos",
    fields: ["heading", "body"],
    variants: [
      {
        key: "richtext.polos",
        label: "Polos",
        hint: "Satu kolom selebar halaman. Paling enak dibaca.",
      },
      {
        key: "richtext.sempit",
        label: "Sempit",
        hint: "Kolom sempit di tengah. Cocok untuk sambutan dan kata pengantar.",
      },
    ],
  },

  /* ============================================================
   * 2. PEMISAH BAGIAN
   * ============================================================ */
  {
    key: "section",
    name: "Pemisah Bagian",
    description: "Judul dan subjudul sebagai penanda bagian baru.",
    icon: "section",
    requirement: "none",
    allowMultiple: true,
    defaultVariant: "section.garis-bawah",
    fields: ["heading", "subheading", "align"],
    variants: [
      {
        key: "section.garis-bawah",
        label: "Garis bawah",
        hint: "Judul dengan garis tipis di bawahnya. Paling rapi.",
      },
      {
        key: "section.tengah",
        label: "Tengah",
        hint: "Judul di tengah halaman. Untuk bagian pembuka.",
      },
      {
        key: "section.nomor",
        label: "Bernomor",
        hint: "Dengan angka besar di samping. Untuk bagian yang berurutan.",
      },
    ],
  },

  /* ============================================================
   * 3. GAMBAR
   * ============================================================ */
  {
    key: "image",
    name: "Gambar",
    description: "Satu gambar dengan keterangan. Bisa dari pustaka media.",
    icon: "image",
    requirement: "none",
    allowMultiple: true,
    defaultVariant: "image.lebar",
    fields: ["imageUrl", "alt", "caption", "width"],
    variants: [
      {
        key: "image.lebar",
        label: "Lebar penuh",
        hint: "Memenuhi lebar halaman. Untuk foto suasana.",
      },
      {
        key: "image.tengah",
        label: "Tengah",
        hint: "Gambar sedang di tengah. Untuk foto orang atau dokumen.",
      },
      {
        key: "image.kiri",
        label: "Rapat kiri",
        hint: "Gambar di kiri, ruang kosong di kanan. Memberi kesan editorial.",
      },
    ],
  },

  /* ============================================================
   * 4. TABEL
   * ============================================================ */
  {
    key: "table",
    name: "Tabel",
    description: "Data berbaris-kolom: rincian biaya, jadwal, syarat pendaftaran.",
    icon: "table",
    requirement: "none",
    allowMultiple: true,
    defaultVariant: "table.garis",
    fields: ["heading", "columns", "rows", "footnote"],
    variants: [
      {
        key: "table.garis",
        label: "Bergaris",
        hint: "Garis tipis antar baris. Paling mudah dibaca.",
      },
      {
        key: "table.belang",
        label: "Belang",
        hint: "Baris bergantian warna. Untuk tabel panjang.",
      },
    ],
  },

  /* ============================================================
   * 5. LANGKAH
   * ============================================================ */
  {
    key: "steps",
    name: "Langkah",
    description: "Prosedur bernomor: alur pendaftaran, pengambilan rapor.",
    icon: "steps",
    requirement: "none",
    allowMultiple: true,
    defaultVariant: "steps.vertikal",
    fields: ["heading", "items"],
    variants: [
      {
        key: "steps.vertikal",
        label: "Vertikal",
        hint: "Ke bawah dengan garis penghubung. Untuk langkah yang berurutan.",
      },
      {
        key: "steps.mendatar",
        label: "Mendatar",
        hint: "Ke samping. Untuk 3–4 langkah singkat.",
        maxItems: 4,
      },
    ],
  },

  /* ============================================================
   * 6. LINIMASA
   * ============================================================ */
  {
    key: "timeline",
    name: "Linimasa",
    description: "Urutan peristiwa menurut tahun — sejarah sekolah.",
    icon: "timeline",
    requirement: "none",
    allowMultiple: true,
    defaultVariant: "timeline.kiri",
    fields: ["heading", "items"],
    variants: [
      {
        key: "timeline.kiri",
        label: "Garis kiri",
        hint: "Garis waktu di kiri, isi di kanan. Paling lazim.",
      },
      {
        key: "timeline.berselang",
        label: "Berselang",
        hint: "Kiri-kanan bergantian. Untuk cerita yang ingin dramatis.",
      },
    ],
  },

  /* ============================================================
   * 7. KARTU
   * ============================================================ */
  {
    key: "cards",
    name: "Kartu",
    description: "Kumpulan kartu: fasilitas, ekstrakurikuler, program unggulan.",
    icon: "cards",
    requirement: "none",
    allowMultiple: true,
    defaultVariant: "cards.kisi",
    fields: ["heading", "items"],
    variants: [
      {
        key: "cards.kisi",
        label: "Kisi",
        hint: "Kartu berjajar dengan gambar. Untuk daftar yang ingin dilihat sekilas.",
        maxItems: 12,
      },
      {
        key: "cards.daftar",
        label: "Daftar",
        hint: "Satu kartu per baris. Untuk isi yang lebih panjang.",
        maxItems: 10,
      },
      {
        key: "cards.angka",
        label: "Angka depan",
        hint: "Angka besar di atas tiap kartu. Untuk data yang ingin ditonjolkan.",
        maxItems: 6,
      },
    ],
  },

  /* ============================================================
   * 8. UNDUHAN
   * ============================================================ */
  {
    key: "downloads",
    name: "Unduhan",
    description: "Berkas yang bisa diunduh: formulir, brosur, kalender akademik.",
    icon: "downloads",
    requirement: "none",
    allowMultiple: true,
    defaultVariant: "downloads.daftar",
    fields: ["heading", "items"],
    variants: [
      {
        key: "downloads.daftar",
        label: "Daftar",
        hint: "Daftar berkas dengan ukuran dan jenisnya.",
      },
      {
        key: "downloads.kartu",
        label: "Kartu",
        hint: "Kartu berjajar. Untuk 2–4 berkas utama.",
        maxItems: 4,
      },
    ],
  },

  /* ============================================================
   * 9. KUTIPAN
   * ============================================================ */
  {
    key: "quote",
    name: "Kutipan",
    description: "Kata-kata yang ditonjolkan: sambutan kepala sekolah, testimoni.",
    icon: "quote",
    requirement: "none",
    allowMultiple: true,
    defaultVariant: "quote.besar",
    fields: ["quote", "attribution", "role", "photoUrl"],
    variants: [
      {
        key: "quote.besar",
        label: "Besar",
        hint: "Teks besar di tengah. Untuk satu kalimat yang kuat.",
      },
      {
        key: "quote.kartu",
        label: "Kartu",
        hint: "Dengan foto dan nama. Untuk sambutan resmi.",
      },
    ],
  },

  /* ============================================================
   * 10. VIDEO
   * ============================================================ */
  {
    key: "video",
    name: "Video",
    description: "Sematan YouTube: profil sekolah, liputan kegiatan.",
    icon: "video",
    requirement: "none",
    allowMultiple: true,
    defaultVariant: "video.lebar",
    fields: ["heading", "youtubeUrl", "caption"],
    variants: [
      {
        key: "video.lebar",
        label: "Lebar penuh",
        hint: "Memenuhi lebar halaman. Untuk video utama.",
      },
      {
        key: "video.tengah",
        label: "Tengah",
        hint: "Ukuran sedang di tengah. Untuk video pendukung.",
      },
    ],
  },

  /* ============================================================
   * 11. PRESTASI
   * ============================================================ */
  {
    key: "achievements",
    name: "Prestasi",
    description: "Daftar prestasi siswa atau sekolah menurut tahun dan tingkat.",
    icon: "achievements",
    requirement: "none",
    allowMultiple: true,
    defaultVariant: "achievements.daftar",
    fields: ["heading", "items"],
    variants: [
      {
        key: "achievements.daftar",
        label: "Daftar",
        hint: "Baris per prestasi dengan tahun dan tingkat.",
        maxItems: 30,
      },
      {
        key: "achievements.sorotan",
        label: "Sorotan",
        hint: "Tiga prestasi terbaik ditonjolkan. Untuk halaman profil.",
        maxItems: 3,
      },
    ],
  },

  /* ============================================================
   * 12. GARIS PEMISAH
   * ============================================================ */
  {
    key: "divider",
    name: "Garis Pemisah",
    description: "Pemisah antar bagian agar halaman bernapas.",
    icon: "divider",
    requirement: "none",
    allowMultiple: true,
    defaultVariant: "divider.garis",
    fields: ["style", "label"],
    variants: [
      {
        key: "divider.garis",
        label: "Garis",
        hint: "Garis tipis selebar halaman.",
      },
      {
        key: "divider.titik",
        label: "Tiga titik",
        hint: "Titik di tengah. Lebih ringan daripada garis.",
      },
      {
        key: "divider.label",
        label: "Dengan label",
        hint: "Garis dengan teks kecil di tengahnya.",
      },
    ],
  },
];

/** Semua kunci blok general — dipakai validasi & penyusun. */
export const GENERAL_BLOCK_KEYS = GENERAL_BLOCK_DEFINITIONS.map((b) => b.key);

/**
 * Susunan awal saat halaman kustom baru dibuat.
 *
 * Sengaja HANYA satu blok teks kosong, bukan susunan halaman depan. Membuka
 * "Visi & Misi" dengan hero dan korsel berita akan membuat operator menghapus
 * lebih banyak daripada menulis.
 */
export const DEFAULT_CUSTOM_PAGE_LAYOUT: {
  blockKey: string;
  variantKey: string;
}[] = [{ blockKey: "richtext", variantKey: "richtext.polos" }];
