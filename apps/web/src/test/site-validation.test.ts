import { describe, expect, it } from "vitest";
import {
  BLOCK_PROPS_SCHEMAS,
  admissionBatchCreateSchema,
  admissionPathCreateSchema,
  navigationCreateSchema,
  pageCreateSchema,
  postCreateSchema,
  saveLayoutSchema,
  siteConfigSchema,
  themeSchema,
} from "@/lib/validations/site";
import { allBlockKeys } from "@/lib/site-blocks";

describe("saveLayoutSchema", () => {
  it("menerima susunan yang sah", () => {
    const r = saveLayoutSchema.safeParse({
      blocks: [
        { blockKey: "hero", variantKey: "hero.besar-tengah", order: 0 },
        { blockKey: "news", variantKey: "news.kartu-kolom", order: 1 },
      ],
    });
    expect(r.success).toBe(true);
  });

  it("menolak susunan kosong", () => {
    expect(saveLayoutSchema.safeParse({ blocks: [] }).success).toBe(false);
  });

  it("menolak blok yang sama dua kali", () => {
    const r = saveLayoutSchema.safeParse({
      blocks: [
        { blockKey: "hero", variantKey: "hero.ringkas", order: 0 },
        { blockKey: "hero", variantKey: "hero.belah-dua", order: 1 },
      ],
    });
    expect(r.success).toBe(false);
  });

  it("menolak varian yang bukan milik bloknya", () => {
    const r = saveLayoutSchema.safeParse({
      blocks: [{ blockKey: "hero", variantKey: "news.korsel", order: 0 }],
    });
    expect(r.success).toBe(false);
  });

  it("menolak blok tak dikenal", () => {
    const r = saveLayoutSchema.safeParse({
      blocks: [{ blockKey: "hantu", variantKey: "hero.ringkas", order: 0 }],
    });
    expect(r.success).toBe(false);
  });

  it("menerima isEnabled sebagai 'on' dari checkbox HTML", () => {
    const r = saveLayoutSchema.safeParse({
      blocks: [{ blockKey: "hero", variantKey: "hero.ringkas", order: 0, isEnabled: "on" }],
    });
    expect(r.success).toBe(true);
  });
});

describe("skema props tiap blok", () => {
  it("setiap blok di katalog punya skema", () => {
    for (const key of allBlockKeys()) {
      expect(BLOCK_PROPS_SCHEMAS[key], `blok ${key}`).toBeDefined();
    }
  });

  it("props kosong tetap menghasilkan bawaan (bukan gagal)", () => {
    // Sekolah baru menambahkan blok lalu langsung menyimpan tanpa mengisi apa pun.
    for (const [key, schema] of Object.entries(BLOCK_PROPS_SCHEMAS)) {
      const r = schema.safeParse({});
      expect(r.success, `blok ${key} gagal dengan props kosong`).toBe(true);
    }
  });

  it("hero menerima tautan internal diawali /", () => {
    const r = BLOCK_PROPS_SCHEMAS.hero.safeParse({ ctaHref: "/spmb" });
    expect(r.success).toBe(true);
  });

  it("hero menolak tautan javascript: (celah XSS)", () => {
    const r = BLOCK_PROPS_SCHEMAS.hero.safeParse({ ctaHref: "javascript:alert(1)" });
    expect(r.success).toBe(false);
  });

  it("hero menolak data: URL pada gambar", () => {
    const r = BLOCK_PROPS_SCHEMAS.hero.safeParse({
      imageUrl: "data:text/html;base64,PHNjcmlwdD4=",
    });
    expect(r.success).toBe(false);
  });

  it("hero menerima URL http(s) yang lengkap", () => {
    const r = BLOCK_PROPS_SCHEMAS.hero.safeParse({
      imageUrl: "https://contoh.sch.id/gedung.jpg",
    });
    expect(r.success).toBe(true);
  });

  it("faq menolak lebih dari 12 pertanyaan", () => {
    const items = Array.from({ length: 13 }, (_, i) => ({
      question: `T${i}`,
      answer: `J${i}`,
    }));
    expect(BLOCK_PROPS_SCHEMAS.faq.safeParse({ items }).success).toBe(false);
  });

  it("faq menerima pertanyaan tanpa jawaban-pun ditolak bila kosong", () => {
    const r = BLOCK_PROPS_SCHEMAS.faq.safeParse({
      items: [{ question: "Kapan pendaftaran?", answer: "" }],
    });
    expect(r.success).toBe(false);
  });

  it("stats menolak lebih dari 4 angka", () => {
    const items = Array.from({ length: 5 }, (_, i) => ({ label: `L${i}`, value: "1" }));
    expect(BLOCK_PROPS_SCHEMAS.stats.safeParse({ items }).success).toBe(false);
  });

  it("news membatasi jumlah item minimal 1", () => {
    expect(BLOCK_PROPS_SCHEMAS.news.safeParse({ itemCount: 0 }).success).toBe(false);
    expect(BLOCK_PROPS_SCHEMAS.news.safeParse({ itemCount: 3 }).success).toBe(true);
  });
});

