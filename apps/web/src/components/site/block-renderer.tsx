import {
  Section,
  SiteButton,
  SiteCard,
  SectionHeading,
  formatSiteDate,
} from "@/components/site/site-ui";
import type { BlockDefinition } from "@/lib/site-blocks";

import { HeroBlock, type HeroProps } from "@/components/site/blocks/hero";
import { StatsBlock, type StatsProps } from "@/components/site/blocks/stats";
import { FaqBlock, type FaqProps } from "@/components/site/blocks/faq";
import { ProfileBlock, type ProfileProps } from "@/components/site/blocks/profile";
import {
  NewsBlock,
  type NewsProps,
  type PostItem,
} from "@/components/site/blocks/news";
import { AgendaBlock, type AgendaProps } from "@/components/site/blocks/agenda";
import { GalleryBlock, type GalleryProps } from "@/components/site/blocks/gallery";
import {
  TeachersBlock,
  type TeachersProps,
  type PersonItem,
} from "@/components/site/blocks/teachers";
import {
  ContactBlock,
  type ContactProps,
  type ContactInfo,
} from "@/components/site/blocks/contact";

/* ---- Blok general (halaman kustom) ---- */
import {
  RichTextBlock,
  type RichTextProps,
  ImageBlock,
  type ImageProps as ImageBlockProps,
  SectionBlock,
  type SectionProps as SectionBlockProps,
  DividerBlock,
  type DividerProps,
} from "@/components/site/blocks/general-text";
import {
  TableBlock,
  type TableProps,
  StepsBlock,
  type StepsProps,
  TimelineBlock,
  type TimelineProps,
  AchievementsBlock,
  type AchievementsProps,
  DownloadsBlock,
  type DownloadsProps,
  CardsBlock,
  type CardsProps,
  QuoteBlock,
  type QuoteProps,
  VideoBlock,
  type VideoProps,
} from "@/components/site/blocks/general-data";

/**
 * PUSAT RENDER WEB SEKOLAH
 *
 * File ini memilih komponen mana yang merender sebuah blok, berdasarkan
 * `block.blockKey`. Semua komponen blok berada di folder `blocks/` dan sudah
 * punya kontrak nama file + nama ekspor yang tetap, sehingga renderer ini bisa
 * ditulis tanpa perlu tahu isi masing-masing komponen.
 *
 * ATURAN PENTING:
 *  - Ini Server Component murni (tanpa "use client", tanpa state). Halaman
 *    publik dirender di server agar cepat dan aman.
 *  - Warna HANYA berasal dari CSS variable `--site-*` (lihat site-ui.tsx).
 *  - Blok yang tidak dikenal DILEWATI (return null), bukan membuat halaman
 *    gagal render. Lihat penjelasan di `BlockRenderer`.
 */

/* ============================================================
 * TIPE DATA MASUKAN
 * ============================================================ */

/*
 * `PostItem`, `PersonItem`, dan `ContactInfo` TIDAK didefinisikan ulang di sini.
 * Ketiganya diimpor langsung dari komponen blok pemakainya lalu di-export
 * ulang supaya hanya ada SATU sumber kebenaran bentuk data. Kalau kita
 * mendefinisikan versi sendiri, sedikit perbedaan (mis. `excerpt` boleh
 * `undefined` vs `null`) membuat data dari DB tidak bisa dikirim ke komponen
 * tanpa cast paksa — dan itu menghilangkan manfaat TypeScript.
 */
export type { PostItem, PersonItem, ContactInfo };

/** Satu jalur pendaftaran di dalam gelombang SPMB. */
export type SpmbPath = {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  /** Nominal dalam Rupiah (integer). null/0 berarti gratis. */
  registrationFee?: number | null;
  quota?: number | null;
};

/** Satu gelombang SPMB beserta jalur-jalurnya. */
export type SpmbBatch = {
  id: string;
  name: string;
  description?: string | null;
  openDate?: string | Date | null;
  closeDate?: string | Date | null;
  paths: SpmbPath[];
};

