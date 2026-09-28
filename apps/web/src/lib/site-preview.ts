import "server-only";
import { prisma } from "@/lib/prisma";
import {
  allowDevFallback,
  buildSchoolUrl,
  rootDomainConfigFromEnv,
} from "@/lib/site-host";

/**
 * Alamat web publik sebuah sekolah — dipakai tombol "Lihat Web Sekolah"
 * yang harus tersedia dari halaman mana pun di dasbor.
 *
 * Di luar produksi dipakai `?school=<slug>` — jembatan yang sudah teruji di
 * `proxy.ts` — karena port server dev (3000/3001/…) tidak diketahui dari
 * sisi server, sedangkan subdomain butuh port itu. Di produksi subdomain wajib
 * (`allowDevFallback()` selalu false), jadi alamat dibangun dari ROOT_DOMAIN.
 *
 * Mengembalikan null bila sekolah belum punya alamat (slug kosong) supaya
 * pemanggil bisa memilih tidak menampilkan tautan mati.
 */
export async function getSchoolPreviewUrl(
  schoolId: string | null | undefined,
): Promise<string | null> {
  if (!schoolId) return null;

  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { slug: true },
  });

  const slug = school?.slug?.trim() ?? "";
  if (!slug) return null;

  return allowDevFallback()
    ? `/?school=${encodeURIComponent(slug)}`
    : buildSchoolUrl(slug, rootDomainConfigFromEnv());
}
