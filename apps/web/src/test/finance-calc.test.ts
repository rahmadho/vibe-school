import { describe, expect, it } from "vitest";
import {
  resolveInvoiceStatus,
  remainingAmount,
  validatePayment,
  formatRupiah,
  buildInvoiceNumber,
  summarizeInvoices,
  gatewayStatusToInvoicePaid,
} from "@/lib/finance-calc";

const NOW = new Date("2025-10-15T10:00:00Z");
const PAST = new Date("2025-10-01T00:00:00Z");
const FUTURE = new Date("2025-11-01T00:00:00Z");

describe("resolveInvoiceStatus", () => {
  it("lunas bila dibayar penuh", () => {
    expect(resolveInvoiceStatus(100000, 100000, FUTURE, NOW)).toBe("PAID");
  });

  it("belum bayar & belum jatuh tempo → UNPAID", () => {
    expect(resolveInvoiceStatus(100000, 0, FUTURE, NOW)).toBe("UNPAID");
  });

  it("bayar sebagian & belum jatuh tempo → PARTIAL", () => {
    expect(resolveInvoiceStatus(100000, 40000, FUTURE, NOW)).toBe("PARTIAL");
  });

  it("lewat jatuh tempo → OVERDUE", () => {
    expect(resolveInvoiceStatus(100000, 0, PAST, NOW)).toBe("OVERDUE");
    expect(resolveInvoiceStatus(100000, 40000, PAST, NOW)).toBe("OVERDUE");
  });

  it("lunas tepat waktu tetap PAID meski lewat tanggal", () => {
    expect(resolveInvoiceStatus(100000, 100000, PAST, NOW)).toBe("PAID");
  });

  it("tidak menimpa status final CANCELLED / REFUNDED", () => {
    expect(resolveInvoiceStatus(100000, 0, PAST, NOW, "CANCELLED")).toBe("CANCELLED");
    expect(resolveInvoiceStatus(100000, 100000, FUTURE, NOW, "REFUNDED")).toBe("REFUNDED");
  });

  it("total nol tidak dianggap lunas", () => {
    expect(resolveInvoiceStatus(0, 0, FUTURE, NOW)).toBe("UNPAID");
  });
});

describe("remainingAmount", () => {
  it("mengurangi total dengan dibayar", () => {
    expect(remainingAmount(100000, 30000)).toBe(70000);
  });

  it("tidak pernah negatif (kelebihan bayar)", () => {
    expect(remainingAmount(100000, 150000)).toBe(0);
  });
});

describe("validatePayment", () => {
  it("menerima nominal wajar", () => {
    expect(validatePayment(100000, 0, 50000)).toBeNull();
    expect(validatePayment(100000, 50000, 50000)).toBeNull();
  });

  it("menolak nominal nol / negatif", () => {
    expect(validatePayment(100000, 0, 0)).not.toBeNull();
    expect(validatePayment(100000, 0, -5)).not.toBeNull();
  });

  it("menolak nominal melebihi sisa", () => {
    expect(validatePayment(100000, 80000, 30000)).not.toBeNull();
  });

  it("menolak pembayaran pada tagihan yang sudah lunas", () => {
    expect(validatePayment(100000, 100000, 10000)).not.toBeNull();
  });

  it("menolak nominal pecahan", () => {
    expect(validatePayment(100000, 0, 1000.5)).not.toBeNull();
  });
});

describe("formatRupiah", () => {
  it("memberi pemisah ribuan titik", () => {
    expect(formatRupiah(0)).toBe("Rp0");
    expect(formatRupiah(1000)).toBe("Rp1.000");
    expect(formatRupiah(250000)).toBe("Rp250.000");
    expect(formatRupiah(1234567)).toBe("Rp1.234.567");
  });

  it("menangani negatif", () => {
    expect(formatRupiah(-50000)).toBe("-Rp50.000");
  });
});

describe("buildInvoiceNumber", () => {
  it("membentuk PREFIX/YYYYMM/URUT", () => {
    const d = new Date("2025-10-05T00:00:00Z");
    expect(buildInvoiceNumber("INV", d, 7)).toBe("INV/202510/0007");
  });

  it("memberi padding urutan", () => {
    const d = new Date("2026-01-01T00:00:00Z");
    expect(buildInvoiceNumber("SPP", d, 123, 5)).toBe("SPP/202601/00123");
  });
});

describe("summarizeInvoices", () => {
  const inv = (
    total: number,
    paid: number,
    due: Date,
    status: string,
  ) => ({ totalAmount: total, paidAmount: paid, dueDate: due, status });

  it("menghitung total ditagihkan, diterima, sisa", () => {
    const s = summarizeInvoices(
      [
        inv(100000, 100000, FUTURE, "PAID"),
        inv(200000, 50000, FUTURE, "PARTIAL"),
      ],
      NOW,
    );
    expect(s.billed).toBe(300000);
    expect(s.collected).toBe(150000);
    expect(s.outstanding).toBe(150000);
    expect(s.paidCount).toBe(1);
  });

  it("menghitung tunggakan hanya yang lewat tempo & bersisa", () => {
    const s = summarizeInvoices(
      [
        inv(100000, 0, PAST, "OVERDUE"),
        inv(100000, 0, FUTURE, "UNPAID"),
        inv(100000, 100000, PAST, "PAID"),
      ],
      NOW,
    );
    expect(s.overdueCount).toBe(1);
    expect(s.overdueAmount).toBe(100000);
  });

  it("tagihan dibatalkan tidak dihitung tunggakan", () => {
    const s = summarizeInvoices([inv(100000, 0, PAST, "CANCELLED")], NOW);
    expect(s.overdueCount).toBe(0);
  });

  it("tingkat penagihan 0% bila belum ada tagihan", () => {
    const s = summarizeInvoices([], NOW);
    expect(s.collectionRate).toBe(0);
    expect(s.count).toBe(0);
  });

  it("menghitung persentase penagihan", () => {
    const s = summarizeInvoices([inv(100000, 25000, FUTURE, "PARTIAL")], NOW);
    expect(s.collectionRate).toBe(25);
  });
});

describe("gatewayStatusToInvoicePaid", () => {
  it("menambah pembayaran ke sisa", () => {
    const r = gatewayStatusToInvoicePaid(100000, 0, 100000);
    expect(r.newPaid).toBe(100000);
    expect(r.shouldRecord).toBe(true);
  });

  it("tidak mencatat bila sudah lunas (webhook ganda)", () => {
    const r = gatewayStatusToInvoicePaid(100000, 100000, 100000);
    expect(r.shouldRecord).toBe(false);
    expect(r.newPaid).toBe(100000);
  });

  it("membatasi kelebihan bayar dari provider", () => {
    // Tagihan 100rb, sudah bayar 90rb, provider lapor bayar 100rb
    const r = gatewayStatusToInvoicePaid(100000, 90000, 100000);
    expect(r.newPaid).toBe(100000); // tidak 190000
    expect(r.shouldRecord).toBe(true);
  });
});
