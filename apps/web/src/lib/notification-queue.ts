import "server-only";
import { prisma } from "@/lib/prisma";
import {
  renderTemplate,
  cleanMessage,
  clampMessage,
  normalizePhone,
  nextSendTime,
} from "@/lib/notification";

/**
 * Jembatan notifikasi untuk modul lain (absensi, nilai, keuangan, SPMB).
 *
 * Kenapa terpisah dari actions.ts: file `"use server"` mengekspos SETIAP ekspor
 * sebagai endpoint HTTP. Fungsi internal seperti ini tidak boleh jadi endpoint —
 * ia tidak melakukan pemeriksaan izin sendiri dan bergantung pada pemanggil.
 *
 * Sifat penting: **tidak pernah melempar galat**. Notifikasi adalah fitur
 * tambahan; kalau WA gagal diantrekan (mis. template belum dibuat), aksi utama
 * (menyimpan absensi, mencatat pembayaran) harus tetap berhasil.
 */

export type QueueNotificationInput = {
  schoolId: string;
  /** Nomor tujuan; boleh kosong (akan dilewati). */
  to: string | null | undefined;
  recipientName?: string | null;
  templateKey: string;
  vars: Record<string, string | number | null | undefined>;
  refType?: string;
  refId?: string;
  priority?: number;
  /** Hormati jam wajar? Default ya. */
  respectSendWindow?: boolean;
};

/**
 * Antrekan satu notifikasi berbasis template.
 * @returns id baris antrean, atau null bila dilewati (nomor/template tidak ada).
 */
export async function queueNotification(
  input: QueueNotificationInput,
): Promise<string | null> {
  try {
    const phone = normalizePhone(input.to);
    if (!phone) return null;

    const tpl = await prisma.messageTemplate.findFirst({
      where: { schoolId: input.schoolId, key: input.templateKey, isActive: true },
      select: { body: true },
    });
    if (!tpl) return null;

    const school = await prisma.school.findUnique({
      where: { id: input.schoolId },
      select: { name: true },
    });

    const body = clampMessage(
      cleanMessage(
        renderTemplate(tpl.body, {
          nama_sekolah: school?.name ?? "",
          ...input.vars,
        }),
      ),
    );

    const row = await prisma.notificationQueue.create({
      data: {
        schoolId: input.schoolId,
        to: phone,
        recipientName: input.recipientName ?? null,
        templateKey: input.templateKey,
        body,
        status: "QUEUED",
        priority: input.priority ?? 5,
        scheduledAt:
          input.respectSendWindow === false ? new Date() : nextSendTime(),
        refType: input.refType ?? null,
        refId: input.refId ?? null,
      },
      select: { id: true },
    });

    return row.id;
  } catch {
    // Sengaja dibisukan: kegagalan notifikasi tidak boleh menggagalkan aksi utama.
    return null;
  }
}

/**
 * Antrekan notifikasi ke banyak penerima sekaligus.
 * Memakai satu query `createMany` agar tidak lambat untuk ratusan penerima.
 */
export async function queueNotificationBulk(input: {
  schoolId: string;
  recipients: { phone: string | null | undefined; name?: string | null }[];
  templateKey: string;
  varsToRecord?: Record<string, string | number | null | undefined>;
  body: string;
  refType?: string;
  refId?: string;
}): Promise<number> {
  try {
    const valid = input.recipients
      .map((r) => ({ ...r, phone: normalizePhone(r.phone) }))
      .filter((r): r is { phone: string; name?: string | null } => Boolean(r.phone));
    if (valid.length === 0) return 0;

    const body = clampMessage(cleanMessage(input.body));
    const when = nextSendTime();

    const res = await prisma.notificationQueue.createMany({
      data: valid.map((r) => ({
        schoolId: input.schoolId,
        to: r.phone,
        recipientName: r.name ?? null,
        templateKey: input.templateKey,
        body,
        status: "QUEUED" as const,
        priority: 5,
        scheduledAt: when,
        refType: input.refType ?? null,
        refId: input.refId ?? null,
      })),
    });
    return res.count;
  } catch {
    return 0;
  }
}
