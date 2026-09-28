/**
 * ============================================================
 * BENTUK & FORMAT RAPOR — MURNI (tanpa DB / PDFKit)
 * ============================================================
 *
 * Dipisahkan agar bisa diuji tanpa database, dan agar pembuat PDF
 * (`rapor-pdf-inti.ts`) tetap bebas `server-only` — rapor massal satu kelas
 * sebaiknya dibuat worker, bukan di dalam request HTTP.
 */

export type BarisNilaiRapor = {
  subjectId: string;
  kodeMapel: string;
  namaMapel: string;
  kkm: number;
  finalScore: number;
  predicate: string | null;
  note: string | null;
};

export type DataRapor = {
  sekolah: {
    name: string;
    npsn: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
    logoUrl: string | null;
  };
  siswa: {
    fullName: string;
    nis: string;
    nisn: string | null;
    gender: string | null;
    birthPlace: string | null;
    birthDate: Date | null;
  };
  kelas: string | null;
  waliKelas: string | null;
  semester: {
    nama: string;
    jenis: string;
    tahunAjaran: string;
  };
  nilai: BarisNilaiRapor[];
  catatanWali: string | null;
  kehadiran: {
    hadir: number;
    sakit: number;
    izin: number;
    alpa: number;
  } | null;
  kepalaSekolah: { nama: string; nip: string | null } | null;
  waliKelasTtd: { nama: string; nip: string | null } | null;
};

const NAMA_BULAN = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

/**
 * "20 September 2026" — format yang lazim di dokumen resmi sekolah.
 *
 * Mengembalikan "—" untuk tanggal kosong/tidak sah, supaya PDF tidak pernah
 * mencetak "Invalid Date" di dokumen yang dipegang orang tua.
 */
export function formatTanggalIndonesia(tanggal: Date | null | undefined): string {
  if (!tanggal) return "—";
  const d = tanggal instanceof Date ? tanggal : new Date(tanggal);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getDate()} ${NAMA_BULAN[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Apakah nilai di bawah KKM (belum tuntas)?
 *
 * Dipakai untuk menandai mapel yang belum tuntas di rapor. Sengaja `<` bukan
 * `<=`: nilai PERSIS KKM berarti tuntas — dan salah menandai siswa yang tuntas
 * sebagai belum tuntas adalah keluhan yang paling sering muncul.
 */
export function belumTuntas(nilai: number, kkm: number): boolean {
  return nilai < kkm;
}

/**
 * Ringkas rekap kehadiran jadi satu baris kalimat.
 *
 * Kehadiran bernilai `null` (belum ada data absensi) ditampilkan sebagai tanda
 * pisah, bukan "0 hari" — "hadir 0 hari" akan membuat orang tua panik.
 */
export function ringkasKehadiran(
  k: DataRapor["kehadiran"],
): string {
  if (!k) return "—";
  return (
    `Hadir: ${k.hadir} hari    ·    Sakit: ${k.sakit} hari    ·    ` +
    `Izin: ${k.izin} hari    ·    Tanpa keterangan: ${k.alpa} hari`
  );
}

/**
 * Judul rapor untuk metadata PDF.
 *
 * Dipakai pada properti `Title` berkas PDF sehingga saat dibuka di peramban,
 * tab-nya menunjukkan nama siswa — memudahkan saat guru membuka 30 rapor.
 */
export function judulRapor(data: DataRapor): string {
  return `Rapor ${data.siswa.fullName} — ${data.semester.nama} ${data.semester.tahunAjaran}`;
}

/**
 * Nama berkas PDF rapor.
 *
 * Contoh: "Rapor-Ahmad-Fauzi-XII-IPA-1-2026-Ganjil.pdf".
 * Nama siswa dibersihkan dari karakter yang tidak sah untuk nama berkas —
 * kalau tidak, nama seperti "Ahmad/Muhammad" bisa merusak path.
 */
export function namaBerkasRapor(data: DataRapor): string {
  const bersih = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  const bagian = [
    "Rapor",
    bersih(data.siswa.fullName),
    data.kelas ? bersih(data.kelas) : null,
    bersih(data.semester.tahunAjaran),
  ].filter(Boolean);

  return `${bagian.join("-")}.pdf`;
}
