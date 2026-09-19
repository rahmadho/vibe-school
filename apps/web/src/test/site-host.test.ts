import { describe, expect, it } from "vitest";
import {
  RESERVED_SUBDOMAINS,
  allowDevFallback,
  buildSchoolUrl,
  explainSlugProblem,
  isReservedSubdomain,
  isValidSchoolSlug,
  resolveDevFallback,
  resolveHost,
  stripPort,
} from "@/lib/site-host";

/**
 * Uji resolusi host — bagian PALING sensitif di web sekolah publik.
 *
 * Fungsi ini menentukan sekolah mana yang datanya ditampilkan. Salah sedetik
 * saja berarti kebocoran data antar sekolah, yang meruntuhkan seluruh alasan
 * produk ini dijual. Karena itu diuji menyeluruh, termasuk upaya jahat.
 */

const CONFIG = { rootDomain: "sekolah.id" };

describe("stripPort", () => {
  it("membuang port", () => {
    expect(stripPort("smpn1.sekolah.id:3000")).toBe("smpn1.sekolah.id");
  });

  it("huruf menjadi kecil & spasi dipangkas", () => {
    expect(stripPort("  SMPN1.Sekolah.ID  ")).toBe("smpn1.sekolah.id");
  });

  it("host tanpa port tetap utuh", () => {
    expect(stripPort("smpn1.sekolah.id")).toBe("smpn1.sekolah.id");
  });
});

describe("resolveHost — subdomain sekolah", () => {
  it("mengenali subdomain sebagai sekolah", () => {
    const r = resolveHost("smpn1.sekolah.id", CONFIG);
    expect(r).toEqual({ kind: "school", identifier: "smpn1", byCustomDomain: false });
  });

  it("mengabaikan port", () => {
    const r = resolveHost("smpn1.sekolah.id:3000", CONFIG);
    expect(r).toEqual({ kind: "school", identifier: "smpn1", byCustomDomain: false });
  });

  it("menerima subdomain dengan tanda hubung", () => {
    const r = resolveHost("smp-negeri-1.sekolah.id", CONFIG);
    expect(r).toEqual({
      kind: "school",
      identifier: "smp-negeri-1",
      byCustomDomain: false,
    });
  });

  it("menerima huruf besar", () => {
    expect(resolveHost("SMPN1.SEKOLAH.ID", CONFIG).kind).toBe("school");
  });
});

describe("resolveHost — portal", () => {
  it("domain utama persis = portal", () => {
    expect(resolveHost("sekolah.id", CONFIG).kind).toBe("portal");
  });

  it("www = portal (subdomain dipesan sistem)", () => {
    // www harus mengarah ke portal, BUKAN mencari sekolah bernama "www".
    const r = resolveHost("www.sekolah.id", CONFIG);
    expect(r.kind).toBe("unknown");
  });

  it("localhost = portal", () => {
    expect(resolveHost("localhost", CONFIG).kind).toBe("portal");
  });

  it("alamat IP = portal", () => {
    expect(resolveHost("127.0.0.1", CONFIG).kind).toBe("portal");
    expect(resolveHost("192.168.1.10:3000", CONFIG).kind).toBe("portal");
  });
});

describe("resolveHost — pengembangan lokal", () => {
  it("smpn1.localhost = sekolah", () => {
    const r = resolveHost("smpn1.localhost", { rootDomain: "localhost" });
    expect(r).toEqual({ kind: "school", identifier: "smpn1", byCustomDomain: false });
  });

  it("smpn1.localhost:3000 tetap dikenali", () => {
    const r = resolveHost("smpn1.localhost:3000", { rootDomain: "localhost" });
    expect(r).toEqual({ kind: "school", identifier: "smpn1", byCustomDomain: false });
  });
});

