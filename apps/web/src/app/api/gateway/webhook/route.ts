import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { decryptSecret } from "@/lib/crypto-secret";
import { sha512Hex } from "@/lib/gateway-client";
import {
  mapMidtransStatus,
  mapXenditStatus,
  midtransNotificationKey,
  xenditNotificationKey,
  verifyMidtransSignature,
  verifyXenditCallbackToken,
  type MidtransNotification,
  type XenditCallback,
} from "@/lib/gateway-adapter";
import {
  resolveInvoiceStatus,
  gatewayStatusToInvoicePaid,
  remainingAmount,
} from "@/lib/finance-calc";

/**
 * Webhook payment gateway.
 *
 * Aturan keamanan & keandalan:
 *  1. Verifikasi tanda tangan / token SEBELUM mempercayai isi notifikasi.
 *  2. Idempotensi: notifikasi yang sama tidak boleh mencatat pembayaran dua kali.
 *  3. Selalu balas 200 untuk notifikasi yang sudah pernah diproses, supaya
 *     provider berhenti mencoba ulang.
 *  4. Jangan pernah mencatat pembayaran melebihi sisa tagihan.
 *
 * Route: POST /api/gateway/webhook
 * Provider ditentukan dari query `?provider=midtrans|xendit`.
 */

export const runtime = "nodejs";

type HandlerResult = { status: number; body: Record<string, unknown> };

export async function POST(req: Request): Promise<NextResponse> {
  const url = new URL(req.url);
  const provider = (url.searchParams.get("provider") ?? "").toLowerCase();

  let payload: Record<string, unknown>;
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Payload bukan JSON" }, { status: 400 });
  }

  let result: HandlerResult;
  try {
    if (provider === "midtrans") {
      result = await handleMidtrans(payload);
    } else if (provider === "xendit") {
      result = await handleXendit(payload, req.headers.get("x-callback-token"));
    } else {
      result = { status: 400, body: { ok: false, error: "Provider tidak dikenal" } };
    }
  } catch (e) {
    // Jangan bocorkan detail internal ke publik; cukup catat.
    console.error("Webhook error:", e);
    result = { status: 500, body: { ok: false, error: "Gagal memproses notifikasi" } };
  }

  return NextResponse.json(result.body, { status: result.status });
}

/* ============================================================
 * MIDTRANS
 * ============================================================ */

async function handleMidtrans(payload: Record<string, unknown>): Promise<HandlerResult> {
  const n = payload as MidtransNotification;

  if (!n.order_id || !n.transaction_status) {
    return { status: 400, body: { ok: false, error: "Notifikasi tidak lengkap" } };
  }

  // externalId sudah dibuat unik per transaksi → langsung ketemu transaksinya.
  const txn = await prisma.paymentGatewayTransaction.findFirst({
    where: { externalId: n.order_id, provider: "MIDTRANS" },
  });
  if (!txn) {
    // Balas 200 agar provider tidak mencoba ulang selamanya; kemungkinan
    // notifikasi dari lingkungan lain (sandbox vs production).
    return { status: 200, body: { ok: true, ignored: "transaksi tidak dikenal" } };
  }

  // Verifikasi tanda tangan memakai server key sekolah yang bersangkutan.
  const cfg = await prisma.schoolPaymentGateway.findUnique({
    where: { schoolId_provider: { schoolId: txn.schoolId, provider: "MIDTRANS" } },
  });
  if (!cfg?.serverKeyEnc) {
    return { status: 200, body: { ok: true, ignored: "gateway belum dikonfigurasi" } };
  }

  let serverKey: string;
  try {
    serverKey = decryptSecret(cfg.serverKeyEnc);
  } catch {
    return { status: 200, body: { ok: true, ignored: "kredensial tidak terbaca" } };
  }

  const valid = await verifyMidtransSignature(n, serverKey, sha512Hex);
  if (!valid) {
    // Tanda tangan salah = kemungkinan pemalsuan. Tolak, jangan proses.
    await recordAudit({
      schoolId: txn.schoolId,
      userId: null,
      action: "UPDATE",
      entity: "PaymentGatewayTransaction",
      entityId: txn.id,
      after: { rejected: "signature tidak valid", orderId: n.order_id },
    });
    return { status: 401, body: { ok: false, error: "Tanda tangan tidak valid" } };
  }

  const status = mapMidtransStatus(n.transaction_status, n.fraud_status);
  const notificationKey = midtransNotificationKey(n);

  return await applyGatewayResult({
    txnId: txn.id,
    schoolId: txn.schoolId,
    invoiceId: txn.invoiceId,
    status,
    notificationKey,
    rawPayload: payload,
    amountHint: Number(n.gross_amount) || txn.amount,
    providerLabel: "Midtrans",
    externalId: n.order_id,
  });
}

/* ============================================================
 * XENDIT
 * ============================================================ */

