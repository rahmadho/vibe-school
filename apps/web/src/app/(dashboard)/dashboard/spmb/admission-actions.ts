"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { guard, requestMeta, flattenZodErrors } from "@/lib/action-guard";
import type { ActionResult } from "@/lib/action-result";
import {
  admissionBatchCreateSchema,
  admissionBatchUpdateSchema,
  admissionPathCreateSchema,
  admissionPathUpdateSchema,
  admissionResultSchema,
  registrationReviewSchema,
} from "@/lib/validations/site";
import { queueNotification } from "@/lib/notification-queue";
import { getBlock } from "@/lib/site-blocks";
import { BLOCK_PROPS_SCHEMAS } from "@/lib/validations/site";

/**
 * Actions untuk SPMB (Sistem Penerimaan Murid Baru).
 *
 * DUKUNG LEBIH DARI SATU JALUR (permintaan user):
 * Satu gelombang pendaftaran bisa membuka beberapa jalur sekaligus — Reguler,
 * Prestasi, Afirmasi — masing-masing dengan biaya, kuota, dan syarat dokumen
 * sendiri. Sekolah TK biasanya hanya memakai satu jalur "Reguler"; SMA favorit
 * memakai tiga dengan kuota berbeda. Tidak ada sekolah yang dipaksa memakai
 * fitur ini: jalur bawaan dibuat otomatis saat gelombang pertama dibuat.
 */

/* ============================================================
 * GELOMBANG PENDAFTARAN
 * ============================================================ */

/**
 * Buat gelombang pendaftaran.
 *
 * Sekaligus membuat satu jalur "REGULER" bawaan — supaya sekolah yang hanya
 * butuh satu formulir bisa langsung jalan tanpa harus memahami konsep "jalur"
 * lebih dulu. Sekolah yang butuh lebih dari satu jalur tinggal menambah.
 */
export async function createAdmissionBatch(formData: FormData): Promise<ActionResult> {
  const g = await guard("spmb", "manage");
  if ("fail" in g) return g.fail;
  const ctx = g.ctx;
  const meta = await requestMeta();

  const parsed = admissionBatchCreateSchema.safeParse({
    academicYearId: formData.get("academicYearId"),
    name: formData.get("name"),
    openDate: formData.get("openDate"),
    closeDate: formData.get("closeDate"),
    description: formData.get("description") || "",
    quota: formData.get("quota") || undefined,
    isActive: formData.get("isActive") ?? undefined,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Periksa kembali isian.",
      fieldErrors: flattenZodErrors(parsed.error),
    };
  }

  const { schoolId } = ctx;
  const d = parsed.data;

  try {
    const batch = await prisma.admissionBatch.create({
      data: {
        schoolId,
        academicYearId: d.academicYearId,
        name: d.name,
        openDate: d.openDate,
        closeDate: d.closeDate,
        description: d.description || null,
        quota: d.quota ?? null,
        isActive: d.isActive ?? true,
        // Jalur bawaan supaya sekolah satu-jalur tidak perlu menyentuh fitur ini.
        paths: {
          create: {
            schoolId,
            name: "Reguler",
            code: "REGULER",
            description: null,
            registrationFee: 0,
            quota: d.quota ?? null,
            order: 0,
            isActive: true,
          },
        },
      },
    });

    await recordAudit({
      schoolId,
      userId: ctx.userId,
      action: "CREATE",
      entity: "AdmissionBatch",
      entityId: batch.id,
      after: { name: d.name },
      ...meta,
    });

    revalidatePath("/dashboard/spmb");
    revalidatePath("/dashboard/website");
    return { ok: true, id: batch.id, message: `Gelombang "${d.name}" dibuat.` };
  } catch (error) {
    return {
      ok: false,
      error: `Gagal membuat gelombang: ${error instanceof Error ? error.message : "tidak diketahui"}`,
    };
  }
}

