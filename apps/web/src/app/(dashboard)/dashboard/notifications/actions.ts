"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { guard, requestMeta, flattenZodErrors, formDataArray } from "@/lib/action-guard";
import type { ActionResult } from "@/lib/action-result";
import {
  templateCreateSchema,
  templateUpdateSchema,
  announcementSchema,
  importSeedSchema,
  testSendSchema,
} from "@/lib/validations/notification";
import { TEMPLATE_SEEDS } from "@/lib/templates-seed";
import {
  cleanMessage,
  clampMessage,
  normalizePhone,
  uniqueRecipients,
  nextSendTime,
  MAX_ATTEMPTS,
} from "@/lib/notification";
import { resolveAudience } from "@/lib/data/notifications";

/**
 * Server actions Notifikasi.
 *
 * PRINSIP PALING PENTING (aturan AGENTS.md #9): JANGAN kirim WA langsung di
 * request handler. Semua pesan masuk ke `NotificationQueue`; worker di
 * wa-gateway yang mengirim. Kalau tidak, permintaan HTTP akan menggantung
 * menunggu WhatsApp dan gagal saat jaringan sekolah buruk.
 */

/* ============================================================
 * TEMPLATE
 * ============================================================ */

export async function createTemplate(formData: FormData): Promise<ActionResult> {
  const g = await guard("notifications", "manage");
  if ("fail" in g) return g.fail;
  const schoolId = g.ctx.schoolId;

  const parsed = templateCreateSchema.safeParse({
    key: formData.get("key"),
    name: formData.get("name"),
    category: formData.get("category"),
    body: formData.get("body"),
    description: formData.get("description") ?? undefined,
    isActive: formData.get("isActive") ?? undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: "Periksa kembali isian.", fieldErrors: flattenZodErrors(parsed.error) };
  }
  const d = parsed.data;

  const dup = await prisma.messageTemplate.findFirst({
    where: { schoolId, key: d.key },
  });
  if (dup) return { ok: false, error: `Kunci "${d.key}" sudah dipakai.` };

  const meta = await requestMeta();
  const created = await prisma.messageTemplate.create({
    data: { schoolId, ...d, body: cleanMessage(d.body) },
  });

  await recordAudit({
    schoolId,
    userId: g.ctx.userId,
    action: "CREATE",
    entity: "MessageTemplate",
    entityId: created.id,
    after: { key: d.key, name: d.name, category: d.category },
    ...meta,
  });

  revalidatePath("/dashboard/notifications/templates");
  return { ok: true, message: `Template "${created.name}" dibuat.` };
}

export async function updateTemplate(formData: FormData): Promise<ActionResult> {
  const g = await guard("notifications", "manage");
  if ("fail" in g) return g.fail;
  const schoolId = g.ctx.schoolId;

  const parsed = templateUpdateSchema.safeParse({
    id: formData.get("id"),
    key: formData.get("key"),
    name: formData.get("name"),
    category: formData.get("category"),
    body: formData.get("body"),
    description: formData.get("description") ?? undefined,
    isActive: formData.get("isActive") ?? undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: "Periksa kembali isian.", fieldErrors: flattenZodErrors(parsed.error) };
  }
  const { id, ...data } = parsed.data;

  const existing = await prisma.messageTemplate.findFirst({ where: { id, schoolId } });
  if (!existing) return { ok: false, error: "Template tidak ditemukan." };

  const dup = await prisma.messageTemplate.findFirst({
    where: { schoolId, key: data.key, NOT: { id } },
  });
  if (dup) return { ok: false, error: `Kunci "${data.key}" sudah dipakai.` };

  const meta = await requestMeta();
  await prisma.messageTemplate.update({
    where: { id },
    data: { ...data, body: cleanMessage(data.body) },
  });

  await recordAudit({
    schoolId,
    userId: g.ctx.userId,
    action: "UPDATE",
    entity: "MessageTemplate",
    entityId: id,
    before: { key: existing.key, name: existing.name },
    after: { key: data.key, name: data.name },
    ...meta,
  });

  revalidatePath("/dashboard/notifications/templates");
  return { ok: true, message: "Template diperbarui." };
}