describe("pageCreateSchema", () => {
  it("menerima halaman yang sah", () => {
    const r = pageCreateSchema.safeParse({ title: "Visi & Misi", slug: "visi-misi" });
    expect(r.success).toBe(true);
  });

  it("menolak slug dengan huruf kapital atau spasi", () => {
    expect(pageCreateSchema.safeParse({ title: "A", slug: "Visi Misi" }).success).toBe(false);
    expect(pageCreateSchema.safeParse({ title: "A", slug: "VisiMisi" }).success).toBe(false);
  });

  it("menolak slug kosong", () => {
    expect(pageCreateSchema.safeParse({ title: "A", slug: "" }).success).toBe(false);
  });

  it("menerima slug bertanda hubung", () => {
    expect(pageCreateSchema.safeParse({ title: "A", slug: "sambutan-kepala-sekolah" }).success).toBe(
      true,
    );
  });

  it("mengubah 'on' menjadi boolean untuk showInNav & isPublished", () => {
    const r = pageCreateSchema.safeParse({ title: "A", slug: "a", showInNav: "on" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.showInNav).toBe(true);
      expect(r.data.isPublished).toBe(false);
    }
  });
});

describe("navigationCreateSchema", () => {
  it("menerima menu internal", () => {
    const r = navigationCreateSchema.safeParse({ label: "Berita", href: "/berita" });
    expect(r.success).toBe(true);
  });

  it("menerima menu eksternal http(s)", () => {
    const r = navigationCreateSchema.safeParse({
      label: "Dinas",
      href: "https://dinas.go.id",
    });
    expect(r.success).toBe(true);
  });

  it("menolak tautan javascript:", () => {
    const r = navigationCreateSchema.safeParse({ label: "X", href: "javascript:alert(1)" });
    expect(r.success).toBe(false);
  });

  it("menolak menu tanpa tujuan", () => {
    expect(navigationCreateSchema.safeParse({ label: "X", href: "" }).success).toBe(false);
  });

  it("menolak area selain header/footer", () => {
    const r = navigationCreateSchema.safeParse({ label: "X", href: "/x", area: "samping" });
    expect(r.success).toBe(false);
  });
});

describe("themeSchema", () => {
  it("menerima preset yang ada", () => {
    expect(themeSchema.safeParse({ preset: "pesantren-hijau" }).success).toBe(true);
  });

  it("menolak preset tak dikenal", () => {
    expect(themeSchema.safeParse({ preset: "preset-hantu" }).success).toBe(false);
  });

  it("menerima warna hex dengan atau tanpa pagar", () => {
    expect(themeSchema.safeParse({ preset: "akademik-biru", primaryColor: "#1E40AF" }).success).toBe(
      true,
    );
    expect(themeSchema.safeParse({ preset: "akademik-biru", primaryColor: "1E40AF" }).success).toBe(
      true,
    );
  });

  it("menolak warna cacat", () => {
    expect(themeSchema.safeParse({ preset: "akademik-biru", primaryColor: "biru" }).success).toBe(
      false,
    );
  });

  it("menolak huruf yang tidak tersedia", () => {
    expect(
      themeSchema.safeParse({ preset: "akademik-biru", headingFont: "comic-sans" }).success,
    ).toBe(false);
  });
});

