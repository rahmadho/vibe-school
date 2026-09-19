import { describe, expect, it } from "vitest";
import {
  mapMidtransStatus,
  mapXenditStatus,
  midtransNotificationKey,
  xenditNotificationKey,
  buildMidtransOrderId,
  verifyMidtransSignature,
  verifyXenditCallbackToken,
  timingSafeEqualStr,
  timingSafeEqualHex,
  statusToPaidAt,
  type MidtransNotification,
} from "@/lib/gateway-adapter";

describe("mapMidtransStatus", () => {
  it("settlement → SETTLEMENT", () => {
    expect(mapMidtransStatus("settlement")).toBe("SETTLEMENT");
  });

  it("capture + fraud accept → SETTLEMENT", () => {
    expect(mapMidtransStatus("capture", "accept")).toBe("SETTLEMENT");
  });

  it("capture + fraud challenge → PENDING (jangan anggap lunas)", () => {
    expect(mapMidtransStatus("capture", "challenge")).toBe("PENDING");
  });

  it("pending → PENDING", () => {
    expect(mapMidtransStatus("pending")).toBe("PENDING");
  });

  it("deny/cancel/failure → FAILED", () => {
    expect(mapMidtransStatus("deny")).toBe("FAILED");
    expect(mapMidtransStatus("cancel")).toBe("FAILED");
    expect(mapMidtransStatus("failure")).toBe("FAILED");
  });

  it("expire → EXPIRE", () => {
    expect(mapMidtransStatus("expire")).toBe("EXPIRE");
  });

  it("refund → REFUND", () => {
    expect(mapMidtransStatus("refund")).toBe("REFUND");
    expect(mapMidtransStatus("partial_refund")).toBe("REFUND");
  });

  it("status tak dikenal → PENDING (aman)", () => {
    expect(mapMidtransStatus("halo")).toBe("PENDING");
  });

  it("tidak peka huruf besar/kecil", () => {
    expect(mapMidtransStatus("SETTLEMENT")).toBe("SETTLEMENT");
  });
});

describe("mapXenditStatus", () => {
  it("PAID/SETTLED → SETTLEMENT", () => {
    expect(mapXenditStatus("PAID")).toBe("SETTLEMENT");
    expect(mapXenditStatus("SETTLED")).toBe("SETTLEMENT");
  });

  it("EXPIRED → EXPIRE, FAILED → FAILED", () => {
    expect(mapXenditStatus("EXPIRED")).toBe("EXPIRE");
    expect(mapXenditStatus("FAILED")).toBe("FAILED");
  });
});

describe("kunci idempotensi", () => {
  const n: MidtransNotification = {
    order_id: "INV-001-123456",
    status_code: "200",
    gross_amount: "250000.00",
    transaction_status: "settlement",
    fraud_status: "accept",
    transaction_id: "abc-123",
  };

  it("Midtrans: kunci sama untuk notifikasi identik", () => {
    expect(midtransNotificationKey(n)).toBe(midtransNotificationKey({ ...n }));
  });

  it("Midtrans: kunci BERBEDA saat status berubah (pending → settlement)", () => {
    const a = midtransNotificationKey({ ...n, transaction_status: "pending" });
    const b = midtransNotificationKey({ ...n, transaction_status: "settlement" });
    expect(a).not.toBe(b);
  });

  it("Midtrans: kunci berbeda untuk order berbeda", () => {
    const a = midtransNotificationKey(n);
    const b = midtransNotificationKey({ ...n, order_id: "INV-002-999999" });
    expect(a).not.toBe(b);
  });

  it("Xendit: kunci sama untuk callback identik", () => {
    const c = { external_id: "INV-001", status: "PAID", paid_amount: 250000, updated: "2025-10-15" };
    expect(xenditNotificationKey(c)).toBe(xenditNotificationKey({ ...c }));
  });

  it("Xendit: kunci berbeda saat nominal berubah", () => {
    const a = xenditNotificationKey({ external_id: "X", status: "PAID", paid_amount: 100 });
    const b = xenditNotificationKey({ external_id: "X", status: "PAID", paid_amount: 200 });
    expect(a).not.toBe(b);
  });
});