export async function deleteTemplate(id: string): Promise<ActionResult> {
  const g = await guard("notifications", "manage");
  if ("fail" in g) return g.fail;
  const schoolId = g.ctx.schoolId;

  const existing = await prisma.messageTemplate.findFirst({ where: { id, schoolId } });
  if (!existing) return { ok: false, error: "Template tidak ditemukan." };

  const meta = await requestMeta();
  await prisma.messageTemplate.delete({ where: { id } });
  await recordAudit({
    schoolId,
    userId: g.ctx.userId,
    action: "DELETE",
    entity: "MessageTemplate",
    entityId: id,
    before: { key: existing.key, name: existing.name },
    ...meta,
  });

  revalidatePath("/dashboard/notifications/templates");
  return { ok: true, message: `Template "${existing.name}" dihapus.` };
}

/** Impor template bawaan (yang belum ada, atau timpa bila diminta). */
export async function importSeedTemplates(formData: FormData): Promise<ActionResult> {
  const g = await guard("notifications", "manage");
  if ("fail" in g) return g.fail;
  const schoolId = g.ctx.schoolId;

  const parsed = importSeedSchema.safeParse({
    keys: formDataArray(formData, "keys"),
    overwrite: formData.get("overwrite") ?? undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: "Permintaan tidak valid." };
  }

  const wantKeys =
    parsed.data.keys.length > 0
      ? parsed.data.keys
      : TEMPLATE_SEEDS.map((t) => t.key);
  const seeds = TEMPLATE_SEEDS.filter((t) => wantKeys.includes(t.key));
  if (seeds.length === 0) return { ok: false, error: "Tidak ada template bawaan yang cocok." };

  const existing = await prisma.messageTemplate.findMany({
    where: { schoolId, key: { in: seeds.map((s) => s.key) } },
    select: { id: true, key: true },
  });
  const existingByKey = new Map(existing.map((e) => [e.key, e.id]));

  const meta = await requestMeta();
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const s of seeds) {
    const foundId = existingByKey.get(s.key);
    if (foundId) {
      if (!parsed.data.overwrite) {
        skipped += 1;
        continue;
      }
      await prisma.messageTemplate.update({
        where: { id: foundId },
        // Hanya isi pesan yang ditimpa — nama yang sudah diubah admin dipertahankan.
        data: { body: cleanMessage(s.body) },
      });
      updated += 1;
    } else {
      await prisma.messageTemplate.create({
        data: {
          schoolId,
          key: s.key,
          name: s.name,
          category: s.category,
          description: s.description,
          body: cleanMessage(s.body),
          isActive: true,
        },
      });
      created += 1;
    }
  }

  await recordAudit({
    schoolId,
    userId: g.ctx.userId,
    action: "CREATE",
    entity: "MessageTemplate",
    entityId: "seed-import",
    after: { created, updated, skipped },
    ...meta,
  });

  revalidatePath("/dashboard/notifications/templates");
  return {
    ok: true,
    message: `Impor selesai: ${created} baru, ${updated} ditimpa, ${skipped} dilewati.`,
  };
}

/* ============================================================
 * UJI COBA KIRIM
 * ============================================================ */

/**
 * Antrekan satu pesan uji ke nomor tertentu.
 * Tetap lewat antrean (bukan kirim langsung) supaya jalur uji sama dengan
 * jalur produksi — bug jadi ketahuan saat uji, bukan saat hari pertama sekolah.
 */
