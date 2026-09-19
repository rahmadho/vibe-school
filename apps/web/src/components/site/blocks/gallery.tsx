import Link from "next/link";
import { BlockEmpty, Section, SectionHeading, SiteImage } from "@/components/site/site-ui";
import type { PostItem } from "@/components/site/blocks/news";

/**
 * Blok "gallery" (Galeri Foto) — 2 varian gaya.
 *
 * POLA WAJIB (lihat hero.tsx): pilih varian lewat `variantKey`, warna HANYA
 * dari CSS variable (--site-*), dan tampilkan `BlockEmpty` bila data kosong.
 * Server component: tanpa "use client" dan tanpa state.
 *
 * `PostItem` diimpor dari blok news — satu sumber kebenaran bentuk data.
 * Hanya item yang punya `coverUrl` yang dirender — foto tanpa gambar tidak
 * berguna di galeri dan akan membuat kisi berlubang.
 */

export type GalleryProps = {
  heading?: string;
  itemCount?: number;
};

export function GalleryBlock({
  props,
  variantKey,
  posts,
}: {
  props: GalleryProps;
  variantKey: string;
  posts: PostItem[];
}) {
  const heading = props.heading?.trim() || "";
  const limit = props.itemCount && props.itemCount > 0 ? props.itemCount : 6;

  // Buang item tanpa gambar lebih dulu, sisanya dibatasi `itemCount`.
  const items = posts.filter((p) => Boolean(p.coverUrl)).slice(0, limit);

  if (items.length === 0) {
    return (
      <Section>
        <SectionHeading title={heading} />
        <BlockEmpty
          message="Belum ada foto"
          hint="Unggah foto kegiatan lewat menu Konten dengan jenis Galeri."
        />
      </Section>
    );
  }

  /* ---------- Varian: kisi seragam ---------- */
  if (variantKey === "gallery.kisi") {
    return (
      <Section>
        <SectionHeading title={heading} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((post) => (
            <Link
              key={post.id}
              href={`/galeri/${post.slug}`}
              className="block transition-opacity hover:opacity-90"
            >
              <SiteImage src={post.coverUrl} alt={post.title} ratio="1/1" />
            </Link>
          ))}
        </div>
      </Section>
    );
  }

  /* ---------- Varian: mosaik (foto utama 2x2) ---------- */
  return (
    <Section>
      <SectionHeading title={heading} />
      <div
        className="grid grid-cols-2 gap-3 lg:grid-cols-4"
        style={{ gridAutoRows: "minmax(0, 1fr)" }}
      >
        {items.map((post, index) => (
          <Link
            key={post.id}
            href={`/galeri/${post.slug}`}
            className={`block transition-opacity hover:opacity-90 ${
              index === 0 ? "col-span-2 row-span-2" : ""
            }`}
          >
            <SiteImage
              src={post.coverUrl}
              alt={post.title}
              ratio="1/1"
              className="h-full w-full"
            />
          </Link>
        ))}
      </div>
    </Section>
  );
}
