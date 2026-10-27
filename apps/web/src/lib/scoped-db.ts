import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "./prisma";

/**
 * ============================================================
 * scopedDb(schoolId) — INTI ISOLASI TENANT
 * ============================================================
 *
 * Setiap operasi pada tabel milik sekolah WAJIB lewat helper ini.
 * Helper menambahkan filter `schoolId` secara otomatis sehingga tidak
 * mungkin "lupa" memfilter — penyebab utama kebocoran data antar-sekolah.
 *
 * Aturan:
 *  - Model yang punya kolom `schoolId` → difilter otomatis.
 *  - Model global (School, Plan) → TIDAK boleh disini; pakai `prisma` mentah
 *    dan selalu di balik cek role SUPER_ADMIN.
 *  - `create`/`createMany` → menyuntikkan schoolId otomatis.
 *  - `findMany`/`findFirst`/`count`/`update`/`delete` → menggabungkan schoolId.
 *
 * Contoh:
 *   const db = scopedDb(session.schoolId)
 *   const students = await db.student.findMany()          // hanya sekolah ini
 *   await db.student.create({ data: { nis: "001", ... } }) // schoolId otomatis
 */

/** Model yang punya kolom schoolId (data milik satu sekolah). */
export const TENANT_MODELS = [
  "user",
  "student",
  "parent",
  "teacher",
  "staff",
  "class",
  "subject",
  "schedule",
  "academicYear",
  "semester",
  "timeSlot",
  "admissionBatch",
  "registration",
  "attendance",
  "gradeItem",
  "grade",
  "reportCard",
  "feeType",
  "invoice",
  "paymentMethod",
  "payment",
  "receipt",
  "paymentGatewayTransaction",
  "post",
  // Fase 8: web sekolah publik + SPMB multi-jalur.
  "siteTheme",
  "siteConfig",
  "siteBlock",
  "page",
  "pageBlock",
  "navigationItem",
  "admissionPath",
  "announcement",
  "notificationTemplate",
  "notificationQueue",
  "auditLog",
  "studentClassHistory",
  "subscription",
  // Fase 7 yang terlewat (ditemukan test tenant-isolation).
  "messageTemplate",
  "announcementCampaign",
  // `waSession` menyimpan kredensial sesi WhatsApp; `schoolPaymentGateway`
  // menyimpan kunci API gateway terenkripsi. Keduanya WAJIB ter-scope.
  "waSession",
  "schoolPaymentGateway",
  // Pesanan paket langganan. Membocorkan baris ini antar-sekolah berarti
  // sekolah lain bisa melihat tautan pembayaran & nominal tagihan paketnya.
  "planOrder",
  // Fase SMK/SMA: jurusan/peminatan, PKL, dan UKK.
  "major",
  "internship",
  "competencyTest",
  // Pustaka media web sekolah.
  "media",
  // Pengaturan AI menyimpan kunci API terenkripsi per sekolah.
  "aiSetting",
  // Penimpaan izin per sekolah.
  "rolePermission",
  // Domain tambahan + token verifikasi DNS milik sekolah.
  "schoolHostAlias",
] as const;

export type TenantModel = (typeof TENANT_MODELS)[number];

/** Model global — tidak punya schoolId; akses harus dibatasi role. */
export const GLOBAL_MODELS = ["school", "plan"] as const;

type ArgsWithWhere = {
  where?: Record<string, unknown>;
  data?: Record<string, unknown> | Record<string, unknown>[];
  [key: string]: unknown;
};

/**
 * Menggabungkan schoolId ke dalam `where` tanpa menimpa kondisi lain.
 * Menolak jika `where` sudah berisi schoolId yang BERBEDA (mencegah bypass).
 */
function mergeWhere(schoolId: string, where?: Record<string, unknown>) {
  if (where && "schoolId" in where && where.schoolId !== schoolId) {
    throw new Error(
      `[scopedDb] Upaya query lintas-tenant terdeteksi: ` +
        `scope=${schoolId}, where.schoolId=${String(where.schoolId)}`,
    );
  }
  return { ...(where ?? {}), schoolId };
}

/** Menyuntikkan schoolId ke payload create. */
function injectSchoolId<T extends Record<string, unknown>>(
  schoolId: string,
  data: T | T[],
): T | T[] {
  const addTo = (row: T): T => {
    if ("schoolId" in row && row.schoolId !== schoolId) {
      throw new Error(
        `[scopedDb] Upaya menulis lintas-tenant terdeteksi: ` +
          `scope=${schoolId}, data.schoolId=${String(row.schoolId)}`,
      );
    }
    return { ...row, schoolId } as T;
  };
  return Array.isArray(data) ? data.map(addTo) : addTo(data);
}

/**
 * Membungkus satu delegate Prisma dengan filter schoolId otomatis.
 * Semua operasi baca/tulis yang menerima `where` atau `data` diproses.
 */
