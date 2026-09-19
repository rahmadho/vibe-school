"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { guard, requestMeta, flattenZodErrors } from "@/lib/action-guard";
import type { ActionResult } from "@/lib/action-result";
import {
  BLOCK_PROPS_SCHEMAS,
  navigationCreateSchema,
  navigationUpdateSchema,
  pageCreateSchema,
  pageUpdateSchema,
  saveLayoutSchema,
  siteConfigSchema,
  themeSchema,
  applyPresetLayoutSchema,
} from "@/lib/validations/site";
import {
  ACADEMIC_HOMEPAGE_LAYOUT,
  DEFAULT_HOMEPAGE_LAYOUT,
  buildInitialLayout,
  getBlock,
  variantBelongsToBlock,
} from "@/lib/site-blocks";
import { checkThemeSafety } from "@/lib/site-themes";
import { explainSlugProblem } from "@/lib/site-host";

/**
 * Actions untuk mengelola tampilan web sekolah.
 *
 * Semua aksi di sini menyentuh "wajah" sekolah di internet, jadi:
 *  - butuh izin modul `website`
 *  - dicatat ke AuditLog
 *  - halaman publik di-revalidate agar perubahan langsung terlihat
 */

/** Segarkan semua halaman publik setelah perubahan tampilan. */
function revalidateSite() {
  // Layout publik di-cache; tanpa ini operator menyimpan lalu tidak melihat
  // perubahan dan mengira aplikasinya rusak.
  revalidatePath("/", "layout");
}

/* ============================================================
 * SUSUNAN BLOK HALAMAN DEPAN
 * ============================================================ */

/**
 * Simpan seluruh susunan blok sekaligus.
 *
 * Mengapa sekaligus, bukan satu per satu: operator menyusun dengan menggeser
 * urutan. Bila dikirim satu-satu dan jaringan putus di tengah, urutannya bisa
 * setengah jadi. Satu permintaan = satu perubahan utuh.
 */
export async function saveHomepageLayout(formData: FormData): Promise<ActionResult> {
  const g = await guard("website", "manage");
  if ("fail" in g) return g.fail;
  const ctx = g.ctx;
  const meta = await requestMeta();

  const parsed = fromForm(saveLayoutSchema, formData);
  if (parsed.status === "error") return parsed.fail;

  const { schoolId } = ctx;

  try {
    await prisma.$transaction(async (tx) => {
      const incoming = parsed.data.blocks;

      // Blok yang tidak lagi dikirim = sekolah menghapusnya dari halaman depan.
      await tx.siteBlock.deleteMany({
        where: {
          schoolId,
          blockKey: { notIn: incoming.map((b) => b.blockKey) },
        },
      });

      for (const b of incoming) {
        const isEnabled = b.isEnabled === undefined ? true : Boolean(b.isEnabled);
        await tx.siteBlock.upsert({
          where: { schoolId_blockKey: { schoolId, blockKey: b.blockKey } },
          create: {
            schoolId,
            blockKey: b.blockKey,
            variantKey: b.variantKey,
            order: b.order,
            isEnabled,
            props: BLOCK_PROPS_SCHEMAS[b.blockKey]?.parse({}) ?? {},
          },
          update: {
            variantKey: b.variantKey,
            order: b.order,
            isEnabled,
          },
        });
      }
    });

    await recordAudit({
      schoolId,
      userId: ctx.userId,
      action: "UPDATE",
      entity: "SiteBlock",
      entityId: schoolId,
      ...meta,
    });

    revalidateSite();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: `Gagal menyimpan susunan: ${error instanceof Error ? error.message : "tidak diketahui"}`,
    };
  }
}