async function handleXendit(
  payload: Record<string, unknown>,
  headerToken: string | null,
): Promise<HandlerResult> {
  const c = payload as XenditCallback;
  const externalId = c.external_id;
  if (!externalId) {
    return { status: 400, body: { ok: false, error: "Notifikasi tidak lengkap" } };
  }

  const txn = await prisma.paymentGatewayTransaction.findFirst({
    where: { externalId, provider: "XENDIT" },
  });
  if (!txn) {
    return { status: 200, body: { ok: true, ignored: "transaksi tidak dikenal" } };
  }

  const cfg = await prisma.schoolPaymentGateway.findUnique({
    where: { schoolId_provider: { schoolId: txn.schoolId, provider: "XENDIT" } },
  });
  if (!cfg?.serverKeyEnc) {
    return { status: 200, body: { ok: true, ignored: "gateway belum dikonfigurasi" } };
  }

  let expectedToken: string;
  try {
    expectedToken = decryptSecret(cfg.serverKeyEnc);
  } catch {
    return { status: 200, body: { ok: true, ignored: "kredensial tidak terbaca" } };
  }

  if (!verifyXenditCallbackToken(headerToken, expectedToken)) {
    await recordAudit({
      schoolId: txn.schoolId,
      userId: null,
      action: "UPDATE",
      entity: "PaymentGatewayTransaction",
      entityId: txn.id,
      after: { rejected: "callback token tidak valid", externalId },
    });
    return { status: 401, body: { ok: false, error: "Token tidak valid" } };
  }

  const status = mapXenditStatus(String(c.status ?? ""));
  const notificationKey = xenditNotificationKey(c);

  return await applyGatewayResult({
    txnId: txn.id,
    schoolId: txn.schoolId,
    invoiceId: txn.invoiceId,
    status,
    notificationKey,
    rawPayload: payload,
    amountHint: Number(c.paid_amount ?? c.amount) || txn.amount,
    providerLabel: "Xendit",
    externalId,
  });
}

/* ============================================================
 * INTI: terapkan hasil gateway (idempoten)
 * ============================================================ */

async function applyGatewayResult(input: {
  txnId: string;
  schoolId: string;
  invoiceId: string;
  status: "PENDING" | "SETTLEMENT" | "EXPIRE" | "REFUND" | "FAILED";
  notificationKey: string;
  rawPayload: unknown;
  amountHint: number;
  providerLabel: string;
  externalId: string;
}): Promise<HandlerResult> {
  // === IDEMPOTENSI ===
  // Kalau kunci ini sudah pernah tercatat, jangan kerjakan apa pun.
  const duplicate = await prisma.paymentGatewayTransaction.findFirst({
    where: {
      schoolId: input.schoolId,
      notificationKey: input.notificationKey,
      NOT: { id: input.txnId },
    },
    select: { id: true },
  });
  if (duplicate) {
    return {
      status: 200,
      body: { ok: true, duplicate: true, message: "Notifikasi sudah diproses" },
    };
  }

  const txn = await prisma.paymentGatewayTransaction.findUnique({
    where: { id: input.txnId },
  });
  if (!txn) return { status: 200, body: { ok: true, ignored: "transaksi hilang" } };

  // Sudah settlement sebelumnya & status tidak berubah → tidak perlu apa-apa.
  if (txn.status === "SETTLEMENT" && input.status === "SETTLEMENT") {
    await prisma.paymentGatewayTransaction.update({
      where: { id: txn.id },
      data: { notificationKey: input.notificationKey, rawPayload: input.rawPayload as never },
    });
    return { status: 200, body: { ok: true, duplicate: true } };
  }

  if (input.status !== "SETTLEMENT") {
    // Status non-settlement: cukup perbarui jejak transaksi.
    await prisma.paymentGatewayTransaction.update({
      where: { id: txn.id },
      data: {
        status: input.status,
        notificationKey: input.notificationKey,
        rawPayload: input.rawPayload as never,
      },
    });
    return {
      status: 200,
      body: { ok: true, status: input.status, message: `Status diperbarui: ${input.status}` },
    };
  }

  // === SETTLEMENT: catat pembayaran ===
  const inv = await prisma.invoice.findUnique({ where: { id: input.invoiceId } });
  if (!inv) {
    return { status: 200, body: { ok: true, ignored: "tagihan tidak ditemukan" } };
  }

  const { newPaid, shouldRecord } = gatewayStatusToInvoicePaid(
    inv.totalAmount,
    inv.paidAmount,
    input.amountHint,
  );

  if (!shouldRecord) {
    await prisma.paymentGatewayTransaction.update({
      where: { id: txn.id },
      data: {
        status: "SETTLEMENT",
        paidAt: new Date(),
        notificationKey: input.notificationKey,
        rawPayload: input.rawPayload as never,
      },
    });
    return { status: 200, body: { ok: true, duplicate: true, message: "Tagihan sudah lunas" } };
  }

  const applied = newPaid - inv.paidAmount;
  const newStatus = resolveInvoiceStatus(
    inv.totalAmount,
    newPaid,
    inv.dueDate,
    new Date(),
    inv.status as never,
  );

  await prisma.$transaction(async (tx) => {
    await tx.payment.create({
      data: {
        schoolId: input.schoolId,
        invoiceId: inv.id,
        amount: applied,
        paidAt: new Date(),
        reference: input.externalId,
        note: `Pembayaran otomatis ${input.providerLabel}`,
        recordedById: null, // bukan dicatat manual oleh user
      },
    });
    await tx.invoice.update({
      where: { id: inv.id },
      data: { paidAmount: newPaid, status: newStatus },
    });
    await tx.paymentGatewayTransaction.update({
      where: { id: txn.id },
      data: {
        status: "SETTLEMENT",
        paidAt: new Date(),
        notificationKey: input.notificationKey,
        rawPayload: input.rawPayload as never,
      },
    });
  });

  await recordAudit({
    schoolId: input.schoolId,
    userId: null,
    action: "CREATE",
    entity: "Payment",
    entityId: input.txnId,
    after: {
      source: input.providerLabel,
      externalId: input.externalId,
      amount: applied,
      invoiceNo: inv.invoiceNo,
      invoiceStatus: newStatus,
      remaining: remainingAmount(inv.totalAmount, newPaid),
    },
  });

  return {
    status: 200,
    body: {
      ok: true,
      recorded: applied,
      invoiceStatus: newStatus,
      message: `Pembayaran ${input.providerLabel} dicatat.`,
    },
  };
}
