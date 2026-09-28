"use server";

import { auth, signIn, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { requestMeta } from "@/lib/action-guard";
import { createImpersonateToken, createRestoreToken } from "@/lib/impersonate";
import type { ActionResult } from "@/lib/action-result";

/**
 * ============================================================
 * IMPERSONATE — Server Actions
 * ============================================================
 *
 * Alur "Masuk sebagai":
 *   1. Super Admin menekan tombol pada halaman pengguna sekolah.
 *   2. `startImpersonation` memverifikasi pemanggil adalah SUPER_ADMIN,
 *      mencatat audit, lalu membuat TIKET bertanda tangan berumur 60 detik.
 *   3. `signIn("impersonate", { token })` menukar tiket itu menjadi sesi milik
 *      pengguna target (lihat provider di `lib/auth.ts`).
 *
 * Verifikasi hak dilakukan di LANGKAH 2, bukan di provider — di sanalah
 * konteks pemanggil benar-benar diketahui.
 */

/** Pastikan pemanggil adalah super-admin yang aktif. */
async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user) return null;
  if (session.user.role !== "SUPER_ADMIN") return null;
  // Sesi hasil impersonasi tidak boleh memulai impersonasi lagi (mencegah
  // rantai: admin A → sekolah X → admin B, yang menyamarkan siapa sebenarnya
  // bertindak).
  if (session.user.impersonatedBy) return null;
  return session.user;
}

/**
 * Mulai impersonasi. Dipanggil dari tombol di halaman detail pengguna.
 * `callbackUrl` selalu diawali "/dashboard" supaya tidak bisa dipakai untuk
 * mengalihkan ke situs lain.
 */
export async function startImpersonation(
  targetUserId: string,
  callbackUrl = "/dashboard",
): Promise<ActionResult> {
  const actor = await requireSuperAdmin();
  if (!actor) {
    return { ok: false, error: "Hanya super-admin yang boleh memakai fitur ini." };
  }

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      schoolId: true,
      isActive: true,
      deletedAt: true,
    },
  });
  if (!target) return { ok: false, error: "Pengguna tidak ditemukan." };
  if (target.role === "SUPER_ADMIN") {
    return {
      ok: false,
      error: "Tidak bisa masuk sebagai super-admin lain.",
    };
  }
  if (!target.isActive || target.deletedAt) {
    return { ok: false, error: "Akun tujuan sedang tidak aktif." };
  }

  // Audit ditulis SEBELUM sesi berpindah: setelah signIn, pemanggil sudah
  // menjadi target dan tidak lagi punya hak mencatat atas nama super-admin.
  const meta = await requestMeta();
  await recordAudit({
    schoolId: target.schoolId,
    userId: actor.id,
    action: "LOGIN",
    entity: "Impersonation",
    entityId: target.id,
    after: {
      actor: actor.name,
      target: target.name,
      targetRole: target.role,
      targetEmail: target.email,
    },
    ...meta,
  });

  const token = createImpersonateToken({
    actorId: actor.id,
    actorName: actor.name ?? "Super Admin",
    targetUserId: target.id,
  });

  const safeCallback = callbackUrl.startsWith("/dashboard")
    ? callbackUrl
    : "/dashboard";

  // `signIn` melempar redirect; jangan ditangkap, biarkan NextAuth yang
  // mengarahkan. Error lain (mis. token ditolak) diteruskan sebagai pesan.
  try {
    await signIn("impersonate", { token, redirectTo: safeCallback });
  } catch (e) {
    // NextAuth memakai throw khusus untuk redirect — itu bukan kegagalan.
    if (isRedirectError(e)) throw e;
    return {
      ok: false,
      error: "Gagal memulai sesi impersonasi. Coba lagi.",
    };
  }
  return { ok: true, message: "Beralih ke akun pengguna." };
}

/**
 * Kembali ke akun Super Admin.
 *
 * Sesi hasil impersonasi menyimpan `impersonatedBy` (identitas aktor). Kita
 * memakainya membuat tiket bertanda tangan yang menukar sesi kembali ke aktor
 * — mekanisme yang sama dengan "Masuk sebagai", hanya arahnya berlawanan.
 *
 * Ini AMAN karena: (1) tiket ditandatangani HMAC (tak bisa dipalsukan),
 * (2) hanya dibuat bila sesi saat ini benar-benar sesi impersonasi,
 * (3) provider "impersonate-return" memverifikasi ulang bahwa aktor memang
 * super-admin yang masih aktif. Tidak ada kredensial yang disimpan di mana pun.
 */
export async function stopImpersonation(): Promise<void> {
  const session = await auth();
  const actor = session?.user?.impersonatedBy;
  if (!session?.user?.id || !actor) {
    // Bukan sesi impersonasi — tidak ada yang perlu dipulihkan.
    return;
  }

  const meta = await requestMeta();
  await recordAudit({
    schoolId: session.user.schoolId,
    userId: actor.id,
    action: "LOGOUT",
    entity: "Impersonation",
    entityId: session.user.id,
    after: {
      actor: actor.name,
      target: session.user.name,
      reason: "selesai_impersonasi",
    },
    ...meta,
  });

  const token = createRestoreToken({
    actorId: actor.id,
    actorName: actor.name,
    targetUserId: session.user.id,
  });

  try {
    await signIn("impersonate-return", { token, redirectTo: "/dashboard/schools" });
  } catch (e) {
    if (isRedirectError(e)) throw e;
    // Bila pemulihan gagal (mis. akun aktor dinonaktifkan), jangan biarkan
    // pengguna terjebak sebagai target — keluarkan saja ke halaman masuk.
    await signOut({ redirectTo: "/login" });
  }
}

/** Deteksi error redirect NextAuth (ditandai digest khusus). */
function isRedirectError(e: unknown): boolean {
  const digest = (e as { digest?: unknown })?.digest;
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT");
}

/** Dipakai halaman untuk memutuskan tombol tampil atau tidak. */
export async function canImpersonate(): Promise<boolean> {
  return (await requireSuperAdmin()) !== null;
}
