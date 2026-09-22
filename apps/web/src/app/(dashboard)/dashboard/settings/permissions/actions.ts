"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { guard, requestMeta } from "@/lib/action-guard";
import type { ActionResult } from "@/lib/action-result";
import {
  ALL_MODULES,
  ALL_ACTIONS,
  defaultActionsFor,
  anyRoleCanManageUsers,
  type Action,
  type Module,
} from "@/lib/rbac";
import { SCHOOL_MANAGEABLE_ROLES } from "@/lib/validations/user";
import type { UserRole } from "@prisma/client";

/**
 * Server Actions pengaturan izin per sekolah.
 *
 * ============================================================
 * KENAPA HANYA BARIS YANG BERBEDA YANG DISIMPAN
 * ============================================================
 * Menyimpan seluruh matriks (9 role × 15 modul = 135 baris) akan mengunci
 * sekolah pada matriks hari ini. Ketika versi berikutnya memperbaiki izin
 * bawaan — misalnya menambah modul baru, atau memperbaiki role yang ternyata
 * terlalu sempit — sekolah itu tidak akan pernah ikut memperoleh perbaikannya,
 * karena semua barisnya sudah tersimpan sebagai penimpaan.
 *
 * Karena itu hanya baris yang BERBEDA dari bawaan yang ditulis. Baris yang
 * sama dengan bawaan dihapus, sehingga "kembali ke bawaan" benar-benar berarti
 * mengikuti kode, bukan menyimpan salinannya.
 */

const MANAGEABLE_ROLES = SCHOOL_MANAGEABLE_ROLES;

/** Susun daftar aksi yang sah dari input form. */
function parseActions(raw: unknown): Action[] {
  const list = Array.isArray(raw) ? raw.map(String) : raw ? [String(raw)] : [];
  const seen = new Set<Action>();
  for (const a of list) {
    if ((ALL_ACTIONS as string[]).includes(a)) seen.add(a as Action);
  }
  // `manage` mencakup semua aksi lain, jadi aksi lain dibuang agar data
  // konsisten — menyimpan ["manage","read"] membuat pembacaan berikutnya
  // membingungkan tanpa menambah arti.
  if (seen.has("manage")) return ["manage"];
  return ALL_ACTIONS.filter((a) => seen.has(a));
}

/** Bandingkan dua daftar aksi tanpa memedulikan urutan. */
function sameActions(a: Action[], b: Action[]): boolean {
  if (a.length !== b.length) return false;
  const sb = new Set(b);
  return a.every((x) => sb.has(x));
}

/**
 * Simpan izin satu role.
 *
 * Menerima `entries` berupa daftar `{ module, actions[] }`. Modul yang aksinya
 * sama dengan bawaan akan DIHAPUS dari tabel penimpaan.
 */
