import { describe, expect, it } from "vitest";
import {
  BEST_TEXT_CONTRAST_MIN,
  THEME_PRESETS,
  CORNER_STYLES,
  HEADING_FONTS,
  BODY_FONTS,
  bestTextOn,
  checkThemeSafety,
  contrastRatio,
  getBodyFont,
  getCornerStyle,
  getHeadingFont,
  getPreset,
  hexToRgb,
  isReadable,
  isValidHex,
  mixToward,
  recommendPreset,
  relativeLuminance,
  resolveTheme,
} from "@/lib/site-themes";

describe("hexToRgb", () => {
  it("mengurai 6 digit", () => {
    expect(hexToRgb("#1E40AF")).toEqual([30, 64, 175]);
  });

  it("mengurai 3 digit", () => {
    expect(hexToRgb("#FFF")).toEqual([255, 255, 255]);
  });

  it("menerima tanpa tanda pagar", () => {
    expect(hexToRgb("000000")).toEqual([0, 0, 0]);
  });

  it("mengembalikan null untuk nilai cacat", () => {
    // Penting: nilai cacat harus DITOLAK, bukan menghasilkan warna acak.
    expect(hexToRgb("merah")).toBeNull();
    expect(hexToRgb("#12345")).toBeNull();
    expect(hexToRgb("#GGGGGG")).toBeNull();
    expect(hexToRgb("")).toBeNull();
  });

  it("isValidHex konsisten dengan hexToRgb", () => {
    expect(isValidHex("#1E40AF")).toBe(true);
    expect(isValidHex("#xyz")).toBe(false);
  });
});

describe("luminansi & kontras (WCAG)", () => {
  it("putih paling terang, hitam paling gelap", () => {
    expect(relativeLuminance("#FFFFFF")).toBeCloseTo(1, 5);
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 5);
  });

  it("kontras hitam-putih = 21:1", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBe(21);
  });

  it("kontras warna sama = 1:1", () => {
    expect(contrastRatio("#1E40AF", "#1E40AF")).toBe(1);
  });

  it("kontras simetris (urutan tidak berpengaruh)", () => {
    expect(contrastRatio("#1E40AF", "#FFFFFF")).toBe(
      contrastRatio("#FFFFFF", "#1E40AF"),
    );
  });

  it("isReadable memakai ambang 4.5 untuk teks biasa", () => {
    expect(isReadable("#000000", "#FFFFFF")).toBe(true);
    expect(isReadable("#AAAAAA", "#FFFFFF")).toBe(false);
  });

  it("isReadable melonggarkan ambang untuk teks besar", () => {
    // Abu yang gagal untuk teks biasa bisa lolos untuk judul besar.
    const gray = "#767676";
    expect(isReadable(gray, "#FFFFFF")).toBe(true);
    expect(isReadable("#949494", "#FFFFFF", true)).toBe(true);
  });
});

describe("bestTextOn", () => {
  it("memilih putih di atas latar gelap", () => {
    expect(bestTextOn("#1E40AF")).toBe("#FFFFFF");
  });

  it("memilih gelap di atas latar terang", () => {
    // Kuning terang: teks putih tidak terbaca, jadi harus gelap.
    expect(bestTextOn("#FACC15")).toBe("#111827");
  });

  it("selalu menghasilkan kontras yang layak untuk semua warna preset", () => {
    // Inilah jaminan utama: apa pun warna aksen yang dipilih sekolah,
    // label tombol tetap terbaca.
    for (const p of THEME_PRESETS) {
      for (const color of [p.primary, p.accent]) {
        const text = bestTextOn(color);
        expect(
          contrastRatio(text, color),
          `kontras teks di atas ${color} (preset ${p.key})`,
        ).toBeGreaterThanOrEqual(BEST_TEXT_CONTRAST_MIN);
      }
    }
  });
});

