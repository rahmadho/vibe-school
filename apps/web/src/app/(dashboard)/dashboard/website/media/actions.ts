"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { guard, requestMeta } from "@/lib/action-guard";
import type { ActionResult } from "@/lib/action-result";
import {
  MAX_IMAGE_BYTES,
  saveImage,
  sniffImageType,
  removeStoredUrl,
} from "@/lib/storage";
import { mediaUsage } from "@/lib/data/media";
import { readImageDimensions } from "@/lib/image-size";

/**
 * Server Actions pustaka media.
 *
 * Dua jalur masuk: UNGGAH berkas (disimpan di penyimpanan kita) dan TAUTKAN
 * alamat (berkas tetap di server orang lain). Keduanya berakhir sebagai baris
 * `Media` yang sama supaya daftarnya satu.
 */

/* ============================================================
 * UNGGAH BERKAS
 * ============================================================ */

export async function uploadMedia(formData: FormData): Promise<ActionResult> {
  const g = await guard("website", "manage");
  if ("fail" in g) return g.fail;
  const { schoolId, userId } = g.ctx;

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Pilih berkas gambar terlebih dahulu." };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return {
      ok: false,
      error: `Ukuran gambar maksimal ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)} MB.`,
    };
  }

  const buf = Buffer.from(await file.arrayBuffer());

  // Jenis ditentukan dari ISI berkas, bukan `file.type` yang bisa ditulis apa
  // saja oleh klien. SVG ditolak (lihat sniffImageType) — XML boleh memuat
  // <script>, dan berkas ini tampil di halaman publik sekolah.
  const type = sniffImageType(buf);
  if (!type) {
    return {
      ok: false,
      error: "Berkas harus berupa gambar PNG, JPEG, atau WEBP.",
    };
  }

  let stored;
  try {
    stored = await saveImage({ data: buf, prefix: `${schoolId}/media`, type });
  } catch (error) {
    return {
      ok: false,
      error: `Gagal menyimpan berkas: ${error instanceof Error ? error.message : "tidak diketahui"}`,
    };
  }

  const altText = String(formData.get("altText") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim() || file.name;

  // Dimensi dibaca dari header berkas (murni, tanpa pustaka). Null bila tidak
  // terbaca — itu bukan kegagalan unggah, hanya angkanya yang tidak tampil.
  const dims = readImageDimensions(buf);

  const meta = await requestMeta();
  try {
    const created = await prisma.media.create({
      data: {
        schoolId,
        name: name.slice(0, 160),
        url: stored.url,
        source: "UPLOAD",
        mimeType: type.contentType,
        size: buf.byteLength,
        width: dims?.width ?? null,
        height: dims?.height ?? null,
        altText: altText || null,
        uploadedById: userId,
      },
      select: { id: true },
    });

    await recordAudit({
      schoolId,
      userId,
      action: "CREATE",
      entity: "Media",
      entityId: created.id,
      after: { name, url: stored.url, source: "UPLOAD" },
      ...meta,
    });

    revalidatePath("/dashboard/website/media");
    return { ok: true, id: created.id, message: `${name} ditambahkan.` };
  } catch (error) {
    // Database gagal → buang berkas yang baru diunggah agar tidak menumpuk
    // tanpa ada baris yang menunjuknya.
    await removeStoredUrl(stored.url);
    return {
      ok: false,
      error: `Gagal mencatat berkas: ${error instanceof Error ? error.message : "tidak diketahui"}`,
    };
  }
}

/* ============================================================
 * TAUTKAN ALAMAT
 * ============================================================ */

export async function linkMedia(formData: FormData): Promise<ActionResult> {
  const g = await guard("website", "manage");
  if ("fail" in g) return g.fail;
  const { schoolId, userId } = g.ctx;

  const url = String(formData.get("url") ?? "").trim();
  if (!/^https?:\/\//i.test(url)) {
    return {
      ok: false,
      error: "Alamat harus lengkap dan diawali http:// atau https://",
      fieldErrors: { url: ["Alamat tidak valid"] },
    };
  }
  if (url.length > 500) {
    return { ok: false, error: "Alamat terlalu panjang." };
  }

  // Nama bawaan diambil dari alamat, tetapi segmen angka dan tanpa ekstensi
  // gambar dilewati — "picsum.photos/seed/x/800/600" berakhir "600" dan itu
  // tidak berguna sebagai nama.
  const name =
    String(formData.get("name") ?? "").trim() ||
    deriveNameFromUrl(url) ||
    "Tautan gambar";

  const altText = String(formData.get("altText") ?? "").trim();
  const meta = await requestMeta();

  try {
    const created = await prisma.media.create({
      data: {
        schoolId,
        name: name.slice(0, 160),
        url,
        source: "LINK",
        altText: altText || null,
        uploadedById: userId,
      },
      select: { id: true },
    });

    await recordAudit({
      schoolId,
      userId,
      action: "CREATE",
      entity: "Media",
      entityId: created.id,
      after: { name, url, source: "LINK" },
      ...meta,
    });

    revalidatePath("/dashboard/website/media");
    return { ok: true, id: created.id, message: `${name} ditautkan.` };
  } catch (error) {
    return {
      ok: false,
      error: `Gagal menyimpan tautan: ${error instanceof Error ? error.message : "tidak diketahui"}`,
    };
  }
}

