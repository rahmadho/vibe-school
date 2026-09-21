import { describe, expect, it } from "vitest";
import {
  validatePageBlocks,
  parseStoredPageBlocks,
  MAX_PAGE_BLOCKS,
} from "@/lib/validations/page-blocks";
import { BLOCK_DEFINITIONS, getBlock } from "@/lib/site-blocks";
import { GENERAL_BLOCK_KEYS } from "@/lib/site-blocks-general";
import { PAGE_BLOCK_FIELDS } from "@/lib/page-block-fields";

/**
 * Uji validasi susunan blok halaman kustom.
 *
 * KENAPA TEST INI PENTING:
 * Susunan blok datang dari form sebagai JSON, dan JSON dari peramban bisa
 * diubah siapa saja sebelum dikirim. Tanpa validasi, seseorang bisa menulis
 * `blockKey` sembarang atau `variantKey` milik blok lain — lalu halaman publik
 * menampilkan blok yang tidak pernah dirancang untuk tempat itu.
 *
 * Ini juga mengunci keputusan produk "blok ganda DIIZINKAN": kalau seseorang
 * kelak menambahkan kembali larangan duplikat, test ini akan gagal dan
 * memaksanya membaca alasannya dulu.
 */

function block(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: "b1",
    blockKey: "richtext",
    variantKey: "richtext.polos",
    order: 0,
    isEnabled: true,
    props: {},
    ...over,
  };
}

describe("validatePageBlocks — menerima", () => {
  it("menerima satu blok yang sah", () => {
    const r = validatePageBlocks([block()]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.blocks).toHaveLength(1);
  });

  it("menerima susunan kosong", () => {
    const r = validatePageBlocks([]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.blocks).toHaveLength(0);
  });

  it("MENGIZINKAN blok sejenis muncul lebih dari sekali", () => {
    // Keputusan produk: halaman kustom sering butuh dua blok teks (pembuka dan
    // penutup) atau tiga blok gambar. Masing-masing punya `id` sendiri.
    const r = validatePageBlocks([
      block({ id: "a", order: 0 }),
      block({ id: "b", order: 1 }),
      block({ id: "c", order: 2 }),
    ]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.blocks).toHaveLength(3);
  });

  it("merapikan urutan menjadi 0..n-1", () => {
    const r = validatePageBlocks([
      block({ id: "a", order: 7 }),
      block({ id: "b", order: 2 }),
    ]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.blocks.map((b) => b.order)).toEqual([0, 1]);
      // Yang berorder 2 harus muncul lebih dulu.
      expect(r.blocks[0].id).toBe("b");
    }
  });

  it("mengisi isEnabled bawaan true", () => {
    const r = validatePageBlocks([
      { id: "a", blockKey: "richtext", variantKey: "richtext.polos", order: 0, props: {} },
    ]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.blocks[0].isEnabled).toBe(true);
  });

  it("menerima semua blok general dengan varian bawaannya", () => {
    for (const key of GENERAL_BLOCK_KEYS) {
      const def = getBlock(key);
      expect(def, `blok ${key} tidak ada di katalog`).toBeTruthy();
      if (!def) continue;
      const r = validatePageBlocks([
        block({ id: `x-${key}`, blockKey: key, variantKey: def.defaultVariant }),
      ]);
      expect(r.ok, `blok ${key} ditolak: ${r.ok ? "" : r.error}`).toBe(true);
    }
  });
});