/** Simpan isi (props) satu blok. */
export async function saveBlockProps(formData: FormData): Promise<ActionResult> {
  const g = await guard("website", "manage");
  if ("fail" in g) return g.fail;
  const ctx = g.ctx;
  const meta = await requestMeta();

  const { schoolId } = ctx;
  const blockKey = String(formData.get("blockKey") ?? "");
  const definition = getBlock(blockKey);
  if (!definition) return { ok: false, error: "Jenis blok tidak dikenal." };

  // Kumpulkan HANYA field yang dikenal blok ini. Field asing diabaikan diam-diam
  // supaya perubahan bentuk form di masa depan tidak merusak data lama.
  const raw: Record<string, unknown> = {};
  for (const field of definition.fields) {
    if (!formData.has(field)) continue;
    const value = formData.get(field);

    // Checkbox: HTML hanya mengirim "on" saat dicentang.
    if (field.startsWith("show") || field === "isEnabled") {
      raw[field] = value === "on" || value === "true";
      continue;
    }
    raw[field] = value;
  }

  // Field berulang (items[k][label] / items[k][value]) untuk stats & faq.
  const items = collectRepeatedItems(formData, blockKey);
  if (items !== undefined) raw.items = items;

  const schema = BLOCK_PROPS_SCHEMAS[blockKey];
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Periksa kembali isian blok.",
      fieldErrors: flattenZodErrors(parsed.error),
    };
  }

  const existing = await prisma.siteBlock.findUnique({
    where: { schoolId_blockKey: { schoolId, blockKey } },
  });

  try {
    await prisma.siteBlock.upsert({
      where: { schoolId_blockKey: { schoolId, blockKey } },
      create: {
        schoolId,
        blockKey,
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
      action: existing ? "UPDATE" : "CREATE",
      entity: "SiteBlock",
      entityId: blockKey,
      ...meta,
    });

    revalidateSite();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: `Gagal menyimpan isi blok: ${error instanceof Error ? error.message : "tidak diketahui"}`,
    };
  }
}

/**
 * Kumpulkan item berulang dari form (untuk blok `stats` dan `faq`).
 *
 * Form mengirim `itemLabel[]` dan `itemValue[]` (atau `itemQuestion[]` /
 * `itemAnswer[]`). Pasangan kosong dibuang supaya operator bisa menambah baris
 * lalu mengosongkannya tanpa menghasilkan entri kosong.
 */
function collectRepeatedItems(
  formData: FormData,
  blockKey: string,
): unknown[] | undefined {
  if (blockKey === "stats") {
    const labels = formData.getAll("itemLabel").map(String);
    const values = formData.getAll("itemValue").map(String);
    return labels
      .map((label, i) => ({ label: label.trim(), value: (values[i] ?? "").trim() }))
      .filter((it) => it.label.length > 0 && it.value.length > 0);
  }

  if (blockKey === "faq") {
    const questions = formData.getAll("itemQuestion").map(String);
    const answers = formData.getAll("itemAnswer").map(String);
    return questions
      .map((question, i) => ({
        question: question.trim(),
        answer: (answers[i] ?? "").trim(),
      }))
      .filter((it) => it.question.length > 0 && it.answer.length > 0);
  }

  return undefined;
}

/** Terapkan susunan awal siap pakai (satu klik untuk sekolah baru). */
export async function applyPresetLayout(formData: FormData): Promise<ActionResult> {
  const g = await guard("website", "manage");
  if ("fail" in g) return g.fail;
  const ctx = g.ctx;
  const meta = await requestMeta();

  const parsed = fromForm(applyPresetLayoutSchema, formData);
  if (parsed.status === "error") return parsed.fail;

  const { schoolId } = ctx;
  const template =
    parsed.data.preset === "ACADEMIC" ? ACADEMIC_HOMEPAGE_LAYOUT : DEFAULT_HOMEPAGE_LAYOUT;
  const layout = buildInitialLayout(template);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.siteBlock.deleteMany({ where: { schoolId } });
      for (const b of layout) {
        await tx.siteBlock.create({
          data: {
            schoolId,
            blockKey: b.blockKey,
            variantKey: b.variantKey,
            order: b.order,
            isEnabled: true,
            props: b.props as object,
          },
        });
      }
    });

    await recordAudit({
      schoolId,
      userId: ctx.userId,
      action: "UPDATE",
      entity: "SiteBlock",
      entityId: schoolId,
      ...meta,
    });

    revalidateSite();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: `Gagal menerapkan susunan: ${error instanceof Error ? error.message : "tidak diketahui"}`,
    };
  }
}

/* ============================================================
 * HALAMAN KUSTOM
 * ============================================================ */

