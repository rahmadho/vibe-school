import "server-only";

/**
 * Public API pembuat PDF kwitansi/nota — HANYA untuk pemakaian di dalam
 * konteks Next.js (Server Components / Route Handlers).
 *
 * Logika asli ada di `kwitansi-pdf-inti.ts` agar bisa dipakai ULANG di luar
 * runtime Next — mis. pembuatan Rapor PDF massal (satu kelas = 30 berkas)
 * yang sebaiknya dikerjakan worker, bukan di dalam request HTTP.
 *
 * Pola ini sama dengan `password.ts` / `password-hash.ts`.
 */
export {
  buatKwitansiPdf,
  buatNotaPdf,
  pdfKeBuffer,
  type KopSekolah,
  type DataKwitansi,
  type DataNota,
} from "./kwitansi-pdf-inti";