describe("validatePageBlocks — menolak", () => {
  it("menolak yang bukan array", () => {
    expect(validatePageBlocks({}).ok).toBe(false);
    expect(validatePageBlocks("teks").ok).toBe(false);
    expect(validatePageBlocks(null).ok).toBe(false);
  });

  it("menolak blok tanpa id", () => {
    const r = validatePageBlocks([block({ id: "" })]);
    expect(r.ok).toBe(false);
  });

  it("menolak id ganda", () => {
    // Tanpa id unik, menyunting satu blok ikut mengubah blok lain.
    const r = validatePageBlocks([block({ id: "sama" }), block({ id: "sama", order: 1 })]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/pengenal ganda/i);
  });

  it("menolak blockKey yang tidak dikenal", () => {
    const r = validatePageBlocks([block({ blockKey: "blok-karangan" })]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/tidak dikenal/i);
  });

  it("menolak variantKey milik blok lain", () => {
    // "faq.akordeon" sah, tapi bukan milik blok "richtext".
    const r = validatePageBlocks([block({ variantKey: "faq.akordeon" })]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/gaya yang bukan miliknya/i);
  });

  it("menolak variantKey yang tidak ada sama sekali", () => {
    const r = validatePageBlocks([block({ variantKey: "richtext.tidak-ada" })]);
    expect(r.ok).toBe(false);
  });

  it("menolak blok yang bukan objek", () => {
    expect(validatePageBlocks([null]).ok).toBe(false);
    expect(validatePageBlocks(["teks"]).ok).toBe(false);
    expect(validatePageBlocks([123]).ok).toBe(false);
  });

  it("menolak susunan melebihi batas", () => {
    const many = Array.from({ length: MAX_PAGE_BLOCKS + 1 }, (_, i) =>
      block({ id: `b${i}`, order: i }),
    );
    const r = validatePageBlocks(many);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/terlalu banyak blok/i);
  });

  it("menolak isi blok yang terlalu besar", () => {
    // Satu blok bisa memuat banyak item; tanpa batas ini, satu permintaan bisa
    // menulis JSON berukuran apa pun ke database.
    const r = validatePageBlocks([
      block({ props: { body: "x".repeat(25_000) } }),
    ]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/terlalu besar/i);
  });
});

describe("parseStoredPageBlocks", () => {
  it("mengembalikan susunan sah dari database", () => {
    expect(parseStoredPageBlocks([block()])).toHaveLength(1);
  });

  it("mengembalikan kosong untuk data rusak, bukan melempar", () => {
    // Data dari versi lama atau suntingan manual tidak boleh membuat halaman
    // publik gagal render.
    expect(parseStoredPageBlocks(null)).toEqual([]);
    expect(parseStoredPageBlocks({})).toEqual([]);
    expect(parseStoredPageBlocks([{ rusak: true }])).toEqual([]);
    expect(parseStoredPageBlocks("bukan json")).toEqual([]);
  });
});

describe("katalog blok general", () => {
  it("semua blok general punya definisi di katalog gabungan", () => {
    const keys = new Set(BLOCK_DEFINITIONS.map((b) => b.key));
    for (const k of GENERAL_BLOCK_KEYS) {
      expect(keys.has(k), `blok ${k} tidak tergabung ke katalog`).toBe(true);
    }
  });

  it("tidak ada kunci blok yang bertabrakan dengan blok inti", () => {
    const keys = BLOCK_DEFINITIONS.map((b) => b.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("setiap blok general punya form isian", () => {
    // Blok tanpa form isian akan tampil di katalog tetapi tidak bisa diisi —
    // operator akan mengira fiturnya rusak.
    for (const k of GENERAL_BLOCK_KEYS) {
      expect(
        Object.hasOwn(PAGE_BLOCK_FIELDS, k),
        `blok ${k} belum punya form isian`,
      ).toBe(true);
    }
  });

  it("semua blok general bisa dipakai berulang", () => {
    for (const k of GENERAL_BLOCK_KEYS) {
      expect(getBlock(k)?.allowMultiple, `blok ${k} menolak duplikat`).toBe(true);
    }
  });

  it("semua blok general tidak bergantung data lain", () => {
    // Inilah yang membuatnya general: isinya diisi operator, bukan ditarik
    // dari tabel berita/guru/SPMB — sehingga aman di halaman mana pun.
    for (const k of GENERAL_BLOCK_KEYS) {
      expect(getBlock(k)?.requirement, `blok ${k} butuh data lain`).toBe("none");
    }
  });
});