export async function createPage(formData: FormData): Promise<ActionResult> {
  const g = await guard("website", "manage");
  if ("fail" in g) return g.fail;
  const ctx = g.ctx;
  const meta = await requestMeta();

  const parsed = fromForm(pageCreateSchema, formData);
  if (parsed.status === "error") return parsed.fail;

  const { schoolId } = ctx;
  const slug = parsed.data.slug.toLowerCase();

  // Slug "spmb" dan "berita" dipakai fitur bawaan — mencegah sekolah menimpanya.
  if (["spmb", "berita", "agenda", "galeri"].includes(slug)) {
    return {
      ok: false,
      error: `Alamat "${slug}" dipakai sistem. Pilih alamat lain.`,
    };
  }

  const problem = explainSlugProblem(slug);
  if (problem) return { ok: false, error: problem };

  const duplicate = await prisma.page.findFirst({
    where: { schoolId, slug, deletedAt: null },
  });
  if (duplicate) return { ok: false, error: `Halaman dengan alamat "${slug}" sudah ada.` };

  try {
    const page = await prisma.page.create({
      data: {
        schoolId,
        title: parsed.data.title,
        slug,
        content: parsed.data.content,
        showInNav: parsed.data.showInNav,
        isPublished: parsed.data.isPublished,
        publishedAt: parsed.data.isPublished ? new Date() : null,
        metaTitle: parsed.data.metaTitle || null,
        metaDescription: parsed.data.metaDescription || null,
      },
    });

    await recordAudit({
      schoolId,
      userId: ctx.userId,
      action: "CREATE",
      entity: "Page",
      entityId: page.id,
      ...meta,
    });

    revalidateSite();
    return { ok: true, id: page.id };
  } catch (error) {
    return {
      ok: false,
      error: `Gagal membuat halaman: ${error instanceof Error ? error.message : "tidak diketahui"}`,
    };
  }
}

export async function updatePage(formData: FormData): Promise<ActionResult> {
  const g = await guard("website", "manage");
  if ("fail" in g) return g.fail;
  const ctx = g.ctx;
  const meta = await requestMeta();

  const parsed = fromForm(pageUpdateSchema, formData);
  if (parsed.status === "error") return parsed.fail;

  const { schoolId } = ctx;
  const existing = await prisma.page.findFirst({
    where: { id: parsed.data.id, schoolId, deletedAt: null },
  });
  if (!existing) return { ok: false, error: "Halaman tidak ditemukan." };

  const slug = parsed.data.slug.toLowerCase();
  const problem = explainSlugProblem(slug);
  if (problem) return { ok: false, error: problem };

  const duplicate = await prisma.page.findFirst({
    where: { schoolId, slug, deletedAt: null, id: { not: parsed.data.id } },
  });
  if (duplicate) return { ok: false, error: `Halaman dengan alamat "${slug}" sudah ada.` };

  try {
    await prisma.page.update({
      where: { id: parsed.data.id },
      data: {
        title: parsed.data.title,
        slug,
        content: parsed.data.content,
        showInNav: parsed.data.showInNav,
        isPublished: parsed.data.isPublished,
        // Tanggal terbit diisi sekali saja saat pertama kali diterbitkan.
        publishedAt:
          parsed.data.isPublished && !existing.publishedAt ? new Date() : existing.publishedAt,
        metaTitle: parsed.data.metaTitle || null,
        metaDescription: parsed.data.metaDescription || null,
      },
    });

    await recordAudit({
      schoolId,
      userId: ctx.userId,
      action: "UPDATE",
      entity: "Page",
      entityId: parsed.data.id,
      ...meta,
    });

    revalidateSite();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: `Gagal memperbarui halaman: ${error instanceof Error ? error.message : "tidak diketahui"}`,
    };
  }
}

/** Soft delete — halaman bisa dipulihkan bila terhapus karena salah klik. */
export async function deletePage(formData: FormData): Promise<ActionResult> {
  const g = await guard("website", "manage");
  if ("fail" in g) return g.fail;
  const ctx = g.ctx;
  const meta = await requestMeta();

  const { schoolId } = ctx;
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "Halaman tidak dikenal." };

  const page = await prisma.page.findFirst({ where: { id, schoolId, deletedAt: null } });
  if (!page) return { ok: false, error: "Halaman tidak ditemukan." };

  try {
    await prisma.page.update({ where: { id }, data: { deletedAt: new Date() } });

    await recordAudit({
      schoolId,
      userId: ctx.userId,
      action: "DELETE",
      entity: "Page",
      entityId: id,
      ...meta,
    });

    revalidateSite();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: `Gagal menghapus halaman: ${error instanceof Error ? error.message : "tidak diketahui"}`,
    };
  }
}

