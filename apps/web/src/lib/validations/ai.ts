import { z } from "zod";
import { AI_PROVIDERS, AI_TONES, AI_LANGUAGES } from "@/lib/ai-providers";

/**
 * Validasi pengaturan AI.
 *
 * `provider` divalidasi terhadap daftar yang dikenal — bukan string bebas —
 * karena nilainya menentukan bentuk permintaan HTTP yang dibuat. Penyedia
 * tak dikenal akan menghasilkan permintaan ke alamat yang salah.
 */

const providerIds = AI_PROVIDERS.map((p) => p.id) as [string, ...string[]];
const toneValues = AI_TONES.map((t) => t.value) as [string, ...string[]];
const languageValues = AI_LANGUAGES.map((l) => l.value) as [string, ...string[]];

export const aiSettingSchema = z.object({
  provider: z.enum(providerIds, { message: "Penyedia AI tidak dikenal" }),
  model: z
    .string()
    .trim()
    .max(120, "Nama model maksimal 120 karakter")
    .optional()
    .default(""),
  baseUrl: z
    .union([
      z.literal(""),
      z.string().trim().url("Alamat dasar harus berupa URL lengkap (https://…)"),
    ])
    .optional()
    .default(""),
  /** Kunci API. Kosong = jangan ubah kunci yang tersimpan. */
  apiKey: z.string().trim().max(300).optional().default(""),
  /** Hapus kunci yang tersimpan. */
  clearApiKey: z
    .union([z.literal("on"), z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((v) => v === true || v === "on" || v === "true"),
  isActive: z
    .union([z.literal("on"), z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((v) => v === true || v === "on" || v === "true"),
  tone: z.enum(toneValues, { message: "Nada tulisan tidak dikenal" }).default("formal"),
  language: z
    .enum(languageValues, { message: "Bahasa tidak dikenal" })
    .default("id"),
});

export type AiSettingInput = z.infer<typeof aiSettingSchema>;

/** Validasi permintaan pembuatan tulisan. */
export const aiGenerateSchema = z.object({
  brief: z
    .string()
    .trim()
    .min(10, "Tulis arahan minimal 10 karakter agar AI punya bahan")
    .max(2000, "Arahan terlalu panjang"),
  title: z.string().trim().max(160).optional().default(""),
  kind: z.enum(["NEWS", "ANNOUNCEMENT", "AGENDA", "GALLERY"]).default("NEWS"),
});

export type AiGenerateInput = z.infer<typeof aiGenerateSchema>;