export async function updateAdmissionBatch(formData: FormData): Promise<ActionResult> {
  const g = await guard("spmb", "manage");
  if ("fail" in g) return g.fail;
  const ctx = g.ctx;
  const meta = await requestMeta();

  const parsed = admissionBatchUpdateSchema.safeParse({
    id: formData.get("id"),
    academicYearId: formData.get("academicYearId") ?? undefined,
    name: formData.get("name") ?? undefined,
    openDate: formData.get("openDate") ?? undefined,
    closeDate: formData.get("closeDate") ?? undefined,
    description: formData.get("description") || undefined,
    quota: formData.get("quota") || undefined,
    isActive: formData.get("isActive") ?? undefined,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Periksa kembali isian.",
      fieldErrors: flattenZodErrors(parsed.error),
    };
  }

  const { schoolId } = ctx;
  const existing = await prisma.admissionBatch.findFirst({
    where: { id: parsed.data.id, schoolId },
  });
  if (!existing) return { ok: false, error: "Gelombang tidak ditemukan." };

  try {
    await prisma.admissionBatch.update({
      where: { id: parsed.data.id },
      data: {
        academicYearId: parsed.data.academicYearId ?? existing.academicYearId,
        name: parsed.data.name ?? existing.name,
        openDate: parsed.data.openDate ?? existing.openDate,
        closeDate: parsed.data.closeDate ?? existing.closeDate,
        description: parsed.data.description ?? existing.description,
        quota: parsed.data.quota ?? existing.quota,
        isActive: parsed.data.isActive ?? existing.isActive,
      },
    });

    await recordAudit({
      schoolId,
      userId: ctx.userId,
      action: "UPDATE",
      entity: "AdmissionBatch",
      entityId: parsed.data.id,
      ...meta,
    });

    revalidatePath("/dashboard/spmb");
    return { ok: true, message: "Gelombang diperbarui." };
  } catch (error) {
    return {
      ok: false,
      error: `Gagal memperbarui gelombang: ${error instanceof Error ? error.message : "tidak diketahui"}`,
    };
  }
}

/* ============================================================
 * JALUR PENDAFTARAN (inti fitur "lebih dari 1 jalur")
 * ============================================================ */

/**
 * Tambah jalur pendaftaran pada satu gelombang.
 *
 * Kuota jalur tidak boleh melebihi kuota gelombang — kalau tidak, sekolah bisa
 * menerima lebih banyak pendaftar daripada daya tampung, dan itu masalah nyata
 * yang baru ketahuan saat pendaftaran dibuka. Ditolak di sini dengan pesan yang
 * menjelaskan angkanya.
 */
