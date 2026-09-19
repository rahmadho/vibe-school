"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { guard, requestMeta } from "@/lib/action-guard";
import type { ActionResult } from "@/lib/action-result";
import {
  startGatewaySession,
  stopGatewaySession,
  logoutGatewaySession,
  getGatewayQr,
  sessionNameFor,
} from "@/lib/gateway-web";

/**
 * Server actions untuk koneksi WhatsApp.
 *
 * Semua tindakan di sini menyentuh koneksi WhatsApp milik sekolah — karena itu
 * semuanya memerlukan izin `notifications:manage` dan dicatat di AuditLog.
 */

export type QrResult =
  | {
      ok: true;
      status: string;
      phoneNumber: string | null;
      qrDataUrl: string | null;
      lastError: string | null;
      lastSeenAt: string | null;
    }
  | { ok: false; error: string };

/** Mulai sesi (memicu QR bila belum pernah login). */
export async function connectWhatsapp(): Promise<ActionResult> {
  const g = await guard("notifications", "manage");
  if ("fail" in g) return g.fail;
  const schoolId = g.ctx.schoolId;

  const sessionName = await sessionNameFor(schoolId);
  if (!sessionName) return { ok: false, error: "Data sekolah tidak ditemukan." };

  // Simpan nama sesi agar worker tahu sesi mana yang dipakai sekolah ini.
  await prisma.school.update({
    where: { id: schoolId },
    data: { waGatewayId: sessionName },
  });

  const res = await startGatewaySession(sessionName);
  const meta = await requestMeta();
  await recordAudit({
    schoolId,
    userId: g.ctx.userId,
    action: "UPDATE",
    entity: "WaSession",
    entityId: sessionName,
    after: { action: "connect", ok: res.ok },
    ...meta,
  });

  revalidatePath("/dashboard/notifications/whatsapp");
  if (!res.ok) return { ok: false, error: res.error };
  return {
    ok: true,
    message:
      "Sesi dimulai. Tunggu QR muncul, lalu pindai dari HP: WhatsApp → Perangkat Tertaut.",
  };
}

/** Ambil QR/status terbaru (dipanggil berkala oleh dasbor). */
export async function fetchQr(): Promise<QrResult> {
  const g = await guard("notifications", "read");
  if ("fail" in g) {
    const fail = g.fail;
    return { ok: false, error: fail.ok ? "Tidak diizinkan." : fail.error };
  }

  const sessionName = await sessionNameFor(g.ctx.schoolId);
  if (!sessionName) return { ok: false, error: "Data sekolah tidak ditemukan." };

  const res = await getGatewayQr(sessionName);
  if (!res.ok) return { ok: false, error: res.error };

  // Simpan status ke DB agar terlihat walau gateway sempat mati.
  await prisma.waSession
    .upsert({
      where: { sessionName },
      create: {
        schoolId: g.ctx.schoolId,
        sessionName,
        status: res.data.status,
        phoneNumber: res.data.phoneNumber,
        lastSeenAt: new Date(),
      },
      update: {
        status: res.data.status,
        phoneNumber: res.data.phoneNumber,
      },
    })
    .catch(() => {
      /* status tidak kritis */
    });

  return {
    ok: true,
    status: res.data.status,
    phoneNumber: res.data.phoneNumber,
    qrDataUrl: res.data.qrDataUrl,
    lastError: res.data.lastError,
    lastSeenAt: res.data.lastSeenAt,
  };
}

/** Putuskan koneksi tetapi simpan kredensial (bisa dinyalakan lagi). */
export async function disconnectWhatsapp(): Promise<ActionResult> {
  const g = await guard("notifications", "manage");
  if ("fail" in g) return g.fail;

  const sessionName = await sessionNameFor(g.ctx.schoolId);
  if (!sessionName) return { ok: false, error: "Data sekolah tidak ditemukan." };

  const res = await stopGatewaySession(sessionName);
  await prisma.waSession
    .update({
      where: { sessionName },
      data: { status: "Disconnected" },
    })
    .catch(() => {});

  const meta = await requestMeta();
  await recordAudit({
    schoolId: g.ctx.schoolId,
    userId: g.ctx.userId,
    action: "UPDATE",
    entity: "WaSession",
    entityId: sessionName,
    after: { action: "disconnect", ok: res.ok },
    ...meta,
  });

  revalidatePath("/dashboard/notifications/whatsapp");
  return res.ok
    ? { ok: true, message: "Koneksi diputus. Kredensial tetap tersimpan." }
    : { ok: false, error: res.error };
}

/** Keluar & hapus kredensial (perlu pindai QR lagi). */
export async function logoutWhatsapp(): Promise<ActionResult> {
  const g = await guard("notifications", "manage");
  if ("fail" in g) return g.fail;

  const sessionName = await sessionNameFor(g.ctx.schoolId);
  if (!sessionName) return { ok: false, error: "Data sekolah tidak ditemukan." };

  const res = await logoutGatewaySession(sessionName);
  await prisma.waSession
    .update({
      where: { sessionName },
      data: { status: "LoggedOut", phoneNumber: null },
    })
    .catch(() => {});

  const meta = await requestMeta();
  await recordAudit({
    schoolId: g.ctx.schoolId,
    userId: g.ctx.userId,
    action: "DELETE",
    entity: "WaSession",
    entityId: sessionName,
    after: { action: "logout" },
    ...meta,
  });

  revalidatePath("/dashboard/notifications/whatsapp");
  return res.ok
    ? { ok: true, message: "Berhasil keluar. Pindai QR lagi untuk menyambungkan." }
    : { ok: false, error: res.error };
}
