"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { recordAudit } from "@/lib/audit";
import { guard, requestMeta, flattenZodErrors } from "@/lib/action-guard";
import type { ActionResult } from "@/lib/action-result";
import {
  userCreateSchema,
  userUpdateSchema,
  passwordResetSchema,
  SCHOOL_MANAGEABLE_ROLES,
} from "@/lib/validations/user";
import { emailExists } from "@/lib/data/users";
import { can } from "@/lib/rbac";
import { getOverridesForRole } from "@/lib/data/permissions";

/**
 * Server Actions Pengguna.
 *
 * ATURAN KEAMANAN KHUSUS:
 * Admin sekolah TIDAK BOLEH membuat atau mengubah akun SUPER_ADMIN.
 * Hanya modul "schools" (super-admin) yang boleh. Ini mencegah eskalasi
 * hak akses lintas-tenant.
 */

function roleAllowedForSchoolAdmin(role: string): boolean {
  return (SCHOOL_MANAGEABLE_ROLES as readonly string[]).includes(role);
}

export async function createUser(formData: FormData): Promise<ActionResult> {
  const g = await guard("users", "manage");
  if ("fail" in g) return g.fail;
  const { schoolId, userId, role: actorRole } = g.ctx;

  const parsed = userCreateSchema.safeParse(
    Object.fromEntries(formData.entries()),
  );
  if (!parsed.success) {
    return {
      ok: false,
      error: "Periksa kembali isian yang ditandai.",
      fieldErrors: flattenZodErrors(parsed.error),
    };
  }
  const d = parsed.data;

  // Cegah eskalasi: admin sekolah tak boleh membuat SUPER_ADMIN.
  if (actorRole !== "SUPER_ADMIN" && !roleAllowedForSchoolAdmin(d.role)) {
    return {
      ok: false,
      error: "Anda tidak boleh membuat akun dengan role tersebut.",
      fieldErrors: { role: ["Role tidak diizinkan"] },
    };
  }

  if (await emailExists(d.email)) {
    return {
      ok: false,
      error: "Email sudah terdaftar.",
      fieldErrors: { email: ["Email sudah dipakai"] },
    };
  }

  const meta = await requestMeta();
  const created = await prisma.user.create({
    data: {
      schoolId, // isolasi tenant
      name: d.name,
      email: d.email,
      passwordHash: await hashPassword(d.password),
      role: d.role,
      phone: d.phone ?? null,
      isActive: d.isActive,
    },
    select: { id: true },
  });

  await recordAudit({
    schoolId,
    userId,
    action: "CREATE",
    entity: "User",
    entityId: created.id,
    // JANGAN catat password ke audit.
    after: { email: d.email, role: d.role },
    ...meta,
  });

  revalidatePath("/dashboard/users");
  return { ok: true, id: created.id, message: "Akun dibuat." };
}

export async function updateUser(formData: FormData): Promise<ActionResult> {
  const g = await guard("users", "manage");
  if ("fail" in g) return g.fail;
  const { schoolId, userId, role: actorRole } = g.ctx;

  const parsed = userUpdateSchema.safeParse(
    Object.fromEntries(formData.entries()),
  );
  if (!parsed.success) {
    return {
      ok: false,
      error: "Periksa kembali isian yang ditandai.",
      fieldErrors: flattenZodErrors(parsed.error),
    };
  }
  const { id, ...d } = parsed.data;

  const existing = await prisma.user.findFirst({
    where: { id, schoolId, deletedAt: null },
  });
  if (!existing) return { ok: false, error: "Pengguna tidak ditemukan." };

  // Tak boleh menyentuh akun SUPER_ADMIN, dan tak boleh mengangkat jadi SUPER_ADMIN.
  if (existing.role === "SUPER_ADMIN" && actorRole !== "SUPER_ADMIN") {
    return { ok: false, error: "Anda tidak boleh mengubah akun super-admin." };
  }
  if (actorRole !== "SUPER_ADMIN" && !roleAllowedForSchoolAdmin(d.role)) {
    return {
      ok: false,
      error: "Anda tidak boleh menetapkan role tersebut.",
      fieldErrors: { role: ["Role tidak diizinkan"] },
    };
  }

  // ---- Pencegahan mengunci diri sendiri ----
  //
  // Dua perubahan di bawah membuat admin kehilangan jalan masuknya sendiri,
  // dan pemulihannya harus lewat Super Admin:
  //   1. menurunkan role sendiri ke role yang tidak boleh mengelola pengguna;
  //   2. menonaktifkan akun sendiri (langsung tidak bisa login).
  // Keduanya ditolak dengan penjelasan, bukan sekadar diperingatkan — setelah
  // terjadi, tidak ada lagi yang bisa memperbaikinya dari dalam sekolah.
  if (id === userId && actorRole !== "SUPER_ADMIN") {
    if (!d.isActive) {
      return {
        ok: false,
        error:
          "Anda tidak dapat menonaktifkan akun Anda sendiri. Minta admin lain melakukannya, atau ubah peran Anda lebih dulu.",
        fieldErrors: { isActive: ["Tidak dapat menonaktifkan akun sendiri"] },
      };
    }
    if (d.role !== actorRole) {
      // Diperiksa dengan penimpaan sekolah, bukan bawaan kode: role itu
      // mungkin sudah dicabut aksesnya lewat halaman Hak Akses.
      const targetOverrides = await getOverridesForRole(schoolId, d.role);
      if (!can(d.role, "users", "manage", targetOverrides)) {
        return {
          ok: false,
          error:
            "Peran itu tidak dapat mengelola pengguna, sehingga Anda akan terkunci dari halaman ini. Sisakan peran Anda saat ini, atau minta admin lain mengubahnya.",
          fieldErrors: { role: ["Akan mengunci akses Anda sendiri"] },
        };
      }
    }
  }

  const meta = await requestMeta();
  await prisma.user.update({
    where: { id },
    data: {
      name: d.name,
      role: d.role,
      phone: d.phone ?? null,
      isActive: d.isActive,
    },
  });

  await recordAudit({
    schoolId,
    userId,
    action: "UPDATE",
    entity: "User",
    entityId: id,
    before: { name: existing.name, role: existing.role, isActive: existing.isActive },
    after: { name: d.name, role: d.role, isActive: d.isActive },
    ...meta,
  });

  revalidatePath("/dashboard/users");
  revalidatePath(`/dashboard/users/${id}`);
  return { ok: true, id, message: "Perubahan disimpan." };
}

