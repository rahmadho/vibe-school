import "server-only";
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto-secret";
import type { GatewayProviderValue } from "@/lib/validations/finance";
import {
  MIDTRANS_BASE,
  MIDTRANS_SNAP_BASE,
  XENDIT_BASE,
  buildMidtransOrderId,
  mapMidtransStatus,
  mapXenditStatus,
  type NormalizedStatus,
} from "@/lib/gateway-adapter";

/**
 * Klien HTTP gateway (server-only). Modul ini memegang kredensial terdekripsi
 * dan melakukan panggilan jaringan; logika penafsiran ada di gateway-adapter.
 */

export type GatewayConfig = {
  provider: GatewayProviderValue;
  environment: string;
  serverKey: string | null;
  clientKey: string | null;
  channels: string[];
  orderPrefix: string | null;
};

/** Ambil & dekripsi konfigurasi gateway aktif untuk sebuah sekolah. */
export async function loadGatewayConfig(
  schoolId: string,
  provider: GatewayProviderValue,
): Promise<GatewayConfig | null> {
  const row = await prisma.schoolPaymentGateway.findUnique({
    where: { schoolId_provider: { schoolId, provider } },
  });
  if (!row || !row.isActive) return null;

  let serverKey: string | null = null;
  let clientKey: string | null = null;
  try {
    if (row.serverKeyEnc) serverKey = decryptSecret(row.serverKeyEnc);
    if (row.clientKeyEnc) clientKey = decryptSecret(row.clientKeyEnc);
  } catch {
    // Kunci enkripsi berubah / data rusak → anggap belum dikonfigurasi.
    return null;
  }

  return {
    provider: row.provider as GatewayProviderValue,
    environment: row.environment,
    serverKey,
    clientKey,
    channels: row.channels,
    orderPrefix: row.orderPrefix,
  };
}

/** Ambil gateway aktif pertama (Midtrans diutamakan) untuk sebuah sekolah. */
export async function loadActiveGateway(schoolId: string): Promise<GatewayConfig | null> {
  const rows = await prisma.schoolPaymentGateway.findMany({
    where: { schoolId, isActive: true, NOT: { provider: "MANUAL" } },
  });
  if (rows.length === 0) return null;
  const order = ["MIDTRANS", "XENDIT"];
  rows.sort((a, b) => order.indexOf(a.provider) - order.indexOf(b.provider));
  return loadGatewayConfig(schoolId, rows[0].provider as GatewayProviderValue);
}

export type CreateChargeResult = {
  ok: boolean;
  externalId?: string;
  paymentLink?: string;
  vaNumber?: string;
  error?: string;
  raw?: unknown;
};

/* ============================================================
 * MIDTRANS — Snap API
 * ============================================================ */

