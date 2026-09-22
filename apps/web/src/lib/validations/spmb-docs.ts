/**
 * Jenis dokumen pendaftaran — MURNI (tanpa DB, tanpa "use server").
 *
 * ============================================================
 * KENAPA DI BERKAS TERPISAH
 * ============================================================
 * Berkas `actions.ts` memakai `"use server"`, dan Next.js hanya mengizinkan
 * ekspor berupa FUNGSI ASYNC dari berkas seperti itu. Menaruh konstanta di
 * sana membuat build gagal dengan pesan yang membingungkan.
 *
 * Dipisah ke sini juga lebih tepat secara makna: daftar ini dipakai bersama
 * oleh aksi server DAN komponen klien, jadi ia bukan milik salah satunya.
 */

/** Jenis dokumen yang bisa diunggah. Kuncinya sama dengan kolom di database. */
export const REGISTRATION_DOC_KINDS = [
  "docBirthCert",
  "docFamilyCard",
  "docPhoto",
  "docDiploma",
] as const;

export type RegistrationDocKind = (typeof REGISTRATION_DOC_KINDS)[number];

/** Nama dokumen dalam bahasa yang dipakai sekolah. */
export const REGISTRATION_DOC_LABEL: Record<RegistrationDocKind, string> = {
  docBirthCert: "Akta kelahiran",
  docFamilyCard: "Kartu keluarga",
  docPhoto: "Pas foto",
  docDiploma: "Ijazah / SKL",
};

/** Apakah string ini jenis dokumen yang dikenal? */
export function isRegistrationDocKind(v: string): v is RegistrationDocKind {
  return (REGISTRATION_DOC_KINDS as readonly string[]).includes(v);
}