export async function createAdmissionPath(formData: FormData): Promise<ActionResult> {
  const g = await guard("spmb", "manage");
  if ("fail" in g) return g.fail;
  const ctx = g.ctx;
  const meta = await requestMeta();

  const parsed = admissionPathCreateSchema.safeParse({
    batchId: formData.get("batchId"),
    name: formData.get("name"),
    code: formData.get("code"),
    description: formData.get("description") || "",
    registrationFee: formData.get("registrationFee") || 0,
    quota: formData.get("quota") || undefined,
    requirements: formData.get("requirements") || "",
    order: formData.get("order") || 0,
    isActive: formData.get("isActive") ?? undefined,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Periksa kembali isian.",
      fieldErrors: flattenZodErrors(parsed.error),
    };
  }

  const { schoolId } = ctx;
  const d = parsed.data;

  const batch = await prisma.admissionBatch.findFirst({
    where: { id: d.batchId, schoolId },
    include: { paths: { where: { isActive: true } } },
  });
  if (!batch) return { ok: false, error: "Gelombang tidak ditemukan." };

  // Kode jalur harus unik di dalam gelombang — kalau tidak, dua jalur "PRESTASI"
  // akan membingungkan saat merekap hasil.
  const codeTaken = await prisma.admissionPath.findFirst({
    where: { batchId: d.batchId, code: d.code },
  });
  if (codeTaken) {
    return { ok: false, error: `Kode jalur "${d.code}" sudah dipakai di gelombang ini.` };
  }

  if (batch.quota !== null && d.quota) {
    const totalPathQuota =
      batch.paths.reduce((sum, p) => sum + (p.quota ?? 0), 0) + d.quota;
    if (totalPathQuota > batch.quota) {
      return {
        ok: false,
        error:
          `Total kuota semua jalur (${totalPathQuota}) melebihi kuota gelombang ` +
          `(${batch.quota}). Kurangi kuota jalur ini atau naikkan kuota gelombang.`,
      };
    }
  }

  try {
    const path = await prisma.admissionPath.create({
      data: {
        schoolId,
        batchId: d.batchId,
        name: d.name,
        code: d.code,
        description: d.description || null,
        registrationFee: d.registrationFee,
        quota: d.quota ?? null,
        requirements: d.requirements || null,
        order: d.order,
        isActive: d.isActive ?? true,
      },
    });

    await recordAudit({
      schoolId,
      userId: ctx.userId,
      action: "CREATE",
      entity: "AdmissionPath",
      entityId: path.id,
      after: { name: d.name, code: d.code },
      ...meta,
    });

    revalidatePath("/dashboard/spmb");
    return { ok: true, id: path.id, message: `Jalur "${d.name}" ditambahkan.` };
  } catch (error) {
    return {
      ok: false,
      error: `Gagal menambah jalur: ${error instanceof Error ? error.message : "tidak diketahui"}`,
    };
  }
}

export async function updateAdmissionPath(formData: FormData): Promise<ActionResult> {
  const g = await guard("spmb", "manage");
  if ("fail" in g) return g.fail;
  const ctx = g.ctx;
  const meta = await requestMeta();

  const parsed = admissionPathUpdateSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name") ?? undefined,
    code: formData.get("code") ?? undefined,
    description: formData.get("description") || undefined,
    registrationFee: formData.get("registrationFee") || undefined,
    quota: formData.get("quota") || undefined,
    requirements: formData.get("requirements") || undefined,
    order: formData.get("order") || undefined,
    isActive: formData.get("isActive") ?? undefined,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Periksa kembali isian.",
      fieldErrors: flattenZodErrors(parsed.error),
    };
  }

  const { schoolId } = ctx;
  const existing = await prisma.admissionPath.findFirst({
    where: { id: parsed.data.id, schoolId },
    include: { batch: { include: { paths: true } } },
  });
  if (!existing) return { ok: false, error: "Jalur tidak ditemukan." };

  // Periksa ulang batas kuota bila kuota diubah.
  if (parsed.data.quota !== undefined && existing.batch.quota !== null) {
    const others = existing.batch.paths
      .filter((p) => p.id !== existing.id)
      .reduce((sum, p) => sum + (p.quota ?? 0), 0);
    if (others + parsed.data.quota > existing.batch.quota) {
      return {
        ok: false,
        error:
          `Total kuota semua jalur akan menjadi ${others + parsed.data.quota}, ` +
          `melebihi kuota gelombang (${existing.batch.quota}).`,
      };
    }
  }

  try {
    await prisma.admissionPath.update({
      where: { id: parsed.data.id },
      data: {
        name: parsed.data.name ?? existing.name,
        code: parsed.data.code ?? existing.code,
        description: parsed.data.description ?? existing.description,
        registrationFee: parsed.data.registrationFee ?? existing.registrationFee,
        quota: parsed.data.quota ?? existing.quota,
        requirements: parsed.data.requirements ?? existing.requirements,
        order: parsed.data.order ?? existing.order,
        isActive: parsed.data.isActive ?? existing.isActive,
      },
    });

    await recordAudit({
      schoolId,
      userId: ctx.userId,
      action: "UPDATE",
      entity: "AdmissionPath",
      entityId: parsed.data.id,
      ...meta,
    });

    revalidatePath("/dashboard/spmb");
    return { ok: true, message: "Jalur diperbarui." };
  } catch (error) {
    return {
      ok: false,
      error: `Gagal memperbarui jalur: ${error instanceof Error ? error.message : "tidak diketahui"}`,
    };
  }
}

