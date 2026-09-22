import { describe, expect, it } from "vitest";
import {
  can,
  canAccessModule,
  modulesFor,
  effectivePermissions,
  isOverridden,
  defaultActionsFor,
  anyRoleCanManageUsers,
  ALL_MODULES,
  ALL_ACTIONS,
  type Action,
} from "@/lib/rbac";

/**
 * Uji penimpaan izin per sekolah.
 *
 * KENAPA TEST INI PENTING:
 * Penimpaan izin menyentuh SETIAP gerbang keamanan di aplikasi — 107
 * pemanggilan `guard()` dan puluhan pemeriksaan di halaman. Salah satu arah
 * saja (mis. penimpaan yang menambah alih-alih mengganti) berarti sekolah bisa
 * memberi akses yang tidak pernah diniatkan, atau mencabut akses yang
 * seharusnya tetap ada.
 *
 * KEPUTUSAN YANG DIKUNCI DI SINI:
 *   1. Tanpa penimpaan → perilaku PERSIS seperti matriks bawaan.
 *   2. Ada penimpaan → MENGGANTIKAN bawaan, bukan menambah. "Mencabut" harus
 *      mungkin, kalau tidak tidak ada cara berhenti memberi akses.
 *   3. SUPER_ADMIN tidak bisa ditimpa.
 */

describe("can() tanpa penimpaan — perilaku bawaan tidak berubah", () => {
  it("admin sekolah boleh mengelola siswa", () => {
    expect(can("SCHOOL_ADMIN", "students", "manage")).toBe(true);
  });

  it("bendahara boleh mengelola keuangan", () => {
    expect(can("TREASURER", "finance", "manage")).toBe(true);
  });

  it("bendahara TIDAK boleh mengelola pengguna", () => {
    expect(can("TREASURER", "users", "manage")).toBe(false);
  });

  it("guru boleh mengisi absensi", () => {
    expect(can("TEACHER", "attendance", "create")).toBe(true);
  });

  it("`manage` mencakup aksi lain", () => {
    expect(can("SCHOOL_ADMIN", "finance", "delete")).toBe(true);
    expect(can("SCHOOL_ADMIN", "finance", "read")).toBe(true);
  });

  it("null/undefined penimpaan sama dengan tidak ada", () => {
    expect(can("SCHOOL_ADMIN", "students", "manage", null)).toBe(true);
    expect(can("TREASURER", "users", "manage", undefined)).toBe(false);
  });

  it("modul yang tidak ada di matriks ditolak", () => {
    expect(can("TEACHER", "schools", "read")).toBe(false);
  });
});

describe("can() dengan penimpaan — MENGGANTIKAN, bukan menambah", () => {
  it("MEMBERI akses yang tadinya tidak ada", () => {
    // Bendahara diberi izin melihat absensi.
    const override = { attendance: ["read"] as Action[] };
    expect(can("TREASURER", "attendance", "read", override)).toBe(true);
    // Tetapi hanya baca — bukan mengubah.
    expect(can("TREASURER", "attendance", "update", override)).toBe(false);
  });

  it("MENCABUT akses yang tadinya ada", () => {
    // Ini alasan utama penimpaan menggantikan, bukan menambah: tanpa
    // kemampuan mencabut, tidak ada cara berhenti memberi akses.
    const override = { finance: ["read"] as Action[] };
    expect(can("TREASURER", "finance", "read", override)).toBe(true);
    expect(can("TREASURER", "finance", "update", override)).toBe(false);
    expect(can("TREASURER", "finance", "delete", override)).toBe(false);
  });

  it("array kosong berarti TIDAK ada akses sama sekali", () => {
    const override = { finance: [] as Action[] };
    expect(can("TREASURER", "finance", "read", override)).toBe(false);
    expect(canAccessModule("TREASURER", "finance", override)).toBe(false);
  });

  it("manage pada penimpaan mencakup aksi lain", () => {
    const override = { grades: ["manage"] as Action[] };
    expect(can("TREASURER", "grades", "delete", override)).toBe(true);
  });

  it("modul yang TIDAK ditimpa tetap memakai bawaan", () => {
    // Hanya `finance` yang ditimpa; `students` harus tetap seperti semula.
    const override = { finance: ["read"] as Action[] };
    expect(can("SCHOOL_ADMIN", "students", "manage", override)).toBe(true);
  });

  it("penimpaan tidak berlaku untuk modul lain", () => {
    const override = { finance: ["read"] as Action[] };
    expect(can("TREASURER", "users", "manage", override)).toBe(false);
  });
});

