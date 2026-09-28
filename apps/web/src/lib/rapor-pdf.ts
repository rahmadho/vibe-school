import "server-only";

/**
 * Public API pembuat Rapor PDF — HANYA untuk pemakaian di dalam konteks
 * Next.js (Server Components / Route Handlers).
 *
 * Logika asli ada di `rapor-pdf-inti.ts` agar bisa dipakai ULANG di luar
 * runtime Next — pencetakan rapor satu kelas (30 berkas) sebaiknya
 * dikerjakan worker, bukan di dalam request HTTP yang bisa timeout.
 *
 * Pola ini sama dengan `password.ts` / `password-hash.ts`.
 */
export { buatRaporPdf, pdfKeBuffer } from "./rapor-pdf-inti";