describe("buildMidtransOrderId", () => {
  it("membentuk PREFIX-NO-TIMESTAMP", () => {
    const d = new Date(1700000000000);
    const id = buildMidtransOrderId("SMPN1", "INV/202510/0001", d);
    expect(id).toMatch(/^SMPN1-INV-202510-0001-\d{6}$/);
  });

  it("membersihkan karakter yang tidak diizinkan Midtrans", () => {
    const id = buildMidtransOrderId(null, "INV/2025 10/0001", new Date(1700000000000));
    // Tidak boleh ada spasi atau garis miring.
    expect(id).not.toMatch(/[\s/]/);
    expect(id.startsWith("INV-")).toBe(true);
  });

  it("memakai INV sebagai awalan default", () => {
    const id = buildMidtransOrderId(undefined, "X", new Date(1700000000000));
    expect(id.startsWith("INV-")).toBe(true);
  });
});

describe("perbandingan waktu-konstan", () => {
  it("cocok untuk string sama", () => {
    expect(timingSafeEqualStr("rahasia123", "rahasia123")).toBe(true);
  });

  it("tidak cocok untuk string berbeda", () => {
    expect(timingSafeEqualStr("rahasia123", "rahasia124")).toBe(false);
  });

  it("menangani panjang berbeda", () => {
    expect(timingSafeEqualStr("abc", "abcd")).toBe(false);
  });

  it("hex tidak peka huruf besar/kecil", () => {
    expect(timingSafeEqualHex("ABCDEF", "abcdef")).toBe(true);
  });
});

describe("verifyMidtransSignature", () => {
  const n: MidtransNotification = {
    order_id: "INV-1",
    status_code: "200",
    gross_amount: "100000.00",
    transaction_status: "settlement",
  };

  it("menerima tanda tangan yang benar", async () => {
    const key = "server-key-rahasia";
    const expected = `sha512:${n.order_id}${n.status_code}${n.gross_amount}${key}`;
    const fakeSha = async (d: string) => `sha512:${d}`;
    const ok = await verifyMidtransSignature(
      { ...n, signature_key: expected },
      key,
      fakeSha,
    );
    expect(ok).toBe(true);
  });

  it("menolak tanda tangan palsu", async () => {
    const fakeSha = async (d: string) => `sha512:${d}`;
    const ok = await verifyMidtransSignature(
      { ...n, signature_key: "palsu" },
      "server-key-rahasia",
      fakeSha,
    );
    expect(ok).toBe(false);
  });

  it("menolak bila signature_key tidak ada", async () => {
    const fakeSha = async (d: string) => `sha512:${d}`;
    const ok = await verifyMidtransSignature(n, "k", fakeSha);
    expect(ok).toBe(false);
  });
});

describe("verifyXenditCallbackToken", () => {
  it("menerima token yang cocok", () => {
    expect(verifyXenditCallbackToken("tok-abc", "tok-abc")).toBe(true);
  });

  it("menolak token salah atau kosong", () => {
    expect(verifyXenditCallbackToken("tok-abc", "tok-xyz")).toBe(false);
    expect(verifyXenditCallbackToken(null, "tok-abc")).toBe(false);
    expect(verifyXenditCallbackToken("", "tok-abc")).toBe(false);
  });
});

describe("statusToPaidAt", () => {
  it("hanya SETTLEMENT yang dianggap sudah dibayar", () => {
    expect(statusToPaidAt("SETTLEMENT")).toBe(true);
    expect(statusToPaidAt("PENDING")).toBe(false);
    expect(statusToPaidAt("EXPIRE")).toBe(false);
    expect(statusToPaidAt("FAILED")).toBe(false);
    expect(statusToPaidAt("REFUND")).toBe(false);
  });
});