/* ============================================================
 * MENU NAVIGASI
 * ============================================================ */

export async function createNavItem(formData: FormData): Promise<ActionResult> {
  const g = await guard("website", "manage");
  if ("fail" in g) return g.fail;
  const ctx = g.ctx;
  const meta = await requestMeta();

  const parsed = fromForm(navigationCreateSchema, formData);
  if (parsed.status === "error") return parsed.fail;

  const { schoolId } = ctx;

  try {
    const item = await prisma.navigationItem.create({
      data: {
        schoolId,
        label: parsed.data.label,
        href: parsed.data.href,
        area: parsed.data.area,
        order: parsed.data.order,
        isExternal: parsed.data.isExternal || /^https?:\/\//i.test(parsed.data.href),
        onlyIfSpmb: parsed.data.onlyIfSpmb,
      },
    });

    await recordAudit({
      schoolId,
      userId: ctx.userId,
      action: "CREATE",
      entity: "NavigationItem",
      entityId: item.id,
      ...meta,
    });

    revalidateSite();
    return { ok: true, id: item.id };
  } catch (error) {
    return {
      ok: false,
      error: `Gagal menambah menu: ${error instanceof Error ? error.message : "tidak diketahui"}`,
    };
  }
}

export async function updateNavItem(formData: FormData): Promise<ActionResult> {
  const g = await guard("website", "manage");
  if ("fail" in g) return g.fail;
  const ctx = g.ctx;
  const meta = await requestMeta();

  const parsed = fromForm(navigationUpdateSchema, formData);
  if (parsed.status === "error") return parsed.fail;

  const { schoolId } = ctx;
  const existing = await prisma.navigationItem.findFirst({
    where: { id: parsed.data.id, schoolId },
  });
  if (!existing) return { ok: false, error: "Menu tidak ditemukan." };

  try {
    await prisma.navigationItem.update({
      where: { id: parsed.data.id },
      data: {
        label: parsed.data.label,
        href: parsed.data.href,
        area: parsed.data.area,
        order: parsed.data.order,
        isExternal: parsed.data.isExternal || /^https?:\/\//i.test(parsed.data.href),
        onlyIfSpmb: parsed.data.onlyIfSpmb,
      },
    });

    await recordAudit({
      schoolId,
      userId: ctx.userId,
      action: "UPDATE",
      entity: "NavigationItem",
      entityId: parsed.data.id,
      ...meta,
    });

    revalidateSite();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: `Gagal memperbarui menu: ${error instanceof Error ? error.message : "tidak diketahui"}`,
    };
  }
}

/**
 * Geser menu naik/turun satu langkah.
 *
 * Sengaja TOMBOL, bukan geser-lepas: operator sekolah sering memakai ponsel,
 * dan geser-lepas rapuh di layar sentuh. Naik/turun bekerja di mana saja.
 */
export async function moveNavItem(formData: FormData): Promise<ActionResult> {
  const g = await guard("website", "manage");
  if ("fail" in g) return g.fail;
  const ctx = g.ctx;

  const { schoolId } = ctx;
  const id = String(formData.get("id") ?? "");
  const direction = String(formData.get("direction") ?? "");
  if (!id || !["up", "down"].includes(direction)) {
    return { ok: false, error: "Permintaan tidak sah." };
  }

  const items = await prisma.navigationItem.findMany({
    where: { schoolId },
    orderBy: [{ area: "asc" }, { order: "asc" }],
  });

  const current = items.find((i) => i.id === id);
  if (!current) return { ok: false, error: "Menu tidak ditemukan." };

  const sameArea = items.filter((i) => i.area === current.area);
  const idx = sameArea.findIndex((i) => i.id === id);
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;

  // Sudah di ujung — bukan galat, hanya tidak ada yang berubah.
  if (swapIdx < 0 || swapIdx >= sameArea.length) return { ok: true };

  const other = sameArea[swapIdx];

  try {
    // Tukar nilai `order`; tulis ulang seluruh area agar urutannya rapat 0..n-1.
    await prisma.$transaction(async (tx) => {
      await tx.navigationItem.update({
        where: { id: current.id },
        data: { order: swapIdx },
      });
      await tx.navigationItem.update({
        where: { id: other.id },
        data: { order: idx },
      });

      // Rapikan bila ada celah.
      const refreshed = await tx.navigationItem.findMany({
        where: { schoolId, area: current.area },
        orderBy: [{ order: "asc" }],
      });
      for (let i = 0; i < refreshed.length; i++) {
        if (refreshed[i].order !== i) {
          await tx.navigationItem.update({
            where: { id: refreshed[i].id },
            data: { order: i },
          });
        }
      }
    });

    revalidateSite();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: `Gagal memindahkan menu: ${error instanceof Error ? error.message : "tidak diketahui"}`,
    };
  }
}