/**
 * Susun nama berkas dari alamat.
 *
 * Mengembalikan "" bila tidak ada bagian yang berguna, supaya pemanggil bisa
 * memakai nama cadangan.
 */
function deriveNameFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const segments = u.pathname.split("/").filter(Boolean).reverse();
    for (const seg of segments) {
      // Lewati segmen angka murni ("800", "600") dan segmen tanpa ekstensi
      // gambar — keduanya bukan nama berkas yang bermakna.
      if (/^\d+$/.test(seg)) continue;
      if (!/\.(png|jpe?g|webp|gif|avif)$/i.test(seg)) continue;
      return `${u.hostname}-${seg}`.slice(0, 160);
    }
    return `${u.hostname}-gambar`;
  } catch {
    return "";
  }
}

/* ============================================================
 * UBAH & HAPUS
 * ============================================================ */

export async function updateMedia(formData: FormData): Promise<ActionResult> {
  const g = await guard("website", "manage");
  if ("fail" in g) return g.fail;
  const { schoolId, userId } = g.ctx;

  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "Berkas tidak dikenali." };

  const existing = await prisma.media.findFirst({
    where: { id, schoolId, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!existing) return { ok: false, error: "Berkas tidak ditemukan." };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return {
      ok: false,
      error: "Nama berkas wajib diisi.",
      fieldErrors: { name: ["Nama wajib diisi"] },
    };
  }

  const altText = String(formData.get("altText") ?? "").trim();
  const meta = await requestMeta();

  await prisma.media.update({
    where: { id },
    data: { name: name.slice(0, 160), altText: altText || null },
  });

  await recordAudit({
    schoolId,
    userId,
    action: "UPDATE",
    entity: "Media",
    entityId: id,
    before: { name: existing.name },
    after: { name, altText: altText || null },
    ...meta,
  });

  revalidatePath("/dashboard/website/media");
  return { ok: true, message: "Berkas diperbarui." };
}

/**
 * Hapus berkas dari pustaka.
 *
 * Berkas yang MASIH DIPAKAI ditolak: menghapusnya akan mematikan gambar di web
 * sekolah tanpa peringatan. Operator harus melepasnya dari berita/halaman dulu.
 */
export async function deleteMedia(id: string): Promise<ActionResult> {
  const g = await guard("website", "manage");
  if ("fail" in g) return g.fail;
  const { schoolId, userId } = g.ctx;

  const existing = await prisma.media.findFirst({
    where: { id, schoolId, deletedAt: null },
    select: { id: true, name: true, url: true, source: true },
  });
  if (!existing) return { ok: false, error: "Berkas tidak ditemukan." };

  const usage = await mediaUsage(schoolId, existing.url);
  if (usage.length > 0) {
    return {
      ok: false,
      error: `Berkas masih dipakai di: ${usage.join(", ")}. Lepas dulu dari sana sebelum menghapus.`,
    };
  }

  const meta = await requestMeta();
  // Soft delete: baris tetap ada agar riwayat & audit tidak kehilangan jejak.
  await prisma.media.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  // Berkas fisik hanya boleh dibuang untuk unggahan MILIK KITA. Tautan luar
  // bukan milik kita — menghapusnya akan mematikan gambar di tempat lain.
  if (existing.source === "UPLOAD") {
    await removeStoredUrl(existing.url);
  }

  await recordAudit({
    schoolId,
    userId,
    action: "DELETE",
    entity: "Media",
    entityId: id,
    before: { name: existing.name, url: existing.url, source: existing.source },
    ...meta,
  });

  revalidatePath("/dashboard/website/media");
  return { ok: true, message: `${existing.name} dihapus.` };
}

/** Hapus banyak berkas sekaligus. Yang masih dipakai dilewati, bukan digagalkan. */
export async function deleteMediaBulk(ids: string[]): Promise<ActionResult> {
  const g = await guard("website", "manage");
  if ("fail" in g) return g.fail;
  const { schoolId, userId } = g.ctx;

  if (!Array.isArray(ids) || ids.length === 0) {
    return { ok: false, error: "Tidak ada berkas yang dipilih." };
  }

  const rows = await prisma.media.findMany({
    where: { id: { in: ids }, schoolId, deletedAt: null },
    select: { id: true, name: true, url: true, source: true },
  });
  if (rows.length === 0) return { ok: false, error: "Berkas tidak ditemukan." };

  const meta = await requestMeta();

  let deleted = 0;
  const skipped: string[] = [];

  for (const row of rows) {
    const usage = await mediaUsage(schoolId, row.url);
    if (usage.length > 0) {
      skipped.push(row.name);
      continue;
    }
    await prisma.media.update({
      where: { id: row.id },
      data: { deletedAt: new Date() },
    });
    if (row.source === "UPLOAD") await removeStoredUrl(row.url);
    await recordAudit({
      schoolId,
      userId,
      action: "DELETE",
      entity: "Media",
      entityId: row.id,
      before: { name: row.name, url: row.url, source: row.source },
      ...meta,
    });
    deleted += 1;
  }

  revalidatePath("/dashboard/website/media");

  if (deleted === 0) {
    return {
      ok: false,
      error: `Semua berkas yang dipilih masih dipakai: ${skipped.join(", ")}.`,
    };
  }
  return {
    ok: true,
    message:
      skipped.length > 0
        ? `${deleted} berkas dihapus. Dilewati (masih dipakai): ${skipped.join(", ")}.`
        : `${deleted} berkas dihapus.`,
  };
}
