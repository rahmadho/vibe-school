/**
 * Bentuk hasil Server Action yang seragam di seluruh aplikasi.
 * Dipisah dari modul server agar aman diimpor komponen client (tipe saja).
 */
export type ActionResult =
  | { ok: true; id?: string; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };
