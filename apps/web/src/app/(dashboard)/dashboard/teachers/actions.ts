"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import {
  guard,
  requestMeta,
  flattenZodErrors,
  formDataArray,
} from "@/lib/action-guard";
import type { ActionResult } from "@/lib/action-result";
import {
  teacherCreateSchema,
  teacherUpdateSchema,
} from "@/lib/validations/personnel";
import {
  MAX_IMAGE_BYTES,
  sniffImageType,
  saveImage,
  removeStoredUrl,
} from "@/lib/storage";

/**
 * Server Actions Guru.
 * Pola: guard(izin) → validasi Zod → cek duplikat NIP → mutasi → audit.
 */

export async function createTeacher(
  formData: FormData,
): Promise<ActionResult> {
  const g = await guard("teachers", "manage");
  if ("fail" in g) return g.fail;
  const { schoolId, userId } = g.ctx;

  const raw = {
    ...Object.fromEntries(formData.entries()),
    subjectIds: formDataArray(formData, "subjectIds"),
  };
  const parsed = teacherCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Periksa kembali isian yang ditandai.",
      fieldErrors: flattenZodErrors(parsed.error),
    };
  }
  const d = parsed.data;

  if (d.nip) {
    const dup = await prisma.teacher.findFirst({
      where: { schoolId, nip: d.nip },
      select: { id: true },
    });
    if (dup) {
      return {
        ok: false,
        error: "NIP sudah dipakai guru lain.",
        fieldErrors: { nip: ["NIP sudah dipakai"] },
      };
    }
  }

  // Pastikan mapel yang dipilih memang milik sekolah ini.
  let subjectIds: string[] = [];
  if (d.subjectIds.length) {
    const valid = await prisma.subject.findMany({
      where: { schoolId, id: { in: d.subjectIds }, deletedAt: null },
      select: { id: true },
    });
    subjectIds = valid.map((s) => s.id);
  }

  // Unggah foto jika ada berkas gambar valid
  const photoFile = formData.get("photo");
  let photoUrl: string | null = null;
  if (photoFile instanceof File && photoFile.size > 0) {
    if (photoFile.size > MAX_IMAGE_BYTES) {
      return {
        ok: false,
        error: `Ukuran foto maksimal ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)} MB.`,
        fieldErrors: { photo: ["Ukuran foto maksimal 2 MB"] },
      };
    }
    const buf = Buffer.from(await photoFile.arrayBuffer());
    const type = sniffImageType(buf);
    if (!type) {
      return {
        ok: false,
        error: "Foto harus berupa format gambar PNG, JPEG, atau WEBP.",
        fieldErrors: { photo: ["Format foto tidak didukung (gunakan PNG/JPEG/WEBP)"] },
      };
    }
    try {
      const stored = await saveImage({ data: buf, prefix: `${schoolId}/teachers`, type });
      photoUrl = stored.url;
    } catch (err) {
      return {
        ok: false,
        error: `Gagal menyimpan foto: ${err instanceof Error ? err.message : "terjadi kesalahan"}`,
      };
    }
  }

  const meta = await requestMeta();
  const created = await prisma.teacher.create({
    data: {
      schoolId, // isolasi tenant
      nip: d.nip ?? null,
      fullName: d.fullName,
      gender: d.gender,
      phone: d.phone ?? null,
      email: d.email ?? null,
      photoUrl,
      isActive: d.isActive,
      ...(subjectIds.length
        ? {
            subjects: {
              create: subjectIds.map((sid) => ({ subjectId: sid })),
            },
          }
        : {}),
    },
    select: { id: true },
  });

  await recordAudit({
    schoolId,
    userId,
    action: "CREATE",
    entity: "Teacher",
    entityId: created.id,
    after: { fullName: d.fullName, nip: d.nip ?? null },
    ...meta,
  });

  revalidatePath("/dashboard/teachers");
  return { ok: true, id: created.id, message: "Guru ditambahkan." };
}