describe("SUPER_ADMIN tidak dapat ditimpa", () => {
  it("penimpaan kosong tidak mengunci super admin", () => {
    // Sekolah tidak boleh mengunci dirinya sendiri dari jalur pemulihan.
    const override = { schools: [] as Action[], users: [] as Action[] };
    expect(can("SUPER_ADMIN", "schools", "manage", override)).toBe(true);
    expect(can("SUPER_ADMIN", "users", "manage", override)).toBe(true);
  });

  it("canAccessModule juga mengabaikan penimpaan untuk super admin", () => {
    const override = { schools: [] as Action[] };
    expect(canAccessModule("SUPER_ADMIN", "schools", override)).toBe(true);
  });
});

describe("modulesFor() — menyusun menu sidebar", () => {
  it("tanpa penimpaan sama dengan bawaan", () => {
    const mods = modulesFor("TREASURER");
    expect(mods).toContain("finance");
    expect(mods).not.toContain("users");
  });

  it("penimpaan bisa MENCABUT modul dari menu", () => {
    const override = { finance: [] as Action[] };
    expect(modulesFor("TREASURER", override)).not.toContain("finance");
  });

  it("penimpaan bisa MENAMBAH modul yang tidak ada di bawaan", () => {
    // Modul baru yang belum pernah dimiliki role ini tetap muncul di menu.
    const override = { attendance: ["read"] as Action[] };
    expect(modulesFor("TREASURER", override)).toContain("attendance");
  });

  it("modul dengan aksi kosong tidak muncul", () => {
    const override = { attendance: [] as Action[] };
    expect(modulesFor("TREASURER", override)).not.toContain("attendance");
  });
});

describe("effectivePermissions()", () => {
  it("mengembalikan izin untuk SEMUA modul", () => {
    const eff = effectivePermissions("SCHOOL_ADMIN");
    for (const m of ALL_MODULES) {
      expect(Array.isArray(eff[m]), `modul ${m} tidak ada`).toBe(true);
    }
  });

  it("memakai penimpaan bila ada, bawaan bila tidak", () => {
    const eff = effectivePermissions("TREASURER", { finance: ["read"] });
    expect(eff.finance).toEqual(["read"]);
    // `students` tidak ditimpa → mengikuti bawaan.
    expect(eff.students).toEqual(defaultActionsFor("TREASURER", "students"));
  });

  it("mengabaikan penimpaan untuk SUPER_ADMIN", () => {
    const eff = effectivePermissions("SUPER_ADMIN", { schools: [] });
    expect(eff.schools.length).toBeGreaterThan(0);
  });
});

describe("isOverridden()", () => {
  it("benar hanya untuk modul yang ditimpa", () => {
    const override = { finance: ["read"] as Action[] };
    expect(isOverridden("TREASURER", "finance", override)).toBe(true);
    expect(isOverridden("TREASURER", "students", override)).toBe(false);
  });

  it("selalu salah untuk SUPER_ADMIN", () => {
    expect(isOverridden("SUPER_ADMIN", "schools", { schools: [] })).toBe(false);
  });

  it("salah bila tidak ada penimpaan", () => {
    expect(isOverridden("TREASURER", "finance", null)).toBe(false);
    expect(isOverridden("TREASURER", "finance", {})).toBe(false);
  });
});

