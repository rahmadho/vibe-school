/**
 * Helper format untuk isi pesan WhatsApp.
 *
 * Kenapa ada: WA hanya punya teks — tidak ada tabel, kolom, atau lampiran
 * ringkas. Daftar nilai/tagihan yang panjang, kalau ditempel apa adanya, jadi
 * dinding teks dan bisa melewati batas 4096 karakter (clampMessage memotong
 * pesan, jadi info penting di bawah bisa hilang). Karena itu setiap daftar
 * dipotong ke jumlah baris wajar dan diberi suffix "dan N ... lain".
 *
 * Modul ini sengaja TANPA import server-only agar bisa dipakai seed, worker,
 * maupun pratinjau UI.
 */

const RUPIAH = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });
const TANGGAL = new Intl.DateTimeFormat("id-ID", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const TANGGAL_PENDEK = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" });

/** 'Rp1.500.000' — tanpa desimal. */
export function formatRupiah(n: number | string): string {
  const v = typeof n === "string" ? Number(n) : n;
  if (!Number.isFinite(v)) return "Rp0";
  return `Rp${RUPIAH.format(Math.trunc(v))}`;
}

/** 'Senin, 3 November 2025' — aman untuk Date maupun string ISO. */
export function formatTanggal(d: Date | string): string {
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "-";
  return TANGGAL.format(date);
}

/** '07:15' — normalisasi "7:5"/"07.15" -> "07:15". */
export function formatJam(waktu: string): string {
  const m = /^(\d{1,2})[:.](\d{1,2})/.exec(waktu.trim());
  if (!m) return waktu.trim();
  return `${m[1].padStart(2, "0")}:${m[2].padStart(2, "0")}`;
}

export type ItemNilai = { mapel: string; nilai: number | string };
export type ItemTagihan = { judul: string; jumlah: number; jatuhTempo?: string };

/**
 * Baris '• Matematika — 82' + ' *' untuk nilai di bawah KKM, max 8 mapel.
 * Keterangan ' *' dijelaskan di baris penutup.
 */
export function formatDaftarNilai(items: ItemNilai[], opts: { kkm?: number } = {}): string {
  const maks = 8;
  const kkm = opts.kkm;
  const below: string[] = [];
  const baris = items.slice(0, maks).map((it) => {
    const nilai = Number(it.nilai);
    const rendah = kkm !== undefined && Number.isFinite(nilai) && nilai < kkm;
    if (rendah) below.push(it.mapel);
    const angka = Number.isFinite(nilai) ? String(nilai) : String(it.nilai);
    return `• ${it.mapel} — ${angka}${rendah ? " *" : ""}`;
  });
  if (items.length > maks) baris.push(`• dan ${items.length - maks} mapel lain`);
  if (below.length) baris.push(`* di bawah KKM ${kkm}`);
  return baris.join("\n");
}

/** Baris '• SPP November — Rp350.000 (tempo 10 Nov)', max 5 tagihan. */
export function formatDaftarTagihan(items: ItemTagihan[], opts: { maks?: number } = {}): string {
  const maks = opts.maks ?? 5;
  const baris = items.slice(0, maks).map((it) => {
    const tempo = it.jatuhTempo
      ? ` (tempo ${TANGGAL_PENDEK.format(new Date(it.jatuhTempo))})`
      : "";
    return `• ${it.judul} — ${formatRupiah(it.jumlah)}${tempo}`;
  });
  if (items.length > maks) baris.push(`• dan ${items.length - maks} tagihan lain`);
  return baris.join("\n");
}
