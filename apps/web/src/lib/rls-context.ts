import { prisma } from "./prisma";

/**
 * Menjalankan callback di dalam transaksi yang sudah menyetel
 * `app.current_school_id`, sehingga Row Level Security (RLS) PostgreSQL
 * mengizinkan hanya baris milik sekolah tersebut.
 *
 * Ini adalah LAPIS KEDUA jika helper `scopedDb` terlewat. Gunakan untuk
 * operasi baca/tulis yang sensitif pada data sekolah.
 *
 * Catatan: `SET LOCAL` hanya berlaku di dalam transaksi; karena itu semua
 * dibungkus `prisma.$transaction`.
 *
 * @example
 *   const students = await withRls(schoolId, (tx) =>
 *     tx.student.findMany()
 *   );
 */
export async function withRls<T>(
  schoolId: string,
  fn: (tx: PrismaTransaction) => Promise<T>,
): Promise<T> {
  if (!schoolId) throw new Error("[withRls] schoolId wajib diisi.");

  return prisma.$transaction(async (tx) => {
    // set_config(..., true) = LOCAL (berlaku sampai transaksi selesai)
    // Parameter dibinding, bukan diinterpolasi → aman dari SQL injection.
    await tx.$executeRaw`SELECT set_config('app.current_school_id', ${schoolId}, true)`;
    return fn(tx);
  });
}

/** Tipe transaksi Prisma — longgar agar mudah dipakai. */
export type PrismaTransaction = Omit<
  typeof prisma,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;