export async function updateTeacher(
  formData: FormData,
): Promise<ActionResult> {
  const g = await guard("teachers", "manage");
  if ("fail" in g) return g.fail;
  const { schoolId, userId } = g.ctx;

  const raw = {
    ...Object.fromEntries(formData.entries()),
    subjectIds: formDataArray(formData, "subjectIds"),
  };
  const parsed = teacherUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Periksa kembali isian yang ditandai.",
      fieldErrors: flattenZodErrors(parsed.error),
    };
  }
  const { id, ...d } = parsed.data;

  const existing = await prisma.teacher.findFirst({
    where: { id, schoolId, deletedAt: null },
  });
  if (!existing) return { ok: false, error: "Guru tidak ditemukan." };

  if (d.nip) {
    const dup = await prisma.teacher.findFirst({
      where: { schoolId, nip: d.nip, id: { not: id } },
      select: { id: true },
    });
    if (dup) {
      return {
        ok: false,
        error: "NIP sudah dipakai guru lain.",
        fieldErrors: { nip: ["NIP sudah dipakai"] },
      };
    }
  }

  let subjectIds: string[] = [];
  if (d.subjectIds.length) {
    const valid = await prisma.subject.findMany({
      where: { schoolId, id: { in: d.subjectIds }, deletedAt: null },
      select: { id: true },
    });
    subjectIds = valid.map((s) => s.id);
  }

  const meta = await requestMeta();

  // Penanganan foto: hapus, unggah baru, atau pertahankan
  const removePhotoFlag = formData.get("removePhoto") === "1";
  const photoFile = formData.get("photo");
  let nextPhotoUrl: string | null = existing.photoUrl;

  if (removePhotoFlag) {
    nextPhotoUrl = null;
  }

  let newlyUploadedUrl: string | null = null;
  if (photoFile instanceof File && photoFile.size > 0) {
    if (photoFile.size > MAX_IMAGE_BYTES) {
      return {
        ok: false,
        error: `Ukuran foto maksimal ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)} MB.`,
        fieldErrors: { photo: ["Ukuran foto maksimal 2 MB"] },
      };
    }
    const buf = Buffer.from(await photoFile.arrayBuffer());
    const type = sniffImageType(buf);
    if (!type) {
      return {
        ok: false,
        error: "Foto harus berupa format gambar PNG, JPEG, atau WEBP.",
        fieldErrors: { photo: ["Format foto tidak didukung (gunakan PNG/JPEG/WEBP)"] },
      };
    }
    try {
      const stored = await saveImage({ data: buf, prefix: `${schoolId}/teachers`, type });
      newlyUploadedUrl = stored.url;
      nextPhotoUrl = stored.url;
    } catch (err) {
      return {
        ok: false,
        error: `Gagal menyimpan foto: ${err instanceof Error ? err.message : "terjadi kesalahan"}`,
      };
    }
  }

  // Ganti daftar mapel: hapus relasi lama, buat yang baru (dalam transaksi).
  await prisma.$transaction([
    prisma.teacherSubject.deleteMany({ where: { teacherId: id } }),
    prisma.teacher.update({
      where: { id },
      data: {
        nip: d.nip ?? null,
        fullName: d.fullName,
        gender: d.gender,
        phone: d.phone ?? null,
        email: d.email ?? null,
        photoUrl: nextPhotoUrl,
        isActive: d.isActive,
        ...(subjectIds.length
          ? { subjects: { create: subjectIds.map((sid) => ({ subjectId: sid })) } }
          : {}),
      },
    }),
  ]);

  // Bersihkan berkas lama di storage jika diganti atau dihapus
  if ((removePhotoFlag || newlyUploadedUrl) && existing.photoUrl && existing.photoUrl !== nextPhotoUrl) {
    await removeStoredUrl(existing.photoUrl);
  }

  await recordAudit({
    schoolId,
    userId,
    action: "UPDATE",
    entity: "Teacher",
    entityId: id,
    before: { fullName: existing.fullName, nip: existing.nip, photoUrl: existing.photoUrl },
    after: { fullName: d.fullName, nip: d.nip ?? null, photoUrl: nextPhotoUrl },
    ...meta,
  });

  revalidatePath("/dashboard/teachers");
  revalidatePath(`/dashboard/teachers/${id}`);
  return { ok: true, id, message: "Perubahan disimpan." };
}

export async function softDeleteTeacher(id: string): Promise<ActionResult> {
  const g = await guard("teachers", "manage");
  if ("fail" in g) return g.fail;

  const existing = await prisma.teacher.findFirst({
    where: { id, schoolId: g.ctx.schoolId, deletedAt: null },
  });
  if (!existing) return { ok: false, error: "Guru tidak ditemukan." };

  const meta = await requestMeta();
  await prisma.teacher.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  });

  await recordAudit({
    schoolId: g.ctx.schoolId,
    userId: g.ctx.userId,
    action: "DELETE",
    entity: "Teacher",
    entityId: id,
    before: { fullName: existing.fullName },
    ...meta,
  });

  revalidatePath("/dashboard/teachers");
  return { ok: true, message: "Guru dinonaktifkan." };
}