/** Setel ulang password pengguna. */
export async function resetUserPassword(
  formData: FormData,
): Promise<ActionResult> {
  const g = await guard("users", "manage");
  if ("fail" in g) return g.fail;
  const { schoolId, userId, role: actorRole } = g.ctx;

  const parsed = passwordResetSchema.safeParse(
    Object.fromEntries(formData.entries()),
  );
  if (!parsed.success) {
    return {
      ok: false,
      error: "Periksa kembali isian yang ditandai.",
      fieldErrors: flattenZodErrors(parsed.error),
    };
  }
  const { id, password } = parsed.data;

  const existing = await prisma.user.findFirst({
    where: { id, schoolId, deletedAt: null },
    select: { id: true, email: true, role: true },
  });
  if (!existing) return { ok: false, error: "Pengguna tidak ditemukan." };
  if (existing.role === "SUPER_ADMIN" && actorRole !== "SUPER_ADMIN") {
    return { ok: false, error: "Anda tidak boleh mengubah akun super-admin." };
  }

  const meta = await requestMeta();
  await prisma.user.update({
    where: { id },
    data: { passwordHash: await hashPassword(password) },
  });

  await recordAudit({
    schoolId,
    userId,
    action: "UPDATE",
    entity: "User",
    entityId: id,
    // Catat AKSI-nya saja, tanpa password.
    after: { action: "reset-password", email: existing.email },
    ...meta,
  });

  revalidatePath(`/dashboard/users/${id}`);
  return { ok: true, message: "Password diperbarui." };
}

export async function softDeleteUser(id: string): Promise<ActionResult> {
  const g = await guard("users", "manage");
  if ("fail" in g) return g.fail;
  const { schoolId, userId, role: actorRole } = g.ctx;

  const existing = await prisma.user.findFirst({
    where: { id, schoolId, deletedAt: null },
  });
  if (!existing) return { ok: false, error: "Pengguna tidak ditemukan." };

  if (existing.id === userId) {
    return { ok: false, error: "Anda tidak bisa menonaktifkan akun sendiri." };
  }
  if (existing.role === "SUPER_ADMIN" && actorRole !== "SUPER_ADMIN") {
    return { ok: false, error: "Anda tidak boleh menonaktifkan super-admin." };
  }

  // ---- Pencegahan kehilangan admin terakhir ----
  //
  // Bila akun ini salah satu dari sedikit yang bisa mengelola pengguna,
  // menonaktifkannya bisa membuat sekolah tidak punya siapa pun yang bisa
  // mengelola akun — termasuk membuat akun baru. Diperiksa terhadap role
  // EFEKTIF (bawaan + penimpaan), bukan role mentah, karena sekolah bisa
  // mencabut akses sebuah role lewat halaman Hak Akses.
  if (existing.isActive) {
    const candidates = await prisma.user.findMany({
      where: { schoolId, deletedAt: null, isActive: true },
      select: { id: true, role: true },
    });

    let activeManagers = 0;
    for (const u of candidates) {
      if (u.id === id) continue; // akun ini sedang dinonaktifkan
      const overrides = await getOverridesForRole(schoolId, u.role);
      if (can(u.role, "users", "manage", overrides)) activeManagers += 1;
    }

    if (activeManagers === 0) {
      return {
        ok: false,
        error:
          "Ini satu-satunya akun aktif yang dapat mengelola pengguna. Menonaktifkannya akan membuat sekolah tidak bisa mengelola akun sama sekali. Angkat atau aktifkan admin lain lebih dulu.",
      };
    }
  }

  const meta = await requestMeta();
  await prisma.user.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  });

  await recordAudit({
    schoolId,
    userId,
    action: "DELETE",
    entity: "User",
    entityId: id,
    before: { email: existing.email, role: existing.role },
    ...meta,
  });

  revalidatePath("/dashboard/users");
  return { ok: true, message: "Akun dinonaktifkan." };
}
