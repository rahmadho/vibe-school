import { beforeEach, describe, expect, it, vi } from "vitest";
import { scopedDb, unscoped, TENANT_MODELS } from "@/lib/scoped-db";

/**
 * Test ISOLASI TENANT — membuktikan helper scopedDb:
 *  1. menyuntikkan schoolId ke setiap `where`
 *  2. menolak query lintas-tenant
 *  3. menyuntikkan schoolId ke setiap `create`
 *  4. menolak model global & schoolId kosong
 *
 * Kita mock delegate Prisma agar test berjalan TANPA database.
 * (Test integrasi terhadap DB nyata dijalankan oleh user di VPS/PC.)
 */

type Captured = { op: string; args: unknown };

// Mock delegate: mencatat argumen yang diterima.
function makeDelegate(captured: Captured[]) {
  const record =
    (op: string) =>
    (args: unknown) => {
      captured.push({ op, args });
      return Promise.resolve([]);
    };
  return {
    findMany: record("findMany"),
    findFirst: record("findFirst"),
    findUnique: record("findUnique"),
    count: record("count"),
    update: record("update"),
    updateMany: record("updateMany"),
    delete: record("delete"),
    deleteMany: record("deleteMany"),
    create: record("create"),
    createMany: record("createMany"),
    upsert: record("upsert"),
    aggregate: record("aggregate"),
    groupBy: record("groupBy"),
  };
}

let captured: Captured[] = [];

// Mock modul prisma dengan delegate palsu untuk setiap model tenant.
// PENTING: path relatif "./prisma" dari dalam scoped-db.ts akan di-resolve
// ke "@/lib/prisma" oleh alias Vitest; mock harus memakai spesifier yang sama
// persis seperti yang di-import scoped-db.ts (yakni "./prisma").
vi.mock("../lib/prisma", () => {
  const delegates: Record<string, unknown> = {};
  const models = [
    "user","student","parent","teacher","staff","class","subject","schedule",
    "academicYear","semester","timeSlot","admissionBatch","registration",
    "attendance","gradeItem","grade","reportCard","feeType","invoice",
    "paymentMethod","payment","paymentGatewayTransaction","post",
    "announcement","notificationTemplate","notificationQueue","auditLog",
    "studentClassHistory","subscription",
  ] as const;

  for (const m of models) {
    delegates[m] = {
      findMany: (args: unknown) => { captured.push({ op: `${m}.findMany`, args }); return Promise.resolve([]); },
      findFirst: (args: unknown) => { captured.push({ op: `${m}.findFirst`, args }); return Promise.resolve(null); },
      findUnique: (args: unknown) => { captured.push({ op: `${m}.findUnique`, args }); return Promise.resolve(null); },
      count: (args: unknown) => { captured.push({ op: `${m}.count`, args }); return Promise.resolve(0); },
      create: (args: unknown) => { captured.push({ op: `${m}.create`, args }); return Promise.resolve({}); },
      createMany: (args: unknown) => { captured.push({ op: `${m}.createMany`, args }); return Promise.resolve({ count: 0 }); },
      update: (args: unknown) => { captured.push({ op: `${m}.update`, args }); return Promise.resolve({}); },
      updateMany: (args: unknown) => { captured.push({ op: `${m}.updateMany`, args }); return Promise.resolve({ count: 0 }); },
      delete: (args: unknown) => { captured.push({ op: `${m}.delete`, args }); return Promise.resolve({}); },
      deleteMany: (args: unknown) => { captured.push({ op: `${m}.deleteMany`, args }); return Promise.resolve({ count: 0 }); },
      upsert: (args: unknown) => { captured.push({ op: `${m}.upsert`, args }); return Promise.resolve({}); },
    };
  }

  return { prisma: delegates };
});

const SCHOOL_A = "school_aaa";
const SCHOOL_B = "school_bbb";

beforeEach(() => {
  captured = [];
});

