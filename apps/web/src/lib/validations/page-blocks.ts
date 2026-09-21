import { z } from "zod";
import { getBlock, getVariant } from "@/lib/site-blocks";

/**
 * Validasi susunan blok halaman kustom.
 *
 * ============================================================
 * KENAPA HARUS DIVALIDASI, BUKAN DIPERCAYA
 * ============================================================
 * Susunan blok datang dari form sebagai JSON — dan JSON dari peramban bisa
 * diubah siapa saja sebelum dikirim. Tanpa validasi, seseorang bisa menulis
 * `blockKey` sembarang atau `variantKey` milik blok lain, lalu halaman publik
 * menampilkan blok yang tidak pernah dirancang untuk tempat itu.
 *
 * ============================================================
 * KENAPA BLOK GANDA DIIZINKAN
 * ============================================================
 * Halaman kustom sering butuh blok yang sama lebih dari sekali: dua blok teks
 * (pembuka dan penutup), tiga blok gambar, dua tabel berbeda. Melarangnya
 * memaksa operator menumpuk semuanya dalam satu blok — dan hasilnya justru
 * lebih sulit dibaca. Karena itu setiap instance punya `id` sendiri.
 *
 * ============================================================
 * KENAPA `id` WAJIB
 * ============================================================
 * Tanpa `id`, dua blok "Teks" tidak bisa dibedakan. React akan memakai
 * `blockKey` sebagai kunci, sehingga menyunting blok kedua ikut mengubah blok
 * pertama — dan menghapus satu akan menghapus keduanya.
 */

/** Batas jumlah blok per halaman. Cukup lega, tetapi mencegah data raksasa. */
export const MAX_PAGE_BLOCKS = 30;

/** Batas ukuran satu blok (JSON) — kira-kira 20 ribu karakter. */
const MAX_PROPS_BYTES = 20_000;

export const pageBlockSchema = z.object({
  /** Pengenal unik instance. Dibuat klien; diperiksa unik di tingkat susunan. */
  id: z.string().trim().min(1, "Blok tanpa pengenal").max(64),
  blockKey: z.string().trim().min(1),
  variantKey: z.string().trim().min(1),
  order: z.coerce.number().int().min(0).max(999),
  isEnabled: z.boolean().default(true),
  props: z.record(z.string(), z.unknown()).default({}),
});

export type PageBlockInput = z.infer<typeof pageBlockSchema>;

/**
 * Validasi susunan lengkap.
 *
 * Diperiksa berlapis: bentuk tiap blok, lalu hubungan antar-blok (id unik,
 * blok dikenal, varian cocok). Kesalahan hubungan tidak bisa ditangkap skema
 * per-blok karena butuh melihat seluruh susunan.
 */
export function validatePageBlocks(input: unknown): {
  ok: true; blocks: PageBlockInput[];
} | {
  ok: false; error: string;
} {
  if (!Array.isArray(input)) {
    return { ok: false, error: "Susunan blok tidak dikenali." };
  }

  if (input.length > MAX_PAGE_BLOCKS) {
    return {
      ok: false,
      error: `Terlalu banyak blok (${input.length}). Maksimal ${MAX_PAGE_BLOCKS} per halaman.`,
    };
  }

  const blocks: PageBlockInput[] = [];
  const seenIds = new Set<string>();

  for (let i = 0; i < input.length; i += 1) {
    const parsed = pageBlockSchema.safeParse(input[i]);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "bentuk tidak dikenal";
      return { ok: false, error: `Blok ke-${i + 1} tidak valid: ${msg}.` };
    }

    const b = parsed.data;

    if (seenIds.has(b.id)) {
      return { ok: false, error: `Blok ke-${i + 1} punya pengenal ganda.` };
    }
    seenIds.add(b.id);

    const definition = getBlock(b.blockKey);
    if (!definition) {
      return {
        ok: false,
        error: `Blok ke-${i + 1} memakai jenis "${b.blockKey}" yang tidak dikenal.`,
      };
    }

    const variant = getVariant(b.variantKey);
    if (!variant || variant.block.key !== b.blockKey) {
      return {
        ok: false,
        error: `Blok ke-${i + 1} (${definition.name}) memakai gaya yang bukan miliknya.`,
      };
    }

    // Batas ukuran isi. Satu blok bisa memuat banyak item; tanpa batas ini,
    // satu permintaan bisa menulis JSON berukuran apa pun ke database.
    const size = JSON.stringify(b.props).length;
    if (size > MAX_PROPS_BYTES) {
      return {
        ok: false,
        error: `Isi blok ke-${i + 1} (${definition.name}) terlalu besar. Kurangi isinya.`,
      };
    }

    blocks.push(b);
  }

  // Urutan dirapikan di sini supaya renderer tidak perlu menyortir lagi.
  return {
    ok: true,
    blocks: blocks
      .sort((a, b) => a.order - b.order)
      .map((b, i) => ({ ...b, order: i })),
  };
}

/** Susun blok dari nilai JSON yang tersimpan di `Page.blocks`. */
export function parseStoredPageBlocks(value: unknown): PageBlockInput[] {
  const result = validatePageBlocks(value);
  return result.ok ? result.blocks : [];
}
