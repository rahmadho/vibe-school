import "server-only";
import {
  randomBytes,
  createCipheriv,
  createDecipheriv,
} from "crypto";

/**
 * Enkripsi kredensial payment gateway (AES-256-GCM).
 *
 * Kunci diambil dari environment PAYMENT_ENCRYPTION_KEY (32 byte, hex/base64).
 * Kredensial TIDAK PERNAH disimpan sebagai teks biasa di database — kalau DB
 * bocor, server key Midtrans tetap tidak terbaca tanpa kunci ini.
 *
 * Format keluaran: base64 dari [iv(12) | tag(16) | ciphertext].
 */

const ALGO = "aes-256-gcm";
const IV_LEN = 12;

function getKey(): Buffer {
  const raw = process.env.PAYMENT_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "PAYMENT_ENCRYPTION_KEY belum diatur. Buat kunci 32 byte (64 karakter hex).",
    );
  }
  // Terima hex (64 char) atau base64.
  const buf = /^[0-9a-fA-F]{64}$/.test(raw)
    ? Buffer.from(raw, "hex")
    : Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error(
      `PAYMENT_ENCRYPTION_KEY harus 32 byte (dapat ${buf.length} byte).`,
    );
  }
  return buf;
}

/** Enkripsi sebuah nilai rahasia. Mengembalikan ciphertext base64. */
export function encryptSecret(plain: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

/** Dekripsi ciphertext base64. Melempar bila kunci salah atau data rusak. */
export function decryptSecret(payload: string): string {
  const key = getKey();
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + 16);
  const data = buf.subarray(IV_LEN + 16);
  const decipher = createDecipheriv(ALGO, key, iv);
  // Auth tag membuat perubahan sekecil apa pun pada ciphertext terdeteksi.
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

/** Ambil 4 karakter terakhir untuk ditampilkan di UI tanpa mendekripsi. */
export function last4(secret: string): string {
  return secret.slice(-4);
}

/** Masker tampilan: "••••3f2a". */
export function maskSecret(secret: string): string {
  return `••••${last4(secret)}`;
}