function scopedDelegate(
  delegate: Record<string, (...args: unknown[]) => unknown>,
  schoolId: string,
) {
  const READ_OPS = new Set([
    "findFirst",
    "findFirstOrThrow",
    "findMany",
    "findUnique",
    "findUniqueOrThrow",
    "count",
    "aggregate",
    "groupBy",
  ]);
  const WHERE_WRITE_OPS = new Set([
    "update",
    "updateMany",
    "delete",
    "deleteMany",
    "upsert",
  ]);
  const CREATE_OPS = new Set(["create", "createMany"]);

  return new Proxy(delegate, {
    get(target, prop: string) {
      const original = target[prop];
      if (typeof original !== "function") return original;

      return (args: ArgsWithWhere = {}) => {
        if (READ_OPS.has(prop) || WHERE_WRITE_OPS.has(prop)) {
          const next = { ...args };
          try {
            next.where = mergeWhere(schoolId, args.where);
            if (prop === "upsert") {
              if (args.create)
                next.create = injectSchoolId(schoolId, args.create as never);
              if (args.update) next.update = args.update; // update tak perlu schoolId
            }
          } catch (err) {
            // Prisma selalu async → teruskan sebagai rejection agar konsisten.
            return Promise.reject(err);
          }
          return original.call(target, next);
        }
        if (CREATE_OPS.has(prop)) {
          const next = { ...args };
          try {
            if (args.data)
              next.data = injectSchoolId(schoolId, args.data as never);
          } catch (err) {
            return Promise.reject(err);
          }
          return original.call(target, next);
        }
        return original.call(target, args);
      };
    },
  }) as Record<string, (...args: unknown[]) => unknown>;
}

/**
 * Bentuk delegate yang dikembalikan scopedDb. Sengaja dibuat longgar pada
 * argumen (menerima objek apa pun) tetapi presisi pada hasil yang umum dipakai,
 * agar kode pemanggil tidak penuh cast `as`.
 */
export type ScopedDelegate = {
  findMany: (args?: unknown) => Promise<unknown[]>;
  findFirst: (args?: unknown) => Promise<unknown | null>;
  findUnique: (args?: unknown) => Promise<unknown | null>;
  count: (args?: unknown) => Promise<number>;
  create: (args?: unknown) => Promise<unknown>;
  createMany: (args?: unknown) => Promise<{ count: number }>;
  update: (args?: unknown) => Promise<unknown>;
  updateMany: (args?: unknown) => Promise<{ count: number }>;
  delete: (args?: unknown) => Promise<unknown>;
  deleteMany: (args?: unknown) => Promise<{ count: number }>;
  upsert: (args?: unknown) => Promise<unknown>;
  aggregate: (args?: unknown) => Promise<unknown>;
  groupBy: (args?: unknown) => Promise<unknown[]>;
};

export type ScopedDb = {
  [K in TenantModel]: ScopedDelegate;
};

/**
 * Membuat view Prisma yang ter-scope ke satu sekolah.
 *
 * @param schoolId - id sekolah dari SESI user (jangan dari input user!)
 * @throws jika schoolId kosong — mencegah query tanpa scope.
 */
export function scopedDb(schoolId: string | null | undefined): ScopedDb {
  if (!schoolId || typeof schoolId !== "string") {
    throw new Error(
      "[scopedDb] schoolId kosong. Query data sekolah tidak boleh tanpa scope. " +
        "Pastikan user punya sekolah (SUPER_ADMIN harus pakai jalur khusus).",
    );
  }

  const proxy = new Proxy(
    {},
    {
      get(_t, model: string) {
        if (!TENANT_MODELS.includes(model as TenantModel)) {
          throw new Error(
            `[scopedDb] Model "${model}" bukan model tenant. ` +
              `Model global (${GLOBAL_MODELS.join(", ")}) harus diakses via prisma mentah ` +
              `di balik cek SUPER_ADMIN.`,
          );
        }
        const delegate = (prisma as unknown as Record<string, Record<string, unknown>>)[
          model
        ];
        if (!delegate) throw new Error(`[scopedDb] Delegate "${model}" tidak ada.`);
        return scopedDelegate(
          delegate as Record<string, (...args: unknown[]) => unknown>,
          schoolId,
        );
      },
    },
  );

  return proxy as unknown as ScopedDb;
}

/**
 * Jalur khusus SUPER_ADMIN: akses lintas-tenant yang disengaja.
 * Wajib dipanggil dengan alasan eksplisit agar mudah diaudit.
 */
export function unscoped(reason: string): PrismaClient {
  // Sengaja mencatat alasan; bisa diganti logger/audit di produksi.
  if (process.env.NODE_ENV !== "test") {
    // eslint-disable-next-line no-console
    console.warn(`[unscoped] Akses lintas-tenant: ${reason}`);
  }
  return prisma;
}