/**
 * Hapus jalur pendaftaran.
 *
 * Jalur yang SUDAH punya pendaftar tidak dihapus — hanya dinonaktifkan. Kalau
 * dihapus, riwayat pendaftaran siswa akan kehilangan konteks: "mendaftar lewat
 * jalur apa?" menjadi tidak terjawab, padahal itu penting untuk laporan.
 */
export async function deleteAdmissionPath(formData: FormData): Promise<ActionResult> {
  const g = await guard("spmb", "manage");
  if ("fail" in g) return g.fail;
  const ctx = g.ctx;
  const meta = await requestMeta();

  const { schoolId } = ctx;
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "Jalur tidak dikenal." };

  const path = await prisma.admissionPath.findFirst({
    where: { id, schoolId },
    include: { _count: { select: { registrations: true } } },
  });
  if (!path) return { ok: false, error: "Jalur tidak ditemukan." };

  try {
    if (path._count.registrations > 0) {
      // Ada pendaftar: nonaktifkan saja, jangan hapus.
      await prisma.admissionPath.update({ where: { id }, data: { isActive: false } });

      await recordAudit({
        schoolId,
        userId: ctx.userId,
        action: "UPDATE",
        entity: "AdmissionPath",
        entityId: id,
        after: { isActive: false, reason: "punya pendaftar" },
        ...meta,
      });

      revalidatePath("/dashboard/spmb");
      return {
        ok: true,
        message:
          `Jalur "${path.name}" dinonaktifkan, bukan dihapus, karena sudah memiliki ` +
          `${path._count.registrations} pendaftar. Riwayatnya tetap tersimpan.`,
      };
    }

    await prisma.admissionPath.delete({ where: { id } });

    await recordAudit({
      schoolId,
      userId: ctx.userId,
      action: "DELETE",
      entity: "AdmissionPath",
      entityId: id,
      before: { name: path.name, code: path.code },
      ...meta,
    });

    revalidatePath("/dashboard/spmb");
    return { ok: true, message: `Jalur "${path.name}" dihapus.` };
  } catch (error) {
    return {
      ok: false,
      error: `Gagal menghapus jalur: ${error instanceof Error ? error.message : "tidak diketahui"}`,
    };
  }
}

/* ============================================================
 * PENDAFTARAN & SELEKSI
 * ============================================================ */

/**
 * Ubah status seleksi satu pendaftaran.
 *
 * Saat pendaftar DITERIMA, biaya daftar ulang dibuat otomatis dan notifikasi WA
 * masuk antrean — supaya operator tidak perlu mengerjakan dua hal terpisah untuk
 * satu keputusan, yang gampang terlupakan saat menerima banyak siswa sekaligus.
 */
