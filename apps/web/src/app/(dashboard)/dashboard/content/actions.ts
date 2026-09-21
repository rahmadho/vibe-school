"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { guard, requestMeta, flattenZodErrors } from "@/lib/action-guard";
import type { ActionResult } from "@/lib/action-result";
import { postCreateSchema, postUpdateSchema, POST_TYPES } from "@/lib/validations/site";
import { isSlugTaken } from "@/lib/data/content";
import { sanitizeRichText } from "@/lib/rich-text";

/**
 * ============================================================
 * Server Actions — Modul Konten
 * ============================================================
 *
 * Mengelola berita, pengumuman, agenda, dan galeri web sekolah.
 *
 * Aturan yang dipegang di semua aksi:
 *  - Izin modul `content` (role CONTENT_EDITOR punya "manage").
 *  - Setiap query DIFILTER `schoolId` dari sesi (AGENTS.md #1).
 *  - Perubahan penting dicatat ke AuditLog (AGENTS.md #5).
 *  - Hapus = soft delete via `deletedAt` (AGENTS.md #4) agar salah klik bisa
 *    dipulihkan — konten sekolah sering ditulis ulang, bukan dibuang permanen.
 *  - Halaman publik di-revalidate supaya perubahan langsung terlihat.
 */

/** Segarkan halaman publik setelah konten berubah. */
function revalidateContent() {
  // Layout publik di-cache; tanpa ini operator menyimpan lalu tidak melihat
  // perubahan dan mengira aplikasinya rusak.
  revalidatePath("/", "layout");
}

/* ============================================================
 * CREATE
 * ============================================================ */

export async function createPost(formData: FormData): Promise<ActionResult> {
  const g = await guard("content", "create");
  if ("fail" in g) return g.fail;
  const ctx = g.ctx;
  const meta = await requestMeta();

  const parsed = fromForm(postCreateSchema, formData);
  if (parsed.status === "error") return parsed.fail;

  const { schoolId } = ctx;
  const slug = parsed.data.slug.toLowerCase();

  if (await isSlugTaken(schoolId, slug)) {
    return { ok: false, error: `Alamat "${slug}" sudah dipakai tulisan lain.` };
  }

  // Agenda: tanggal kegiatan wajib agar tidak tampil tanpa kapan berlangsungnya.
  if (parsed.data.type === "AGENDA" && !parsed.data.eventDate) {
    return {
      ok: false,
      error: "Agenda wajib punya tanggal kegiatan.",
      fieldErrors: { eventDate: ["Tanggal kegiatan wajib diisi"] },
    };
  }

  try {
    const post = await prisma.post.create({
      data: {
        schoolId,
        title: parsed.data.title,
        slug,
        excerpt: parsed.data.excerpt ?? null,
        content: sanitizeRichText(parsed.data.content),
        coverUrl: parsed.data.coverUrl || null,
        type: parsed.data.type,
        isPublished: parsed.data.isPublished,
        publishedAt: resolvePublishedAt(parsed.data.isPublished, parsed.data.publishedAt),
        eventDate: parseDateOrNull(parsed.data.eventDate),
        eventLocation: parsed.data.eventLocation ?? null,
        authorId: ctx.userId,
      },
    });

    await recordAudit({
      schoolId,
      userId: ctx.userId,
      action: "CREATE",
      entity: "Post",
      entityId: post.id,
      after: { title: post.title, type: post.type, isPublished: post.isPublished },
      ...meta,
    });

    revalidateContent();
    return { ok: true, id: post.id };
  } catch (error) {
    return {
      ok: false,
      error: `Gagal menyimpan tulisan: ${error instanceof Error ? error.message : "tidak diketahui"}`,
    };
  }
}

/* ============================================================
 * UPDATE
 * ============================================================ */

export async function updatePost(formData: FormData): Promise<ActionResult> {
  const g = await guard("content", "update");
  if ("fail" in g) return g.fail;
  const ctx = g.ctx;
  const meta = await requestMeta();

  const parsed = fromForm(postUpdateSchema, formData);
  if (parsed.status === "error") return parsed.fail;

  const { schoolId } = ctx;
  const existing = await prisma.post.findFirst({
    where: { id: parsed.data.id, schoolId, deletedAt: null },
  });
  if (!existing) return { ok: false, error: "Tulisan tidak ditemukan." };

  const slug = parsed.data.slug.toLowerCase();
  if (await isSlugTaken(schoolId, slug, parsed.data.id)) {
    return { ok: false, error: `Alamat "${slug}" sudah dipakai tulisan lain.` };
  }

  if (parsed.data.type === "AGENDA" && !parsed.data.eventDate) {
    return {
      ok: false,
      error: "Agenda wajib punya tanggal kegiatan.",
      fieldErrors: { eventDate: ["Tanggal kegiatan wajib diisi"] },
    };
  }

  try {
    const post = await prisma.post.update({
      where: { id: parsed.data.id },
      data: {
        title: parsed.data.title,
        slug,
        excerpt: parsed.data.excerpt ?? null,
        content: sanitizeRichText(parsed.data.content),
        coverUrl: parsed.data.coverUrl || null,
        type: parsed.data.type,
        isPublished: parsed.data.isPublished,
        // Tanggal terbit diisi sekali saat pertama terbit; bila sekolah mengisi
        // jadwal terbit eksplisit, hormati nilai itu.
        publishedAt:
          parsed.data.publishedAt !== undefined && parsed.data.publishedAt !== ""
            ? parseDateOrNull(parsed.data.publishedAt)
            : parsed.data.isPublished
              ? (existing.publishedAt ?? new Date())
              : existing.publishedAt,
        eventDate: parseDateOrNull(parsed.data.eventDate),
        eventLocation: parsed.data.eventLocation ?? null,
      },
    });

    await recordAudit({
      schoolId,
      userId: ctx.userId,
      action: "UPDATE",
      entity: "Post",
      entityId: post.id,
      before: { title: existing.title, isPublished: existing.isPublished },
      after: { title: post.title, isPublished: post.isPublished },
      ...meta,
    });

    revalidateContent();
    return { ok: true, id: post.id };
  } catch (error) {
    return {
      ok: false,
      error: `Gagal memperbarui tulisan: ${error instanceof Error ? error.message : "tidak diketahui"}`,
    };
  }
}

