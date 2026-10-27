import { AsyncLocalStorage } from "node:async_hooks";
import { prisma } from "./prisma";

/**
 * ============================================================
 * KONTEKS TENANT — penyambung RLS
 * ============================================================
 *
 * RLS PostgreSQL di repo ini menyaring berdasarkan variabel sesi
 * `app.current_school_id`. Tanpa variabel itu, SETIAP query ke tabel tenant
 * mengembalikan nol baris — aplikasi tampak berjalan normal tapi seluruh
 * halaman kosong. Itu persis yang terjadi saat RLS pertama kali diaktifkan.
 *
 * Ada dua cara menyetelnya, dan hanya satu yang aman:
 *
 *   SALAH — set sekali di koneksi pool
 *     Prisma memakai connection pool. `set_config(..., false)` menempel pada
 *     koneksi fisik, bukan pada request. Dua permintaan bersamaan dari sekolah
 *     berbeda akan saling menimpa → sekolah A melihat data sekolah B. Itu
 *     kebocoran antar-tenant, jauh lebih buruk daripada halaman kosong.
 *
 *   BENAR — set di dalam transaksi yang sama dengan query-nya
 *     `set_config(..., true)` = LOCAL, hilang saat transaksi selesai. Karena
 *     setiap operasi berjalan dalam transaksi sendiri, tidak ada nilai yang
 *     bisa terbawa ke permintaan lain walau koneksi dipakai ulang.
 *
 * `runAsTenant()` membungkus SATU operasi (bukan satu request). Ini disengaja:
 * umur transaksi = umur operasi, jadi batas keamanannya tepat di tempat yang
 * sulit salah.
 *
 * BIAYA: satu transaksi tambahan per operasi. Dapat diterima — query yang sama
 * sudah melakukan round-trip ke DB.
 */

const storage = new AsyncLocalStorage<string>();

/** schoolId aktif, atau undefined bila di luar konteks tenant. */
export function currentTenant(): string | undefined {
  return storage.getStore();
}

/**
 * Jalankan `fn` dengan `app.current_school_id` diset pada transaksi.
 *
 * @example
 *   const rows = await asTenant(schoolId, (tx) => tx.siteBlock.findMany());
 */
export async function asTenant<T>(
  schoolId: string,
  fn: (tx: TenantTx) => Promise<T>,
): Promise<T> {
  if (!schoolId) throw new Error("[asTenant] schoolId wajib diisi.");

  return prisma.$transaction(async (tx) => {
    // Parameter dibinding, bukan diinterpolasi → aman dari SQL injection.
    // `true` = LOCAL, hanya berlaku sampai transaksi berakhir.
    await tx.$executeRaw`SELECT set_config('app.current_school_id', ${schoolId}, true)`;
    return storage.run(schoolId, () => fn(tx));
  });
}

/**
 * Versi ringkas untuk query yang tidak butuh `tx` — dipakai `scopedDb`, yang
 * delegate Prisma-nya sudah membawa `where` sendiri.
 *
 * Mengapa tidak memakai `asTenant`: delegate membutuhkan koneksi yang SAMA
 * dengan yang dipakai `SET LOCAL`. `asTenant` memberi `tx` sebagai parameter,
 * sedangkan delegate memanggil Prisma lewat field-nya sendiri, sehingga
 * konteks bisa jatuh ke koneksi lain di pool.
 */
export async function inTenant<T>(
  schoolId: string,
  fn: () => Promise<T>,
): Promise<T> {
  if (!schoolId) throw new Error("[inTenant] schoolId wajib diisi.");

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_school_id', ${schoolId}, true)`;
    return storage.run(schoolId, fn);
  });
}

/** Tipe transaksi Prisma — longgar agar mudah dipakai. */
export type TenantTx = Omit<
  typeof prisma,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;
