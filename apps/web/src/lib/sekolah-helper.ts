import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Ambil slug sekolah (dipakai membentuk email akun siswa).
 *
 * Bila sekolah tidak ditemukan, mengembalikan "sekolah" sebagai cadangan
 * supaya pembuatan akun tidak gagal total hanya karena slug hilang — email
 * tetap unik karena ada pemeriksaan bentrok di `buatAkunSiswa`.
 */
export async function ambilSlugSekolah(schoolId: string): Promise<string> {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { slug: true },
  });
  return school?.slug ?? "sekolah";
}
