import { describe, expect, it } from "vitest";
import {
  teacherCreateSchema,
  staffCreateSchema,
  STAFF_POSITIONS,
} from "@/lib/validations/personnel";

describe("teacherCreateSchema", () => {
  const base = { fullName: "Pak Budi", gender: "MALE" };

  it("menerima input minimal", () => {
    const r = teacherCreateSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.subjectIds).toEqual([]);
      expect(r.data.isActive).toBe(false); // checkbox tak dikirim = nonaktif
    }
  });

  it("mengaktifkan isActive saat checkbox 'on'", () => {
    const r = teacherCreateSchema.safeParse({ ...base, isActive: "on" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.isActive).toBe(true);
  });

  it("mengubah nip kosong menjadi undefined", () => {
    const r = teacherCreateSchema.safeParse({ ...base, nip: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.nip).toBeUndefined();
  });

  it("menormalkan nomor WA guru", () => {
    const r = teacherCreateSchema.safeParse({ ...base, phone: "081234567890" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.phone).toBe("6281234567890");
  });

  it("menerima banyak subjectIds", () => {
    const r = teacherCreateSchema.safeParse({
      ...base,
      subjectIds: ["s1", "s2"],
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.subjectIds).toEqual(["s1", "s2"]);
  });

  it("menolak email tidak valid", () => {
    const r = teacherCreateSchema.safeParse({ ...base, email: "bukan-email" });
    expect(r.success).toBe(false);
  });

  it("menolak nama terlalu pendek", () => {
    const r = teacherCreateSchema.safeParse({ ...base, fullName: "A" });
    expect(r.success).toBe(false);
  });
});

describe("staffCreateSchema", () => {
  const base = { fullName: "Bu Sari" };

  it("menerima position yang dikenal", () => {
    const r = staffCreateSchema.safeParse({ ...base, position: "BENDAHARA" });
    expect(r.success).toBe(true);
  });

  it("menolak position tak dikenal", () => {
    const r = staffCreateSchema.safeParse({ ...base, position: "RAJA" });
    expect(r.success).toBe(false);
  });

  it("position opsional", () => {
    const r = staffCreateSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.position).toBeUndefined();
  });

  it("semua posisi terdaftar valid", () => {
    for (const p of STAFF_POSITIONS) {
      const r = staffCreateSchema.safeParse({ ...base, position: p });
      expect(r.success, `posisi ${p} seharusnya valid`).toBe(true);
    }
  });
});