describe("resolveHost — custom domain", () => {
  it("domain lain ditandai sebagai custom domain", () => {
    const r = resolveHost("smpn1.sch.id", CONFIG);
    expect(r).toEqual({ kind: "school", identifier: "smpn1.sch.id", byCustomDomain: true });
  });

  it("custom domain dengan port", () => {
    const r = resolveHost("sekolahku.com:8080", CONFIG);
    expect(r).toEqual({ kind: "school", identifier: "sekolahku.com", byCustomDomain: true });
  });
});

describe("resolveHost — masukan jahat / aneh", () => {
  it("host kosong ditolak", () => {
    const r = resolveHost("", CONFIG);
    expect(r.kind).toBe("unknown");
  });

  it("subdomain bertingkat ditolak (cegah kejutan wildcard DNS)", () => {
    // "a.b.sekolah.id" tidak boleh diam-diam jadi sekolah "a.b".
    const r = resolveHost("a.b.sekolah.id", CONFIG);
    expect(r.kind).toBe("unknown");
  });

  it("subdomain dipesan sistem ditolak", () => {
    for (const reserved of ["admin", "api", "dashboard", "app"]) {
      const r = resolveHost(`${reserved}.sekolah.id`, CONFIG);
      expect(r.kind, `subdomain ${reserved} seharusnya ditolak`).toBe("unknown");
    }
  });

  it("subdomain dengan karakter aneh ditolak", () => {
    expect(resolveHost("smpn 1.sekolah.id", CONFIG).kind).toBe("unknown");
    expect(resolveHost("smpn1;drop.sekolah.id", CONFIG).kind).toBe("unknown");
  });

  it("port kosong setelah titik dua tidak merusak", () => {
    expect(resolveHost("smpn1.sekolah.id:", CONFIG).kind).toBe("school");
  });

  it("domain yang hanya mirip akar tidak dianggap subdomain", () => {
    // "sekolah.id.evil.com" BUKAN subdomain kita.
    const r = resolveHost("sekolah.id.evil.com", CONFIG);
    expect(r.kind).toBe("school");
    if (r.kind === "school") {
      expect(r.byCustomDomain).toBe(true);
      expect(r.identifier).toBe("sekolah.id.evil.com");
    }
  });

  it("akhiran palsu tidak lolos sebagai subdomain", () => {
    // "notsekolah.id" tidak boleh dianggap subdomain dari "sekolah.id".
    const r = resolveHost("notsekolah.id", CONFIG);
    expect(r.kind).toBe("school");
    if (r.kind === "school") expect(r.byCustomDomain).toBe(true);
  });
});

describe("isValidSchoolSlug", () => {
  it("menerima slug yang wajar", () => {
    for (const s of ["smpn1", "smp-negeri-1", "tkit-bunga", "sd1", "a"]) {
      expect(isValidSchoolSlug(s), `slug ${s}`).toBe(true);
    }
  });

  it("menolak slug kosong, terlalu panjang, atau berkarakter aneh", () => {
    expect(isValidSchoolSlug("")).toBe(false);
    expect(isValidSchoolSlug("a".repeat(41))).toBe(false);
    expect(isValidSchoolSlug("smp n1")).toBe(false);
    expect(isValidSchoolSlug("smpn1!")).toBe(false);
    expect(isValidSchoolSlug("-smpn1")).toBe(false);
    expect(isValidSchoolSlug("smpn1-")).toBe(false);
  });

  it("menolak subdomain yang dipesan sistem", () => {
    for (const r of RESERVED_SUBDOMAINS) {
      expect(isValidSchoolSlug(r), `reserved ${r}`).toBe(false);
    }
  });

  it("menolak slug tanpa huruf", () => {
    // "123" membingungkan dan mudah tertukar dengan nomor lain.
    expect(isValidSchoolSlug("123")).toBe(false);
  });

  it("menerima slug dengan huruf besar (dinormalkan)", () => {
    expect(isValidSchoolSlug("SMPN1")).toBe(true);
  });
});

