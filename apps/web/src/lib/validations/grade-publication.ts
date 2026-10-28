import { z } from "zod";

/**
 * Validasi publikasi nilai (Fase 5).
 * Hanya kelas + semester — keduanya wajib milik sekolah sesi (dicek di action).
 */
export const publishGradesSchema = z.object({
  classId: z.string().trim().min(1, "Pilih kelas"),
  semesterId: z.string().trim().min(1, "Pilih semester"),
});

export const unpublishGradesSchema = z.object({
  id: z.string().trim().min(1, "ID publikasi wajib diisi"),
});