describe("anyRoleCanManageUsers() — pencegahan penguncian diri", () => {
  const SCHOOL_ROLES = [
    "SCHOOL_ADMIN",
    "PRINCIPAL",
    "TREASURER",
    "TEACHER",
    "STUDENT",
    "PARENT",
    "STAFF",
    "CONTENT_EDITOR",
  ] as const;

  it("benar bila bawaan masih memberi akses ke admin sekolah", () => {
    // Tanpa penimpaan, SCHOOL_ADMIN punya `users: manage`.
    expect(anyRoleCanManageUsers(SCHOOL_ROLES, {})).toBe(true);
  });

  it("SALAH bila SEMUA role dicabut dari mengelola pengguna", () => {
    // Inilah keadaan yang harus dicegah: halaman Hak Akses sendiri tidak akan
    // bisa dibuka lagi oleh siapa pun di sekolah.
    const overrides: Record<string, { users: Action[] }> = {};
    for (const r of SCHOOL_ROLES) overrides[r] = { users: [] };
    expect(anyRoleCanManageUsers(SCHOOL_ROLES, overrides)).toBe(false);
  });

  it("benar bila masih ada SATU role yang boleh", () => {
    const overrides: Record<string, { users: Action[] }> = {};
    for (const r of SCHOOL_ROLES) overrides[r] = { users: [] };
    // Sisakan Kepala Sekolah.
    overrides.PRINCIPAL = { users: ["manage"] };
    expect(anyRoleCanManageUsers(SCHOOL_ROLES, overrides)).toBe(true);
  });

  it("benar bila hanya sebagian role yang dicabut", () => {
    expect(
      anyRoleCanManageUsers(SCHOOL_ROLES, { TREASURER: { users: [] } }),
    ).toBe(true);
  });

  it("akses 'read' saja TIDAK cukup — harus manage", () => {
    // Membaca daftar pengguna tidak sama dengan boleh mengubah izin.
    const overrides: Record<string, { users: Action[] }> = {};
    for (const r of SCHOOL_ROLES) overrides[r] = { users: ["read"] };
    expect(anyRoleCanManageUsers(SCHOOL_ROLES, overrides)).toBe(false);
  });

  it("SUPER_ADMIN tidak dihitung sebagai penyelamat", () => {
    // Super Admin memang punya akses, tetapi ia pengelola platform — bukan
    // jalan yang pantas dibutuhkan sekolah untuk membuka dirinya sendiri.
    const overrides: Record<string, { users: Action[] }> = {};
    for (const r of SCHOOL_ROLES) overrides[r] = { users: [] };
    overrides.SUPER_ADMIN = { users: ["manage"] };
    expect(anyRoleCanManageUsers(SCHOOL_ROLES, overrides)).toBe(false);
  });

  it("mencabut lewat modul lain tidak berpengaruh", () => {
    const overrides: Record<string, { finance: Action[] }> = {};
    for (const r of SCHOOL_ROLES) overrides[r] = { finance: [] };
    expect(anyRoleCanManageUsers(SCHOOL_ROLES, overrides)).toBe(true);
  });
});

describe("keutuhan matriks bawaan", () => {
  it("setiap aksi di matriks adalah aksi yang dikenal", () => {
    for (const m of ALL_MODULES) {
      const actions = defaultActionsFor("SCHOOL_ADMIN", m);
      for (const a of actions) {
        expect(ALL_ACTIONS, `aksi tak dikenal: ${a}`).toContain(a);
      }
    }
  });

  it("`manage` tidak pernah bercampur dengan aksi lain", () => {
    // Campuran seperti ["manage","read"] membingungkan tanpa menambah arti.
    for (const role of ["SCHOOL_ADMIN", "TREASURER", "TEACHER"] as const) {
      for (const m of ALL_MODULES) {
        const actions = defaultActionsFor(role, m);
        if (actions.includes("manage")) {
          expect(actions, `${role}/${m} mencampur manage`).toEqual(["manage"]);
        }
      }
    }
  });
});
