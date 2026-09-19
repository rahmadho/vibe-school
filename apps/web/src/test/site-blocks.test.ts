import { describe, expect, it } from "vitest";
import {
  BLOCK_DEFINITIONS,
  DEFAULT_HOMEPAGE_LAYOUT,
  ACADEMIC_HOMEPAGE_LAYOUT,
  allBlockKeys,
  allVariantKeys,
  buildInitialLayout,
  defaultPropsFor,
  getBlock,
  getVariant,
  layoutIsRenderable,
  normalizeLayout,
  validateLayout,
  variantBelongsToBlock,
} from "@/lib/site-blocks";
import { BLOCK_PROPS_KEYS } from "@/lib/validations/site";

/**
 * Uji katalog blok — ini KONTRAK yang dipakai editor web, renderer publik, dan
 * (pada Fase 8) sub-agent penulis blok. Bila kontrak ini bergeser tanpa
 * sengaja, halaman sekolah bisa gagal render; test ini menjaganya.
 */

describe("katalog blok — keutuhan", () => {
  it("setiap blok punya minimal satu varian", () => {
    for (const b of BLOCK_DEFINITIONS) {
      expect(b.variants.length, `blok ${b.key}`).toBeGreaterThanOrEqual(1);
    }
  });

  it("setiap varian punya kunci unik global & berawalan nama bloknya", () => {
    const variants = BLOCK_DEFINITIONS.flatMap((b) =>
      b.variants.map((v) => ({ block: b.key, v })),
    );
    const keys = variants.map((x) => x.v.key);
    expect(new Set(keys).size).toBe(keys.length);

    for (const { block, v } of variants) {
      expect(v.key.startsWith(`${block}.`), `${v.key} harus berawalan "${block}."`).toBe(true);
      expect(v.label.length).toBeGreaterThan(0);
      expect(v.hint.length).toBeGreaterThan(0);
    }
  });

  it("varian bawaan benar-benar ada di daftar variannya", () => {
    for (const b of BLOCK_DEFINITIONS) {
      expect(
        b.variants.some((v) => v.key === b.defaultVariant),
        `defaultVariant ${b.defaultVariant} tidak ditemukan`,
      ).toBe(true);
    }
  });

  it("kunci blok unik", () => {
    const keys = allBlockKeys();
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("setiap blok punya skema props yang terdaftar", () => {
    // Menjaga agar blok baru tidak lupa didaftarkan skema validasinya.
    for (const b of BLOCK_DEFINITIONS) {
      expect(BLOCK_PROPS_KEYS, `skema props untuk ${b.key}`).toContain(b.key);
    }
  });

  it("tidak ada skema props yatim (tanpa blok)", () => {
    for (const k of BLOCK_PROPS_KEYS) {
      expect(getBlock(k), `skema ${k} tidak punya blok`).toBeDefined();
    }
  });

  it("blok yang butuh SPMB ditandai needsSpmb", () => {
    const spmb = getBlock("spmb")!;
    expect(spmb.needsSpmb).toBe(true);
    expect(spmb.requirement).toBe("spmb");
  });
});

describe("pencarian blok & varian", () => {
  it("getBlock menemukan blok yang ada", () => {
    expect(getBlock("hero")?.name).toBe("Pembuka");
  });

  it("getBlock mengembalikan undefined untuk blok tak dikenal", () => {
    expect(getBlock("tidak-ada")).toBeUndefined();
  });

  it("getVariant mengembalikan blok pemiliknya", () => {
    const r = getVariant("news.korsel");
    expect(r?.block.key).toBe("news");
    expect(r?.variant.label).toBe("Korsel");
  });

  it("variantBelongsToBlock menolak pasangan tidak sah", () => {
    // "news.korsel" adalah varian berita, bukan milik hero.
    expect(variantBelongsToBlock("news", "news.korsel")).toBe(true);
    expect(variantBelongsToBlock("hero", "news.korsel")).toBe(false);
    expect(variantBelongsToBlock("tidak-ada", "news.korsel")).toBe(false);
  });

  it("allVariantKeys mencakup seluruh varian", () => {
    const expected = BLOCK_DEFINITIONS.reduce((n, b) => n + b.variants.length, 0);
    expect(allVariantKeys().length).toBe(expected);
  });
});

describe("susunan awal", () => {
  it("susunan bawaan valid & bisa dirender", () => {
    const blocks = DEFAULT_HOMEPAGE_LAYOUT.map((b, i) => ({ ...b, order: i }));
    const issues = validateLayout(blocks);
    expect(issues.filter((i) => i.severity === "error")).toEqual([]);
    expect(layoutIsRenderable(issues)).toBe(true);
  });

  it("susunan akademik valid & bisa dirender", () => {
    const blocks = ACADEMIC_HOMEPAGE_LAYOUT.map((b, i) => ({ ...b, order: i }));
    expect(layoutIsRenderable(validateLayout(blocks))).toBe(true);
  });

  it("susunan bawaan memprioritaskan pendaftaran (keputusan produk)", () => {
    // Blok SPMB harus muncul tinggi — sekolah memakai web untuk mencari murid.
    const keys = DEFAULT_HOMEPAGE_LAYOUT.map((b) => b.blockKey);
    expect(keys.indexOf("spmb")).toBeLessThan(3);
    expect(keys.indexOf("hero")).toBe(0);
  });

  it("susunan akademik tidak menempatkan SPMB di paling atas", () => {
    const keys = ACADEMIC_HOMEPAGE_LAYOUT.map((b) => b.blockKey);
    expect(keys.indexOf("spmb")).toBeGreaterThan(0);
  });

  it("buildInitialLayout memberi order berurutan & props terisi", () => {
    const layout = buildInitialLayout();
    expect(layout.map((b) => b.order)).toEqual(layout.map((_, i) => i));
    expect(layout.every((b) => b.isEnabled)).toBe(true);
    // Props awal harus ada isinya agar editor tidak tampil kosong.
    expect(Object.keys(layout[0].props).length).toBeGreaterThan(0);
  });

  it("defaultPropsFor mengembalikan objek untuk setiap blok di katalog", () => {
    for (const b of BLOCK_DEFINITIONS) {
      const props = defaultPropsFor(b.key);
      expect(typeof props, `props ${b.key}`).toBe("object");
    }
  });
});

describe("validateLayout — mendeteksi masalah", () => {
  it("menolak halaman tanpa blok aktif", () => {
    const issues = validateLayout([]);
    expect(issues.some((i) => i.severity === "error")).toBe(true);
    expect(layoutIsRenderable(issues)).toBe(false);
  });

  it("menolak halaman yang semua bloknya nonaktif", () => {
    const issues = validateLayout([
      { blockKey: "hero", variantKey: "hero.ringkas", isEnabled: false },
    ]);
    expect(layoutIsRenderable(issues)).toBe(false);
  });

  it("menolak blok yang muncul dua kali", () => {
    const issues = validateLayout([
      { blockKey: "hero", variantKey: "hero.ringkas" },
      { blockKey: "hero", variantKey: "hero.belah-dua" },
    ]);
    expect(issues.some((i) => i.severity === "error" && i.blockKey === "hero")).toBe(true);
  });

  it("menolak blok tak dikenal", () => {
    const issues = validateLayout([{ blockKey: "blok-hantu", variantKey: "hero.ringkas" }]);
    expect(issues.some((i) => i.severity === "error")).toBe(true);
  });

  it("menolak pasangan blok-varian yang tidak cocok", () => {
    const issues = validateLayout([{ blockKey: "hero", variantKey: "news.korsel" }]);
    expect(issues.some((i) => i.severity === "error" && i.blockKey === "hero")).toBe(true);
  });

  it("memperingatkan bila SPMB paling atas tanpa blok Pembuka", () => {
    const issues = validateLayout([
      { blockKey: "spmb", variantKey: "spmb.kartu" },
      { blockKey: "news", variantKey: "news.daftar" },
    ]);
    // SPMB di atas tanpa hero → peringatan, tetapi tetap boleh dirender.
    expect(issues.some((i) => i.severity === "warning" && i.blockKey === "spmb")).toBe(true);
    expect(layoutIsRenderable(issues)).toBe(true);
  });

  it("memperingatkan bila Pembuka tidak di paling atas", () => {
    const issues = validateLayout([
      { blockKey: "stats", variantKey: "stats.tiga-angka" },
      { blockKey: "hero", variantKey: "hero.ringkas" },
    ]);
    expect(issues.some((i) => i.severity === "warning" && i.blockKey === "hero")).toBe(true);
  });

  it("memperingatkan halaman terlalu panjang", () => {
    const many = BLOCK_DEFINITIONS.slice(0, 10).map((b) => ({
      blockKey: b.key,
      variantKey: b.defaultVariant,
    }));
    const issues = validateLayout(many);
    expect(issues.some((i) => i.message.includes("terlalu panjang"))).toBe(true);
  });

  it("memperingatkan bila blok pendaftaran tidak dipakai", () => {
    const issues = validateLayout([{ blockKey: "hero", variantKey: "hero.ringkas" }]);
    expect(issues.some((i) => i.severity === "warning" && i.message.includes("Mendaftar"))).toBe(
      true,
    );
  });

  it("tidak memberi peringatan SPMB bila blok spmb memang tidak ada di katalog aktif", () => {
    // Susunan sehat dengan spmb → tidak ada peringatan "tidak dipakai".
    const issues = validateLayout([
      { blockKey: "hero", variantKey: "hero.ringkas" },
      { blockKey: "spmb", variantKey: "spmb.bilah" },
    ]);
    expect(issues.some((i) => i.message.includes("tidak diarahkan"))).toBe(false);
  });
});

describe("normalizeLayout", () => {
  it("mengurutkan berdasarkan order", () => {
    const out = normalizeLayout([
      { blockKey: "b", order: 2 },
      { blockKey: "a", order: 0 },
      { blockKey: "c", order: 1 },
    ]);
    expect(out.map((b) => b.blockKey)).toEqual(["a", "c", "b"]);
  });

  it("membuang blok nonaktif", () => {
    const out = normalizeLayout([
      { blockKey: "a", order: 0, isEnabled: true },
      { blockKey: "b", order: 1, isEnabled: false },
    ]);
    expect(out.map((b) => b.blockKey)).toEqual(["a"]);
  });

  it("menormalkan ulang order menjadi rapat 0..n-1", () => {
    // Celah urutan (mis. 0, 5, 9) setelah penghapusan blok harus dirapatkan.
    const out = normalizeLayout([
      { blockKey: "a", order: 0 },
      { blockKey: "b", order: 5 },
      { blockKey: "c", order: 9 },
    ]);
    expect(out.map((b) => b.order)).toEqual([0, 1, 2]);
  });

  it("tidak mengubah array masukan", () => {
    const input = [{ blockKey: "b", order: 1 }, { blockKey: "a", order: 0 }];
    const copy = JSON.stringify(input);
    normalizeLayout(input);
    expect(JSON.stringify(input)).toBe(copy);
  });
});
