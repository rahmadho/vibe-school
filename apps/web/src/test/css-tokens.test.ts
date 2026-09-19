import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

/**
 * Uji token CSS.
 *
 * KENAPA TEST INI ADA — BUG NYATA:
 * ~35 berkas Fase 8 memakai `var(--rule)` dan `var(--ink-soft)`, tetapi
 * `globals.css` hanya mendefinisikan `--ink/--paper/--board/--chalk/--marker/
 * --slate`. Kedua token itu TIDAK PERNAH ada.
 *
 * Akibatnya bukan "sekadar styling": `border: 2px solid var(--rule)` menjadi
 * border tanpa warna, sehingga seluruh garis tabel dan batas kartu HILANG, dan
 * teks sekunder jatuh ke warna bawaan (hitam pekat) sehingga hierarki visual
 * rata. `tsc` tidak melihatnya (ini CSS), `next build` juga tidak (build sukses
 * — CSS tak dikenal memang diabaikan browser), dan test lain tak menyentuhnya.
 *
 * Test ini menutup celah itu: setiap `var(--x)` yang dipakai di kode harus
 * terdefinisi di globals.css.
 */

const WEB = resolve(__dirname, "..");
const CSS = readFileSync(resolve(WEB, "app/globals.css"), "utf8");

/** Semua token yang didefinisikan di globals.css. */
function definedTokens(): Set<string> {
  const set = new Set<string>();
  for (const m of Array.from(CSS.matchAll(/(--[a-z0-9-]+)\s*:/g))) set.add(m[1]);
  return set;
}

/** Semua berkas .tsx/.ts/.css di dalam src/. */
function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return; // direktori tidak ada — lewati
    }
    for (const name of entries) {
      const full = join(dir, name);
      let isDir = false;
      try {
        isDir = statSync(full).isDirectory();
      } catch {
        continue;
      }
      if (isDir) walk(full);
      else if (/\.(tsx|ts|css)$/.test(name)) out.push(full);
    }
  };
  walk(resolve(WEB, "app"));
  walk(resolve(WEB, "components"));
  walk(resolve(WEB, "lib"));
  return out;
}

/**
 * Token yang memang disediakan runtime lain, bukan dari globals.css:
 *  - --site-* : disuntikkan layout publik per sekolah (tema).
 *  - --font-* : disuntikkan next/font.
 */
const EXTERNAL_PREFIXES = ["--site-", "--font-"];

describe("token CSS terdefinisi", () => {
  const defined = definedTokens();

  it("globals.css mendefinisikan token dasar palet proyek", () => {
    for (const t of ["--ink", "--paper", "--board", "--chalk", "--marker", "--slate"]) {
      expect(defined.has(t), `token ${t} hilang dari globals.css`).toBe(true);
    }
  });

  it("alias semantik terdefinisi (mencegah bug border/teks tak terlihat)", () => {
    // Bug nyata: --rule dan --ink-soft dipakai di banyak berkas tetapi tidak
    // pernah didefinisikan. Keduanya harus tetap terdaftar.
    expect(defined.has("--rule"), "--rule tidak terdefinisi").toBe(true);
    expect(defined.has("--ink-soft"), "--ink-soft tidak terdefinisi").toBe(true);
  });

  it("SETIAP var(--x) yang dipakai di kode sudah terdefinisi", () => {
    const missing = new Map<string, string[]>();

    for (const file of sourceFiles()) {
      const text = readFileSync(file, "utf8");
      for (const m of Array.from(text.matchAll(/var\((--[a-z0-9-]+)/g))) {
        const token = m[1];
        if (EXTERNAL_PREFIXES.some((p) => token.startsWith(p))) continue;
        if (defined.has(token)) continue;

        const rel = file.replace(`${WEB}/`, "");
        if (!missing.has(token)) missing.set(token, []);
        missing.get(token)!.push(rel);
      }
    }

    const report = Array.from(missing.entries())
      .map(([token, files]) => `  ${token} → ${files.length} berkas (mis. ${files[0]})`)
      .join("\n");

    expect(
      missing.size,
      `Token CSS berikut dipakai tetapi TIDAK terdefinisi.\n` +
        `Perbaiki dengan menambahkannya di :root globals.css, atau ganti ke\n` +
        `token yang ada (--ink/--paper/--board/--chalk/--marker/--slate):\n${report}`,
    ).toBe(0);
  });

  it("tidak ada sisa token karangan yang pernah jadi bug", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles()) {
      const text = readFileSync(file, "utf8");
      // Pola historis: token di luar palet resmi.
      for (const bad of ["var(--ink-faint)", "var(--grey)", "var(--gray)", "var(--border-color)"]) {
        if (text.includes(bad)) offenders.push(`${file.replace(`${WEB}/`, "")} → ${bad}`);
      }
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });
});
