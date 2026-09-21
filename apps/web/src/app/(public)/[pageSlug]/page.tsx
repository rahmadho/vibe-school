import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { resolveSchoolFromRequest } from "@/lib/site-server";
import {
  getPageBySlug,
  listPublishedPosts,
  listPeopleForSite,
  getOpenBatches,
  getSiteConfig,
} from "@/lib/data/site";
import { getBlock } from "@/lib/site-blocks";
import { parseStoredPageBlocks } from "@/lib/validations/page-blocks";
import {
  BlockRenderer,
  type BlockData,
  type RenderableBlock,
} from "@/components/site/block-renderer";
import { Section, SiteCard, RichContent } from "@/components/site/site-ui";

/**
 * Halaman kustom buatan sekolah ("Visi & Misi", "Sejarah", "Sambutan Kepala
 * Sekolah", …).
 *
 * ============================================================
 * KENAPA RUTE BAWAAN HARUS DICADANGKAN DI SINI:
 * ============================================================
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

  // `metaTitle`/`metaDescription` sudah lama ada di model tetapi belum pernah
  // dipakai — halaman sekolah jadi tampil dengan judul generik di hasil
  // pencarian. Sekarang keduanya dipakai, dengan judul halaman sebagai cadangan.
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

  const { school } = ctx;
  const page = await getPageBySlug(school.id, pageSlug);
  if (!page) notFound();

  // Susunan blok dari kolom JSON. Divalidasi ulang saat dibaca, bukan
  // dipercaya: data bisa berasal dari versi aplikasi lama atau dari suntingan
  // langsung di database.
  const storedBlocks = parseStoredPageBlocks(page.blocks);

  const resolved: RenderableBlock[] = [];
  for (const b of storedBlocks) {
    if (!b.isEnabled) continue;
    const definition = getBlock(b.blockKey);
    // Blok usang dilewati diam-diam — pengunjung tetap harus bisa membaca
    // sisa halaman walaupun satu blok sudah tidak dikenal.
    if (!definition) continue;
    resolved.push({
      blockKey: b.blockKey,
      variantKey: b.variantKey,
      props: b.props,
      definition,
    });
  }

  // Halaman dengan blok: seluruh halaman disusun blok, judul besar tidak
  // diulang karena blok pertama sudah menjadi pembukanya.
  if (resolved.length > 0) {
    // Data pendukung diambil HANYA bila ada blok yang membutuhkannya. Halaman
    // "Visi & Misi" yang seluruhnya blok teks tidak perlu menarik berita,
    // daftar guru, dan jalur SPMB — dan itu menghemat empat kueri.
    const needs = new Set(
      resolved.map((b) => b.definition.requirement).filter((r) => r !== "none"),
    );

    const [posts, people, spmbBatches, config] = await Promise.all([
      needs.has("posts") ? listPublishedPosts(school.id, { take: 12 }) : [],
      needs.has("teachers") ? listPeopleForSite(school.id, 12) : [],
      needs.has("spmb") ? getOpenBatches(school.id) : [],
      needs.has("contact") ? getSiteConfig(school.id) : null,
    ]);

    const data: BlockData = {
      posts: posts.map((p) => ({
        id: p.id,
        title: p.title,
        slug: p.slug,
        excerpt: p.excerpt,
        coverUrl: p.coverUrl,
        type: p.type,
        publishedAt: p.publishedAt,
        createdAt: p.createdAt,
      })),
      people,
      contact: {
        address: school.address,
        phone: school.phone,
        email: school.email,
        mapsUrl: config?.mapsUrl,
        officeHours: config?.officeHours,
        contactWa: config?.contactWa,
        facebookUrl: config?.facebookUrl,
        instagramUrl: config?.instagramUrl,
        youtubeUrl: config?.youtubeUrl,
        tiktokUrl: config?.tiktokUrl,
      },
      schoolName: school.name,
      logoUrl: school.logoUrl,
      spmbBatches: spmbBatches.map((b) => ({
        id: b.id,
        name: b.name,
        description: b.description,
        openDate: b.openDate,
        closeDate: b.closeDate,
        paths: b.paths.map((p) => ({
          id: p.id,
          name: p.name,
          code: p.code,
          description: p.description,
          registrationFee: p.registrationFee,
          quota: p.quota,
        })),
      })),
    };

    return (
      <div>
        {/* Judul halaman SELALU dirender, walaupun blok pertama punya judulnya
            sendiri. Alasannya dua: setiap halaman perlu satu `<h1>` untuk
            pembaca layar dan mesin pencari, dan blok yang belum diisi
            (mis. blok pemisah tanpa judul) tidak menghasilkan apa pun —
            tanpa baris ini halaman tampil benar-benar kosong. */}
        <Section>
          <h1 className="font-[family-name:var(--site-heading-font)] text-3xl font-semibold text-[var(--site-text)]">
            {page.title}
          </h1>
        </Section>

        {resolved.map((b, i) => (
          <BlockRenderer key={`${b.blockKey}-${i}`} block={b} data={data} />
        ))}
      </div>
    );
  }

  // Halaman tanpa blok: mode teks (perilaku lama, tetap didukung agar halaman
  // yang dibuat sebelum fitur blok tidak berubah tampilannya).
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
            <RichContent html={page.content} />
          </div>
        )}
      </article>
    </Section>
  );
}
