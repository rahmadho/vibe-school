/**
 * Label & gaya status antrean notifikasi.
 *
 * Dipisah dari lib/notification.ts karena file ini dipakai komponen KLIEN,
 * sementara notification.ts berisi util yang dipakai server.
 */

export const QUEUE_STATUSES = [
  "QUEUED",
  "PROCESSING",
  "SENT",
  "FAILED",
  "CANCELLED",
] as const;
export type QueueStatusValue = (typeof QUEUE_STATUSES)[number];

export const QUEUE_STATUS_LABEL: Record<QueueStatusValue, string> = {
  QUEUED: "Menunggu",
  PROCESSING: "Diproses",
  SENT: "Terkirim",
  FAILED: "Gagal",
  CANCELLED: "Dibatalkan",
};

/** Kelas Tailwind untuk titik status + teks. */
export const QUEUE_STATUS_TONE: Record<QueueStatusValue, string> = {
  QUEUED: "text-slate",
  PROCESSING: "text-ink",
  SENT: "text-emerald-700",
  FAILED: "text-marker",
  CANCELLED: "text-slate line-through",
};

/** Warna titik indikator (untuk tabel seperti buku induk). */
export const QUEUE_STATUS_DOT: Record<QueueStatusValue, string> = {
  QUEUED: "bg-slate-400",
  PROCESSING: "bg-amber-500",
  SENT: "bg-emerald-600",
  FAILED: "bg-red-600",
  CANCELLED: "bg-slate-300",
};

export const REF_TYPE_LABEL: Record<string, string> = {
  ATTENDANCE: "Absensi",
  INVOICE: "Tagihan",
  GRADE: "Nilai",
  ANNOUNCEMENT: "Pengumuman",
  REGISTRATION: "SPMB",
  TEST: "Uji coba",
};

export const WA_STATUS_LABEL: Record<string, string> = {
  Connected: "Tersambung",
  Pairing: "Menunggu pindai QR",
  Disconnected: "Terputus",
  LoggedOut: "Keluar",
};

export const WA_STATUS_TONE: Record<string, string> = {
  Connected: "text-emerald-700",
  Pairing: "text-amber-700",
  Disconnected: "text-slate",
  LoggedOut: "text-marker",
};
