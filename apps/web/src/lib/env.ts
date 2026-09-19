import { z } from "zod";

/**
 * Validasi environment dengan Zod.
 * Gagal cepat saat start bila ada variabel yang hilang/salah bentuk.
 */
const envSchema = z.object({
  DATABASE_URL: z.string().url().or(z.string().startsWith("postgresql://")),
  NEXTAUTH_SECRET: z.string().min(32, "NEXTAUTH_SECRET minimal 32 karakter"),
  NEXTAUTH_URL: z.string().url().optional(),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DEFAULT_TIMEZONE: z.string().default("Asia/Jakarta"),

  // WA Gateway
  WA_GATEWAY_URL: z.string().url().optional(),
  WA_GATEWAY_TOKEN: z.string().optional(),

  // Seed
  SEED_SUPERADMIN_EMAIL: z.string().email().default("admin@schoolapp.local"),
  SEED_SUPERADMIN_PASSWORD: z.string().min(8).default("changeme12345"),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Parsing env. Di test, kita longgarkan agar unit test tidak butuh .env nyata.
 * Jangan import `env` di kode yang dijalankan saat build tanpa variabel.
 */
export function parseEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Environment tidak valid:\n${issues}`);
  }
  return result.data;
}
