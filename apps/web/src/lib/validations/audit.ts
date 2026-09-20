import { z } from "zod";

/**
 * Validasi filter Log Aktivitas.
 *
 * Rentang tanggal memakai bentuk `YYYY-MM-DD` (nilai mentah input date) lalu
 * diubah ke `Date` di query layer — bukan `coerce.date()`, karena nilai itu
 * akan menafsirkan "2025-07-01" sebagai UTC tengah malam dan menggeser hari.
 */

/** Aksi audit — harus sama dengan enum AuditAction di schema.prisma. */
export const AUDIT_ACTIONS = [
  "CREATE",
  "UPDATE",
  "DELETE",
  "LOGIN",
  "LOGOUT",
  "EXPORT",
  "IMPORT",
] as const;

export const auditFilterSchema = z.object({
  q: z.string().trim().max(120).optional(),
  action: z.enum(AUDIT_ACTIONS).optional(),
  entity: z.string().trim().max(60).optional(),
  /** Tanggal mulai, bentuk YYYY-MM-DD. */
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak sah")
    .optional(),
  /** Tanggal akhir, bentuk YYYY-MM-DD. */
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak sah")
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(10).max(100).default(25),
});

export type AuditFilter = z.infer<typeof auditFilterSchema>;