export async function deleteNavItem(formData: FormData): Promise<ActionResult> {
  const g = await guard("website", "manage");
  if ("fail" in g) return g.fail;
  const ctx = g.ctx;
  const meta = await requestMeta();

  const { schoolId } = ctx;
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "Menu tidak dikenal." };

  const item = await prisma.navigationItem.findFirst({ where: { id, schoolId } });
  if (!item) return { ok: false, error: "Menu tidak ditemukan." };

  try {
    await prisma.navigationItem.delete({ where: { id } });

    await recordAudit({
      schoolId,
      userId: ctx.userId,
      action: "DELETE",
      entity: "NavigationItem",
      entityId: id,
      ...meta,
    });

    revalidateSite();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: `Gagal menghapus menu: ${error instanceof Error ? error.message : "tidak diketahui"}`,
    };
  }
}

/* ============================================================
 * TEMA & PENGATURAN SITUS
 * ============================================================ */

export async function saveTheme(formData: FormData): Promise<ActionResult> {
  const g = await guard("website", "manage");
  if ("fail" in g) return g.fail;
  const ctx = g.ctx;
  const meta = await requestMeta();

  const parsed = fromForm(themeSchema, formData);
  if (parsed.status === "error") return parsed.fail;

  const { schoolId } = ctx;
  const d = parsed.data;

  // Nilai kosong = pakai warna preset (bukan dianggap salah).
  const primaryColor = d.primaryColor?.trim() ? normalizeHex(d.primaryColor) : null;
  const accentColor = d.accentColor?.trim() ? normalizeHex(d.accentColor) : null;

  // Periksa kontras. Peringatan TIDAK memblokir — sekolah tetap boleh
  // menyimpan, tetapi diberi tahu agar bisa memutuskan sendiri.
  const safety = checkThemeSafety({
    preset: d.preset,
    primaryColor: primaryColor,
    accentColor: accentColor,
  });

  try {
    await prisma.siteTheme.upsert({
      where: { schoolId },
      create: {
        schoolId,
        preset: d.preset,
        primaryColor,
        accentColor,
        headingFont: d.headingFont,
        bodyFont: d.bodyFont,
        cornerStyle: d.cornerStyle,
      },
      update: {
        preset: d.preset,
        primaryColor,
        accentColor,
        headingFont: d.headingFont,
        bodyFont: d.bodyFont,
        cornerStyle: d.cornerStyle,
      },
    });

    await recordAudit({
      schoolId,
      userId: ctx.userId,
      action: "UPDATE",
      entity: "SiteTheme",
      entityId: schoolId,
      ...meta,
    });

    revalidateSite();

    // Kembalikan peringatan agar UI bisa menampilkannya setelah simpan.
    const warning = safety.find((s) => s.severity === "warning");
    return { ok: true, message: warning?.message };
  } catch (error) {
    return {
      ok: false,
      error: `Gagal menyimpan tema: ${error instanceof Error ? error.message : "tidak diketahui"}`,
    };
  }
}

/** Tambahkan "#" bila hilang dan normalkan ke huruf besar. */
function normalizeHex(hex: string): string {
  const h = hex.trim();
  return (h.startsWith("#") ? h : `#${h}`).toUpperCase();
}

