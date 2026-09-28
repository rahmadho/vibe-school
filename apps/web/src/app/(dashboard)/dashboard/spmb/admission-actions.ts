"use server";

import { revalidatePath } from "next/cache";
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
import { buatAkunSiswa } from "@/lib/akun-siswa";
import { ambilSlugSekolah } from "@/lib/sekolah-helper";
import { getBlock } from "@/lib/site-blocks";
import { BLOCK_PROPS_SCHEMAS } from "@/lib/validations/site";
import { manualRegistrationSchema } from "@/lib/validations/spmb-manual";
import {
  REGISTRATION_DOC_KINDS,
  REGISTRATION_DOC_LABEL,
  isRegistrationDocKind,
  type RegistrationDocKind,
} from "@/lib/validations/spmb-docs";
import { buildRegistrationNo } from "@/lib/spmb-public";
import { buildInvoiceNumber } from "@/lib/finance-calc";
import {
  MAX_DOCUMENT_BYTES,
  saveDocument,
  sniffDocumentType,
  removeStoredUrl,
} from "@/lib/storage";

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

  // Tanggal pengumuman dibaca terpisah dari skema batch: ia bukan bagian dari
  // bentuk gelombang, melainkan hasil seleksi. Sebelumnya field ini ADA di form
  // tetapi tidak pernah dibaca — panitia mengisi tanggal, lalu angkanya lenyap
  // tanpa peringatan apa pun.
  const resultDateRaw = String(formData.get("resultDate") ?? "").trim();
  let resultDate: Date | null = null;
  if (resultDateRaw) {
    const parsedDate = new Date(resultDateRaw);
    if (Number.isNaN(parsedDate.getTime())) {
      return {
        ok: false,
        error: "Tanggal pengumuman hasil tidak valid.",
        fieldErrors: { resultDate: ["Tanggal tidak valid"] },
      };
    }
    resultDate = parsedDate;
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
        resultDate,
        // Hanya dua kemungkinan: disebut "tidak aktif" (false), atau tidak
        // disebut sama sekali → aktif. Gelombang baru yang lahir nonaktif
        // membuat pendaftaran tidak pernah terbuka tanpa penjelasan apa pun.
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

  // Konsistensi tanggal diperiksa terhadap nilai GABUNGAN (tersimpan + baru).
  // Form sunting cepat tidak mengirim tanggal sama sekali, jadi memeriksa
  // hanya yang dikirim tidak akan menangkap apa pun.
  const nextOpen = parsed.data.openDate ?? existing.openDate;
  const nextClose = parsed.data.closeDate ?? existing.closeDate;
  if (nextClose.getTime() <= nextOpen.getTime()) {
    return {
      ok: false,
      error: "Tanggal tutup harus setelah tanggal buka.",
      fieldErrors: { closeDate: ["Harus setelah tanggal buka"] },
    };
  }

  try {
    await prisma.admissionBatch.update({
      where: { id: parsed.data.id },
      data: {
        academicYearId: parsed.data.academicYearId ?? existing.academicYearId,
        name: parsed.data.name ?? existing.name,
        openDate: nextOpen,
        closeDate: nextClose,
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
    score: formData.get("score") ?? "",
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
          ...(d.score !== undefined ? { score: d.score } : {}),
          // Biaya daftar ulang DISIMPAN. Sebelumnya nilai ini hanya divalidasi
          // lalu dibuang — panitia mengisi nominalnya, dan angka itu hilang
          // tanpa peringatan apa pun.
          //
          // Hanya ditulis saat status DITERIMA: nominal daftar ulang tidak
          // berarti apa-apa untuk pendaftar yang masih menunggu atau ditolak,
          // dan menyimpannya di sana hanya menambah data yang menyesatkan.
          ...(d.status === "ACCEPTED" && d.reRegistrationFee !== undefined
            ? { reRegistrationFee: d.reRegistrationFee }
            : {}),
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
    //
    // NAMA TEMPLATE memakai `admission.*`, bukan `spmb.*`. Ketiganya harus
    // benar-benar ada di database; `admission.rejected` DITAMBAHKAN karena
    // sebelumnya tidak ada sama sekali — pendaftar yang ditolak tidak pernah
    // menerima pemberitahuan apa pun, dan itu yang paling menyakitkan bagi
    // orang tua yang menunggu.
    if (d.status === "ACCEPTED" || d.status === "REJECTED") {
      await queueNotification({
        schoolId,
        to: reg.parentPhone,
        recipientName: reg.parentName,
        templateKey:
          d.status === "ACCEPTED" ? "admission.accepted" : "admission.rejected",
        vars: {
          nama_pendaftar: reg.parentName,
          nama_calon: reg.fullName,
          nomor_pendaftaran: reg.registrationNo,
          // Langkah lanjutan diisi panitia lewat kolom catatan, supaya orang
          // tua tahu apa yang harus dilakukan — bukan hanya "selamat".
          langkah_selanjutnya:
            d.note?.trim() || "Hubungi sekolah untuk informasi daftar ulang.",
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
 * DOKUMEN PENDAFTARAN
 * ============================================================ */

/**
 * Unggah satu dokumen pendaftaran.
 *
 * ============================================================
 * KENAPA DIPISAH DARI FORM PENDAFTARAN
 * ============================================================
 * Berkas diunggah SATU PER SATU, bukan bersama formulir. Alasannya: berkas
 * hasil pindai bisa besar, dan mengirim empat berkas sekaligus dalam satu
 * permintaan membuat kegagalan satu berkas menggagalkan seluruh pendaftaran —
 * orang tua harus mengulang dari awal. Di sini tiap berkas berdiri sendiri.
 *
 * ============================================================
 * KENAPA PDF DITERIMA
 * ============================================================
 * Dokumen sekolah hampir selalu berupa hasil pindai berformat PDF, atau foto
 * dari ponsel. Keduanya diterima. SVG dan HTML tetap ditolak: keduanya bisa
 * memuat skrip yang berjalan di peramban.
 */
export async function uploadRegistrationDocument(
  formData: FormData,
): Promise<ActionResult> {
  const g = await guard("spmb", "manage");
  if ("fail" in g) return g.fail;
  const { schoolId, userId } = g.ctx;

  const registrationId = String(formData.get("registrationId") ?? "");
  const kind = String(formData.get("kind") ?? "");

  if (!registrationId) return { ok: false, error: "Pendaftaran tidak dikenali." };
  if (!(REGISTRATION_DOC_KINDS as readonly string[]).includes(kind)) {
    return { ok: false, error: "Jenis dokumen tidak dikenal." };
  }

  const registration = await prisma.registration.findFirst({
    where: { id: registrationId, schoolId },
    select: { id: true, fullName: true },
  });
  if (!registration) return { ok: false, error: "Pendaftaran tidak ditemukan." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Pilih berkas terlebih dahulu." };
  }
  if (file.size > MAX_DOCUMENT_BYTES) {
    return {
      ok: false,
      error: `Ukuran berkas maksimal ${Math.round(MAX_DOCUMENT_BYTES / 1024 / 1024)} MB.`,
    };
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const type = sniffDocumentType(buf);
  if (!type) {
    return {
      ok: false,
      error: "Berkas harus berupa PDF atau gambar (PNG, JPEG, WEBP).",
    };
  }

  let stored;
  try {
    stored = await saveDocument({
      data: buf,
      prefix: `${schoolId}/registrations/${registration.id}`,
      type,
    });
  } catch (error) {
    return {
      ok: false,
      error: `Gagal menyimpan berkas: ${error instanceof Error ? error.message : "tidak diketahui"}`,
    };
  }

  const meta = await requestMeta();
  try {
    const previous = await prisma.registration.findUnique({
      where: { id: registration.id },
      select: { docBirthCert: true, docFamilyCard: true, docPhoto: true, docDiploma: true },
    });

    await prisma.registration.update({
      where: { id: registration.id },
      data: { [kind]: stored.url },
    });

    // Berkas lama dibuang setelah baris baru tersimpan — urutan ini disengaja.
    // Kalau dibuang lebih dulu lalu penyimpanan gagal, pendaftar kehilangan
    // dokumennya tanpa pengganti.
    const oldUrl = previous?.[kind as RegistrationDocKind] ?? null;
    if (oldUrl && oldUrl !== stored.url) {
      await removeStoredUrl(oldUrl);
    }

    await recordAudit({
      schoolId,
      userId,
      action: "UPDATE",
      entity: "Registration",
      entityId: registration.id,
      after: { document: kind, url: stored.url },
      ...meta,
    });

    revalidatePath("/dashboard/spmb/registrations");
    return { ok: true, message: `${REGISTRATION_DOC_LABEL[kind as RegistrationDocKind]} diunggah.` };
  } catch (error) {
    await removeStoredUrl(stored.url);
    return {
      ok: false,
      error: `Gagal menyimpan dokumen: ${error instanceof Error ? error.message : "tidak diketahui"}`,
    };
  }
}

/**
 * Hapus satu dokumen pendaftaran.
 *
 * Berkas fisik juga dibuang dari penyimpanan — berbeda dari data siswa yang
 * memakai soft delete, karena dokumen pendaftar yang ditolak tidak perlu
 * disimpan selamanya.
 */
export async function deleteRegistrationDocument(
  registrationId: string,
  kind: string,
): Promise<ActionResult> {
  const g = await guard("spmb", "manage");
  if ("fail" in g) return g.fail;
  const { schoolId, userId } = g.ctx;

  if (!(REGISTRATION_DOC_KINDS as readonly string[]).includes(kind)) {
    return { ok: false, error: "Jenis dokumen tidak dikenal." };
  }

  const registration = await prisma.registration.findFirst({
    where: { id: registrationId, schoolId },
    select: { id: true, docBirthCert: true, docFamilyCard: true, docPhoto: true, docDiploma: true },
  });
  if (!registration) return { ok: false, error: "Pendaftaran tidak ditemukan." };

  const url = registration[kind as RegistrationDocKind];
  if (!url) return { ok: false, error: "Dokumen ini memang belum ada." };

  const meta = await requestMeta();
  await prisma.registration.update({
    where: { id: registration.id },
    data: { [kind]: null },
  });
  await removeStoredUrl(url);

  await recordAudit({
    schoolId,
    userId,
    action: "DELETE",
    entity: "Registration",
    entityId: registration.id,
    before: { document: kind, url },
    ...meta,
  });

  revalidatePath("/dashboard/spmb/registrations");
  return { ok: true, message: "Dokumen dihapus." };
}

/* ============================================================
 * PENGUMUMAN HASIL SELEKSI
 * ============================================================ */

/**
 * Simpan pengumuman resmi hasil seleksi satu gelombang.
 *
 * ============================================================
 * KENAPA AKSI INI ADA
 * ============================================================
 * Kolom `resultAnnouncement` dan `resultDate` sudah lama ada di database, dan
 * halaman Cek Status publik sudah membacanya — tetapi TIDAK ADA cara mengisinya
 * dari dasbor. Akibatnya fitur itu menganggur: orang tua membuka halaman cek
 * status dan tidak pernah melihat pengumuman apa pun, hanya status per orang.
 *
 * Pengumuman di tingkat gelombang berbeda gunanya dari `resultNote` per
 * pendaftar: yang pertama menjelaskan KAPAN dan BAGAIMANA hasil diumumkan
 * (mis. "hasil diumumkan 1 Juli, daftar ulang 1–10 Juli"), yang kedua catatan
 * untuk satu orang.
 *
 * Opsi `notify` mengirim WA ke SEMUA pendaftar gelombang itu — dipakai sekolah
 * yang mengumumkan hasil serentak, bukan satu per satu.
 */
export async function saveAdmissionResult(
  formData: FormData,
): Promise<ActionResult> {
  const g = await guard("spmb", "manage");
  if ("fail" in g) return g.fail;
  const { schoolId, userId } = g.ctx;
  const meta = await requestMeta();

  const parsed = admissionResultSchema.safeParse({
    batchId: formData.get("batchId"),
    resultAnnouncement: formData.get("resultAnnouncement") ?? "",
    resultDate: formData.get("resultDate") ?? "",
    notify: formData.get("notify") ?? false,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Periksa kembali isian.",
      fieldErrors: flattenZodErrors(parsed.error),
    };
  }
  const d = parsed.data;

  const batch = await prisma.admissionBatch.findFirst({
    where: { id: d.batchId, schoolId },
    select: { id: true, name: true },
  });
  if (!batch) return { ok: false, error: "Gelombang tidak ditemukan." };

  const resultDate = d.resultDate ? new Date(d.resultDate) : null;
  if (resultDate && Number.isNaN(resultDate.getTime())) {
    return {
      ok: false,
      error: "Tanggal pengumuman tidak valid.",
      fieldErrors: { resultDate: ["Tanggal tidak valid"] },
    };
  }

  await prisma.admissionBatch.update({
    where: { id: batch.id },
    data: {
      resultAnnouncement: d.resultAnnouncement || null,
      resultDate,
    },
  });

  // Notifikasi massal — hanya bila panitia memintanya.
  //
  // Dikirim ke pendaftar yang sudah punya keputusan saja (DITERIMA / DITOLAK /
  // CADANGAN). Mengirim "hasil sudah diumumkan" ke pendaftar yang masih
  // menunggu verifikasi hanya membuat orang tua menelepon bertanya.
  let notified = 0;
  if (d.notify) {
    const targets = await prisma.registration.findMany({
      where: {
        schoolId,
        batchId: batch.id,
        status: { in: ["ACCEPTED", "REJECTED", "WAITLIST"] },
      },
      select: {
        id: true,
        fullName: true,
        parentName: true,
        parentPhone: true,
        status: true,
      },
    });

    for (const t of targets) {
      const templateKey =
        t.status === "ACCEPTED"
          ? "admission.accepted"
          : t.status === "REJECTED"
            ? "admission.rejected"
            : "general.announcement";

      const queued = await queueNotification({
        schoolId,
        to: t.parentPhone,
        recipientName: t.parentName,
        templateKey,
        vars: {
          nama_pendaftar: t.parentName,
          nama_calon: t.fullName,
          nomor_pendaftaran: "",
          langkah_selanjutnya:
            d.resultAnnouncement.trim() ||
            "Lihat pengumuman resmi di halaman Cek Status sekolah.",
          judul: `Pengumuman hasil ${batch.name}`,
          isi: d.resultAnnouncement,
        },
        refType: "AdmissionBatch",
        refId: batch.id,
      });
      if (queued) notified += 1;
    }
  }

  await recordAudit({
    schoolId,
    userId,
    action: "UPDATE",
    entity: "AdmissionBatch",
    entityId: batch.id,
    after: {
      resultAnnouncement: d.resultAnnouncement,
      resultDate: resultDate?.toISOString() ?? null,
      notified,
    },
    ...meta,
  });

  revalidatePath("/dashboard/spmb");
  revalidatePath("/spmb/status");

  return {
    ok: true,
    message:
      notified > 0
        ? `Pengumuman disimpan. ${notified} notifikasi masuk antrean.`
        : "Pengumuman disimpan.",
  };
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

/* ============================================================
 * PENDAFTARAN MANUAL (DATANG LANGSUNG / TELEPON)
 * ============================================================ */

/**
 * Catat pendaftaran yang masuk lewat datang langsung atau telepon.
 *
 * ============================================================
 * KENAPA FITUR INI WAJIB ADA
 * ============================================================
 * Sebelum ini, satu-satunya jalan masuk pendaftaran adalah formulir publik.
 * Padahal orang tua yang datang ke sekolah membawa berkas fisik — dan
 * menyuruhnya mengisi sendiri formulir online di ponselnya sering gagal:
 * tidak terbiasa, sinyal buruk, atau berkas fisik tidak bisa diunggah.
 * Tanpa aksi ini, panitia tidak punya cara mencatat mereka selain menunggu.
 *
 * ============================================================
 * PERBEDAAN YANG DISENGAJA DARI JALUR PUBLIK
 * ============================================================
 *   1. NOMOR PENDAFTARAN boleh diisi panitia — sekolah sering punya buku
 *      register fisik yang penomorannya sudah berjalan.
 *   2. STATUS boleh langsung VERIFIED — berkasnya sudah dilihat di depan mata,
 *      tidak perlu menunggu verifikasi.
 *   3. KUOTA TETAP ditegakkan, sama seperti jalur publik. Pendaftaran manual
 *      bukan celah untuk menembus daya tampung.
 *   4. NOTIFIKASI opsional — orang tuanya sering masih di ruangan yang sama.
 *   5. AUDIT memakai `userId` panitia, bukan null: jelas siapa yang mencatat.
 */
export async function createManualRegistration(
  formData: FormData,
): Promise<ActionResult> {
  const g = await guard("spmb", "manage");
  if ("fail" in g) return g.fail;
  const { schoolId, userId } = g.ctx;
  const meta = await requestMeta();

  const parsed = manualRegistrationSchema.safeParse({
    batchId: formData.get("batchId"),
    pathId: formData.get("pathId"),
    majorId: formData.get("majorId") ?? "",
    registrationNo: formData.get("registrationNo") ?? "",
    source: formData.get("source") ?? "WALK_IN",
    markVerified: formData.get("markVerified") ?? false,
    fullName: formData.get("fullName"),
    gender: formData.get("gender"),
    birthPlace: formData.get("birthPlace") ?? "",
    birthDate: formData.get("birthDate") ?? "",
    religion: formData.get("religion") ?? "",
    address: formData.get("address") ?? "",
    phone: formData.get("phone") ?? "",
    email: formData.get("email") ?? "",
    previousSchool: formData.get("previousSchool") ?? "",
    parentName: formData.get("parentName"),
    parentPhone: formData.get("parentPhone"),
    parentRelation: formData.get("parentRelation"),
    notify: formData.get("notify") ?? false,
    note: formData.get("note") ?? "",
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: "Periksa kembali isian yang ditandai.",
      fieldErrors: flattenZodErrors(parsed.error),
    };
  }
  const d = parsed.data;

  // Gelombang & jalur diverifikasi ke DB — form bisa dimanipulasi.
  const batch = await prisma.admissionBatch.findFirst({
    where: { id: d.batchId, schoolId },
    select: { id: true, name: true, quota: true, openDate: true },
  });
  if (!batch) return { ok: false, error: "Gelombang tidak ditemukan." };

  const path = await prisma.admissionPath.findFirst({
    where: { id: d.pathId, schoolId, batchId: batch.id },
    select: { id: true, name: true, code: true, quota: true },
  });
  if (!path) return { ok: false, error: "Jalur pendaftaran tidak ditemukan." };

  // Kuota gelombang tetap ditegakkan.
  if (batch.quota > 0) {
    const filled = await prisma.registration.count({
      where: {
        schoolId,
        batchId: batch.id,
        status: { in: ["VERIFIED", "TESTED", "ACCEPTED"] },
      },
    });
    if (filled >= batch.quota) {
      return {
        ok: false,
        error: `Kuota gelombang sudah penuh (${filled}/${batch.quota}). Naikkan kuota atau buat gelombang baru.`,
      };
    }
  }

  // Kuota jalur juga.
  if (path.quota > 0) {
    const filled = await prisma.registration.count({
      where: {
        schoolId,
        batchId: batch.id,
        pathId: path.id,
        status: { in: ["VERIFIED", "TESTED", "ACCEPTED"] },
      },
    });
    if (filled >= path.quota) {
      return {
        ok: false,
        error: `Jalur "${path.name}" sudah penuh (${filled}/${path.quota}).`,
      };
    }
  }

  // Jurusan opsional — diverifikasi agar tidak menerima id sekolah lain.
  let majorId: string | null = null;
  if (d.majorId) {
    const major = await prisma.major.findFirst({
      where: { id: d.majorId, schoolId, deletedAt: null, isActive: true },
      select: { id: true },
    });
    if (!major) return { ok: false, error: "Jurusan yang dipilih tidak tersedia." };
    majorId = major.id;
  }

  // Nomor pendaftaran: isian panitia, atau dibuat otomatis bila kosong.
  const manualNo = d.registrationNo.trim().toUpperCase();
  if (manualNo) {
    const taken = await prisma.registration.findFirst({
      where: { registrationNo: manualNo },
      select: { id: true },
    });
    if (taken) {
      return {
        ok: false,
        error: `Nomor pendaftaran "${manualNo}" sudah dipakai. Gunakan nomor lain.`,
        fieldErrors: { registrationNo: ["Nomor sudah dipakai"] },
      };
    }
  }

  const status = d.markVerified ? "VERIFIED" : "PENDING";
  const now = new Date();

  try {
    const created = await prisma.registration.create({
      data: {
        schoolId,
        batchId: batch.id,
        pathId: path.id,
        majorId,
        source: d.source,
        registrationNo:
          manualNo ||
          buildRegistrationNo({
            // Tahun diambil dari tanggal BUKA gelombang, sama seperti jalur
            // publik. Gelombang "2026/2027" yang dibuka Desember 2025 memberi
            // nomor bertahun 2026, sesuai yang tertulis di brosur sekolah.
            year: batch.openDate.getFullYear(),
            pathCode: path.code,
          }),
        status,
        fullName: d.fullName,
        gender: d.gender,
        birthPlace: d.birthPlace || null,
        birthDate: d.birthDate ?? null,
        religion: d.religion || null,
        address: d.address || null,
        phone: d.phone ?? null,
        email: d.email ?? null,
        previousSchool: d.previousSchool || null,
        parentName: d.parentName,
        parentPhone: d.parentPhone,
        parentRelation: d.parentRelation,
        resultNote: d.note || null,
        verifiedAt: status === "VERIFIED" ? now : null,
        submittedAt: now,
      },
      select: { id: true, registrationNo: true },
    });

    await recordAudit({
      schoolId,
      userId,
      action: "CREATE",
      entity: "Registration",
      entityId: created.id,
      after: {
        registrationNo: created.registrationNo,
        batch: batch.name,
        path: path.name,
        source: d.source,
        status,
      },
      ...meta,
    });

    // Notifikasi opsional. Untuk pendaftaran lewat telepon, WA justru menjadi
    // bukti tercatat — karena itu panitia yang memutuskan, bukan sistem.
    if (d.notify) {
      await queueNotification({
        schoolId,
        to: d.parentPhone,
        recipientName: d.parentName,
        templateKey: "admission.received",
        vars: {
          nama_pendaftar: d.parentName,
          nama_calon: d.fullName,
          nomor_pendaftaran: created.registrationNo,
        },
        refType: "Registration",
        refId: created.id,
      });
    }

    revalidatePath("/dashboard/spmb/registrations");
    revalidatePath("/dashboard/spmb");

    return {
      ok: true,
      id: created.id,
      message: `Pendaftaran ${created.registrationNo} dicatat.`,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    if (msg.includes("Unique constraint") || msg.includes("P2002")) {
      return {
        ok: false,
        error: "Nomor pendaftaran bentrok. Coba lagi atau isi nomor lain.",
        fieldErrors: { registrationNo: ["Nomor sudah dipakai"] },
      };
    }
    return {
      ok: false,
      error: `Gagal mencatat pendaftaran: ${msg || "tidak diketahui"}`,
    };
  }
}

/* ============================================================
 * KONVERSI PENDAFTAR DITERIMA → SISWA
 * ============================================================ */

/**
 * Ubah pendaftar yang sudah DITERIMA menjadi data siswa resmi.
 *
 * KENAPA DI SINI, BUKAN DI MENU SISWA:
 * Data pendaftar sudah lengkap (nama, jenis kelamin, tempat/tanggal lahir,
 * agama, alamat, wali). Meminta panitia mengetik ulang semuanya berarti
 * pekerjaan berlipat DAN peluang salah ketik pada data anak orang. Konversi
 * memindahkan apa yang sudah ada, lalu meminta hanya yang belum ada: NIS,
 * tahun masuk, dan kelas.
 *
 * JURUSAN IKUT TERBAWA: pilihan jurusan pendaftar disalin ke `Student.majorId`.
 * Tanpa itu, panitia SMK harus membuka satu per satu siswa untuk mengisi
 * jurusan yang sudah dipilih saat mendaftar.
 *
 * Bersifat idempoten terhadap pendaftaran: kolom `Registration.studentId`
 * menandai pendaftar ini sudah dikonversi, sehingga menekan tombol dua kali
 * tidak membuat siswa kembar.
 */
export async function convertRegistrationToStudent(
  formData: FormData,
): Promise<ActionResult> {
  const g = await guard("students", "create");
  if ("fail" in g) return g.fail;
  const ctx = g.ctx;
  const meta = await requestMeta();
  const { schoolId } = ctx;

  const registrationId = String(formData.get("registrationId") ?? "");
  const nis = String(formData.get("nis") ?? "").trim();
  const classId = String(formData.get("classId") ?? "").trim();
  const entryYearRaw = String(formData.get("entryYear") ?? "").trim();

  if (!registrationId) return { ok: false, error: "Pendaftar tidak dikenali." };
  if (!nis) {
    return {
      ok: false,
      error: "NIS wajib diisi.",
      fieldErrors: { nis: ["NIS wajib diisi"] },
    };
  }

  const registration = await prisma.registration.findFirst({
    where: { id: registrationId, schoolId },
    select: {
      id: true,
      fullName: true,
      gender: true,
      birthPlace: true,
      birthDate: true,
      religion: true,
      address: true,
      phone: true,
      parentName: true,
      parentPhone: true,
      parentRelation: true,
      status: true,
      majorId: true,
      studentId: true,
      reRegistrationFee: true,
    },
  });
  if (!registration) return { ok: false, error: "Pendaftar tidak ditemukan." };

  if (registration.status !== "ACCEPTED") {
    return {
      ok: false,
      error: "Hanya pendaftar berstatus Diterima yang dapat dijadikan siswa.",
    };
  }
  if (registration.studentId) {
    return { ok: false, error: "Pendaftar ini sudah pernah dijadikan siswa." };
  }

  // NIS tidak boleh kembar di sekolah yang sama.
  const dupNis = await prisma.student.findFirst({
    where: { schoolId, nis },
    select: { id: true },
  });
  if (dupNis) {
    return {
      ok: false,
      error: "NIS sudah dipakai siswa lain.",
      fieldErrors: { nis: ["NIS sudah dipakai"] },
    };
  }

  // Kelas tujuan (opsional) harus milik sekolah ini.
  let majorId = registration.majorId;
  if (classId) {
    const targetClass = await prisma.class.findFirst({
      where: { id: classId, schoolId, deletedAt: null },
      select: { id: true, majorId: true },
    });
    if (!targetClass) return { ok: false, error: "Kelas tujuan tidak ditemukan." };
    // Kelas berjurusan menang atas pilihan awal pendaftar: keputusan panitia
    // tentang penempatan lebih akhir dan lebih mengikat.
    if (targetClass.majorId) majorId = targetClass.majorId;
  }

  const entryYear = entryYearRaw ? Number(entryYearRaw) : new Date().getFullYear();
  if (!Number.isInteger(entryYear) || entryYear < 1900 || entryYear > 2200) {
    return {
      ok: false,
      error: "Tahun masuk tidak valid.",
      fieldErrors: { entryYear: ["Tahun masuk tidak valid"] },
    };
  }

  // Slug sekolah untuk membentuk email akun siswa; diambil di luar transaksi
  // supaya transaksi tidak menyentuh tabel schools.
  const slugSekolah = await ambilSlugSekolah(schoolId);

  try {
    const student = await prisma.$transaction(async (tx) => {
      const created = await tx.student.create({
        data: {
          schoolId,
          nis,
          fullName: registration.fullName,
          gender: registration.gender,
          birthPlace: registration.birthPlace,
          birthDate: registration.birthDate,
          religion: registration.religion,
          address: registration.address,
          phone: registration.phone,
          entryYear,
          classId: classId || null,
          majorId,
          status: "ACTIVE",
          parents: {
            create: {
              fullName: registration.parentName,
              relation: registration.parentRelation,
              phone: registration.parentPhone,
              isPrimary: true,
            },
          },
        },
        select: { id: true, nis: true, fullName: true, birthDate: true },
      });

      // Akun login siswa baru (username = NIS, password awal = tanggal lahir).
      // Dibuat DI DALAM transaksi yang sama supaya siswa yang jadi tidak
      // pernah tertinggal tanpa akun.
      const akun = await buatAkunSiswa(tx, {
        studentId: created.id,
        schoolId,
        nis: created.nis,
        nama: created.fullName,
        tanggalLahir: created.birthDate,
        slugSekolah,
      });

      // Tandai pendaftaran sudah dikonversi — penanda idempotensi.
      await tx.registration.update({
        where: { id: registration.id },
        data: { studentId: created.id },
      });

      // Tagihan daftar ulang dibuat DI SINI, bukan saat pendaftar diterima.
      //
      // Alasannya teknis: `Invoice` wajib terhubung ke `Student`, sedangkan
      // pendaftar baru menjadi siswa setelah baris ini. Nominalnya sudah
      // disimpan di `Registration.reRegistrationFee` sejak panitia memutuskan,
      // jadi angkanya tidak hilang di antara dua momen itu.
      //
      // Nominal 0 berarti sekolah tidak memungut daftar ulang — tidak dibuatkan
      // tagihan kosong, karena tagihan bernilai nol hanya membingungkan
      // bendahara saat menagih.
      if (registration.reRegistrationFee && registration.reRegistrationFee > 0) {
        // Nomor tagihan dihitung dari jumlah tagihan sekolah ini + 1. Sama
        // seperti modul keuangan; `invoiceNo` unik global, jadi nomor yang
        // bentrok akan ditolak database dan ditangani blok catch di bawah.
        const seq = (await tx.invoice.count({ where: { schoolId } })) + 1;
        await tx.invoice.create({
          data: {
            schoolId,
            studentId: created.id,
            invoiceNo: buildInvoiceNumber("INV", new Date(), seq),
            title: `Daftar ulang — ${registration.fullName}`,
            // Jatuh tempo 14 hari: cukup longgar untuk orang tua mengurus
            // administrasi, tetapi tetap punya tenggat yang jelas.
            dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            status: "UNPAID",
            totalAmount: registration.reRegistrationFee,
            paidAmount: 0,
            items: {
              create: {
                description: "Daftar ulang penerimaan murid baru",
                amount: registration.reRegistrationFee,
                quantity: 1,
              },
            },
          },
        });
      }

      return created;
    });

    await recordAudit({
      schoolId,
      userId: ctx.userId,
      action: "CREATE",
      entity: "Student",
      entityId: student.id,
      after: { fullName: registration.fullName, nis, fromRegistration: registration.id },
      ...meta,
    });

    revalidatePath("/dashboard/students");
    revalidatePath("/dashboard/spmb/registrations");
    return {
      ok: true,
      id: student.id,
      message: `${registration.fullName} kini terdaftar sebagai siswa.`,
    };
  } catch (error) {
    return {
      ok: false,
      error: `Gagal membuat data siswa: ${error instanceof Error ? error.message : "tidak diketahui"}`,
    };
  }
}

// Re-export tipe agar bisa dipakai di form client tanpa impor ulang.
export type { ActionResult };
