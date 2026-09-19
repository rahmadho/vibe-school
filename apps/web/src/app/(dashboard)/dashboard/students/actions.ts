"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { scopedDb } from "@/lib/scoped-db";
import { recordAudit } from "@/lib/audit";
import { can } from "@/lib/rbac";
import {
  studentCreateSchema,
  studentUpdateSchema,
} from "@/lib/validations/student";

/**
 * Server Actions untuk Siswa.
 *
 * Pola keamanan SETIAP action:
 *  1. Ambil sesi → pastikan login & punya schoolId.
 *  2. Cek RBAC (can(role, "students", action)).
 *  3. Validasi input di SERVER dengan Zod (jangan percaya client).
 *  4. Mutasi lewat scopedDb (schoolId otomatis).
 *  5. Catat audit log.
 */

export type ActionResult =
  | { ok: true; id?: string; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

async function requestMeta() {
  const h = await headers();
  return {
    ipAddress: h.get("x-forwarded-for") ?? null,
    userAgent: h.get("user-agent") ?? null,
  };
}

/** Ambil sesi + pastikan boleh kelola siswa. Melempar bila tidak. */
async function requireStudentManager() {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHENTICATED");
  if (!session.user.schoolId) throw new Error("NO_SCHOOL_SCOPE");
  if (!can(session.user.role, "students", "manage") &&
      !can(session.user.role, "students", "create")) {
    throw new Error("FORBIDDEN");
  }
  return {
    userId: session.user.id,
    role: session.user.role,
    schoolId: session.user.schoolId,
  };
}

function flattenErrors(err: {
  issues: Array<{ path: (string | number)[]; message: string }>;
}): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const i of err.issues) {
    const key = String(i.path[0] ?? "_");
    (out[key] ??= []).push(i.message);
  }
  return out;
}

/* ============================================================
 * CREATE
 * ============================================================ */
export async function createStudent(
  formData: FormData,
): Promise<ActionResult> {
  let ctx;
  try {
    ctx = await requireStudentManager();
  } catch (e) {
    return { ok: false, error: mapAuthError(e) };
  }

  const raw = Object.fromEntries(formData.entries());
  const parsed = studentCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Periksa kembali isian yang ditandai.",
      fieldErrors: flattenErrors(parsed.error),
    };
  }
  const data = parsed.data;

  // Cek duplikat NIS dalam sekolah ini.
  const db = scopedDb(ctx.schoolId);
  const dup = (await db.student.findFirst({
    where: { nis: data.nis },
    select: { id: true },
  })) as { id: string } | null;
  if (dup) {
    return {
      ok: false,
      error: "NIS sudah dipakai siswa lain di sekolah ini.",
      fieldErrors: { nis: ["NIS sudah dipakai"] },
    };
  }

  const meta = await requestMeta();

  const created = await prisma.student.create({
    data: {
      schoolId: ctx.schoolId, // ← isolasi tenant
      nis: data.nis,
      nisn: data.nisn ?? null,
      fullName: data.fullName,
      gender: data.gender,
      birthPlace: data.birthPlace ?? null,
      birthDate: data.birthDate ?? null,
      religion: data.religion ?? null,
      address: data.address ?? null,
      phone: data.phone ?? null,
      entryYear: data.entryYear,
      classId: data.classId ?? null,
      status: data.status,
      ...(data.parentName
        ? {
            parents: {
              create: {
                fullName: data.parentName,
                relation: data.parentRelation ?? "GUARDIAN",
                phone: data.parentPhone ?? "",
                isPrimary: true,
              },
            },
          }
        : {}),
    },
    select: { id: true },
  });

  await recordAudit({
    schoolId: ctx.schoolId,
    userId: ctx.userId,
    action: "CREATE",
    entity: "Student",
    entityId: created.id,
    after: { nis: data.nis, fullName: data.fullName },
    ...meta,
  });

  revalidatePath("/dashboard/students");
  return { ok: true, id: created.id, message: "Siswa ditambahkan." };
}

/* ============================================================
 * UPDATE
 * ============================================================ */
export async function updateStudent(
  formData: FormData,
): Promise<ActionResult> {
  let ctx;
  try {
    ctx = await requireStudentManager();
  } catch (e) {
    return { ok: false, error: mapAuthError(e) };
  }

  const raw = Object.fromEntries(formData.entries());
  const parsed = studentUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Periksa kembali isian yang ditandai.",
      fieldErrors: flattenErrors(parsed.error),
    };
  }
  const { id, ...data } = parsed.data;

  // Pastikan siswa milik sekolah ini (isolasi tenant).
  const existing = await prisma.student.findFirst({
    where: { id, schoolId: ctx.schoolId, deletedAt: null },
  });
  if (!existing) return { ok: false, error: "Siswa tidak ditemukan." };

  // Duplikat NIS selain dirinya sendiri.
  const dup = await prisma.student.findFirst({
    where: { schoolId: ctx.schoolId, nis: data.nis, id: { not: id } },
    select: { id: true },
  });
  if (dup) {
    return {
      ok: false,
      error: "NIS sudah dipakai siswa lain.",
      fieldErrors: { nis: ["NIS sudah dipakai"] },
    };
  }

  const meta = await requestMeta();

  await prisma.student.update({
    where: { id },
    data: {
      nis: data.nis,
      nisn: data.nisn ?? null,
      fullName: data.fullName,
      gender: data.gender,
      birthPlace: data.birthPlace ?? null,
      birthDate: data.birthDate ?? null,
      religion: data.religion ?? null,
      address: data.address ?? null,
      phone: data.phone ?? null,
      entryYear: data.entryYear,
      classId: data.classId ?? null,
      status: data.status,
    },
  });

  await recordAudit({
    schoolId: ctx.schoolId,
    userId: ctx.userId,
    action: "UPDATE",
    entity: "Student",
    entityId: id,
    before: { nis: existing.nis, fullName: existing.fullName },
    after: { nis: data.nis, fullName: data.fullName },
    ...meta,
  });

  revalidatePath("/dashboard/students");
  revalidatePath(`/dashboard/students/${id}`);
  return { ok: true, id, message: "Perubahan disimpan." };
}

/* ============================================================
 * SOFT DELETE
 * ============================================================ */
export async function softDeleteStudent(id: string): Promise<ActionResult> {
  let ctx;
  try {
    ctx = await requireStudentManager();
  } catch (e) {
    return { ok: false, error: mapAuthError(e) };
  }

  // Hanya boleh hapus siswa milik sekolah ini.
  const existing = await prisma.student.findFirst({
    where: { id, schoolId: ctx.schoolId, deletedAt: null },
  });
  if (!existing) return { ok: false, error: "Siswa tidak ditemukan." };

  const meta = await requestMeta();

  // Soft delete — jangan hard delete (AGENTS.md #4).
  await prisma.student.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  await recordAudit({
    schoolId: ctx.schoolId,
    userId: ctx.userId,
    action: "DELETE",
    entity: "Student",
    entityId: id,
    before: { nis: existing.nis, fullName: existing.fullName },
    ...meta,
  });

  revalidatePath("/dashboard/students");
  return { ok: true, message: "Siswa dinonaktifkan." };
}

function mapAuthError(e: unknown): string {
  const msg = e instanceof Error ? e.message : "";
  if (msg === "UNAUTHENTICATED") return "Sesi berakhir. Silakan masuk lagi.";
  if (msg === "NO_SCHOOL_SCOPE") return "Akun ini tidak terhubung ke sekolah.";
  if (msg === "FORBIDDEN") return "Anda tidak punya izin mengelola data siswa.";
  return "Terjadi kesalahan.";
}
