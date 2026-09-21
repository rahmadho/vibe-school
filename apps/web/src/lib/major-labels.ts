import type { SchoolLevel } from "@prisma/client";

/**
 * Istilah "jurusan" berbeda tiap jenjang, tetapi STRUKTUR DATANYA SATU
 * (`model Major`). Berkas ini satu-satunya tempat penerjemahan istilah itu,
 * supaya halaman yang sama bisa tampil sebagai "Peminatan" di SMA dan
 * "Kompetensi Keahlian" di SMK tanpa menduplikasi layar.
 *
 * KENAPA TIDAK MEMBUAT DUA MODEL TERPISAH:
 * Peminatan SMA dan jurusan SMK punya bentuk identik (kode, nama, ketua
 * program, terhubung ke kelas & siswa). Memisahkannya berarti menggandakan
 * setiap query, form, dan validasi — lalu keduanya menyimpang seiring waktu.
 */

export type MajorTerminology = {
  /** Istilah tunggal, mis. "Peminatan" — dipakai di label form. */
  singular: string;
  /** Istilah jamak, mis. "Peminatan" — dipakai di judul halaman. */
  plural: string;
  /** Contoh isian, ditampilkan sebagai placeholder. */
  example: string;
  /** Apakah jenjang ini lazim memakai jurusan. */
  typical: boolean;
};

const TERMINOLOGY: Record<SchoolLevel, MajorTerminology> = {
  TK: { singular: "Kelompok", plural: "Kelompok", example: "Kelompok A", typical: false },
  SD: { singular: "Kelompok", plural: "Kelompok", example: "Kelompok A", typical: false },
  MI: { singular: "Kelompok", plural: "Kelompok", example: "Kelompok A", typical: false },
  SMP: { singular: "Jurusan", plural: "Jurusan", example: "Jurusan", typical: false },
  MTs: { singular: "Jurusan", plural: "Jurusan", example: "Jurusan", typical: false },
  SMA: {
    singular: "Peminatan",
    plural: "Peminatan",
    example: "MIPA, IPS, Bahasa",
    typical: true,
  },
  MA: {
    singular: "Peminatan",
    plural: "Peminatan",
    example: "MIPA, IPS, Bahasa, Keagamaan",
    typical: true,
  },
  SMK: {
    singular: "Kompetensi Keahlian",
    plural: "Kompetensi Keahlian",
    example: "RPL, TKJ, Akuntansi",
    typical: true,
  },
  MAK: {
    singular: "Kompetensi Keahlian",
    plural: "Kompetensi Keahlian",
    example: "RPL, TKJ, Akuntansi",
    typical: true,
  },
};

/** Istilah jurusan untuk jenjang tertentu. */
export function majorTerminology(level: SchoolLevel | string | null | undefined): MajorTerminology {
  if (!level) return TERMINOLOGY.SMP;
  return TERMINOLOGY[level as SchoolLevel] ?? TERMINOLOGY.SMP;
}

/**
 * Apakah jenjang ini lazim memakai jurusan.
 * Dipakai untuk memutuskan apakah menu Jurusan ditampilkan menonjol atau
 * disembunyikan di balik "opsional" — bukan untuk melarang, karena SMP pun
 * boleh punya program khusus.
 */
export function majorIsTypical(level: SchoolLevel | string | null | undefined): boolean {
  return majorTerminology(level).typical;
}

/**
 * Apakah jenjang ini memakai modul PKL & UKK.
 * Hanya SMK/MAK yang keduanya wajib; SMA/MA tidak memerlukannya.
 */
export function usesVocationalModules(level: SchoolLevel | string | null | undefined): boolean {
  return level === "SMK" || level === "MAK";
}
