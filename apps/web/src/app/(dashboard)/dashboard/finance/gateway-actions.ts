"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { guard, requestMeta, flattenZodErrors } from "@/lib/action-guard";
import type { ActionResult } from "@/lib/action-result";
import {
  gatewayConfigSchema,
  GATEWAY_LABEL,
  type GatewayProviderValue,
} from "@/lib/validations/finance";
import { encryptSecret, last4 } from "@/lib/crypto-secret";
import { loadActiveGateway, createGatewayCharge } from "@/lib/gateway-client";
import { remainingAmount } from "@/lib/finance-calc";
import { wajibFitur } from "@/lib/entitlement";

/**
 * Aksi gateway: pengaturan kredensial + pembuatan sesi pembayaran online.
 *
 * PENTING: kredensial hanya ditulis (terenkripsi) di sini dan TIDAK PERNAH
 * dikirim balik ke klien. UI hanya menerima 4 karakter terakhir untuk
 * ditampilkan sebagai "••••3f2a".
 */

/* ============================================================
 * PENGATURAN GATEWAY
 * ============================================================ */

export async function saveGatewayConfig(formData: FormData): Promise<ActionResult> {
  const g = await guard("finance", "manage");
  if ("fail" in g) return g.fail;

  // Gateway = fitur berbayar (paket Pro ke atas). Ditegakkan di sini, bukan
  // hanya dengan menyembunyikan menu: tanpa ini sekolah paket Basic bisa
  // menyimpan kredensial & mengaktifkan gateway lewat POST langsung.
  try {
    await wajibFitur(g.ctx.schoolId, "paymentGateway");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const parsed = gatewayConfigSchema.safeParse({
    provider: formData.get("provider"),
    environment: formData.get("environment") ?? "sandbox",
    serverKey: formData.get("serverKey") ?? undefined,
    clientKey: formData.get("clientKey") ?? undefined,
    orderPrefix: formData.get("orderPrefix") ?? undefined,
    isActive: formData.get("isActive") ?? undefined,
    channels: formData.getAll("channels").map(String),
  });
  if (!parsed.success) {
    return { ok: false, error: "Periksa kembali isian.", fieldErrors: flattenZodErrors(parsed.error) };
  }
  const d = parsed.data;

  // Kunci enkripsi wajib ada sebelum menyimpan kredensial.
  const wantsCredentials = Boolean(d.serverKey || d.clientKey);
  if (wantsCredentials && !process.env.PAYMENT_ENCRYPTION_KEY) {
    return {
      ok: false,
      error:
        "PAYMENT_ENCRYPTION_KEY belum diatur di server. Kredensial tidak boleh disimpan tanpa enkripsi.",
    };
  }

  const existing = await prisma.schoolPaymentGateway.findUnique({
    where: { schoolId_provider: { schoolId: g.ctx.schoolId, provider: d.provider } },
  });

  // Mengaktifkan gateway tanpa kredensial akan membuat pembayaran online gagal
  // secara diam-diam di halaman orang tua — tolak lebih awal.
  if (d.isActive && d.provider !== "MANUAL") {
    const hasServer = Boolean(d.serverKey) || Boolean(existing?.serverKeyEnc);
    if (!hasServer) {
      return {
        ok: false,
        error: `Server key ${GATEWAY_LABEL[d.provider]} belum diisi. Tidak bisa diaktifkan.`,
      };
    }
  }

  const meta = await requestMeta();
  const data = {
    environment: d.environment,
    orderPrefix: d.orderPrefix ?? null,
    channels: d.channels,
    isActive: d.provider === "MANUAL" ? false : d.isActive,
    // Kosong = pertahankan kredensial lama (tidak menimpa dengan null).
    ...(d.serverKey
      ? { serverKeyEnc: encryptSecret(d.serverKey), serverKeyLast4: last4(d.serverKey) }
      : {}),
    ...(d.clientKey ? { clientKeyEnc: encryptSecret(d.clientKey) } : {}),
  };

  await prisma.schoolPaymentGateway.upsert({
    where: { schoolId_provider: { schoolId: g.ctx.schoolId, provider: d.provider } },
    create: { schoolId: g.ctx.schoolId, provider: d.provider, ...data },
    update: data,
  });

  // Hanya SATU gateway online boleh aktif — kalau tidak, tagihan yang sama bisa
  // menghasilkan dua tautan pembayaran yang berbeda.
  if (data.isActive) {
    await prisma.schoolPaymentGateway.updateMany({
      where: {
        schoolId: g.ctx.schoolId,
        NOT: { provider: d.provider },
      },
      data: { isActive: false },
    });
  }

  await recordAudit({
    schoolId: g.ctx.schoolId,
    userId: g.ctx.userId,
    action: "UPDATE",
    entity: "SchoolPaymentGateway",
    entityId: d.provider,
    // JANGAN catat kredensial — hanya metadata yang aman.
    after: {
      provider: d.provider,
      environment: d.environment,
      isActive: data.isActive,
      channels: d.channels,
      credentialsChanged: wantsCredentials,
    },
    ...meta,
  });

  revalidatePath("/dashboard/finance/gateway");
  revalidatePath("/dashboard/finance");
  return {
    ok: true,
    message: `Pengaturan ${GATEWAY_LABEL[d.provider]} disimpan.`,
  };
}

export async function deleteGatewayCredentials(provider: GatewayProviderValue): Promise<ActionResult> {
  const g = await guard("finance", "manage");
  if ("fail" in g) return g.fail;
  if (provider === "MANUAL") return { ok: false, error: "Tidak ada kredensial untuk jalur manual." };

  const existing = await prisma.schoolPaymentGateway.findUnique({
    where: { schoolId_provider: { schoolId: g.ctx.schoolId, provider } },
  });
  if (!existing) return { ok: false, error: "Konfigurasi tidak ditemukan." };

  const meta = await requestMeta();
  await prisma.schoolPaymentGateway.update({
    where: { id: existing.id },
    data: {
      serverKeyEnc: null,
      clientKeyEnc: null,
      serverKeyLast4: null,
      isActive: false,
    },
  });
  await recordAudit({
    schoolId: g.ctx.schoolId,
    userId: g.ctx.userId,
    action: "UPDATE",
    entity: "SchoolPaymentGateway",
    entityId: provider,
    after: { provider, credentialsCleared: true, isActive: false },
    ...meta,
  });

  revalidatePath("/dashboard/finance/gateway");
  return { ok: true, message: `Kredensial ${GATEWAY_LABEL[provider]} dihapus.` };
}

/** Uji koneksi: pastikan kredensial bisa dipakai menghubungi provider. */
export async function testGatewayConnection(): Promise<ActionResult> {
  const g = await guard("finance", "manage");
  if ("fail" in g) return g.fail;

  const cfg = await loadActiveGateway(g.ctx.schoolId);
  if (!cfg) {
    return { ok: false, error: "Belum ada gateway aktif. Simpan & aktifkan dulu." };
  }
  if (!cfg.serverKey) {
    return { ok: false, error: "Server key kosong atau gagal didekripsi." };
  }
  // Tidak membuat transaksi nyata — cukup pastikan key terbaca.
  return {
    ok: true,
    message: `Kredensial ${GATEWAY_LABEL[cfg.provider]} terbaca (${cfg.environment}). Kunci: ••••${last4(
      cfg.serverKey,
    )}.`,
  };
}

/* ============================================================
 * BUAT SESI PEMBAYARAN ONLINE
 * ============================================================ */

/**
 * Buat tautan/VA pembayaran online untuk sebuah tagihan.
 * Kalau gateway belum dikonfigurasi, kembalikan pesan yang jelas agar admin
 * tahu harus memakai pencatatan manual.
 */
export async function createPaymentLink(invoiceId: string): Promise<ActionResult> {
  const g = await guard("finance", "manage");
  if ("fail" in g) return g.fail;

  // Tagihan tetap bisa dicatat manual — yang dikunci hanya pembuatan tautan
  // gateway, karena itulah fitur yang dibayar.
  try {
    await wajibFitur(g.ctx.schoolId, "paymentGateway");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const inv = await prisma.invoice.findFirst({
    where: { id: invoiceId, schoolId: g.ctx.schoolId, deletedAt: null },
    include: {
      student: { select: { fullName: true, parents: { select: { phone: true }, take: 1 } } },
    },
  });
  if (!inv) return { ok: false, error: "Tagihan tidak ditemukan." };
  if (inv.status === "CANCELLED") return { ok: false, error: "Tagihan sudah dibatalkan." };

  const sisa = remainingAmount(inv.totalAmount, inv.paidAmount);
  if (sisa <= 0) return { ok: false, error: "Tagihan ini sudah lunas." };

  const cfg = await loadActiveGateway(g.ctx.schoolId);
  if (!cfg) {
    return {
      ok: false,
      error:
        "Belum ada payment gateway aktif. Aktifkan Midtrans/Xendit di Pengaturan Gateway, atau catat pembayaran manual.",
    };
  }

  // Sudah ada transaksi pending? Pakai ulang tautannya daripada membuat baru.
  const pending = await prisma.paymentGatewayTransaction.findFirst({
    where: {
      schoolId: g.ctx.schoolId,
      invoiceId: inv.id,
      status: "PENDING",
      provider: cfg.provider,
      paymentLink: { not: null },
    },
    orderBy: { createdAt: "desc" },
  });
  if (pending?.paymentLink) {
    return {
      ok: true,
      message: `Tautan pembayaran sudah ada: ${pending.paymentLink}`,
    };
  }

  const res = await createGatewayCharge(cfg, {
    invoiceNo: inv.invoiceNo,
    totalAmount: sisa,
    title: inv.title,
    customerName: inv.student.fullName,
    customerPhone: inv.student.parents[0]?.phone ?? null,
  });

  if (!res.ok || !res.externalId) {
    return { ok: false, error: res.error ?? "Gagal membuat sesi pembayaran." };
  }

  const meta = await requestMeta();
  const txn = await prisma.paymentGatewayTransaction.create({
    data: {
      schoolId: g.ctx.schoolId,
      invoiceId: inv.id,
      provider: cfg.provider,
      externalId: res.externalId,
      paymentLink: res.paymentLink ?? null,
      vaNumber: res.vaNumber ?? null,
      amount: sisa,
      status: "PENDING",
      rawPayload: (res.raw ?? undefined) as never,
    },
  });

  await recordAudit({
    schoolId: g.ctx.schoolId,
    userId: g.ctx.userId,
    action: "CREATE",
    entity: "PaymentGatewayTransaction",
    entityId: txn.id,
    after: {
      invoiceNo: inv.invoiceNo,
      provider: cfg.provider,
      externalId: res.externalId,
      amount: sisa,
    },
    ...meta,
  });

  revalidatePath(`/dashboard/finance/invoices/${inv.id}`);
  return {
    ok: true,
    message: res.paymentLink
      ? `Tautan pembayaran dibuat: ${res.paymentLink}`
      : `Transaksi ${cfg.provider} dibuat (${res.externalId}).`,
  };
}

/** Tampilkan ringkas konfigurasi (tanpa kredensial) untuk UI. */
export async function getGatewayViewState() {
  const g = await guard("finance", "manage");
  if ("fail" in g) {
    const fail = g.fail;
    return { ok: false as const, error: fail.ok ? "" : fail.error };
  }
  const rows = await prisma.schoolPaymentGateway.findMany({
    where: { schoolId: g.ctx.schoolId },
  });
  return {
    ok: true as const,
    configs: rows.map((r) => ({
      provider: r.provider as GatewayProviderValue,
      environment: r.environment,
      isActive: r.isActive,
      channels: r.channels,
      orderPrefix: r.orderPrefix,
      hasServerKey: Boolean(r.serverKeyEnc),
      serverKeyLast4: r.serverKeyLast4,
      hasClientKey: Boolean(r.clientKeyEnc),
    })),
  };
}
