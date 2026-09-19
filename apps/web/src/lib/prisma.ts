import { PrismaClient } from "@prisma/client";

/**
 * Prisma client singleton.
 *
 * Di dev, Next.js hot-reload membuat instance baru tiap perubahan → koneksi
 * menumpuk. Simpan di globalThis agar hanya ada satu instance.
 *
 * PENTING (multi-tenant): JANGAN pakai `prisma` langsung untuk query data
 * sekolah. Gunakan `scopedDb(schoolId)` dari `@/lib/scoped-db` yang otomatis
 * memfilter schoolId. `prisma` mentah hanya untuk operasi lintas-tenant
 * (mis. School, Plan) dan selalu di balik cek role SUPER_ADMIN.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