export async function createMidtransCharge(
  cfg: GatewayConfig,
  input: {
    invoiceNo: string;
    totalAmount: number;
    title: string;
    customerName: string;
    customerPhone?: string | null;
    enabledPayments?: string[];
  },
): Promise<CreateChargeResult> {
  if (!cfg.serverKey) return { ok: false, error: "Server key Midtrans belum diisi." };

  const base = MIDTRANS_SNAP_BASE[cfg.environment] ?? MIDTRANS_SNAP_BASE.sandbox;
  const orderId = buildMidtransOrderId(cfg.orderPrefix, input.invoiceNo);

  const body = {
    transaction_details: {
      order_id: orderId,
      gross_amount: input.totalAmount,
    },
    item_details: [
      { id: "tagihan", price: input.totalAmount, quantity: 1, name: input.title.slice(0, 50) },
    ],
    customer_details: {
      first_name: input.customerName.slice(0, 50),
      ...(input.customerPhone ? { phone: input.customerPhone } : {}),
    },
    ...(input.enabledPayments && input.enabledPayments.length > 0
      ? { enabled_payments: input.enabledPayments }
      : {}),
  };

  try {
    const res = await fetch(`${base}/transactions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        // Midtrans memakai Basic auth: serverKey sebagai username, password kosong.
        Authorization: `Basic ${Buffer.from(`${cfg.serverKey}:`).toString("base64")}`,
      },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    let json: Record<string, unknown> = {};
    try {
      json = JSON.parse(text) as Record<string, unknown>;
    } catch {
      return { ok: false, error: `Respons Midtrans tidak valid (HTTP ${res.status})` };
    }

    if (!res.ok) {
      const msgs = Array.isArray(json.error_messages)
        ? (json.error_messages as string[]).join("; ")
        : `HTTP ${res.status}`;
      return { ok: false, error: `Midtrans: ${msgs}`, raw: json };
    }

    return {
      ok: true,
      externalId: orderId,
      paymentLink:
        typeof json.redirect_url === "string" ? json.redirect_url : undefined,
      raw: json,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gagal menghubungi Midtrans" };
  }
}

/** Verifikasi signature notifikasi Midtrans (sha512). */
export async function sha512Hex(data: string): Promise<string> {
  return createHash("sha512").update(data).digest("hex");
}

export function midtransBaseFor(env: string): string {
  return MIDTRANS_BASE[env] ?? MIDTRANS_BASE.sandbox;
}

/* ============================================================
 * XENDIT — Invoice API
 * ============================================================ */

export async function createXenditCharge(
  cfg: GatewayConfig,
  input: {
    invoiceNo: string;
    totalAmount: number;
    title: string;
    customerName: string;
    customerEmail?: string | null;
    customerPhone?: string | null;
    successRedirectUrl?: string;
  },
): Promise<CreateChargeResult> {
  if (!cfg.serverKey) return { ok: false, error: "Secret key Xendit belum diisi." };

  const externalId = buildMidtransOrderId(cfg.orderPrefix, input.invoiceNo);

  const body: Record<string, unknown> = {
    external_id: externalId,
    amount: input.totalAmount,
    description: input.title.slice(0, 200),
    customer: {
      given_names: input.customerName.slice(0, 100),
      ...(input.customerEmail ? { email: input.customerEmail } : {}),
      ...(input.customerPhone ? { mobile_number: input.customerPhone } : {}),
    },
    ...(cfg.channels.length > 0
      ? { payment_methods: cfg.channels }
      : {}),
    ...(input.successRedirectUrl
      ? { success_redirect_url: input.successRedirectUrl }
      : {}),
  };

  try {
    const res = await fetch(`${XENDIT_BASE}/v2/invoices`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${cfg.serverKey}:`).toString("base64")}`,
      },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    let json: Record<string, unknown> = {};
    try {
      json = JSON.parse(text) as Record<string, unknown>;
    } catch {
      return { ok: false, error: `Respons Xendit tidak valid (HTTP ${res.status})` };
    }

    if (!res.ok) {
      const msg =
        typeof json.message === "string" ? json.message : `HTTP ${res.status}`;
      return { ok: false, error: `Xendit: ${msg}`, raw: json };
    }

    return {
      ok: true,
      externalId,
      paymentLink: typeof json.invoice_url === "string" ? json.invoice_url : undefined,
      raw: json,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gagal menghubungi Xendit" };
  }
}

/** Buat tagihan di gateway sesuai provider yang aktif. */
export async function createGatewayCharge(
  cfg: GatewayConfig,
  input: {
    invoiceNo: string;
    totalAmount: number;
    title: string;
    customerName: string;
    customerEmail?: string | null;
    customerPhone?: string | null;
  },
): Promise<CreateChargeResult> {
  if (cfg.provider === "MIDTRANS") {
    return createMidtransCharge(cfg, {
      ...input,
      enabledPayments: cfg.channels.length > 0 ? cfg.channels : undefined,
    });
  }
  if (cfg.provider === "XENDIT") {
    return createXenditCharge(cfg, input);
  }
  return { ok: false, error: "Provider gateway tidak didukung untuk pembayaran online." };
}

export { mapMidtransStatus, mapXenditStatus };
export type { NormalizedStatus };