export async function saveRolePermissions(
  role: string,
  entries: { module: string; actions: string[] }[],
): Promise<ActionResult> {
  const g = await guard("users", "manage");
  if ("fail" in g) return g.fail;
  const { schoolId, userId } = g.ctx;

  // SUPER_ADMIN sengaja tidak bisa diatur: ia pengelola lintas sekolah, dan
  // sekolah tidak boleh mengunci dirinya sendiri dari jalur pemulihan.
  if (role === "SUPER_ADMIN") {
    return {
      ok: false,
      error: "Izin Super Admin tidak dapat diubah dari dasbor sekolah.",
    };
  }
  if (!(MANAGEABLE_ROLES as readonly string[]).includes(role)) {
    return { ok: false, error: "Role tidak dikenal." };
  }

  if (!Array.isArray(entries)) {
    return { ok: false, error: "Data izin tidak dikenali." };
  }

  // Validasi modul sebelum menyentuh database.
  const clean: { module: Module; actions: Action[] }[] = [];
  for (const e of entries) {
    if (!(ALL_MODULES as string[]).includes(String(e.module))) {
      return { ok: false, error: `Modul "${e.module}" tidak dikenal.` };
    }
    clean.push({ module: e.module as Module, actions: parseActions(e.actions) });
  }

  // ---- Pencegahan penguncian diri ----
  //
  // Halaman ini sendiri dibuka dengan izin `users: manage`. Bila perubahan ini
  // membuat TIDAK ADA satu pun role sekolah yang boleh mengelolanya, sekolah
  // terkunci dari halamannya sendiri — dan pemulihannya harus lewat Super
  // Admin. Karena itu keadaan itu ditolak, bukan sekadar diperingatkan.
  {
    const stored = await prisma.rolePermission.findMany({
      where: { schoolId },
      select: { role: true, module: true, actions: true },
    });

    // Susun gambaran izin SETELAH perubahan: penimpaan tersimpan, lalu
    // ditimpa oleh perubahan yang sedang disimpan.
    const next: Record<string, Record<string, Action[]>> = {};
    for (const r of stored) {
      (next[r.role] ??= {})[r.module] = r.actions as Action[];
    }
    const pendingRole = (next[role] ??= {});
    for (const { module, actions } of clean) {
      pendingRole[module] = actions;
    }

    if (!anyRoleCanManageUsers(MANAGEABLE_ROLES as readonly UserRole[], next)) {
      return {
        ok: false,
        error:
          "Perubahan ini akan mencabut akses \"Kelola Pengguna\" dari semua peran, termasuk peran Anda sendiri — dan halaman ini tidak akan bisa dibuka lagi oleh siapa pun di sekolah. Sisakan minimal satu peran yang boleh mengelola pengguna.",
      };
    }
  }

  const meta = await requestMeta();

  try {
    await prisma.$transaction(async (tx) => {
      const before = await tx.rolePermission.findMany({
        where: { schoolId, role: role as UserRole },
        select: { module: true, actions: true },
      });

      for (const { module, actions } of clean) {
        // `undefined` = tidak ada penimpaan → pakai bawaan kode.
        const isDefault = isDefaultActions(role as UserRole, module, actions);

        if (isDefault) {
          // Kembali ke bawaan: hapus baris, jangan simpan salinannya.
          await tx.rolePermission.deleteMany({ where: { schoolId, role: role as UserRole, module } });
          continue;
        }

        await tx.rolePermission.upsert({
          where: { schoolId_role_module: { schoolId, role: role as UserRole, module } },
          update: { actions, updatedById: userId },
          create: { schoolId, role: role as UserRole, module, actions, updatedById: userId },
        });
      }

      await recordAudit({
        schoolId,
        userId,
        action: "UPDATE",
        entity: "RolePermission",
        entityId: role,
        before: { role, overrides: before },
        after: { role, overrides: clean.filter((c) => !isDefaultActions(role as UserRole, c.module, c.actions)) },
        ...meta,
      });
    });
  } catch (error) {
    return {
      ok: false,
      error: `Gagal menyimpan izin: ${
        error instanceof Error ? error.message : "tidak diketahui"
      }`,
    };
  }

  revalidatePath("/dashboard/settings/permissions");
  revalidatePath("/dashboard", "layout");
  return { ok: true, message: "Izin disimpan." };
}

/**
 * Hapus SEMUA penimpaan satu role — kembalikan sepenuhnya ke bawaan.
 *
 * Dipakai tombol "Kembalikan ke bawaan". Lebih aman daripada meminta operator
 * mencentang ulang satu per satu, dan mustahil lupa satu modul.
 */
export async function resetRolePermissions(role: string): Promise<ActionResult> {
  const g = await guard("users", "manage");
  if ("fail" in g) return g.fail;
  const { schoolId, userId } = g.ctx;

  if (role === "SUPER_ADMIN") {
    return { ok: false, error: "Izin Super Admin tidak dapat diubah." };
  }
  if (!(MANAGEABLE_ROLES as readonly string[]).includes(role)) {
    return { ok: false, error: "Role tidak dikenal." };
  }

  const meta = await requestMeta();
  const before = await prisma.rolePermission.findMany({
    where: { schoolId, role: role as UserRole },
    select: { module: true, actions: true },
  });

  await prisma.rolePermission.deleteMany({
    where: { schoolId, role: role as UserRole },
  });

  await recordAudit({
    schoolId,
    userId,
    action: "DELETE",
    entity: "RolePermission",
    entityId: role,
    before: { role, overrides: before },
    after: { role, overrides: [] },
    ...meta,
  });

  revalidatePath("/dashboard/settings/permissions");
  revalidatePath("/dashboard", "layout");
  return { ok: true, message: "Izin dikembalikan ke bawaan." };
}

/** Apakah daftar aksi ini sama dengan bawaan kode? */
function isDefaultActions(role: UserRole, module: Module, actions: Action[]): boolean {
  return sameActions(actions, defaultActionsFor(role, module));
}
