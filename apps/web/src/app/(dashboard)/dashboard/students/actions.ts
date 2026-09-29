"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import type {
  EducationLevel,
  IncomeRange,
  LivingWith,
  ResidenceType,
  Transportation,
} from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { scopedDb } from "@/lib/scoped-db";
import { recordAudit } from "@/lib/audit";
import { can } from "@/lib/rbac";
import {
  studentCreateSchema,
  studentUpdateSchema,
} from "@/lib/validations/student";
import { buatAkunSiswa } from "@/lib/akun-siswa";
import { ambilSlugSekolah } from "@/lib/sekolah-helper";

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
  if (!can(session.user.role, "students", "manage", session.user.permissions) &&
      !can(session.user.role, "students", "create", session.user.permissions)) {
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

  // Pembuatan siswa + akun login-nya dijalankan dalam SATU transaksi.
  // Kalau akun dibuat di luar transaksi lalu pembuatan siswa gagal, akan
  // tertinggal akun yatim yang tidak terhubung ke siswa mana pun.
  const slugSekolah = await ambilSlugSekolah(ctx.schoolId);

  const { created, akun } = await prisma.$transaction(async (tx) => {
    const siswa = await tx.student.create({
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

        // Data administrasi (Dapodik/Disdik). NIK & KK disimpan apa adanya
        // (sudah dibersihkan validasi); `?? null` supaya kolom kosong jadi
        // NULL, bukan string kosong.
        nik: data.nik ?? null,
        kkNumber: data.kkNumber ?? null,
        village: data.village ?? null,
        district: data.district ?? null,
        city: data.city ?? null,
        province: data.province ?? null,
        postalCode: data.postalCode ?? null,
        villageCode: data.villageCode ?? null,
        // Enum di-cast di sini, bukan mengandalkan tipe dari Zod.
        //
        // Zod melebarkan literal enum jadi `string` ketika skema dibungkus
        // `z.object` (nilai `""` yang di-transform tidak dipertahankan
        // tipenya). Nilainya SUDAH divalidasi `z.enum` di skema — string di
        // luar daftar ditolak sebelum sampai sini. Jadi cast ini aman dan
        // tidak menyembunyikan kesalahan.
        residenceType: (data.residenceType ?? null) as ResidenceType | null,
        transportation: (data.transportation ?? null) as Transportation | null,
        livingWith: (data.livingWith ?? null) as LivingWith | null,
        distanceKm: data.distanceKm ?? null,
        bloodType: data.bloodType ?? null,
        heightCm: data.heightCm ?? null,
        weightKg: data.weightKg ?? null,
        isKipRecipient: data.isKipRecipient ?? false,

        entryYear: data.entryYear,
        classId: data.classId ?? null,
        majorId: data.majorId ?? null,
        status: data.status,
        ...(data.parentName
          ? {
              parents: {
                create: {
                  fullName: data.parentName,
                  relation: data.parentRelation ?? "GUARDIAN",
                  phone: data.parentPhone ?? "",
                  isPrimary: true,
                  // Data administrasi orang tua — diminta Dapodik & dipakai
                  // menentukan peringkat kesejahteraan (dasar KIP/PIP).
                  nik: data.parentNik ?? null,
                  kkNumber: data.parentKkNumber ?? null,
                  occupation: data.parentOccupation ?? null,
                  // Cast sama seperti field enum siswa (lihat catatan di atas):
                  // nilainya sudah divalidasi `z.enum` di skema.
                  education: (data.parentEducation ?? null) as
                    | EducationLevel
                    | null,
                  incomeRange: (data.parentIncomeRange ?? null) as
                    | IncomeRange
                    | null,
                  birthYear: data.parentBirthYear ?? null,
                },
              },
            }
          : {}),
      },
      select: { id: true, nis: true, fullName: true, birthDate: true },
    });

    // Akun login: username = NIS, password awal = tanggal lahir.
    // Wajib ganti password saat pertama masuk (lihat lib/akun-siswa.ts).
    const hasilAkun = await buatAkunSiswa(tx, {
      studentId: siswa.id,
      schoolId: ctx.schoolId,
      nis: siswa.nis,
      nama: siswa.fullName,
      tanggalLahir: siswa.birthDate,
      slugSekolah,
    });

    return { created: siswa, akun: hasilAkun };
  });

  await recordAudit({
    schoolId: ctx.schoolId,
    userId: ctx.userId,
    action: "CREATE",
    entity: "Student",
    entityId: created.id,
    after: {
      nis: data.nis,
      fullName: data.fullName,
      akun: akun.status,
      ...(akun.status !== "dibuat" ? { akunAlasan: akun.alasan } : {}),
    },
    ...meta,
  });

  revalidatePath("/dashboard/students");

  // Kegagalan membuat akun TIDAK membatalkan pembuatan siswa (data siswa tetap
  // tersimpan), tetapi operator harus tahu — bukan diam-diam.
  if (akun.status === "gagal") {
    return {
      ok: true,
      id: created.id,
      message: `Siswa ditambahkan, tetapi akun login GAGAL dibuat: ${akun.alasan}`,
    };
  }
  if (akun.status === "dilewati") {
    return {
      ok: true,
      id: created.id,
      message: `Siswa ditambahkan. Akun login dilewati: ${akun.alasan}`,
    };
  }
  return { ok: true, id: created.id, message: "Siswa ditambahkan beserta akun login." };
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

  // Cek duplikat NIK — NIK unik per sekolah. Tanpa cek ini, sekolah dapat
  // pesan error database yang membingungkan alih-alih keterangan jelas.
  if (data.nik) {
    const dupNik = await prisma.student.findFirst({
      where: {
        schoolId: ctx.schoolId,
        nik: data.nik,
        id: { not: id },
        deletedAt: null,
      },
      select: { id: true, fullName: true },
    });
    if (dupNik) {
      return {
        ok: false,
        error: `NIK sudah dipakai siswa lain (${dupNik.fullName}).`,
        fieldErrors: { nik: ["NIK sudah dipakai siswa lain"] },
      };
    }
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

      // Data administrasi — wajib ikut di-update, kalau tidak, NIK yang
      // diisi operator akan HILANG begitu siswa disunting.
      nik: data.nik ?? null,
      kkNumber: data.kkNumber ?? null,
      village: data.village ?? null,
      district: data.district ?? null,
      city: data.city ?? null,
      province: data.province ?? null,
      postalCode: data.postalCode ?? null,
      villageCode: data.villageCode ?? null,
      // Cast enum — lihat catatan di createStudent.
      residenceType: (data.residenceType ?? null) as ResidenceType | null,
      transportation: (data.transportation ?? null) as Transportation | null,
      livingWith: (data.livingWith ?? null) as LivingWith | null,
      distanceKm: data.distanceKm ?? null,
      bloodType: data.bloodType ?? null,
      heightCm: data.heightCm ?? null,
      weightKg: data.weightKg ?? null,
      isKipRecipient: data.isKipRecipient ?? false,

      entryYear: data.entryYear,
      classId: data.classId ?? null,
      majorId: data.majorId ?? null,
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
