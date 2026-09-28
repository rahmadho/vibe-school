/**
 * ============================================================
 * KWITANSI — bagian MURNI (tanpa DB / PDFKit)
 * ============================================================
 *
 * Dipisahkan supaya aturan penomoran & penyajian bisa diuji tanpa database dan
 * tanpa menghasilkan berkas PDF.
 */

/** Kunci periode penomoran: "202609" untuk September 2026. */
export function periodeKwitansi(tanggal: Date): string {
  const y = tanggal.getFullYear();
  const m = String(tanggal.getMonth() + 1).padStart(2, "0");
  return `${y}${m}`;
}

/**
 * Bentuk nomor kwitansi: KWT/202609/0007
 *
 * Urutan nomor DI-RESET tiap bulan. Alasannya praktis: bendahara mencari
 * kwitansi berdasarkan bulan, dan "KWT/202609/0007" langsung memberi tahu
 * kapan dokumen itu dibuat. Penomoran yang terus naik lintas tahun akan
 * menghasilkan angka panjang yang tidak berguna.
 */
export function nomorKwitansi(periode: string, urut: number, pad = 4): string {
  return `KWT/${periode}/${String(urut).padStart(pad, "0")}`;
}

/** Bentuk nomor nota (rincian banyak tagihan). */
export function nomorNota(periode: string, urut: number, pad = 4): string {
  return `NOTA/${periode}/${String(urut).padStart(pad, "0")}`;
}

/**
 * Nominal dalam kata (bahasa Indonesia).
 *
 * Kwitansi resmi WAJIB memuat jumlah uang dalam huruf — ini yang membuat
 * kwitansi sulit diubah tanpa ketahuan: mengubah angka "1.500.000" menjadi
 * "7.500.000" akan bertabrakan dengan tulisan "satu juta lima ratus ribu".
 *
 * Mengembalikan "" untuk 0, dan menandai negatif secara eksplisit (nominal
 * negatif menandakan kesalahan input, jadi harus terlihat mencolok).
 */
export function nominalKeKata(nilai: number): string {
  if (!Number.isFinite(nilai)) return "";
  if (nilai === 0) return "nol rupiah";

  const negatif = nilai < 0;
  let n = Math.abs(Math.round(nilai));

  const satuan = [
    "", "satu", "dua", "tiga", "empat", "lima",
    "enam", "tujuh", "delapan", "sembilan", "sepuluh", "sebelas",
  ];

  function terbilang(x: number): string {
    if (x < 12) return satuan[x];
    if (x < 20) return `${terbilang(x - 10)} belas`;
    if (x < 100) {
      const puluh = Math.floor(x / 10);
      const sisa = x % 10;
      return `${satuan[puluh]} puluh${sisa ? ` ${terbilang(sisa)}` : ""}`;
    }
    if (x < 200) {
      const sisa = x - 100;
      return `seratus${sisa ? ` ${terbilang(sisa)}` : ""}`;
    }
    if (x < 1000) {
      const ratus = Math.floor(x / 100);
      const sisa = x % 100;
      return `${satuan[ratus]} ratus${sisa ? ` ${terbilang(sisa)}` : ""}`;
    }
    if (x < 2000) {
      const sisa = x - 1000;
      return `seribu${sisa ? ` ${terbilang(sisa)}` : ""}`;
    }
    if (x < 1_000_000) {
      const ribu = Math.floor(x / 1000);
      const sisa = x % 1000;
      return `${terbilang(ribu)} ribu${sisa ? ` ${terbilang(sisa)}` : ""}`;
    }
    if (x < 1_000_000_000) {
      const juta = Math.floor(x / 1_000_000);
      const sisa = x % 1_000_000;
      return `${terbilang(juta)} juta${sisa ? ` ${terbilang(sisa)}` : ""}`;
    }
    if (x < 1_000_000_000_000) {
      const miliar = Math.floor(x / 1_000_000_000);
      const sisa = x % 1_000_000_000;
      return `${terbilang(miliar)} miliar${sisa ? ` ${terbilang(sisa)}` : ""}`;
    }
    const triliun = Math.floor(x / 1_000_000_000_000);
    const sisa = x % 1_000_000_000_000;
    return `${terbilang(triliun)} triliun${sisa ? ` ${terbilang(sisa)}` : ""}`;
  }

  n = Math.floor(n);
  const kata = terbilang(n).replace(/\s+/g, " ").trim();
  const hasil = `${kata} rupiah`;
  return negatif ? `minus ${hasil}` : hasil;
}

/** Kapitalkan awal kalimat tanpa merusak huruf lain. */
export function kapitalkanAwal(teks: string): string {
  if (!teks) return teks;
  return teks.charAt(0).toUpperCase() + teks.slice(1);
}

/** Nama bulan Indonesia untuk kop/kwitansi. */
const BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

/** Tanggal dalam bahasa Indonesia: "20 September 2026". */
export function tanggalIndonesia(tanggal: Date | null | undefined): string {
  if (!tanggal || Number.isNaN(tanggal.getTime())) return "—";
  return `${tanggal.getDate()} ${BULAN[tanggal.getMonth()]} ${tanggal.getFullYear()}`;
}

/**
 * Label "Untuk pembayaran" pada kwitansi.
 *
 * Kwitansi sering dipakai sebagai bukti di luar sekolah (penggantian biaya
 * perusahaan, klaam asuransi), jadi keterangannya harus bisa berdiri sendiri
 * tanpa orang harus membuka aplikasi.
 */
export function keteranganPembayaran(input: {
  invoiceTitle: string;
  invoiceNo: string;
  studentName: string;
  className?: string | null;
}): string {
  const kelas = input.className ? ` (${input.className})` : "";
  return `${input.invoiceTitle} — ${input.invoiceNo} — a.n. ${input.studentName}${kelas}`;
}

/**
 * Penanda kwitansi batal, ditulis besar di tengah dokumen.
 *
 * Kwitansi batal TIDAK dihapus dan nomornya TIDAK dipakai ulang. Cetakan lama
 * yang sudah dipegang orang tua harus tetap bisa dikenali sebagai batal saat
 * dicetak ulang — kalau tidak, dua lembar kwitansi dengan nomor sama bisa
 * dipakai untuk mengeklaim pembayaran yang sama dua kali.
 */
export function adalahBatal(cancelledAt: Date | null | undefined): boolean {
  return Boolean(cancelledAt);
}