export async function saveSiteConfig(formData: FormData): Promise<ActionResult> {
  const g = await guard("website", "manage");
  if ("fail" in g) return g.fail;
  const ctx = g.ctx;
  const meta = await requestMeta();

  const parsed = fromForm(siteConfigSchema, formData);
  if (parsed.status === "error") return parsed.fail;

  const { schoolId } = ctx;
  const d = parsed.data;

  // Nomor WA humas: normalisasi ke format yang dipakai wa.me (tanpa + dan
  // tanpa 0 di depan), supaya tautannya langsung bekerja.
  const contactWa = d.contactWa ? normalizeWaNumber(d.contactWa) : null;

  const data = {
    tagline: d.tagline || null,
    shortDescription: d.shortDescription || null,
    homepageMode: d.homepageMode,
    beritaUrl: d.beritaUrl || null,
    contactWa,
    facebookUrl: d.facebookUrl || null,
    instagramUrl: d.instagramUrl || null,
    youtubeUrl: d.youtubeUrl || null,
    tiktokUrl: d.tiktokUrl || null,
    mapsUrl: d.mapsUrl || null,
    officeHours: d.officeHours || null,
  };

  try {
    await prisma.siteConfig.upsert({
      where: { schoolId },
      create: { schoolId, ...data },
      update: data,
    });

    await recordAudit({
      schoolId,
      userId: ctx.userId,
      action: "UPDATE",
      entity: "SiteConfig",
      entityId: schoolId,
      ...meta,
    });

    revalidateSite();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: `Gagal menyimpan pengaturan: ${error instanceof Error ? error.message : "tidak diketahui"}`,
    };
  }
}

/**
 * Normalisasi nomor WhatsApp ke bentuk yang diterima wa.me.
 * "0812-3456-7890" → "628123456789"
 */
function normalizeWaNumber(input: string): string {
  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = `62${digits.slice(1)}`;
  else if (digits.startsWith("8")) digits = `62${digits}`;
  return digits;
}

/* ============================================================
 * PENGATURAN SUBDOMAIN
 * ============================================================ */

/**
 * Ubah alamat subdomain sekolah.
 *
 * Alamat web adalah identitas publik sekolah — mengubahnya berarti semua
 * tautan lama mati. Ini diperingatkan di UI, bukan dilarang, karena sekolah
 * baru sering perlu memperbaiki alamat yang salah ketik di awal.
 */
export async function updateSchoolSlug(formData: FormData): Promise<ActionResult> {
  const g = await guard("website", "manage");
  if ("fail" in g) return g.fail;
  const ctx = g.ctx;
  const meta = await requestMeta();

  const { schoolId } = ctx;
  const raw = String(formData.get("slug") ?? "").trim().toLowerCase();

  const problem = explainSlugProblem(raw);
  if (problem) return { ok: false, error: problem };

  const taken = await prisma.school.findFirst({
    where: { slug: raw, id: { not: schoolId }, deletedAt: null },
  });
  if (taken) return { ok: false, error: `Alamat "${raw}" sudah dipakai sekolah lain.` };

  const current = await prisma.school.findUnique({ where: { id: schoolId } });
  if (!current) return { ok: false, error: "Sekolah tidak ditemukan." };
  if (current.slug === raw) return { ok: true };

  try {
    await prisma.school.update({ where: { id: schoolId }, data: { slug: raw } });

    await recordAudit({
      schoolId,
      userId: ctx.userId,
      action: "UPDATE",
      entity: "School",
      entityId: schoolId,
      ...meta,
    });

    revalidateSite();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: `Gagal mengubah alamat web: ${error instanceof Error ? error.message : "tidak diketahui"}`,
    };
  }
}

/* ============================================================
 * HELPER VALIDASI FORM
 * ============================================================ */

/**
 * Ubah FormData menjadi hasil Zod dengan pola yang dipakai seluruh aplikasi:
 * ambil field satu per satu (bukan menyebar seluruh FormData) supaya hanya
 * field yang dikenal skema yang masuk.
 *
 * Mengembalikan `{ ok: true, data }` atau `{ ok: false, fail }` dalam bentuk
 * ActionResult, sehingga pemanggil cukup `if (parsed.status === "error") return parsed.fail;`.
 */
function fromForm<T extends z.ZodTypeAny>(
  schema: T,
  formData: FormData,
):
  | { status: "ok"; data: z.infer<T> }
  | { status: "error"; fail: ActionResult } {
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