describe("scopedDb — isolasi tenant", () => {
  it("menyuntikkan schoolId ke findMany", async () => {
    const db = scopedDb(SCHOOL_A);
    await db.student.findMany();
    expect(captured).toHaveLength(1);
    expect(captured[0].args).toMatchObject({ where: { schoolId: SCHOOL_A } });
  });

  it("mempertahankan kondisi where lain sambil menambah schoolId", async () => {
    const db = scopedDb(SCHOOL_A);
    await db.student.findMany({ where: { status: "ACTIVE" } });
    expect(captured[0].args).toMatchObject({
      where: { status: "ACTIVE", schoolId: SCHOOL_A },
    });
  });

  it("MENOLAK query lintas-tenant (where.schoolId berbeda)", async () => {
    const db = scopedDb(SCHOOL_A);
    await expect(
      db.student.findMany({ where: { schoolId: SCHOOL_B } }),
    ).rejects.toThrow(/lintas-tenant/i);
    // Tidak ada query yang benar-benar dijalankan.
    expect(captured).toHaveLength(0);
  });

  it("menyuntikkan schoolId ke create", async () => {
    const db = scopedDb(SCHOOL_A);
    await db.student.create({ data: { nis: "001", fullName: "Ani" } });
    expect(captured[0].args).toMatchObject({
      data: { nis: "001", fullName: "Ani", schoolId: SCHOOL_A },
    });
  });

  it("menyuntikkan schoolId ke setiap baris createMany", async () => {
    const db = scopedDb(SCHOOL_A);
    await db.student.createMany({
      data: [{ nis: "001" }, { nis: "002" }],
    });
    const args = captured[0].args as { data: Array<{ schoolId: string }> };
    expect(args.data).toHaveLength(2);
    expect(args.data.every((r) => r.schoolId === SCHOOL_A)).toBe(true);
  });

  it("MENOLAK create dengan schoolId sekolah lain", async () => {
    const db = scopedDb(SCHOOL_A);
    await expect(
      db.student.create({ data: { nis: "001", schoolId: SCHOOL_B } }),
    ).rejects.toThrow(/lintas-tenant/i);
  });

  it("menyuntikkan schoolId ke update/delete", async () => {
    const db = scopedDb(SCHOOL_A);
    await db.student.update({ where: { id: "s1" }, data: { fullName: "X" } });
    await db.student.delete({ where: { id: "s1" } });
    expect(captured[0].args).toMatchObject({
      where: { id: "s1", schoolId: SCHOOL_A },
    });
    expect(captured[1].args).toMatchObject({
      where: { id: "s1", schoolId: SCHOOL_A },
    });
  });

  it("schoolId sekolah A != sekolah B (bukti isolasi)", async () => {
    const dbA = scopedDb(SCHOOL_A);
    await dbA.invoice.findMany();
    captured = [];
    const dbB = scopedDb(SCHOOL_B);
    await dbB.invoice.findMany();
    expect(captured[0].args).toMatchObject({ where: { schoolId: SCHOOL_B } });
  });
});

describe("scopedDb — penolakan konfigurasi salah", () => {
  it("menolak schoolId kosong", () => {
    expect(() => scopedDb("")).toThrow(/schoolId kosong/i);
    expect(() => scopedDb(null)).toThrow(/schoolId kosong/i);
    expect(() => scopedDb(undefined)).toThrow(/schoolId kosong/i);
  });

  it("menolak akses model global lewat scopedDb", () => {
    const db = scopedDb(SCHOOL_A) as unknown as Record<string, unknown>;
    expect(() => db.school).toThrow(/bukan model tenant/i);
    expect(() => db.plan).toThrow(/bukan model tenant/i);
  });
});

describe("unscoped — jalur super-admin", () => {
  it("mengembalikan prisma mentah", () => {
    const raw = unscoped("test: kelola sekolah");
    expect(raw).toBeTruthy();
  });
});

describe("TENANT_MODELS — kelengkapan", () => {
  it("mencakup tabel-tabel inti", () => {
    for (const m of ["student", "invoice", "attendance", "grade"]) {
      expect(TENANT_MODELS).toContain(m);
    }
  });
});
