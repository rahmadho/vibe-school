import { guard } from "@/lib/action-guard";
import { getSiteConfig } from "@/lib/data/site";
import {
  allowDevFallback,
  buildSchoolUrl,
  rootDomainConfigFromEnv,
} from "@/lib/site-host";
import { prisma } from "@/lib/prisma";
import { LogoBox } from "./logo-box";
import { SettingsForm } from "./settings-form";

/**
 * Halaman pengaturan identitas & kontak web sekolah.
 *
 * Dipisah dari halaman utama "Web Sekolah" (susunan blok + tema) karena isinya
 * berbeda sifat: di sini operator mengisi DATA (tagline, kontak, sosial media),
 * bukan mengatur tampilan. Menggabungkannya membuat satu halaman terlalu
 * panjang dan sulit dipakai dari ponsel.
 */

export const metadata = { title: "Identitas & Kontak Web" };
export const dynamic = "force-dynamic";

export default async function WebsiteSettingsPage() {
  const g = await guard("website", "read");
  if ("fail" in g) {
    return (
      <div className="mx-auto max-w-md border-2 border-[var(--chalk)] bg-white p-6 text-center">
        <p className="font-display text-lg font-semibold text-[var(--ink)]">
          Tidak dapat diakses
        </p>
        <p className="mt-2 text-sm text-[var(--slate)]">
          {g.fail.ok ? "Tidak diizinkan." : g.fail.error}
        </p>
      </div>
    );
  }

  const { schoolId } = g.ctx;

  const [config, school] = await Promise.all([
    getSiteConfig(schoolId),
    prisma.school.findUnique({
      where: { id: schoolId },
      select: { name: true, slug: true, logoUrl: true },
    }),
  ]);

  const schoolName = school?.name ?? "Sekolah";
  const slug = school?.slug?.trim() ?? "";

  /*
   * Alamat web publik untuk tombol pratinjau.
   *
   * Di luar produksi dipakai `?school=<slug>` — jembatan yang sudah teruji di
   * middleware.ts — karena port server dev (3000/3001/…) tidak diketahui dari
   * sini, sedangkan subdomain butuh port itu. Di produksi subdomain wajib
   * (allowDevFallback() selalu false), jadi alamat dibangun dari ROOT_DOMAIN.
   */
  const previewUrl = !slug
    ? null
    : allowDevFallback()
      ? `/?school=${encodeURIComponent(slug)}`
      : buildSchoolUrl(slug, rootDomainConfigFromEnv());

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Logo dipisah dari form utama karena berkas dikirim dengan cara berbeda
          (multipart, bukan field teks) — mencampurnya membuat satu form punya
          dua cara simpan dan membingungkan. */}
      <LogoBox currentUrl={school?.logoUrl ?? ""} schoolName={schoolName} />

      <SettingsForm
        schoolName={schoolName}
        slug={slug}
        previewUrl={previewUrl}
        config={{
          tagline: config?.tagline ?? "",
          shortDescription: config?.shortDescription ?? "",
          homepageMode: config?.homepageMode ?? "BLOCKS",
          beritaUrl: config?.beritaUrl ?? "",
          contactWa: config?.contactWa ?? "",
          facebookUrl: config?.facebookUrl ?? "",
          instagramUrl: config?.instagramUrl ?? "",
          youtubeUrl: config?.youtubeUrl ?? "",
          tiktokUrl: config?.tiktokUrl ?? "",
          mapsUrl: config?.mapsUrl ?? "",
          officeHours: config?.officeHours ?? "",
        }}
      />
    </div>
  );
}
