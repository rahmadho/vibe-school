import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import type { Action, Module, PermissionOverride } from "@/lib/rbac";
import { ALL_MODULES } from "@/lib/rbac";
import type { UserRole } from "@prisma/client";

/**
 * Query layer penimpaan izin.
 * Isolasi tenant: selalu menerima schoolId dari sesi.
 */

/**
 * Ambil seluruh penimpaan izin satu sekolah, dibentuk sebagai map siap pakai
 * untuk `can()`.
 *
 * Dibungkus `cache()` milik React supaya satu permintaan halaman hanya
 * menanyakan database SEKALI, walaupun `can()` dipanggil puluhan kali di
 * halaman yang sama (sidebar, header, dan beberapa komponen sekaligus).
 */
export const getPermissionOverrides = cache(
  async (schoolId: string): Promise<Record<UserRole, PermissionOverride>> => {
    const rows = await prisma.rolePermission.findMany({
      where: { schoolId }, // isolasi tenant
      select: { role: true, module: true, actions: true },
    });

    const out = {} as Record<UserRole, PermissionOverride>;
    for (const row of rows) {
      // Modul yang tidak dikenal diabaikan: modul bisa dihapus dari kode pada
      // versi berikutnya, dan baris lama tidak boleh membuat halaman gagal.
      if (!(ALL_MODULES as string[]).includes(row.module)) continue;

      const perRole = (out[row.role] ??= {});
      perRole[row.module as Module] = row.actions as Action[];
    }
    return out;
  },
);

/**
 * Penimpaan untuk SATU role.
 *
 * Dipakai saat menyusun sesi: pengguna hanya perlu izin role-nya sendiri,
 * bukan seluruh matriks sekolah. Mengirim semuanya berarti membawa data peran
 * lain ke dalam sesi setiap pengguna — tidak ada gunanya, dan memperbesar
 * permukaan kebocoran.
 */
export const getOverridesForRole = cache(
  async (schoolId: string, role: UserRole): Promise<PermissionOverride> => {
    const rows = await prisma.rolePermission.findMany({
      where: { schoolId, role },
      select: { module: true, actions: true },
    });

    const out: PermissionOverride = {};
    for (const row of rows) {
      if (!(ALL_MODULES as string[]).includes(row.module)) continue;
      out[row.module as Module] = row.actions as Action[];
    }
    return out;
  },
);

/** Daftar baris mentah — dipakai halaman pengaturan untuk menandai "ditimpa". */
export async function listRolePermissions(schoolId: string) {
  return prisma.rolePermission.findMany({
    where: { schoolId },
    select: { role: true, module: true, actions: true },
    orderBy: [{ role: "asc" }, { module: "asc" }],
  });
}
