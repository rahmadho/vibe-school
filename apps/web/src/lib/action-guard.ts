import "server-only";
import { headers } from "next/headers";
import type { UserRole } from "@prisma/client";
import { auth } from "@/lib/auth";
import { can, type Module, type Action } from "@/lib/rbac";
import type { ActionResult } from "@/lib/action-result";

/**
 * Helper sesi & guard untuk Server Actions.
 * Dikumpulkan agar setiap action tidak mengulang logika yang sama.
 */

export type SessionContext = {
  userId: string;
  role: UserRole;
  schoolId: string;
};

/** Ambil konteks sesi + pastikan punya izin pada modul & aksi tertentu. */
export async function requirePermission(
  module: Module,
  action: Action,
): Promise<SessionContext> {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHENTICATED");
  if (!session.user.schoolId) throw new Error("NO_SCHOOL_SCOPE");
  if (!can(session.user.role, module, action)) throw new Error("FORBIDDEN");
  return {
    userId: session.user.id,
    role: session.user.role,
    schoolId: session.user.schoolId,
  };
}

/** Metadata request untuk audit log. */
export async function requestMeta() {
  const h = await headers();
  return {
    ipAddress: h.get("x-forwarded-for") ?? null,
    userAgent: h.get("user-agent") ?? null,
  };
}

/** Terjemahkan error guard menjadi hasil aksi yang ramah pengguna. */
export function mapAuthError(e: unknown): string {
  const msg = e instanceof Error ? e.message : "";
  if (msg === "UNAUTHENTICATED") return "Sesi berakhir. Silakan masuk lagi.";
  if (msg === "NO_SCHOOL_SCOPE") return "Akun ini tidak terhubung ke sekolah.";
  if (msg === "FORBIDDEN") return "Anda tidak punya izin untuk tindakan ini.";
  return "Terjadi kesalahan.";
}

/** Rangkum hasil guard menjadi ActionResult siap-pakai. */
export async function guard(
  module: Module,
  action: Action,
): Promise<{ ctx: SessionContext } | { fail: ActionResult }> {
  try {
    const ctx = await requirePermission(module, action);
    return { ctx };
  } catch (e) {
    return { fail: { ok: false, error: mapAuthError(e) } };
  }
}

/** Ratakan error Zod menjadi map field → pesan. */
export function flattenZodErrors(err: {
  issues: Array<{ path: (string | number)[]; message: string }>;
}): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const i of err.issues) {
    const key = String(i.path[0] ?? "_");
    (out[key] ??= []).push(i.message);
  }
  return out;
}

/** Ambil nilai berulang dari FormData (mis. subjectIds). */
export function formDataArray(fd: FormData, key: string): string[] {
  return fd.getAll(key).map((v) => String(v)).filter(Boolean);
}
