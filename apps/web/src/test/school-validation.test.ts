import { describe, expect, it } from "vitest";
import {
  schoolCreateSchema,
  slugField,
  hexColorField,
} from "@/lib/validations/school";

describe("slugField", () => {
  it("menerima slug huruf kecil & angka", () => {
    expect(slugField.safeParse("smpn1-bandung").success).toBe(true);
    expect(slugField.safeParse("sd-negeri-05").success).toBe(true);
  });

  it("mengubah huruf besar menjadi kecil", () => {
    const r = slugField.safeParse("SMPN1-Bandung");
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toBe("smpn1-bandung");
  });

  it("menolak spasi & garis bawah", () => {
    expect(slugField.safeParse("smpn 1").success).toBe(false);
    expect(slugField.safeParse("smpn_1").success).toBe(false);
  });

  it("menolak tanda hubung di awal/akhir atau ganda", () => {
    expect(slugField.safeParse("-sekolah").success).toBe(false);
    expect(slugField.safeParse("sekolah-").success).toBe(false);
    expect(slugField.safeParse("sekolah--ku").success).toBe(false);
  });

  it("menolak karakter aneh (keamanan)", () => {
    expect(slugField.safeParse("sekolah/../admin").success).toBe(false);
    expect(slugField.safeParse("<script>").success).toBe(false);
  });
});

describe("hexColorField", () => {
  it("menerima hex 6 digit dan menormalkan ke huruf besar", () => {
    const r = hexColorField.safeParse("#1e6b52");
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toBe("#1E6B52");
  });

  it("menolak format pendek & tanpa pagar", () => {
    expect(hexColorField.safeParse("#1E6").success).toBe(false);
    expect(hexColorField.safeParse("1E6B52").success).toBe(false);
  });

  it("menolak nilai non-hex", () => {
    expect(hexColorField.safeParse("#ZZZZZZ").success).toBe(false);
  });
});

describe("schoolCreateSchema", () => {
  const base = { name: "SMP Negeri 1 Bandung", slug: "smpn1-bandung", level: "SMP" };

  it("menerima input minimal", () => {
    const r = schoolCreateSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.timezone).toBe("Asia/Jakarta");
  });

  it("menolak nama sekolah terlalu pendek", () => {
    expect(schoolCreateSchema.safeParse({ ...base, name: "SD" }).success).toBe(false);
  });

  it("menolak jenjang tak dikenal", () => {
    expect(schoolCreateSchema.safeParse({ ...base, level: "UNIV" }).success).toBe(false);
  });

  it("menerima white-label warna tema", () => {
    const r = schoolCreateSchema.safeParse({ ...base, themeColor: "#1e6b52" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.themeColor).toBe("#1E6B52");
  });

  it("warna tema kosong menjadi undefined", () => {
    const r = schoolCreateSchema.safeParse({ ...base, themeColor: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.themeColor).toBeUndefined();
  });

  it("menolak password admin pendek bila diisi", () => {
    const r = schoolCreateSchema.safeParse({
      ...base,
      adminName: "Admin",
      adminEmail: "a@b.sch.id",
      adminPassword: "pendek",
    });
    expect(r.success).toBe(false);
  });

  it("menerima data admin lengkap", () => {
    const r = schoolCreateSchema.safeParse({
      ...base,
      adminName: "Admin Sekolah",
      adminEmail: "admin@sekolah.sch.id",
      adminPassword: "rahasia12345",
    });
    expect(r.success).toBe(true);
  });
});