/**
 * Seluruh data yang mungkin dibutuhkan blok.
 *
 * Dikumpulkan di satu tempat (bukan diambil per-blok) supaya halaman publik
 * cukup melakukan SATU kali pengambilan data, lalu semua blok dirender dari
 * objek yang sama. Ini mengurangi query DB dan mencegah N+1.
 */
export type BlockData = {
  posts: PostItem[];
  people: PersonItem[];
  contact: ContactInfo;
  schoolName: string;
  logoUrl?: string | null;
  spmbBatches: SpmbBatch[];
};

/** Satu blok siap-render: definisi + varian + isi yang diisi sekolah. */
export type RenderableBlock = {
  blockKey: string;
  variantKey: string;
  /** Isi dari DB — bertipe longgar, di-cast terkontrol di tiap cabang. */
  props: Record<string, unknown>;
  definition: BlockDefinition;
};

/* ============================================================
 * PEMBANTU FORMAT
 * ============================================================ */

/**
 * Format Rupiah tanpa desimal — sesuai aturan "Uang = integer".
 * `null`/`0` dianggap gratis agar sekolah tidak perlu menulis "0" yang
 * membingungkan calon pendaftar.
 */
function formatRupiah(value: number | null | undefined): string {
  if (value === null || value === undefined || value === 0) return "Gratis";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

/* ============================================================
 * BLOK SPMB (ditulis lokal, tidak ada sub-agent untuk blok ini)
 * ============================================================ */

type SpmbProps = {
  title?: string;
  subtitle?: string;
};

/**
 * Blok "Ajakan Mendaftar (SPMB)" — 2 varian.
 *
 * Ditulis di dalam file ini karena blok SPMB erat kaitannya dengan data
 * gelombang/jalur dan aturan tampilannya, sehingga lebih mudah dijaga di satu
 * tempat daripada dipecah ke file terpisah.
 */
function SpmbBlock({
  props,
  variantKey,
  batches,
}: {
  props: SpmbProps;
  variantKey: string;
  batches: SpmbBatch[];
}) {
  const title = props.title?.trim() || "Penerimaan Murid Baru";
  const subtitle =
    props.subtitle?.trim() ||
    "Bergabunglah bersama kami. Pendaftaran dibuka untuk putra-putri Anda.";

  const openCount = batches.length;
  const daftarHref = "/spmb";

  /* ---------- Keadaan kosong ---------- */
  /*
   * Blok ajakan HARUS tetap menarik walau belum ada gelombang aktif.
   * Karena itu sengaja TIDAK memakai `BlockEmpty` (yang terlihat seperti
   * peringatan bagi admin): pengunjung tetap melihat ajakan dan cara
   * menghubungi sekolah.
   */
  if (openCount === 0) {
    return (
      <Section tone="primary">
        <div className="mx-auto max-w-2xl text-center">
          <SectionHeading title={title} subtitle={subtitle} align="center" onPrimary />
          <p className="text-base leading-relaxed opacity-90">
            Jadwal pendaftaran gelombang berikutnya belum diumumkan. Silakan
            hubungi sekolah untuk informasi penerimaan murid baru dan jadwal
            pendaftaran terdekat.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <SiteButton href="/kontak" variant="accent">
              Hubungi Sekolah
            </SiteButton>
          </div>
        </div>
      </Section>
    );
  }

  /* ---------- Varian: bilah ringkas ---------- */
  /*
   * Nada "ringkas": tidak memakai tone primary supaya tidak bersaing dengan
   * blok Pembuka. Tetap menyebut jumlah gelombang terbuka agar terasa hidup,
   * dan tombol tetap di sisi kanan agar terlihat tanpa harus menggulir.
   */
  if (variantKey === "spmb.bilah") {
    return (
      <Section tone="surface">
        <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-[family-name:var(--site-heading-font)] text-xl font-bold tracking-tight text-[var(--site-text)] sm:text-2xl">
              {title}
            </h2>
            <p className="mt-1 text-base text-[var(--site-muted)]">
              {subtitle}
            </p>
            <p className="mt-2 text-sm font-medium text-[var(--site-text)]">
              {openCount} gelombang sedang dibuka untuk pendaftaran.
            </p>
          </div>
          <SiteButton href={daftarHref} variant="accent">
            Daftar Sekarang
          </SiteButton>
        </div>
      </Section>
    );
  }

  /* ---------- Varian: kartu menonjol (default) ---------- */
  return (
    <Section tone="primary">
      <SectionHeading title={title} subtitle={subtitle} align="center" onPrimary />

      <div className="grid gap-5 sm:grid-cols-2">
        {batches.map((batch) => (
          <SiteCard key={batch.id} onPrimary className="p-6">
            <h3 className="font-[family-name:var(--site-heading-font)] text-lg font-bold">
              {batch.name}
            </h3>

            {formatSiteDate(batch.openDate) || formatSiteDate(batch.closeDate) ? (
              <p className="mt-1 text-sm opacity-90">
                {formatSiteDate(batch.openDate)}
                {formatSiteDate(batch.openDate) && formatSiteDate(batch.closeDate)
                  ? " – "
                  : ""}
                {formatSiteDate(batch.closeDate)}
              </p>
            ) : null}

            {batch.description ? (
              <p className="mt-3 text-sm leading-relaxed opacity-90">
                {batch.description}
              </p>
            ) : null}

            {/* Daftar jalur + biaya pendaftaran masing-masing. */}
            {batch.paths.length > 0 ? (
              <ul className="mt-4 space-y-2">
                {batch.paths.map((path) => (
                  <li
                    key={path.id}
                    className="flex items-baseline justify-between gap-3 border-t border-white/25 pt-2 text-sm"
                  >
                    <span className="font-medium">{path.name}</span>
                    <span className="shrink-0 tabular-nums opacity-90">
                      {formatRupiah(path.registrationFee)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </SiteCard>
        ))}
      </div>

      <div className="mt-8 flex justify-center">
        <SiteButton href={daftarHref} variant="accent">
          Daftar Sekarang
        </SiteButton>
      </div>
    </Section>
  );
}

/* ============================================================
 * RENDERER UTAMA
 * ============================================================ */

/**
 * Memilih dan merender satu blok.
 *
 * KEPUTUSAN: blockKey yang tidak dikenal mengembalikan `null` (dilewati diam-diam).
 * Alasan: sekolah bisa saja masih menyimpan data blok dari versi lama yang
 * fiturnya sudah dihapus. Halaman publik TIDAK BOLEH gagal render hanya karena
 * satu blok usang — pengunjung tetap harus bisa membaca sisanya. Validasi &
 * peringatan untuk admin sudah ditangani `validateLayout()` di lib/site-blocks.
 */
export function BlockRenderer({
  block,
  data,
}: {
  block: RenderableBlock;
  data: BlockData;
}) {
  switch (block.blockKey) {
    case "hero": {
      const p = block.props as HeroProps;
      return (
        <HeroBlock
          props={p}
          variantKey={block.variantKey}
          schoolName={data.schoolName}
          logoUrl={data.logoUrl}
        />
      );
    }

    case "stats": {
      const p = block.props as StatsProps;
      return <StatsBlock props={p} variantKey={block.variantKey} />;
    }

    case "faq": {
      const p = block.props as FaqProps;
      return <FaqBlock props={p} variantKey={block.variantKey} />;
    }

    case "profile": {
      const p = block.props as ProfileProps;
      return <ProfileBlock props={p} variantKey={block.variantKey} />;
    }

    case "news": {
      const p = block.props as NewsProps;
      return (
        <NewsBlock
          props={p}
          variantKey={block.variantKey}
          posts={data.posts}
        />
      );
    }

    case "agenda": {
      const p = block.props as AgendaProps;
      return (
        <AgendaBlock
          props={p}
          variantKey={block.variantKey}
          posts={data.posts}
        />
      );
    }

    case "gallery": {
      const p = block.props as GalleryProps;
      return (
        <GalleryBlock
          props={p}
          variantKey={block.variantKey}
          /*
           * Cast terkontrol: bentuk `PostItem` milik blok gallery identik,
           * hanya berbeda pada `excerpt` (di sana tidak mengizinkan
           * `undefined`). `BlockData.posts` memakai bentuk kanonik dari
           * blok news (sumber kebenaran bersama), jadi cast ini aman.
           */
          posts={data.posts as unknown as PostItem[]}
        />
      );
    }

    case "teachers": {
      const p = block.props as TeachersProps;
      return (
        <TeachersBlock
          props={p}
          variantKey={block.variantKey}
          people={data.people}
        />
      );
    }

    case "contact": {
      const p = block.props as ContactProps;
      return (
        <ContactBlock
          props={p}
          variantKey={block.variantKey}
          contact={data.contact}
          schoolName={data.schoolName}
        />
      );
    }

    case "spmb": {
      const p = block.props as SpmbProps;
      return (
        <SpmbBlock
          props={p}
          variantKey={block.variantKey}
          batches={data.spmbBatches}
        />
      );
    }

    /* ---- Blok general (halaman kustom) ---- */

    case "richtext": {
      const p = block.props as RichTextProps;
      return <RichTextBlock props={p} variantKey={block.variantKey} />;
    }

    case "image": {
      const p = block.props as ImageBlockProps;
      return <ImageBlock props={p} variantKey={block.variantKey} />;
    }

    case "section": {
      const p = block.props as SectionBlockProps;
      return <SectionBlock props={p} variantKey={block.variantKey} />;
    }

    case "divider": {
      const p = block.props as DividerProps;
      return <DividerBlock props={p} variantKey={block.variantKey} />;
    }

    case "table": {
      const p = block.props as TableProps;
      return <TableBlock props={p} variantKey={block.variantKey} />;
    }

    case "steps": {
      const p = block.props as StepsProps;
      return <StepsBlock props={p} variantKey={block.variantKey} />;
    }

    case "timeline": {
      const p = block.props as TimelineProps;
      return <TimelineBlock props={p} variantKey={block.variantKey} />;
    }

    case "achievements": {
      const p = block.props as AchievementsProps;
      return <AchievementsBlock props={p} variantKey={block.variantKey} />;
    }

    case "downloads": {
      const p = block.props as DownloadsProps;
      return <DownloadsBlock props={p} variantKey={block.variantKey} />;
    }

    case "cards": {
      const p = block.props as CardsProps;
      return <CardsBlock props={p} variantKey={block.variantKey} />;
    }

    case "quote": {
      const p = block.props as QuoteProps;
      return <QuoteBlock props={p} variantKey={block.variantKey} />;
    }

    case "video": {
      const p = block.props as VideoProps;
      return <VideoBlock props={p} variantKey={block.variantKey} />;
    }

    /* Blok usang / tak dikenal — lihat penjelasan di atas fungsi ini. */
    default:
      return null;
  }
}

/* ============================================================
 * DAFTAR BLOK
 * ============================================================ */

/**
 * Merender seluruh blok halaman depan secara berurutan.
 * `key` memakai blockKey (blok tidak boleh muncul lebih dari sekali, lihat
 * `allowMultiple`/validasi susunan).
 */
export function SiteBlockList({
  blocks,
  data,
}: {
  blocks: RenderableBlock[];
  data: BlockData;
}) {
  return (
    <>
      {blocks.map((block) => (
        <BlockRenderer key={block.blockKey} block={block} data={data} />
      ))}
    </>
  );
}
