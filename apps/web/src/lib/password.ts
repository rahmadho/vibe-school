import "server-only";
import { randomBytes, scrypt as _scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";
import type { ScryptOptions } from "crypto";

// promisify tidak membawa overload beropsi; beri tipe eksplisit.
const scrypt = promisify(_scrypt) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options?: ScryptOptions,
) => Promise<Buffer>;

/**
 * Hashing password dengan scrypt bawaan Node (tanpa dependensi native).
 *
 * Format tersimpan:  scrypt$N$r$p$<salt-hex>$<hash-hex>
 * Parameternya disimpan bersama hash agar bisa dinaikkan di masa depan
 * tanpa merusak hash lama.
 *
 * Catatan: PRD menyebut argon2/bcrypt. scrypt dipilih agar tidak butuh
 * kompilasi native di VPS sekolah (portabilitas). Bila ingin argon2, ganti
 * implementasi ini — antarmuka (hashPassword/verifyPassword) tetap sama.
 */

const N = 16384; // CPU/memory cost
const r = 8;
const p = 1;
const KEYLEN = 64;

export async function hashPassword(password: string): Promise<string> {
  if (typeof password !== "string" || password.length < 8) {
    throw new Error("Password minimal 8 karakter.");
  }
  const salt = randomBytes(16);
  const derived = (await scrypt(password, salt, KEYLEN, { N, r, p })) as Buffer;
  return ["scrypt", N, r, p, salt.toString("hex"), derived.toString("hex")].join(
    "$",
  );
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  try {
    const [scheme, nStr, rStr, pStr, saltHex, hashHex] = stored.split("$");
    if (scheme !== "scrypt") return false;

    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(hashHex, "hex");
    const derived = (await scrypt(password, salt, expected.length, {
      N: Number(nStr),
      r: Number(rStr),
      p: Number(pStr),
    })) as Buffer;

    // Perbandingan waktu-konstan
    return derived.length === expected.length && timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}