export async function sendTestMessage(formData: FormData): Promise<ActionResult> {
  const g = await guard("notifications", "manage");
  if ("fail" in g) return g.fail;
  const schoolId = g.ctx.schoolId;

  const parsed = testSendSchema.safeParse({
    phone: formData.get("phone"),
    body: formData.get("body"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Periksa kembali isian.", fieldErrors: flattenZodErrors(parsed.error) };
  }

  // Uji coba default "kirim sekarang": lewati jam wajar (07:00–20:00, tanpa
  // Minggu) agar admin tidak bingung pesan uji tertahan sampai besok pagi.
  // Tetap lewat antrean — worker yang mengirim, bukan request handler ini.
  const sendNow = formData.get("sendNow") != null;

  const phone = normalizePhone(parsed.data.phone);
  if (!phone) {
    return {
      ok: false,
      error:
        "Nomor tidak valid. Gunakan format Indonesia, mis. 081234567890 atau 6281234567890.",
    };
  }

  const meta = await requestMeta();
  const queued = await prisma.notificationQueue.create({
    data: {
      schoolId,
      to: phone,
      recipientName: "Pesan uji",
      body: clampMessage(cleanMessage(parsed.data.body)),
      status: "QUEUED",
      priority: 1, // uji coba didahulukan
      scheduledAt: sendNow ? new Date() : nextSendTime(),
      refType: "TEST",
    },
  });

  await recordAudit({
    schoolId,
    userId: g.ctx.userId,
    action: "CREATE",
    entity: "NotificationQueue",
    entityId: queued.id,
    after: { kind: "test", to: phone.slice(0, 6) + "…" },
    ...meta,
  });

  revalidatePath("/dashboard/notifications");
  return {
    ok: true,
    message: sendNow
      ? `Pesan uji diantrekan untuk ${phone} dan akan dikirim dalam beberapa detik. Pastikan WhatsApp sudah terhubung.`
      : `Pesan uji masuk antrean untuk ${phone} (menunggu jam kirim berikutnya 07:00–20:00). Pastikan WhatsApp sudah terhubung.`,
  };
}

/* ============================================================
 * PENGUMUMAN MASSAL
 * ============================================================ */

export async function sendAnnouncement(formData: FormData): Promise<ActionResult> {
  const g = await guard("notifications", "manage");
  if ("fail" in g) return g.fail;
  const schoolId = g.ctx.schoolId;

  const parsed = announcementSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body"),
    audienceType: formData.get("audienceType"),
    audienceClassId: formData.get("audienceClassId") ?? undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: "Periksa kembali isian.", fieldErrors: flattenZodErrors(parsed.error) };
  }
  const d = parsed.data;

  // Pastikan kelas milik sekolah ini (cegah kirim ke kelas sekolah lain).
  if (d.audienceClassId) {
    const cls = await prisma.class.findFirst({
      where: { id: d.audienceClassId, schoolId, deletedAt: null },
      select: { id: true },
    });
    if (!cls) return { ok: false, error: "Kelas tidak ditemukan di sekolah ini." };
  }

  const targets = await resolveAudience(schoolId, d.audienceType, d.audienceClassId);
  const recipients = uniqueRecipients(targets);
  if (recipients.length === 0) {
    return {
      ok: false,
      error:
        "Tidak ada penerima dengan nomor WA yang valid. Lengkapi nomor wali/guru terlebih dahulu.",
    };
  }

  const body = clampMessage(cleanMessage(d.body));
  const when = nextSendTime();
  const meta = await requestMeta();

  await prisma.$transaction(async (tx) => {
    // createMany jauh lebih cepat daripada loop create untuk ratusan penerima.
    await tx.notificationQueue.createMany({
      data: recipients.map((r) => ({
        schoolId,
        to: r.phone,
        recipientName: r.name || null,
        body,
        status: "QUEUED" as const,
        priority: 5,
        scheduledAt: when,
        refType: "ANNOUNCEMENT",
      })),
    });

    await tx.announcementCampaign.create({
      data: {
        schoolId,
        title: d.title,
        body,
        audienceType: d.audienceType,
        audienceClassId: d.audienceClassId ?? null,
        recipientCount: recipients.length,
        createdById: g.ctx.userId,
      },
    });
  });

  await recordAudit({
    schoolId,
    userId: g.ctx.userId,
    action: "CREATE",
    entity: "AnnouncementCampaign",
    entityId: d.title,
    after: {
      title: d.title,
      audienceType: d.audienceType,
      recipients: recipients.length,
      scheduledAt: when.toISOString(),
    },
    ...meta,
  });

  revalidatePath("/dashboard/notifications");
  revalidatePath("/dashboard/notifications/announcements");

  const skipped = targets.length - recipients.length;
  return {
    ok: true,
    message: `${recipients.length} pesan masuk antrean${
      skipped > 0 ? ` (${skipped} nomor tidak valid/duplikat dilewati)` : ""
    }.`,
  };
}

/* ============================================================
 * KELOLA ANTREAN
 * ============================================================ */

