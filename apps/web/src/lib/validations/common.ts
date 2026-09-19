import { z } from "zod";

/**
 * Util validasi bersama untuk semua entitas.
 * Dikumpulkan di sini agar aturan (HP E.164, kolom opsional, dll) konsisten.
 */

/**
 * Nomor HP: normalisasi ke E.164 tanpa '+' (62812...).
 * Menerima 08xx, 8xx, +62xxx, dan format berpemisah.
 */
export function normalizePhone(input: string): string | undefined {
  const digits = input.replace(/[^\d]/g, "");
  if (!digits) return undefined;
  if (digits.startsWith("0")) return "62" + digits.slice(1);
  if (digits.startsWith("62")) return digits;
  if (digits.startsWith("8")) return "62" + digits;
  return digits;
}

/**
 * Kolom teks opsional: trim, batasi panjang, dan ubah string kosong → undefined.
 * PENTING: transform dijalankan SEBELUM optional, agar "" benar-benar jadi
 * undefined (bukan lolos sebagai string kosong).
 */
export const optionalText = (max = 255) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? undefined : v))
    .optional();

/** Nomor HP opsional dengan normalisasi + validasi. */
export const optionalPhone = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? normalizePhone(v) : undefined))
  .refine((v) => v === undefined || /^62\d{8,14}$/.test(v), {
    message: "Nomor HP tidak valid (contoh: 081234567890)",
  });

/** Email opsional (kosong → undefined). */
export const optionalEmail = z
  .string()
  .trim()
  .max(160)
  .transform((v) => (v === "" ? undefined : v))
  .optional()
  .refine((v) => v === undefined || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), {
    message: "Email tidak valid",
  });

/** ID opsional (select) — kosong → undefined. */
export const optionalId = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .optional();

/** Tahun ajaran: "2025/2026" → validasi pola. */
export const academicYearName = z
  .string()
  .trim()
  .regex(/^\d{4}\/\d{4}$/, "Format tahun ajaran: 2025/2026");