describe("explainSlugProblem", () => {
  it("menjelaskan setiap jenis masalah dengan bahasa manusia", () => {
    expect(explainSlugProblem("")).toMatch(/wajib diisi/);
    expect(explainSlugProblem("smp n1")).toMatch(/huruf kecil, angka/);
    expect(explainSlugProblem("-smpn1")).toMatch(/tanda hubung/);
    expect(explainSlugProblem("admin")).toMatch(/dipakai sistem/);
    expect(explainSlugProblem("123")).toMatch(/mengandung huruf/);
    expect(explainSlugProblem("a".repeat(45))).toMatch(/maksimal/);
  });

  it("mengembalikan null untuk slug yang sah", () => {
    expect(explainSlugProblem("smpn1")).toBeNull();
  });
});

describe("resolveDevFallback — cadangan pengembangan", () => {
  it("DIMATIKAN di produksi (subdomain wajib)", () => {
    // Ini pengaman terpenting: di produksi tidak boleh ada cara masuk selain
    // subdomain, karena ?school= memungkinkan menebak sekolah lain.
    expect(resolveDevFallback("smpn1", false)).toBeNull();
  });

  it("aktif di luar produksi", () => {
    const r = resolveDevFallback("smpn1", true);
    expect(r).toEqual({ kind: "school", identifier: "smpn1", byCustomDomain: false });
  });

  it("null bila parameter kosong", () => {
    expect(resolveDevFallback(null, true)).toBeNull();
    expect(resolveDevFallback("", true)).toBeNull();
    expect(resolveDevFallback(undefined, true)).toBeNull();
  });

  it("menerima bentuk smpn1.localhost", () => {
    expect(resolveDevFallback("smpn1.localhost", true)).toEqual({
      kind: "school",
      identifier: "smpn1",
      byCustomDomain: false,
    });
  });

  it("menolak slug tidak sah walau cadangan aktif", () => {
    expect(resolveDevFallback("admin", true)?.kind).toBe("unknown");
    expect(resolveDevFallback("smp n1", true)?.kind).toBe("unknown");
  });
});

describe("allowDevFallback", () => {
  it("hanya true di luar produksi", () => {
    expect(allowDevFallback("production")).toBe(false);
    expect(allowDevFallback("development")).toBe(true);
    expect(allowDevFallback("test")).toBe(true);
    expect(allowDevFallback(undefined)).toBe(true);
  });
});

describe("buildSchoolUrl", () => {
  it("membangun alamat subdomain di produksi", () => {
    expect(buildSchoolUrl("smpn1", { rootDomain: "sekolah.id" })).toBe(
      "https://smpn1.sekolah.id/",
    );
  });

  it("menambahkan path", () => {
    expect(buildSchoolUrl("smpn1", { rootDomain: "sekolah.id" }, { path: "/berita" })).toBe(
      "https://smpn1.sekolah.id/berita",
    );
  });

  it("memberi garis miring di depan path", () => {
    expect(buildSchoolUrl("smpn1", { rootDomain: "sekolah.id" }, { path: "spmb" })).toBe(
      "https://smpn1.sekolah.id/spmb",
    );
  });

  it("memakai http di localhost", () => {
    const url = buildSchoolUrl("smpn1", { rootDomain: "localhost" }, { port: "3000" });
    expect(url).toBe("http://smpn1.localhost:3000/");
  });

  it("membuang port dari akar domain", () => {
    expect(buildSchoolUrl("smpn1", { rootDomain: "sekolah.id:3000" })).toBe(
      "https://smpn1.sekolah.id/",
    );
  });
});

describe("isReservedSubdomain", () => {
  it("mengenali subdomain dipesan sistem", () => {
    expect(isReservedSubdomain("admin")).toBe(true);
    expect(isReservedSubdomain("ADMIN")).toBe(true);
    expect(isReservedSubdomain(" admin ")).toBe(true);
  });

  it("mengembalikan false untuk subdomain biasa", () => {
    expect(isReservedSubdomain("smpn1")).toBe(false);
  });
});