/** Kirim ulang pesan yang gagal. */
export async function retryMessage(id: string): Promise<ActionResult> {
  const g = await guard("notifications", "manage");
  if ("fail" in g) return g.fail;

  const row = await prisma.notificationQueue.findFirst({
    where: { id, schoolId: g.ctx.schoolId },
  });
  if (!row) return { ok: false, error: "Pesan tidak ditemukan." };
  if (row.status === "SENT") return { ok: false, error: "Pesan ini sudah terkirim." };
  if (row.status === "PROCESSING") {
    return { ok: false, error: "Pesan sedang diproses. Tunggu sebentar." };
  }

  const meta = await requestMeta();
  await prisma.notificationQueue.update({
    where: { id },
    data: {
      status: "QUEUED",
      attempts: 0, // kirim ulang manual = hitungan percobaan direset
      lastError: null,
      lockedAt: null,
      lockedBy: null,
      nextAttemptAt: null,
      // Kirim ulang manual = permintaan eksplisit admin: kirim sekarang,
      // jangan tunggu jam wajar (biar tidak terasa "nyangkut").
      scheduledAt: new Date(),
    },
  });

  await recordAudit({
    schoolId: g.ctx.schoolId,
    userId: g.ctx.userId,
    action: "UPDATE",
    entity: "NotificationQueue",
    entityId: id,
    after: { action: "retry", previousStatus: row.status, attempts: row.attempts },
    ...meta,
  });

  revalidatePath("/dashboard/notifications");
  return { ok: true, message: "Pesan dimasukkan kembali ke antrean." };
}

/** Batalkan pesan yang belum terkirim. */
export async function cancelMessage(id: string): Promise<ActionResult> {
  const g = await guard("notifications", "manage");
  if ("fail" in g) return g.fail;

  const row = await prisma.notificationQueue.findFirst({
    where: { id, schoolId: g.ctx.schoolId },
  });
  if (!row) return { ok: false, error: "Pesan tidak ditemukan." };
  if (row.status === "SENT") {
    return { ok: false, error: "Pesan sudah terkirim — tidak bisa dibatalkan." };
  }
  if (row.status === "PROCESSING") {
    return { ok: false, error: "Pesan sedang dikirim oleh worker." };
  }
  if (row.status === "CANCELLED") {
    return { ok: false, error: "Pesan sudah dibatalkan." };
  }

  const meta = await requestMeta();
  await prisma.notificationQueue.update({
    where: { id },
    data: { status: "CANCELLED" },
  });

  await recordAudit({
    schoolId: g.ctx.schoolId,
    userId: g.ctx.userId,
    action: "UPDATE",
    entity: "NotificationQueue",
    entityId: id,
    before: { status: row.status },
    after: { status: "CANCELLED" },
    ...meta,
  });

  revalidatePath("/dashboard/notifications");
  return { ok: true, message: "Pesan dibatalkan." };
}

/** Batalkan semua pesan yang masih mengantre (mis. salah kirim pengumuman). */
export async function cancelAllQueued(): Promise<ActionResult> {
  const g = await guard("notifications", "manage");
  if ("fail" in g) return g.fail;
  const schoolId = g.ctx.schoolId;

  const res = await prisma.notificationQueue.updateMany({
    where: { schoolId, status: "QUEUED" },
    data: { status: "CANCELLED" },
  });

  const meta = await requestMeta();
  await recordAudit({
    schoolId,
    userId: g.ctx.userId,
    action: "UPDATE",
    entity: "NotificationQueue",
    entityId: "bulk-cancel",
    after: { cancelled: res.count },
    ...meta,
  });

  revalidatePath("/dashboard/notifications");
  return { ok: true, message: `${res.count} pesan dalam antrean dibatalkan.` };
}

/** Kirim ulang semua pesan gagal (maksimum sekian agar tidak membanjiri). */
export async function retryAllFailed(limit = 100): Promise<ActionResult> {
  const g = await guard("notifications", "manage");
  if ("fail" in g) return g.fail;
  const schoolId = g.ctx.schoolId;

  const rows = await prisma.notificationQueue.findMany({
    where: { schoolId, status: "FAILED", attempts: { lt: MAX_ATTEMPTS } },
    select: { id: true },
    take: limit,
  });
  if (rows.length === 0) {
    return { ok: false, error: "Tidak ada pesan gagal yang masih bisa dicoba." };
  }

  await prisma.notificationQueue.updateMany({
    where: { id: { in: rows.map((r) => r.id) } },
    data: {
      status: "QUEUED",
      attempts: 0,
      lastError: null,
      lockedAt: null,
      lockedBy: null,
      nextAttemptAt: null,
      // Kirim ulang manual: kirim sekarang (lewati jam wajar).
      scheduledAt: new Date(),
    },
  });

  const meta = await requestMeta();
  await recordAudit({
    schoolId,
    userId: g.ctx.userId,
    action: "UPDATE",
    entity: "NotificationQueue",
    entityId: "bulk-retry",
    after: { retried: rows.length },
    ...meta,
  });

  revalidatePath("/dashboard/notifications");
  return { ok: true, message: `${rows.length} pesan gagal dimasukkan kembali ke antrean.` };
}
