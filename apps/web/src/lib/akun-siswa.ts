import "server-only";
import type { Prisma, PrismaClient } from "@prisma/client";
import { hashPassword } from "@/lib/password-hash";
import { tanggalLahirKePassword, usulanEmailSiswa } from "@/lib/akun-siswa-murni";

/**
 * ============================================================
 * PEMBUATAN AKUN SISWA / WALI
 * ============================================================
 *
 * Keputusan produk: akun dibuat DARI DATA SISWA. NIS anak menjadi username,
 * dan orang tua memakai akun yang sama (satu akun untuk siswa & wali).
 *
 * Mengapa password awal = tanggal lahir:
 *   - Orang tua/siswa pasti tahu tanggal lahir anaknya.
 *   - Tidak perlu distribusi password terpisah (yang pasti bocor lewat grup WA).
 *   - Akun LANGSUNG ditandai `mustChangePassword` supaya password yang dapat
 *     ditebak ini tidak dipakai permanen.
 *
 * PENTING: fungsi ini menerima `tx` (Prisma.TransactionClient) supaya bisa
 * dipanggil DI DALAM transaksi pembuatan siswa. Kalau akun dibuat di luar
 * transaksi dan pembuatan siswa gagal, akan ada akun yatim.
 */

export type HasilAkunSiswa =
  | { status: "dibuat"; userId: string }
  | { status: "dilewati"; alasan: string }
  | { status: "gagal"; alasan: string };

type Tx = Prisma.TransactionClient | PrismaClient;

/**
 * Buat akun login untuk seorang siswa.
 *
 * Aman dipanggil dua kali (idempoten): bila student sudah punya User, atau
 * username sudah terpakai, fungsi ini melewati tanpa melempar.
 */
export async function buatAkunSiswa(
  tx: Tx,
  input: {
    studentId: string;
    schoolId: string;
    nis: string;
    nama: string;
    tanggalLahir: Date | null;
    slugSekolah: string;
  },
): Promise<HasilAkunSiswa> {
  const { studentId, schoolId, nis, nama, tanggalLahir, slugSekolah } = input;

  if (!nis?.trim()) {
    return { status: "dilewati", alasan: "NIS kosong — tanpa NIS tidak ada username." };
  }

  // Sudah punya akun? (relasi User.studentId @unique)
  const sudahAda = await tx.user.findUnique({
    where: { studentId },
    select: { id: true },
  });
  if (sudahAda) {
    return { status: "dilewati", alasan: "Siswa ini sudah punya akun." };
  }

  // Username = NIS, unik per sekolah. Bila sudah dipakai akun lain
  // (mis. NIS ganda karena salah input), JANGAN timpa — laporkan.
  const bentrok = await tx.user.findFirst({
    where: { schoolId, username: nis.trim() },
    select: { id: true },
  });
  if (bentrok) {
    return {
      status: "gagal",
      alasan: `NIS ${nis} sudah dipakai akun lain. Periksa data siswa ganda.`,
    };
  }

  const email = usulanEmailSiswa(nis, slugSekolah);

  // Email juga unik global. Bila bentrok, tambahkan akhiran deterministik
  // (bukan acak) supaya percobaan ulang menghasilkan alamat yang sama.
  const emailTerpakai = await tx.user.findUnique({
    where: { email },
    select: { id: true },
  });
  const emailFinal = emailTerpakai
    ? `${email.replace("@", `.${schoolId.slice(-6)}@`)}`
    : email;

  const passwordAwal = tanggalLahirKePassword(tanggalLahir) ?? nis.trim();

  try {
    const user = await tx.user.create({
      data: {
        schoolId,
        email: emailFinal,
        username: nis.trim(),
        // Tanpa `server-only`: hashPassword dari password-hash.ts, agar bisa
        // dipakai di luar runtime Next (impor & seed).
        passwordHash: await hashPassword(passwordAwal),
        name: nama,
        role: "STUDENT",
        studentId,
        mustChangePassword: true,
      },
      select: { id: true },
    });
    return { status: "dibuat", userId: user.id };
  } catch (e) {
    return {
      status: "gagal",
      alasan: e instanceof Error ? e.message : "Gagal membuat akun.",
    };
  }
}

/**
 * Buat akun untuk BANYAK siswa sekaligus (dipakai impor Excel & SPMB).
 * Mengembalikan ringkasan supaya operator tahu siapa yang gagal, bukan hanya
 * "berhasil" secara keseluruhan.
 */
export async function buatAkunSiswaMassal(
  tx: Tx,
  daftar: {
    studentId: string;
    nis: string;
    nama: string;
    tanggalLahir: Date | null;
  }[],
  schoolId: string,
  slugSekolah: string,
): Promise<{ dibuat: number; dilewati: number; gagal: { nis: string; alasan: string }[] }> {
  let dibuat = 0;
  let dilewati = 0;
  const gagal: { nis: string; alasan: string }[] = [];

  for (const s of daftar) {
    const hasil = await buatAkunSiswa(tx, {
      ...s,
      schoolId,
      slugSekolah,
    });
    if (hasil.status === "dibuat") dibuat += 1;
    else if (hasil.status === "dilewati") dilewati += 1;
    else gagal.push({ nis: s.nis, alasan: hasil.alasan });
  }

  return { dibuat, dilewati, gagal };
}