describe("siteConfigSchema", () => {
  it("menerima pengaturan kosong dengan bawaan", () => {
    const r = siteConfigSchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.homepageMode).toBe("BLOCKS");
  });

  it("menolak mode halaman depan yang tidak dikenal", () => {
    expect(siteConfigSchema.safeParse({ homepageMode: "KOSONG" }).success).toBe(false);
  });
});

describe("admissionPathCreateSchema — multi-jalur SPMB", () => {
  const base = { batchId: "b1", name: "Jalur Prestasi", code: "PRESTASI", quota: 20 };

  it("menerima jalur dasar", () => {
    const r = admissionPathCreateSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.registrationFee).toBeNull();
  });

  it("mengubah kode jalur menjadi huruf kapital", () => {
    const r = admissionPathCreateSchema.safeParse({ ...base, code: "prestasi" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.code).toBe("PRESTASI");
  });

  it("menolak kode dengan spasi atau simbol", () => {
    expect(admissionPathCreateSchema.safeParse({ ...base, code: "Prest asi" }).success).toBe(false);
    expect(admissionPathCreateSchema.safeParse({ ...base, code: "A-1" }).success).toBe(false);
  });

  it("memperlakukan biaya kosong sebagai null (gratis), bukan 0", () => {
    // Penting: null = tidak dipungut biaya; 0 = gratis eksplisit. Beda makna.
    const r = admissionPathCreateSchema.safeParse({ ...base, registrationFee: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.registrationFee).toBeNull();
  });

  it("menerima biaya gratis eksplisit sebagai 0", () => {
    const r = admissionPathCreateSchema.safeParse({ ...base, registrationFee: "0" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.registrationFee).toBe(0);
  });

  it("menolak biaya pecahan (rupiah harus bulat)", () => {
    expect(
      admissionPathCreateSchema.safeParse({ ...base, registrationFee: "1500.5" }).success,
    ).toBe(false);
  });

  it("menolak biaya negatif", () => {
    expect(
      admissionPathCreateSchema.safeParse({ ...base, registrationFee: "-1" }).success,
    ).toBe(false);
  });

  it("menolak kuota negatif", () => {
    expect(admissionPathCreateSchema.safeParse({ ...base, quota: -5 }).success).toBe(false);
  });

  it("menerima biaya dalam bentuk string dari form HTML", () => {
    const r = admissionPathCreateSchema.safeParse({ ...base, registrationFee: "150000" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.registrationFee).toBe(150000);
  });
});

describe("admissionBatchCreateSchema", () => {
  const base = {
    academicYearId: "y1",
    name: "SPMB 2026/2027 Gelombang 1",
    openDate: "2026-01-01",
    closeDate: "2026-03-31",
    quota: 100,
  };

  it("menerima gelombang yang sah", () => {
    expect(admissionBatchCreateSchema.safeParse(base).success).toBe(true);
  });

  it("menolak tanggal tutup sebelum tanggal buka", () => {
    const r = admissionBatchCreateSchema.safeParse({
      ...base,
      openDate: "2026-03-31",
      closeDate: "2026-01-01",
    });
    expect(r.success).toBe(false);
  });

  it("menolak tanggal tutup sama dengan tanggal buka", () => {
    const r = admissionBatchCreateSchema.safeParse({
      ...base,
      openDate: "2026-01-01",
      closeDate: "2026-01-01",
    });
    expect(r.success).toBe(false);
  });
});

describe("postCreateSchema", () => {
  it("menerima berita yang sah", () => {
    expect(postCreateSchema.safeParse({ title: "Juara Lomba", slug: "juara-lomba" }).success).toBe(
      true,
    );
  });

  it("menolak jenis tulisan tak dikenal", () => {
    expect(
      postCreateSchema.safeParse({ title: "A", slug: "a", type: "PUISI" }).success,
    ).toBe(false);
  });

  it("menerima agenda dengan tanggal kegiatan", () => {
    const r = postCreateSchema.safeParse({
      title: "Rapat Orang Tua",
      slug: "rapat-ortu",
      type: "AGENDA",
      eventDate: "2026-02-10",
    });
    expect(r.success).toBe(true);
  });
});