/* ============================================================
 * DELETE (SOFT)
 * ============================================================ */

/** Soft delete — tulisan bisa dipulihkan bila terhapus karena salah klik. */
export async function deletePost(formData: FormData): Promise<ActionResult> {
  const g = await guard("content", "delete");
  if ("fail" in g) return g.fail;
  const ctx = g.ctx;
  const meta = await requestMeta();

  const { schoolId } = ctx;
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "Tulisan tidak dikenal." };

  const post = await prisma.post.findFirst({
    where: { id, schoolId, deletedAt: null },
  });
  if (!post) return { ok: false, error: "Tulisan tidak ditemukan." };

  try {
    await prisma.post.update({ where: { id }, data: { deletedAt: new Date() } });

    await recordAudit({
      schoolId,
      userId: ctx.userId,
      action: "DELETE",
      entity: "Post",
      entityId: id,
      before: { title: post.title, type: post.type },
      ...meta,
    });

    revalidateContent();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: `Gagal menghapus tulisan: ${error instanceof Error ? error.message : "tidak diketahui"}`,
    };
  }
}

/**
 * Ubah status terbit cepat dari daftar (tanpa membuka form lengkap).
 * Dibuat terpisah karena aksi ini paling sering dipakai: menulis draf lalu
 * menerbitkannya setelah siap.
 */
export async function togglePostPublished(formData: FormData): Promise<ActionResult> {
  const g = await guard("content", "update");
  if ("fail" in g) return g.fail;
  const ctx = g.ctx;
  const meta = await requestMeta();

  const { schoolId } = ctx;
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "Tulisan tidak dikenal." };

  const post = await prisma.post.findFirst({
    where: { id, schoolId, deletedAt: null },
  });
  if (!post) return { ok: false, error: "Tulisan tidak ditemukan." };

  const nextPublished = !post.isPublished;

  try {
    const updated = await prisma.post.update({
      where: { id },
      data: {
        isPublished: nextPublished,
        publishedAt: nextPublished ? (post.publishedAt ?? new Date()) : post.publishedAt,
      },
    });

    await recordAudit({
      schoolId,
      userId: ctx.userId,
      action: "UPDATE",
      entity: "Post",
      entityId: id,
      before: { isPublished: post.isPublished },
      after: { isPublished: updated.isPublished },
      ...meta,
    });

    revalidateContent();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: `Gagal mengubah status terbit: ${error instanceof Error ? error.message : "tidak diketahui"}`,
    };
  }
}

/* ============================================================
 * HELPER
 * ============================================================ */

/**
 * Tentukan tanggal terbit.
 * - Bila jadwal terbit eksplisit diisi → pakai itu (terbit terjadwal).
 * - Bila diterbitkan tanpa jadwal → sekarang.
 * - Draf → null.
 */
function resolvePublishedAt(
  isPublished: boolean,
  scheduled: string | undefined,
): Date | null {
  if (!isPublished) return null;
  return parseDateOrNull(scheduled) ?? new Date();
}

/** Ubah string tanggal dari form menjadi Date; kosong/invalid → null. */
function parseDateOrNull(value: string | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Ubah FormData menjadi hasil Zod dengan pola yang dipakai seluruh aplikasi:
 * ambil field satu per satu (bukan menyebar seluruh FormData) supaya hanya
 * field yang dikenal skema yang masuk.
 */
function fromForm<T extends z.ZodTypeAny>(
  schema: T,
  formData: FormData,
): { status: "ok"; data: z.infer<T> } | { status: "error"; fail: ActionResult } {
  const shape = (schema as unknown as { shape?: Record<string, unknown> }).shape ?? {};
  const raw: Record<string, unknown> = {};

  for (const key of Object.keys(shape)) {
    if (!formData.has(key)) continue;
    const value = formData.get(key);
    // Checkbox HTML hanya mengirim "on" saat dicentang.
    raw[key] = key.startsWith("is") || key.startsWith("show") ? value === "on" : value;
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      status: "error",
      fail: {
        ok: false,
        error: "Periksa kembali isian.",
        fieldErrors: flattenZodErrors(parsed.error),
      },
    };
  }
  return { status: "ok", data: parsed.data as z.infer<T> };
}

/** Nilai yang sah untuk dropdown jenis konten (dipakai UI). */
