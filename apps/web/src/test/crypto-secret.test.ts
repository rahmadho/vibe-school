import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { encryptSecret, decryptSecret, maskSecret, last4 } from "@/lib/crypto-secret";

/**
 * Uji enkripsi kredensial. Modul ini menandai "server-only", jadi stub
 * dipakai lewat alias di vitest.config (src/test/stubs/server-only.ts).
 */

const KEY = "a".repeat(64); // 32 byte dalam heksadesimal

beforeEach(() => {
  process.env.PAYMENT_ENCRYPTION_KEY = KEY;
});

afterEach(() => {
  delete process.env.PAYMENT_ENCRYPTION_KEY;
});

describe("encryptSecret / decryptSecret", () => {
  it("bolak-balik menghasilkan nilai yang sama", () => {
    const plain = "SB-Mid-server-ABC123xyz";
    const cipher = encryptSecret(plain);
    expect(cipher).not.toBe(plain);
    expect(decryptSecret(cipher)).toBe(plain);
  });

  it("ciphertext berbeda setiap kali (IV acak)", () => {
    const plain = "rahasia-sama";
    const a = encryptSecret(plain);
    const b = encryptSecret(plain);
    expect(a).not.toBe(b);
    // Tapi keduanya mendekripsi ke nilai yang sama.
    expect(decryptSecret(a)).toBe(plain);
    expect(decryptSecret(b)).toBe(plain);
  });

  it("mendeteksi ciphertext yang diubah (auth tag GCM)", () => {
    const cipher = encryptSecret("rahasia-penting");
    const buf = Buffer.from(cipher, "base64");
    // Ubah satu byte di bagian ciphertext.
    buf[buf.length - 1] ^= 0xff;
    const tampered = buf.toString("base64");
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("gagal bila kunci berbeda", () => {
    const cipher = encryptSecret("rahasia");
    process.env.PAYMENT_ENCRYPTION_KEY = "b".repeat(64);
    expect(() => decryptSecret(cipher)).toThrow();
  });

  it("menerima kunci dalam format base64", () => {
    const b64 = Buffer.alloc(32, 7).toString("base64");
    process.env.PAYMENT_ENCRYPTION_KEY = b64;
    const cipher = encryptSecret("halo");
    expect(decryptSecret(cipher)).toBe("halo");
  });

  it("menolak bila kunci belum diatur", () => {
    delete process.env.PAYMENT_ENCRYPTION_KEY;
    expect(() => encryptSecret("x")).toThrow(/PAYMENT_ENCRYPTION_KEY/);
  });

  it("menolak kunci dengan panjang salah", () => {
    process.env.PAYMENT_ENCRYPTION_KEY = "abcd";
    expect(() => encryptSecret("x")).toThrow(/32 byte/);
  });

  it("mendukung karakter non-ASCII", () => {
    const plain = "kunci-rahasia-日本-ü";
    expect(decryptSecret(encryptSecret(plain))).toBe(plain);
  });
});

describe("maskSecret / last4", () => {
  it("mengambil 4 karakter terakhir", () => {
    expect(last4("SB-Mid-server-3f2a")).toBe("3f2a");
  });

  it("membuat masker tampilan", () => {
    expect(maskSecret("SB-Mid-server-3f2a")).toBe("••••3f2a");
  });
});
