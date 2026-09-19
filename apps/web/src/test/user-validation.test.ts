import { describe, expect, it } from "vitest";
import {
  userCreateSchema,
  userUpdateSchema,
  SCHOOL_MANAGEABLE_ROLES,
} from "@/lib/validations/user";

describe("userCreateSchema", () => {
  const base = {
    name: "Admin Sekolah",
    email: "admin@sekolah.sch.id",
    password: "rahasia12345",
    role: "SCHOOL_ADMIN",
  };

  it("menerima input valid", () => {
    const r = userCreateSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.isActive).toBe(false);
  });

  it("menormalkan email ke huruf kecil", () => {
    const r = userCreateSchema.safeParse({ ...base, email: "Admin@Sekolah.SCH.ID" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe("admin@sekolah.sch.id");
  });

  it("menolak password kurang dari 8 karakter", () => {
    const r = userCreateSchema.safeParse({ ...base, password: "pendek" });
    expect(r.success).toBe(false);
  });

  it("menolak email tidak valid", () => {
    const r = userCreateSchema.safeParse({ ...base, email: "bukan-email" });
    expect(r.success).toBe(false);
  });

  it("menolak role tak dikenal", () => {
    const r = userCreateSchema.safeParse({ ...base, role: "DEWA" });
    expect(r.success).toBe(false);
  });

  it("mengaktifkan isActive saat 'on'", () => {
    const r = userCreateSchema.safeParse({ ...base, isActive: "on" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.isActive).toBe(true);
  });

  it("menerima semua role yang sah", () => {
    const roles = [
      "SUPER_ADMIN",
      "SCHOOL_ADMIN",
      "PRINCIPAL",
      "TREASURER",
      "TEACHER",
      "STUDENT",
      "PARENT",
      "STAFF",
    ];
    for (const role of roles) {
      expect(userCreateSchema.safeParse({ ...base, role }).success).toBe(true);
    }
  });
});

describe("userUpdateSchema", () => {
  it("menerima tanpa password (tidak diubah)", () => {
    const r = userUpdateSchema.safeParse({
      id: "u1",
      name: "Nama Baru",
      role: "TEACHER",
    });
    expect(r.success).toBe(true);
  });

  it("wajib punya id", () => {
    const r = userUpdateSchema.safeParse({ name: "X", role: "TEACHER" });
    expect(r.success).toBe(false);
  });
});

describe("SCHOOL_MANAGEABLE_ROLES", () => {
  it("tidak memuat SUPER_ADMIN (cegah eskalasi hak akses)", () => {
    expect(SCHOOL_MANAGEABLE_ROLES).not.toContain("SUPER_ADMIN");
  });
});
