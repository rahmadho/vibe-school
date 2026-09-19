import { describe, expect, it } from "vitest";
import {
  feeTypeCreateSchema,
  invoiceCreateSchema,
  invoiceBulkSchema,
  paymentCreateSchema,
  gatewayConfigSchema,
  GATEWAY_LABEL,
  GATEWAY_CHANNELS,
} from "@/lib/validations/finance";

describe("feeTypeCreateSchema", () => {
  const base = { name: "SPP Bulanan", code: "spp", amount: "250000" };

  it("menerima input valid & mengubah kode jadi huruf besar", () => {
    const r = feeTypeCreateSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.code).toBe("SPP");
      expect(r.data.amount).toBe(250000);
      expect(r.data.recurring).toBe(false);
    }
  });

  it("menolak nominal nol / negatif / pecahan", () => {
    expect(feeTypeCreateSchema.safeParse({ ...base, amount: "0" }).success).toBe(false);
    expect(feeTypeCreateSchema.safeParse({ ...base, amount: "-100" }).success).toBe(false);
    expect(feeTypeCreateSchema.safeParse({ ...base, amount: "100.5" }).success).toBe(false);
  });

  it("menolak kode dengan karakter aneh (mencegah injeksi)", () => {
    expect(feeTypeCreateSchema.safeParse({ ...base, code: "SPP;DROP" }).success).toBe(false);
    expect(feeTypeCreateSchema.safeParse({ ...base, code: "a b" }).success).toBe(false);
  });

  it("menolak nama kosong", () => {
    expect(feeTypeCreateSchema.safeParse({ ...base, name: "  " }).success).toBe(false);
  });

  it("checkbox 'on' menjadi true", () => {
    const r = feeTypeCreateSchema.safeParse({ ...base, recurring: "on" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.recurring).toBe(true);
  });
});

describe("invoiceCreateSchema", () => {
  const base = {
    studentId: "s1",
    title: "SPP Oktober",
    dueDate: "2025-10-31",
    items: [{ description: "SPP", amount: "250000", quantity: "1" }],
  };

  it("menerima tagihan valid", () => {
    const r = invoiceCreateSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.items[0].amount).toBe(250000);
      expect(r.data.items[0].quantity).toBe(1);
    }
  });

  it("menolak tanpa rincian", () => {
    expect(invoiceCreateSchema.safeParse({ ...base, items: [] }).success).toBe(false);
  });

  it("menolak format tanggal salah", () => {
    expect(invoiceCreateSchema.safeParse({ ...base, dueDate: "31-10-2025" }).success).toBe(false);
  });

  it("menolak tanpa siswa", () => {
    expect(invoiceCreateSchema.safeParse({ ...base, studentId: "" }).success).toBe(false);
  });

  it("feeTypeId kosong menjadi undefined", () => {
    const r = invoiceCreateSchema.safeParse({
      ...base,
      items: [{ feeTypeId: "", description: "SPP", amount: "1000", quantity: "1" }],
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.items[0].feeTypeId).toBeUndefined();
  });
});

describe("invoiceBulkSchema", () => {
  const base = {
    classId: "c1",
    title: "SPP November",
    dueDate: "2025-11-30",
    amount: "250000",
    studentIds: ["s1", "s2"],
  };

  it("menerima tagihan massal", () => {
    expect(invoiceBulkSchema.safeParse(base).success).toBe(true);
  });

  it("menolak tanpa siswa terpilih", () => {
    expect(invoiceBulkSchema.safeParse({ ...base, studentIds: [] }).success).toBe(false);
  });
});

describe("paymentCreateSchema", () => {
  const base = { invoiceId: "inv1", amount: "50000" };

  it("menerima pembayaran valid", () => {
    const r = paymentCreateSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.amount).toBe(50000);
  });

  it("menolak nominal nol", () => {
    expect(paymentCreateSchema.safeParse({ ...base, amount: "0" }).success).toBe(false);
  });

  it("menolak tanpa tagihan", () => {
    expect(paymentCreateSchema.safeParse({ ...base, invoiceId: "" }).success).toBe(false);
  });

  it("memperlakukan string kosong sebagai undefined", () => {
    const r = paymentCreateSchema.safeParse({ ...base, reference: "", note: "" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.reference).toBeUndefined();
      expect(r.data.note).toBeUndefined();
    }
  });
});

describe("gatewayConfigSchema", () => {
  it("menerima konfigurasi Midtrans", () => {
    const r = gatewayConfigSchema.safeParse({
      provider: "MIDTRANS",
      environment: "sandbox",
      serverKey: "SB-Mid-server-xxx",
      channels: ["qris", "gopay"],
      isActive: "on",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.channels).toEqual(["qris", "gopay"]);
      expect(r.data.isActive).toBe(true);
    }
  });

  it("default environment sandbox", () => {
    const r = gatewayConfigSchema.safeParse({ provider: "XENDIT" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.environment).toBe("sandbox");
  });

  it("menolak provider tak dikenal", () => {
    expect(gatewayConfigSchema.safeParse({ provider: "STRIPE" }).success).toBe(false);
  });

  it("menolak lingkungan tak dikenal", () => {
    expect(
      gatewayConfigSchema.safeParse({ provider: "MIDTRANS", environment: "staging" })
        .success,
    ).toBe(false);
  });

  it("channels tunggal dibungkus jadi array", () => {
    const r = gatewayConfigSchema.safeParse({ provider: "MIDTRANS", channels: "qris" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.channels).toEqual(["qris"]);
  });

  it("server key kosong menjadi undefined (jangan timpa kredensial lama)", () => {
    const r = gatewayConfigSchema.safeParse({ provider: "MIDTRANS", serverKey: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.serverKey).toBeUndefined();
  });
});

describe("peta label & kanal", () => {
  it("setiap provider punya label", () => {
    expect(GATEWAY_LABEL.MIDTRANS).toBe("Midtrans");
    expect(GATEWAY_LABEL.XENDIT).toBe("Xendit");
    expect(GATEWAY_LABEL.MANUAL).toContain("Manual");
  });

  it("Midtrans & Xendit punya daftar kanal; MANUAL tidak", () => {
    expect(GATEWAY_CHANNELS.MIDTRANS.length).toBeGreaterThan(0);
    expect(GATEWAY_CHANNELS.XENDIT.length).toBeGreaterThan(0);
    expect(GATEWAY_CHANNELS.MANUAL).toEqual([]);
  });
});
