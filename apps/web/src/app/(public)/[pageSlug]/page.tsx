import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { resolveSchoolFromRequest } from "@/lib/site-server";
import { getPageBySlug } from "@/lib/data/site";
import { Section, Prose, SiteCard } from "@/components/site/site-ui";

/**
 * Halaman kustom buatan sekolah ("Visi & Misi", "Sejarah", "Sambutan Kepala
 * Sekolah", …).
 *
 * KENAPA RUTE BAWAAN HARUS DICADANGKAN DI SINI:
 * Rute dinamis `[pageSlug]` cocok dengan HAMPIR SEMUA jalur satu tingkat. Kalau
 * tidak dicadangkan, halaman kustom bernama "spmb" akan menutupi formulir
 * pendaftaran, dan "berita" akan menutupi daftar berita. Next.js memilih rute
 * statis lebih dulu, jadi dalam praktiknya aman — tetapi ini bergantung pada
 * urutan berkas, bukan niat. Menolaknya secara eksplisit membuat aturan itu
 * terlihat di kode dan tidak bisa rusak karena seseorang memindahkan berkas.
 */
const RESERVED_SLUGS = new Set([
  "berita",
  "agenda",
  "galeri",
  "spmb",
  "kontak",
  "sitemap.xml",
  "robots.txt",
  "not-found",
]);

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ pageSlug: string }>;
}): Promise<Metadata> {
  const { pageSlug } = await params;
  const ctx = await resolveSchoolFromRequest();
  if (ctx.status !== "ok") return { title: "Halaman" };

  const page = await getPageBySlug(ctx.school.id, pageSlug);
  if (!page) return { title: "Halaman" };

  return {
    title: page.metaTitle || page.title,
    description: page.metaDescription || undefined,
  };
}

export default async function CustomPage({
  params,
}: {
  params: Promise<{ pageSlug: string }>;
}) {
  const { pageSlug } = await params;
  if (RESERVED_SLUGS.has(pageSlug)) notFound();

  const ctx = await resolveSchoolFromRequest();
  if (ctx.status !== "ok") notFound();

  const page = await getPageBySlug(ctx.school.id, pageSlug);
  if (!page) notFound();

  return (
    <Section>
      <article className="mx-auto max-w-3xl">
        <h1 className="font-[family-name:var(--site-heading-font)] text-3xl font-semibold text-[var(--site-text)]">
          {page.title}
        </h1>

        {page.content.trim() === "" ? (
          // Halaman yang sudah ditautkan di menu tapi isinya belum diisi.
          // Kotak kosong lebih baik daripada halaman yang tampak rusak.
          <div className="mt-6">
            <SiteCard className="p-6">
              <p className="text-sm text-[var(--site-muted)]">
                Isi halaman ini belum diisi oleh sekolah.
              </p>
            </SiteCard>
          </div>
        ) : (
          <div className="mt-6">
            <Prose text={page.content} />
          </div>
        )}
      </article>
    </Section>
  );
}
