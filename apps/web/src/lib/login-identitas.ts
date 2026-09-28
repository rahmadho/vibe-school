import "server-only";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
  allowDevFallback,
  resolveDevFallback,
  resolveHost,
  rootDomainConfigFromEnv,
  type HostResolution,
} from "@/lib/site-host";
import { slugSekolahValid } from "@/lib/login-identitas-murni";

/**
 * ============================================================
 * LOGIN DENGAN NIS — sisi server (menyentuh DB & header)
 * ============================================================
 *
 * Aturan murni ada di `login-identitas-murni.ts` (teruji tanpa DB):
 *   - klasifikasi input email vs NIS
 *   - validasi slug sekolah
 *
 * Berkas ini hanya menjembatani ke database & Next.js.
 */

/** Field user yang diperlukan proses login. */
export const USER_LOGIN_SELECT = {
  id: true,
  email: true,
  name: true,
  passwordHash: true,
  role: true,
  schoolId: true,
  isActive: true,
  deletedAt: true,
  mustChangePassword: true,
} as const;

/** Cari sekolah aktif berdasarkan slug. null bila tidak ada / tidak valid. */
async function sekolahDariSlug(slug: unknown): Promise<string | null> {
  if (!slugSekolahValid(slug)) return null;
  const school = await prisma.school.findFirst({
    where: { slug: slug.trim(), deletedAt: null },
    select: { id: true },
  });
  return school?.id ?? null;
}

/**
 * Tentukan schoolId dari host permintaan yang sedang berjalan.
 *
 * Dipakai sebagai CADANGAN bila halaman login tidak mengirim slug. Di produksi
 * sekolah selalu punya subdomain sendiri, jadi jalur ini yang utama di sana.
 */
export async function schoolIdDariHost(): Promise<string | null> {
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
    if (!host) return null;

    const resolution: HostResolution = resolveHost(
      host,
      rootDomainConfigFromEnv(),
    );

    if (resolution.kind === "school") {
      return sekolahDariSlug(resolution.identifier);
    }

    // Cadangan pengembangan: hanya bila subdomain belum bisa diatur DAN kita
    // tidak di produksi. Di produksi resolveDevFallback selalu null.
    if (allowDevFallback()) {
      const dev = resolveDevFallback(h.get("x-dev-school"), true);
      if (dev && dev.kind === "school") {
        return sekolahDariSlug(dev.identifier);
      }
    }

    return null;
  } catch {
    // `headers()` di luar request scope (mis. dipanggil dari skrip) → tolak.
    return null;
  }
}

/**
 * Selesaikan schoolId untuk login berbasis NIS.
 *
 * @param slugDariForm slug sekolah yang ikut dikirim halaman login (opsional).
 *
 * Bila slug DIKIRIM tapi tidak cocok, hasilnya null — sengaja TIDAK jatuh ke
 * host. Jatuh ke host berarti pengguna bisa masuk ke sekolah berbeda dari yang
 * ia pilih di layar; lebih baik gagal dan minta ulang.
 */
export async function schoolIdUntukLoginNis(
  slugDariForm?: string | null,
): Promise<string | null> {
  const slug = slugDariForm?.trim();
  if (slug) return sekolahDariSlug(slug);
  return schoolIdDariHost();
}
