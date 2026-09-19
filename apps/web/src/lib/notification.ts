/**
 * Logika notifikasi — MURNI (tanpa DB) agar mudah diuji.
 *
 * Mencakup: render template, jam wajar pengiriman, dan backoff percobaan ulang.
 */

/* ============================================================
 * RENDER TEMPLATE
 * ============================================================ */

/** Pola variabel: {{nama}}, {{nama_siswa}}, {{ kelas }} (spasi diizinkan). */
const VAR_PATTERN = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

export type TemplateVars = Record<string, string | number | null | undefined>;

/**
 * Ganti variabel {{kunci}} dengan nilainya.
 *
 * Kalau variabel tidak tersedia, dipakai nilai pengganti "-" agar pesan tidak
 * terkirim dengan "{{nama}}" mentah ke orang tua — itu terlihat seperti sistem
 * rusak. `strict` mengembalikan daftar variabel yang hilang untuk UI.
 */
export function renderTemplate(
  body: string,
  vars: TemplateVars,
  options: { fallback?: string } = {},
): string {
  const fallback = options.fallback ?? "-";
  return body.replace(VAR_PATTERN, (_m, key: string) => {
    const v = vars[key];
    if (v === null || v === undefined || v === "") return fallback;
    return String(v);
  });
}

/** Daftar variabel yang dipakai dalam sebuah template. */
export function extractVariables(body: string): string[] {
  const found = new Set<string>();
  // `matchAll` bergantung target ES2015+; loop ini aman di semua target.
  const re = new RegExp(VAR_PATTERN.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    found.add(m[1]);
  }
  return Array.from(found).sort();
}

/** Variabel yang belum terisi (untuk peringatan di UI). */
export function missingVariables(body: string, vars: TemplateVars): string[] {
  return extractVariables(body).filter(
    (k) => vars[k] === null || vars[k] === undefined || vars[k] === "",
  );
}

/** Pratinjau: tampilkan isi pesan dengan contoh nilai. */
export function previewTemplate(body: string, sample: TemplateVars): string {
  return renderTemplate(body, sample, { fallback: "…" });
}

/* ============================================================
 * JAM WAJAR PENGIRIMAN
 * ============================================================ */

export type SendWindow = {
  /** Jam mulai boleh kirim (0-23). */
  startHour: number;
  /** Jam terakhir boleh kirim (0-23). */
  endHour: number;
  /** Kirim juga pada hari Minggu? */
  allowSunday: boolean;
};

export const DEFAULT_SEND_WINDOW: SendWindow = {
  startHour: 7,
  endHour: 20,
  allowSunday: false,
};

/**
 * Hitung waktu kirim yang menghormati jam wajar.
 *
 * Alasannya nyata: notifikasi absen bisa dibuat jam 23:30 oleh guru yang lembur.
 * Mengirim WA "anak Anda alpa hari ini" pada tengah malam akan membuat orang tua
 * panik. Pesan ditahan sampai jendela kirim berikutnya.
 *
 * @param now   waktu sekarang
 * @param win   jendela jam wajar
 * @param tz    offset zona waktu dalam menit (mis. WIB = +420)
 */
export function nextSendTime(
  now: Date = new Date(),
  win: SendWindow = DEFAULT_SEND_WINDOW,
  tz = 420,
): Date {
  // Kerjakan dalam waktu lokal (bergeser sesuai zona), lalu kembalikan ke UTC.
  const local = new Date(now.getTime() + tz * 60_000);
  const hour = local.getUTCHours();
  const day = local.getUTCDay(); // 0 = Minggu

  const withinHours = hour >= win.startHour && hour < win.endHour;
  const dayOk = win.allowSunday || day !== 0;

  if (withinHours && dayOk) return now;

  // Cari batas berikutnya.
  const candidate = new Date(local);
  candidate.setUTCMinutes(0, 0, 0);

  if (hour >= win.endHour || !dayOk) {
    // Sudah lewat jendela hari ini (atau hari Minggu) → mulai hari berikutnya.
    candidate.setUTCDate(candidate.getUTCDate() + 1);
  }
  candidate.setUTCHours(win.startHour, 0, 0, 0);

  // Lewati hari Minggu bila tidak diizinkan.
  if (!win.allowSunday) {
    let guard = 0;
    while (candidate.getUTCDay() === 0 && guard < 8) {
      candidate.setUTCDate(candidate.getUTCDate() + 1);
      candidate.setUTCHours(win.startHour, 0, 0, 0);
      guard += 1;
    }
  }

  return new Date(candidate.getTime() - tz * 60_000);
}

/* ============================================================
 * BACKOFF PERCOBAAN ULANG
 * ============================================================ */

export const MAX_ATTEMPTS = 4;

