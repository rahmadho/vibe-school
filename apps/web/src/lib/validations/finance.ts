import { z } from "zod";
import { optionalText } from "./common";

/**
 * Validasi Keuangan: jenis biaya, tagihan, pembayaran, konfigurasi gateway.
 *
 * Catatan: semua nominal rupiah INTEGER (tanpa pecahan).
 */

/** Nominal uang: bilangan bulat ≥ 1 (Rupiah). */
const moneyField = z.coerce
  .number()
  .int("Nominal harus bilangan bulat (Rupiah)")
  .min(1, "Nominal harus lebih dari nol")
  .max(1_000_000_000, "Nominal terlalu besar");

/* ============================================================
 * JENIS BIAYA
 * ============================================================ */

export const feeTypeCreateSchema = z.object({
  name: z.string().trim().min(1, "Nama wajib diisi").max(80),
  code: z
    .string()
    .trim()
    .min(1, "Kode wajib diisi")
    .max(20)
    .regex(/^[A-Za-z0-9_-]+$/, "Kode hanya huruf, angka, - dan _")
    .transform((v) => v.toUpperCase()),
  amount: moneyField,
  recurring: z
    .union([z.literal("on"), z.literal("true"), z.boolean()])
    .optional()
    .transform((v) => v === "on" || v === "true" || v === true),
  isActive: z
    .union([z.literal("on"), z.boolean()])
    .optional()
    .transform((v) => v === "on" || v === true),
});

export const feeTypeUpdateSchema = feeTypeCreateSchema.extend({
  id: z.string().min(1),
});

/* ============================================================
 * TAGIHAN
 * ============================================================ */

export const invoiceItemSchema = z.object({
  feeTypeId: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v === "" || v === undefined ? undefined : v)),
  description: z.string().trim().min(1, "Keterangan wajib diisi").max(120),
  amount: moneyField,
  quantity: z.coerce.number().int().min(1).max(100).default(1),
});

export const invoiceCreateSchema = z.object({
  studentId: z.string().min(1, "Pilih siswa"),
  title: z.string().trim().min(1, "Judul tagihan wajib diisi").max(120),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal: YYYY-MM-DD"),
  note: optionalText(200),
  items: z.array(invoiceItemSchema).min(1, "Minimal satu rincian tagihan"),
});

export type InvoiceCreateInput = z.infer<typeof invoiceCreateSchema>;

/** Tagihan massal: satu judul, satu jatuh tempo, banyak siswa. */
export const invoiceBulkSchema = z.object({
  classId: z.string().min(1, "Pilih kelas"),
  title: z.string().trim().min(1, "Judul tagihan wajib diisi").max(120),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal: YYYY-MM-DD"),
  feeTypeId: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v === "" || v === undefined ? undefined : v)),
  amount: moneyField,
  note: optionalText(200),
  studentIds: z.array(z.string().min(1)).min(1, "Pilih minimal satu siswa"),
});

/* ============================================================
 * PEMBAYARAN
 * ============================================================ */

export const paymentCreateSchema = z.object({
  invoiceId: z.string().min(1, "Tagihan tidak diketahui"),
  amount: moneyField,
  methodId: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v === "" || v === undefined ? undefined : v)),
  paidAt: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v === "" || v === undefined ? undefined : v)),
  reference: optionalText(60),
  note: optionalText(200),
  /** Nomor bukti transfer / catatan kas. */
  proofUrl: optionalText(300),
});

export type PaymentCreateInput = z.infer<typeof paymentCreateSchema>;

export const paymentMethodCreateSchema = z.object({
  name: z.string().trim().min(1, "Nama wajib diisi").max(60),
  code: z
    .string()
    .trim()
    .min(1, "Kode wajib diisi")
    .max(20)
    .regex(/^[A-Za-z0-9_-]+$/, "Kode hanya huruf, angka, - dan _")
    .transform((v) => v.toUpperCase()),
});

/* ============================================================
 * KONFIGURASI GATEWAY
 * ============================================================ */

export const GATEWAY_PROVIDERS = ["MIDTRANS", "XENDIT", "MANUAL"] as const;
export type GatewayProviderValue = (typeof GATEWAY_PROVIDERS)[number];

export const GATEWAY_LABEL: Record<GatewayProviderValue, string> = {
  MIDTRANS: "Midtrans",
  XENDIT: "Xendit",
  MANUAL: "Manual (tanpa gateway)",
};

export const gatewayConfigSchema = z.object({
  provider: z.enum(GATEWAY_PROVIDERS),
  environment: z.enum(["sandbox", "production"]).default("sandbox"),
  /** Dikosongkan = jangan ubah kredensial yang sudah tersimpan. */
  serverKey: optionalText(200),
  clientKey: optionalText(200),
  orderPrefix: optionalText(20),
  isActive: z
    .union([z.literal("on"), z.boolean()])
    .optional()
    .transform((v) => v === "on" || v === true),
  /** Kanal dipilih sebagai daftar bernama (checkbox). */
  channels: z
    .union([z.array(z.string()), z.string()])
    .optional()
    .transform((v) => {
      if (v === undefined) return [];
      return Array.isArray(v) ? v : [v];
    }),
});

export type GatewayConfigInput = z.infer<typeof gatewayConfigSchema>;

/** Kanal umum yang didukung (untuk checkbox di UI). */
export const GATEWAY_CHANNELS: Record<
  GatewayProviderValue,
  { id: string; label: string }[]
> = {
  MIDTRANS: [
    { id: "qris", label: "QRIS" },
    { id: "bca_va", label: "VA BCA" },
    { id: "bni_va", label: "VA BNI" },
    { id: "bri_va", label: "VA BRI" },
    { id: "mandiri_bill", label: "Mandiri Bill" },
    { id: "gopay", label: "GoPay" },
    { id: "shopeepay", label: "ShopeePay" },
  ],
  XENDIT: [
    { id: "QRIS", label: "QRIS" },
    { id: "BCA", label: "VA BCA" },
    { id: "BNI", label: "VA BNI" },
    { id: "BRI", label: "VA BRI" },
    { id: "OVO", label: "OVO" },
    { id: "DANA", label: "DANA" },
  ],
  MANUAL: [],
};