describe("preset tema", () => {
  it("semua preset punya warna hex yang sah", () => {
    for (const p of THEME_PRESETS) {
      for (const key of ["primary", "accent", "background", "surface", "text"] as const) {
        expect(isValidHex(p[key]), `${p.key}.${key} = ${p[key]}`).toBe(true);
      }
      expect(p.swatch.length).toBe(3);
      p.swatch.forEach((s) => expect(isValidHex(s)).toBe(true));
    }
  });

  it("kunci preset unik", () => {
    const keys = THEME_PRESETS.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("teks terbaca di atas latar & permukaan pada semua preset", () => {
    // Ini yang membuat preset bisa dipercaya: sekolah tidak bisa memilih
    // kombinasi yang menghasilkan teks tak terbaca.
    for (const p of THEME_PRESETS) {
      expect(
        contrastRatio(p.text, p.background),
        `${p.key}: teks di latar`,
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(p.text, p.surface),
        `${p.key}: teks di permukaan`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("resolveTheme", () => {
  it("memakai preset bawaan bila preset tidak dikenal — TANPA peringatan", () => {
    // Sengaja tidak memberi peringatan: nilai tak sah bisa berasal dari data
    // lama atau preset yang dihapus di versi baru. Halaman publik harus tetap
    // tampil normal, bukan menampilkan keluhan ke pengunjung.
    const t = resolveTheme({ preset: "tidak-ada" });
    expect(t.presetKey).toBe("akademik-biru");
    expect(t.warnings).toEqual([]);
  });

  it("memakai preset bawaan bila preset kosong", () => {
    const t = resolveTheme({});
    expect(t.presetKey).toBe("akademik-biru");
  });

  it("menerapkan penyesuaian warna yang sah", () => {
    const t = resolveTheme({ preset: "akademik-biru", primaryColor: "#123456" });
    expect(t.primary).toBe("#123456");
  });

  it("MENGABAIKAN warna cacat dan memberi peringatan", () => {
    const t = resolveTheme({ preset: "akademik-biru", primaryColor: "bukan-warna" });
    expect(t.primary).toBe(getPreset("akademik-biru")!.primary);
    expect(t.warnings.some((w) => w.includes("tidak sah"))).toBe(true);
  });

  it("selalu memberi warna teks tombol yang terbaca", () => {
    const t = resolveTheme({ preset: "pesantren-hijau" });
    expect(contrastRatio(t.primaryText, t.primary)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(t.accentText, t.accent)).toBeGreaterThanOrEqual(4.5);
  });

  it("memetakan gaya sudut ke radius", () => {
    const tegas = resolveTheme({ cornerStyle: "tegas" });
    const bulat = resolveTheme({ cornerStyle: "bulat" });
    expect(tegas.radiusButton).toBe("0.25rem");
    expect(bulat.radiusButton).toBe("9999px");
  });

  it("memakai gaya sudut bawaan bila tidak dikenal", () => {
    const t = resolveTheme({ cornerStyle: "segitiga" });
    expect(t.radiusCard).toBe(getCornerStyle("lembut")!.radiusCard);
  });

  it("memakai huruf bawaan bila pilihan tidak dikenal", () => {
    const t = resolveTheme({ headingFont: "comic-sans", bodyFont: "papyrus" });
    expect(t.headingFontVar).toBe(getHeadingFont("fraunces")!.cssVar);
    expect(t.bodyFontVar).toBe(getBodyFont("public-sans")!.cssVar);
  });

  it("menghasilkan warna turunan (muted & border) yang sah", () => {
    const t = resolveTheme({ preset: "netral-elegan" });
    expect(isValidHex(t.mutedText)).toBe(true);
    expect(isValidHex(t.border)).toBe(true);
  });
});

describe("checkThemeSafety", () => {
  it("menandai hex cacat sebagai error", () => {
    const issues = checkThemeSafety({ primaryColor: "xyz" });
    expect(issues.some((i) => i.severity === "error")).toBe(true);
  });

  it("tidak mengeluh untuk preset yang sehat tanpa penyesuaian", () => {
    const issues = checkThemeSafety({ preset: "akademik-biru" });
    expect(issues).toEqual([]);
  });

  it("memperingatkan warna utama yang nyaris tak terlihat di latar", () => {
    // Kuning sangat terang di atas latar hampir putih → judul tak terbaca.
    const issues = checkThemeSafety({
      preset: "akademik-biru",
      primaryColor: "#FFFDE7",
    });
    expect(issues.some((i) => i.severity === "warning")).toBe(true);
  });
});

describe("mixToward", () => {
  it("amount 0 mengembalikan warna awal", () => {
    expect(mixToward("#000000", "#FFFFFF", 0)).toBe("#000000");
  });

  it("amount 1 mengembalikan warna tujuan", () => {
    expect(mixToward("#000000", "#FFFFFF", 1)).toBe("#FFFFFF");
  });

  it("amount 0.5 menghasilkan tengah", () => {
    expect(mixToward("#000000", "#FFFFFF", 0.5)).toBe("#808080");
  });

  it("membatasi amount di luar 0..1", () => {
    expect(mixToward("#000000", "#FFFFFF", -5)).toBe("#000000");
    expect(mixToward("#000000", "#FFFFFF", 99)).toBe("#FFFFFF");
  });

  it("mengembalikan warna awal bila masukan cacat", () => {
    expect(mixToward("cacat", "#FFFFFF", 0.5)).toBe("cacat");
  });
});

describe("recommendPreset", () => {
  it("merekomendasikan tema ramah untuk TK/SD", () => {
    expect(recommendPreset("TK")).toBe("ramah-jingga");
    expect(recommendPreset("SD")).toBe("ramah-jingga");
  });

  it("merekomendasikan tema pesantren untuk madrasah", () => {
    expect(recommendPreset("MTs")).toBe("pesantren-hijau");
    expect(recommendPreset("MA")).toBe("pesantren-hijau");
  });

  it("merekomendasikan tema elegan untuk SMA/SMK", () => {
    expect(recommendPreset("SMA")).toBe("netral-elegan");
    expect(recommendPreset("SMK")).toBe("netral-elegan");
  });

  it("selalu mengembalikan preset yang benar-benar ada", () => {
    for (const lvl of ["TK", "SD", "SMP", "SMA", "SMK", "MI", "MTs", "MA", "???"]) {
      expect(getPreset(recommendPreset(lvl)), `jenjang ${lvl}`).toBeDefined();
    }
  });
});

describe("daftar pilihan huruf & sudut", () => {
  it("huruf punya kunci unik dan cssVar terisi", () => {
    for (const list of [HEADING_FONTS, BODY_FONTS]) {
      const keys = list.map((f) => f.key);
      expect(new Set(keys).size).toBe(keys.length);
      list.forEach((f) => {
        expect(f.cssVar.startsWith("--font-")).toBe(true);
        expect(f.description.length).toBeGreaterThan(0);
      });
    }
  });

  it("gaya sudut punya radius yang sah", () => {
    const keys = CORNER_STYLES.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const c of CORNER_STYLES) {
      expect(c.radiusCard.length).toBeGreaterThan(0);
      expect(c.radiusButton.length).toBeGreaterThan(0);
    }
  });

  it("lookup mengembalikan undefined untuk kunci tak dikenal", () => {
    expect(getCornerStyle("segitiga")).toBeUndefined();
    expect(getHeadingFont("x")).toBeUndefined();
    expect(getBodyFont("x")).toBeUndefined();
    expect(getPreset("x")).toBeUndefined();
  });
});