/**
 * Jeda (menit) sebelum percobaan ke-`attempt`.
 * Bertambah secara eksponensial: 1, 5, 15, 60 menit.
 *
 * Kenapa penting: WhatsApp memblokir nomor yang mengirim terlalu cepat setelah
 * gagal. Menunggu lebih lama pada setiap kegagalan menjaga nomor sekolah tetap
 * aman dan memberi waktu masalah jaringan pulih sendiri.
 */
export const BACKOFF_MINUTES = [1, 5, 15, 60] as const;

export function backoffMinutes(attempt: number): number {
  const idx = Math.max(0, Math.min(attempt - 1, BACKOFF_MINUTES.length - 1));
  return BACKOFF_MINUTES[idx];
}

/** Waktu percobaan berikutnya (atau null bila sudah habis jatah). */
export function nextAttemptAt(
  attempt: number,
  now: Date = new Date(),
): Date | null {
  if (attempt >= MAX_ATTEMPTS) return null;
  return new Date(now.getTime() + backoffMinutes(attempt + 1) * 60_000);
}

/**
 * Klasifikasi pesan galat dari gateway.
 * Galat permanen (nomor tidak ada) tidak perlu dicoba ulang.
 *
 * PENTING: pesan galat dari wa-gateway berbahasa INDONESIA
 * ("Nomor tidak terdaftar di WhatsApp"), sedangkan galat pustaka Baileys
 * berbahasa Inggris. Keduanya harus dikenali — kalau tidak, nomor yang sudah
 * tidak aktif akan dicoba berulang kali dan membuang kuota sekolah.
 */
export function isPermanentFailure(error: string): boolean {
  const e = String(error ?? "").toLowerCase();
  return (
    // Indonesia
    e.includes("tidak terdaftar") ||
    e.includes("nomor tidak valid") ||
    e.includes("bukan nomor") ||
    // Inggris (Baileys / provider)
    e.includes("not registered") ||
    e.includes("invalid number") ||
    e.includes("no lid") ||
    e.includes("phone number does not exist") ||
    e.includes("not on whatsapp")
  );
}

/** Ringkas hasil pengiriman untuk ditampilkan di UI. */
export function summarizeQueue(
  rows: { status: string; attempts: number }[],
): {
  total: number;
  queued: number;
  processing: number;
  sent: number;
  failed: number;
  cancelled: number;
  successRate: number;
} {
  const counts = {
    QUEUED: 0,
    PROCESSING: 0,
    SENT: 0,
    FAILED: 0,
    CANCELLED: 0,
  };
  for (const r of rows) {
    if (r.status in counts) counts[r.status as keyof typeof counts] += 1;
  }
  const attempted = counts.SENT + counts.FAILED;
  return {
    total: rows.length,
    queued: counts.QUEUED,
    processing: counts.PROCESSING,
    sent: counts.SENT,
    failed: counts.FAILED,
    cancelled: counts.CANCELLED,
    successRate:
      attempted === 0 ? 0 : Math.round((counts.SENT / attempted) * 1000) / 10,
  };
}

/** Bersihkan isi pesan sebelum disimpan (buang ruang berlebih). */
export function cleanMessage(body: string): string {
  return body.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Potong pesan agar tidak melebihi batas praktis WhatsApp.
 * Dipotong pada batas baris agar tidak memutus kalimat di tengah kata.
 */
export function clampMessage(body: string, max = 4096): string {
  if (body.length <= max) return body;
  const cut = body.slice(0, max - 1);
  const lastBreak = cut.lastIndexOf("\n");
  return `${lastBreak > max * 0.5 ? cut.slice(0, lastBreak) : cut}…`;
}

/**
 * Bangun daftar penerima unik dari siswa + orang tua/wali.
 * Nomor dinormalisasi; duplikat dibuang agar tidak ada dua pesan sama.
 */
export function uniqueRecipients(
  items: { name?: string | null; phone?: string | null }[],
): { name: string; phone: string }[] {
  const seen = new Set<string>();
  const out: { name: string; phone: string }[] = [];
  for (const it of items) {
    const phone = normalizePhone(it.phone);
    if (!phone || seen.has(phone)) continue;
    seen.add(phone);
    out.push({ name: it.name ?? "", phone });
  }
  return out;
}

/**
 * Normalisasi nomor telepon ke format E.164 tanpa "+" (aturan proyek).
 * Menerima "0812-3456-7890", "+62 812 3456 7890", "62812...".
 * Mengembalikan null bila nomor jelas tidak valid.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = String(raw).replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  // Buang awalan 0 → 62 (Indonesia).
  if (d.startsWith("0")) d = `62${d.slice(1)}`;
  else if (d.startsWith("8")) d = `62${d}`;
  // Nomor Indonesia yang sah: 62 diikuti 8xx, panjang 10-15 digit.
  if (!d.startsWith("62")) return null;
  if (d.length < 10 || d.length > 15) return null;
  if (!/^62\d+$/.test(d)) return null;
  return d;
}
