import { describe, expect, it } from "vitest";
import {
  templateCreateSchema,
  announcementSchema,
  testSendSchema,
  importSeedSchema,
  AUDIENCE_TYPES,
  TEMPLATE_CATEGORIES,
} from "@/lib/validations/notification";
import { TEMPLATE_SEEDS, getTemplateSeed, SAMPLE_VARS } from "@/lib/templates-seed";
import { extractVariables, renderTemplate } from "@/lib/notification";

describe("templateCreateSchema", () => {
  const base = {
    key: "attendance.absent",
    name: "Pemberitahuan alpa",
    category: "ATTENDANCE" as const,
    body: "Halo {{nama_siswa}}",
  };

  it("menerima template yang sah", () => {
    const r = templateCreateSchema.safeParse(base);
    expect(r.success).toBe(true);
  });

  it("menolak kunci dengan huruf besar atau spasi", () => {
    expect(templateCreateSchema.safeParse({ ...base, key: "Attendance Absent" }).success).toBe(false);
    expect(templateCreateSchema.safeParse({ ...base, key: "Attendance" }).success).toBe(false);
  });

  it("menolak isi pesan yang melebihi batas WhatsApp", () => {
    const r = templateCreateSchema.safeParse({ ...base, body: "x".repeat(5000) });
    expect(r.success).toBe(false);
  });

  it("menolak kategori yang tidak dikenal", () => {
    const r = templateCreateSchema.safeParse({ ...base, category: "NGAWUR" });
    expect(r.success).toBe(false);
  });

  it("checkbox 'on' menjadi true, absen menjadi false", () => {
    const on = templateCreateSchema.safeParse({ ...base, isActive: "on" });
    const off = templateCreateSchema.safeParse({ ...base });
    expect(on.success && on.data.isActive).toBe(true);
    expect(off.success && off.data.isActive).toBe(false);
  });
});

describe("announcementSchema", () => {
  const base = { title: "Libur", body: "Sekolah libur besok.", audienceType: "TEACHERS" as const };

  it("menerima audiens tanpa kelas", () => {
    expect(announcementSchema.safeParse(base).success).toBe(true);
  });

  it("mewajibkan kelas untuk audiens per kelas", () => {
    const r = announcementSchema.safeParse({
      ...base,
      audienceType: "PARENTS_OF_CLASS",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].path).toContain("audienceClassId");
    }
  });

  it("menerima audiens per kelas bila kelas diisi", () => {
    const r = announcementSchema.safeParse({
      ...base,
      audienceType: "PARENTS_OF_CLASS",
      audienceClassId: "cls_1",
    });
    expect(r.success).toBe(true);
  });

  it("menolak semua tipe audiens yang tidak dikenal", () => {
    expect(announcementSchema.safeParse({ ...base, audienceType: "SEMUA" }).success).toBe(false);
  });
});

describe("testSendSchema", () => {
  it("menerima nomor dengan spasi, tanda hubung, dan tanda plus", () => {
    expect(testSendSchema.safeParse({ phone: "+62 812-3456-7890", body: "Hai" }).success).toBe(true);
  });

  it("menolak nomor dengan huruf", () => {
    expect(testSendSchema.safeParse({ phone: "0812ABCD", body: "Hai" }).success).toBe(false);
  });

  it("menolak pesan kosong", () => {
    expect(testSendSchema.safeParse({ phone: "081234567890", body: "" }).success).toBe(false);
  });
});

describe("importSeedSchema", () => {
  it("keys kosong berarti impor semua", () => {
    const r = importSeedSchema.safeParse({});
    expect(r.success && r.data.keys).toEqual([]);
  });

  it("satu kunci tunggal dibungkus jadi array", () => {
    const r = importSeedSchema.safeParse({ keys: "attendance.absent" });
    expect(r.success && r.data.keys).toEqual(["attendance.absent"]);
  });

  it("overwrite terdeteksi dari checkbox", () => {
    const r = importSeedSchema.safeParse({ overwrite: "on" });
    expect(r.success && r.data.overwrite).toBe(true);
  });
});

describe("perpustakaan template bawaan", () => {
  it("tidak ada kunci ganda", () => {
    const keys = TEMPLATE_SEEDS.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("semua kategori sah", () => {
    for (const t of TEMPLATE_SEEDS) {
      expect(TEMPLATE_CATEGORIES).toContain(t.category);
    }
  });

  it("setiap template punya nama, keterangan, dan isi", () => {
    for (const t of TEMPLATE_SEEDS) {
      expect(t.name.length).toBeGreaterThan(0);
      expect(t.description.length).toBeGreaterThan(0);
      expect(t.body.length).toBeGreaterThan(10);
    }
  });

  it("semua template boleh diparse skema", () => {
    for (const t of TEMPLATE_SEEDS) {
      const r = templateCreateSchema.safeParse({ ...t, isActive: "on" });
      expect(r.success, `template ${t.key} gagal validasi`).toBe(true);
    }
  });

  it("setiap variabel punya contoh untuk pratinjau", () => {
    for (const t of TEMPLATE_SEEDS) {
      for (const v of extractVariables(t.body)) {
        // nama_sekolah diisi otomatis saat kirim, jadi boleh tanpa contoh khusus.
        expect(
          SAMPLE_VARS[v] !== undefined,
          `template ${t.key} memakai {{${v}}} tanpa contoh`,
        ).toBe(true);
      }
    }
  });

  it("contoh dapat me-render template tanpa sisa kurung", () => {
    for (const t of TEMPLATE_SEEDS) {
      const out = renderTemplate(t.body, SAMPLE_VARS);
      expect(out).not.toContain("{{");
      expect(out).not.toContain("}}");
    }
  });

  it("getTemplateSeed menemukan template yang ada", () => {
    expect(getTemplateSeed("attendance.absent")?.name).toBe("Pemberitahuan alpa");
    expect(getTemplateSeed("tidak.ada")).toBeUndefined();
  });

  it("mencakup semua kategori penting untuk sekolah", () => {
    const cats = new Set(TEMPLATE_SEEDS.map((t) => t.category));
    expect(cats.has("ATTENDANCE")).toBe(true);
    expect(cats.has("GRADE")).toBe(true);
    expect(cats.has("FINANCE")).toBe(true);
    expect(cats.has("ADMISSION")).toBe(true);
  });
});
