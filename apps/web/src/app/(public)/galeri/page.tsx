import Link from "next/link";
import { notFound } from "next/navigation";
import { resolveSchoolFromRequest } from "@/lib/site-server";
import { listPublishedPosts } from "@/lib/data/site";
import { Section, SectionHeading, SiteImage, BlockEmpty } from "@/components/site/site-ui";

/**
 * Galeri foto sekolah.
 *
 * Hanya tulisan bergambar yang ditampilkan: kartu tanpa gambar di halaman
 * galeri terasa seperti kesalahan, bukan konten. Foto dibuka ke halaman
 * detailnya agar sekolah bisa menambahkan keterangan kegiatan.
 */
export const dynamic = "force-dynamic";
export const metadata = { title: "Galeri" };

export default async function GalleryPage() {
  const ctx = await resolveSchoolFromRequest();
  if (ctx.status !== "ok") notFound();

  const items = await listPublishedPosts(ctx.school.id, { type: "GALLERY", take: 60 });
  const withPhoto = items.filter((i) => Boolean(i.coverUrl));

  return (
    <Section>
      <SectionHeading
        title="Galeri"
        subtitle={`Dokumentasi kegiatan ${ctx.school.name}`}
      />

      {withPhoto.length === 0 && (
        <BlockEmpty
          message="Belum ada foto"
          hint="Tulisan bergambar yang diterbitkan sekolah akan tampil di sini."
        />
      )}

      <div className="site-stagger grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {withPhoto.map((g) => (
          <Link key={g.id} href={`/berita/${g.slug}`} className="group block">
            <SiteImage zoomOnHover src={g.coverUrl} alt={g.title} ratio="1/1" />
            <p className="mt-1.5 line-clamp-2 text-xs text-[var(--site-muted)] group-hover:text-[var(--site-text)]">
              {g.title}
            </p>
          </Link>
        ))}
      </div>
    </Section>
  );
}
