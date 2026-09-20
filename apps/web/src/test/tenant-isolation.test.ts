import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { TENANT_MODELS } from "@/lib/scoped-db";

/**
 * Uji isolasi tenant — dua daftar yang mudah tertinggal.
 *
 * KENAPA TEST INI ADA (temuan nyata pada Fase 8):
 * Proyek punya DUA lapisan pertahanan isolasi tenant:
 *   1. `TENANT_MODELS` di lib/scoped-db.ts — helper `scopedDb()` menyuntik
 *      `schoolId` otomatis.
 *   2. `tenant_tables` di prisma/rls.sql — RLS database menolak baris sekolah
 *      lain walaupun kode lupa memfilter.
 *
 * Ketika Fase 8 menambah 7 model baru (SiteTheme, SiteConfig, SiteBlock, Page,
 * PageBlock, NavigationItem, AdmissionPath), KEDUA daftar itu TIDAK diperbarui.
 * Akibatnya seluruh tabel web sekolah + jalur SPMB berjalan tanpa RLS — dan
 * tidak ada satu pun gerbang (tsc, vitest, next build) yang bisa melihatnya,
 * karena ini soal daftar, bukan tipe.
 *
 * Test ini membandingkan daftar tersebut dengan `schema.prisma` sehingga model
 * baru yang punya `schoolId` WAJIB terdaftar di keduanya.
 */

const WEB = resolve(__dirname, "..");
const SCHEMA = readFileSync(resolve(WEB, "../prisma/schema.prisma"), "utf8");
const RLS = readFileSync(resolve(WEB, "../prisma/rls.sql"), "utf8");

/** Model global yang memang BUKAN milik satu sekolah. */
const GLOBAL_MODELS = new Set([
  "School", // sekolah itu sendiri
  "Plan", // paket langganan (katalog produk)
  "User", // punya schoolId opsional utk super-admin; dikelola terpisah
]);

type ModelInfo = { name: string; table: string; hasSchoolId: boolean };

/** Baca model dari schema.prisma: nama, @@map, dan apakah punya schoolId. */
function parseModels(): ModelInfo[] {
  const out: ModelInfo[] = [];
  const blocks = Array.from(SCHEMA.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm));
  for (const b of blocks) {
    const name = b[1];
    const body = b[2];
    const mapMatch = body.match(/@@map\("([^"]+)"\)/);
    // Konvensi proyek: tabel snake_case plural.
    const table = mapMatch ? mapMatch[1] : `${name.toLowerCase()}s`;
    out.push({ name, table, hasSchoolId: /^\s*schoolId\s+/m.test(body) });
  }
  return out;
}

/** Tabel yang terdaftar di array tenant_tables pada rls.sql. */
function rlsTables(): Set<string> {
  const m = RLS.match(/tenant_tables\s+text\[\]\s*:=\s*ARRAY\[([\s\S]*?)\];/);
  if (!m) throw new Error("tenant_tables tidak ditemukan di prisma/rls.sql");
  const set = new Set<string>();
  for (const t of Array.from(m[1].matchAll(/'([^']+)'/g))) set.add(t[1]);
  return set;
}

describe("isolasi tenant — daftar model & RLS", () => {
  const models = parseModels();
  const tenantModels = models.filter(
    (m) => m.hasSchoolId && !GLOBAL_MODELS.has(m.name),
  );

  it("schema.prisma terbaca dan punya model tenant", () => {
    expect(models.length).toBeGreaterThan(20);
    expect(tenantModels.length).toBeGreaterThan(20);
  });

  it("SETIAP model ber-schoolId terdaftar di TENANT_MODELS (scoped-db)", () => {
    // PENTING: TENANT_MODELS memakai nama PROPERTI Prisma client (camelCase,
    // mis. "academicYear"), bukan nama model ("AcademicYear"). Perbandingan
    // harus memakai bentuk camelCase, kalau tidak seluruh daftar tampak salah.
    const toClientName = (modelName: string) =>
      modelName.charAt(0).toLowerCase() + modelName.slice(1);

    const registered = new Set<string>(TENANT_MODELS);
    const missing = tenantModels
      .filter((m) => !registered.has(toClientName(m.name)))
      .map((m) => `${toClientName(m.name)} (model ${m.name})`);

    expect(
      missing,
      `Model berikut punya kolom schoolId tetapi TIDAK ada di TENANT_MODELS ` +
        `(lib/scoped-db.ts), sehingga scopedDb() tidak menyuntik schoolId:\n` +
        missing.map((m) => `  - ${m}`).join("\n"),
    ).toEqual([]);
  });

  it("SETIAP tabel tenant terdaftar di RLS (prisma/rls.sql)", () => {
    const tables = rlsTables();
    const missing = tenantModels
      .filter((m) => !tables.has(m.table))
      .map((m) => `${m.table} (model ${m.name})`);

    expect(
      missing,
      `Tabel berikut TIDAK punya RLS, sehingga satu query yang lupa memfilter ` +
        `schoolId akan membocorkan data antar-sekolah:\n` +
        missing.map((t) => `  - ${t}`).join("\n"),
    ).toEqual([]);
  });

  it("tabel web sekolah + SPMB multi-jalur sudah dilindungi RLS", () => {
    // Daftar eksplisit supaya regresi Fase 8 tidak terulang.
    const tables = rlsTables();
    for (const t of [
      "site_themes",
      "site_configs",
      "site_blocks",
      "pages",
      "page_blocks",
      "navigation_items",
      "admission_paths",
    ]) {
      expect(tables.has(t), `${t} tidak dilindungi RLS`).toBe(true);
    }
  });

  it("tidak ada nama tabel RLS yang sudah tidak ada di schema (sisa usang)", () => {
    const known = new Set(models.map((m) => m.table));
    // Tabel non-tenant yang boleh ada di RLS atau dikelola terpisah.
    const exceptions = new Set(["students", "users"]);
    const stale = Array.from(rlsTables()).filter(
      (t) => !known.has(t) && !exceptions.has(t),
    );
    // Tabel usang bukan bug fatal, tetapi menandakan skema & RLS tidak sinkron.
    expect(stale.length, `Tabel di RLS tanpa model: ${stale.join(", ")}`).toBeLessThan(3);
  });
});
