import { describe, expect, it } from "vitest";
import { BLOCK_DEFINITIONS, defaultPropsFor } from "@/lib/site-blocks";
import { BLOCK_PROPS_SCHEMAS } from "@/lib/validations/site";

/**
 * Uji PENYELARASAN antara tiga sumber yang harus sepakat:
 *
 *   1. BLOCK_DEFINITIONS.fields  — field yang boleh diisi sekolah
 *   2. BLOCK_PROPS_SCHEMAS       — validasi Zod (menentukan apa yang DISIMPAN)
 *   3. defaultPropsFor()         — isi awal editor
 *
 * Ditambah prop yang DIBACA komponen React.
 *
 * KENAPA TEST INI ADA:
 * Pernah terjadi ketidakcocokan nyata — skema Zod menyimpan `subheading`,
 * tetapi komponen `NewsBlock` membaca `subtitle`. Akibatnya operator mengetik
 * judul sekunder, menyimpan, dan teksnya TIDAK PERNAH muncul di web. TypeScript
 * tidak bisa menangkapnya karena props blok di-cast dari `Record<string,
 * unknown>` di renderer. Test ini yang menjaga agar hal itu tidak terulang.
 */

/** Nama field yang dibaca komponen React, dikumpulkan dari file komponennya. */
const COMPONENT_READS: Record<string, string[]> = {
  hero: ["title", "subtitle", "imageUrl", "ctaLabel", "ctaHref", "cta2Label", "cta2Href"],
  profile: ["heading", "body", "imageUrl", "imagePosition"],
  stats: ["heading", "items"],
  news: ["heading", "subtitle", "itemCount"],
  agenda: ["heading", "itemCount"],
  gallery: ["heading", "itemCount"],
  teachers: ["heading", "itemCount", "showPosition"],
  faq: ["heading", "items"],
  contact: ["heading", "showMap", "showHours"],
  spmb: ["title", "subtitle"],
};

/** Ambil kunci field dari sebuah objek skema Zod. */
function schemaKeys(blockKey: string): string[] {
  const schema = BLOCK_PROPS_SCHEMAS[blockKey];
  // ZodObject menyimpan bentuknya di .shape
  const shape = (schema as unknown as { shape?: Record<string, unknown> }).shape;
  return shape ? Object.keys(shape) : [];
}

describe("penyelarasan field blok — cegah bug 'tidak pernah tampil'", () => {
  it("field yang DIBACA komponen ada di skema Zod (kalau tidak, input sekolah hilang)", () => {
    for (const [blockKey, reads] of Object.entries(COMPONENT_READS)) {
      const keys = schemaKeys(blockKey);
      for (const field of reads) {
        expect(
          keys,
          `blok "${blockKey}": komponen membaca "${field}" tetapi skema Zod tidak menyimpannya`,
        ).toContain(field);
      }
    }
  });

  it("field di skema Zod juga diumumkan di BLOCK_DEFINITIONS.fields", () => {
    // Supaya daftar `fields` di katalog tidak menyesatkan pembaca kode.
    for (const def of BLOCK_DEFINITIONS) {
      const keys = schemaKeys(def.key);
      for (const k of keys) {
        expect(
          def.fields,
          `blok "${def.key}": field "${k}" ada di skema tetapi tidak terdaftar di definition.fields`,
        ).toContain(k);
      }
    }
  });

  it("defaultPropsFor hanya menghasilkan field yang dikenali skema", () => {
    // Mencegah isi awal editor memuat field yang akan dibuang saat disimpan.
    for (const def of BLOCK_DEFINITIONS) {
      const props = defaultPropsFor(def.key);
      const keys = schemaKeys(def.key);
      for (const k of Object.keys(props)) {
        expect(
          keys,
          `blok "${def.key}": defaultPropsFor menghasilkan "${k}" yang tidak dikenal skema`,
        ).toContain(k);
      }
    }
  });

  it("defaultPropsFor lolos validasi skemanya sendiri", () => {
    // Isi awal harus sah, kalau tidak sekolah baru langsung melihat galat.
    for (const def of BLOCK_DEFINITIONS) {
      const props = defaultPropsFor(def.key);
      const r = BLOCK_PROPS_SCHEMAS[def.key].safeParse(props);
      expect(r.success, `defaultProps ${def.key} gagal validasi`).toBe(true);
    }
  });

  it("news memakai 'subtitle', BUKAN 'subheading' (bug yang pernah terjadi)", () => {
    const keys = schemaKeys("news");
    expect(keys).toContain("subtitle");
    expect(keys).not.toContain("subheading");
  });
});