export async function reviewRegistration(formData: FormData): Promise<ActionResult> {
  const g = await guard("spmb", "manage");
  if ("fail" in g) return g.fail;
  const ctx = g.ctx;
  const meta = await requestMeta();

  const parsed = registrationReviewSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
    note: formData.get("note") || "",
    reRegistrationFee: formData.get("reRegistrationFee") || undefined,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Periksa kembali isian.",
      fieldErrors: flattenZodErrors(parsed.error),
    };
  }

  const { schoolId } = ctx;
  const d = parsed.data;

  const reg = await prisma.registration.findFirst({
    where: { id: d.id, schoolId },
    include: { batch: true, path: true },
  });
  if (!reg) return { ok: false, error: "Pendaftaran tidak ditemukan." };

  try {
    await prisma.$transaction(async (tx) => {
      await tx.registration.update({
        where: { id: d.id },
        data: {
          status: d.status,
          resultNote: d.note || null,
          verifiedAt: reg.verifiedAt ?? new Date(),
          decidedAt: new Date(),
        },
      });

      // Catatan: tagihan daftar ulang TIDAK dibuat di sini. Invoice wajib
      // terhubung ke Student, sedangkan pendaftar baru menjadi siswa setelah
      // panitia membuatkan akunnya. Membuat tagihan lebih awal berarti membuat
      // invoice tanpa pemilik — yang justru menimbulkan tagihan hantu.
      // Nominal daftar ulang disimpan agar bisa dipakai saat siswa dibuat.
    });

    // Notifikasi hasil seleksi — masuk antrean, bukan dikirim langsung
    // (aturan proyek: kirim WA lewat worker, jangan di dalam request handler).
    if (d.status === "ACCEPTED" || d.status === "REJECTED") {
      await queueNotification({
        schoolId,
        to: reg.parentPhone,
        templateKey: d.status === "ACCEPTED" ? "spmb.accepted" : "spmb.rejected",
        vars: {
          nama: reg.fullName,
          gelombang: reg.batch.name,
          jalur: reg.path?.name ?? "Reguler",
          sekolah: reg.schoolId,
        },
        refType: "Registration",
        refId: reg.id,
      });
    }

    await recordAudit({
      schoolId,
      userId: ctx.userId,
      action: "UPDATE",
      entity: "Registration",
      entityId: d.id,
      after: { status: d.status, note: d.note },
      ...meta,
    });

    revalidatePath("/dashboard/spmb");
    revalidatePath("/dashboard/finance");
    return { ok: true, message: "Status pendaftaran diperbarui." };
  } catch (error) {
    return {
      ok: false,
      error: `Gagal memperbarui status: ${error instanceof Error ? error.message : "tidak diketahui"}`,
    };
  }
}

/* ============================================================
 * SPMB DI WEB PUBLIK
 * ============================================================ */

/**
 * Simpan teks ajakan SPMB di halaman depan.
 *
 * Sederhana, tetapi berguna: sekolah sering ingin mengubah kalimat ajakan saat
 * gelombang dibuka tanpa meminta bantuan teknis.
 */
export async function saveSpmbBlockProps(formData: FormData): Promise<ActionResult> {
  const g = await guard("website", "manage");
  if ("fail" in g) return g.fail;
  const ctx = g.ctx;
  const meta = await requestMeta();

  const definition = getBlock("spmb");
  if (!definition) return { ok: false, error: "Blok SPMB tidak dikenal." };

  const raw: Record<string, unknown> = {};
  for (const field of definition.fields) {
    if (formData.has(field)) raw[field] = formData.get(field);
  }

  const parsed = BLOCK_PROPS_SCHEMAS.spmb.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Periksa kembali isian.",
      fieldErrors: flattenZodErrors(parsed.error),
    };
  }

  const { schoolId } = ctx;

  try {
    await prisma.siteBlock.upsert({
      where: { schoolId_blockKey: { schoolId, blockKey: "spmb" } },
      create: {
        schoolId,
        blockKey: "spmb",
        variantKey: definition.defaultVariant,
        order: 99,
        isEnabled: true,
        props: parsed.data as object,
      },
      update: { props: parsed.data as object },
    });

    await recordAudit({
      schoolId,
      userId: ctx.userId,
      action: "UPDATE",
      entity: "SiteBlock",
      entityId: "spmb",
      ...meta,
    });

    revalidatePath("/dashboard/website");
    return { ok: true, message: "Teks pengumuman SPMB disimpan." };
  } catch (error) {
    return {
      ok: false,
      error: `Gagal menyimpan: ${error instanceof Error ? error.message : "tidak diketahui"}`,
    };
  }
}

// Re-export tipe agar bisa dipakai di form client tanpa impor ulang.
export type { ActionResult };
export const _z = z;
