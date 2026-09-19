/**
 * Template pesan bawaan.
 *
 * Dibuat sebagai "pabrik" agar setiap sekolah baru langsung punya pesan yang
 * rapi, tanpa harus menulis dari nol. Sekolah bebas mengubahnya di UI.
 *
 * Aturan penulisan pesan sekolah:
 *  - Sebut nama siswa & kelas di awal → orang tua langsung tahu ini tentang anaknya.
 *  - Hindari istilah teknis ("tagihan ID INV/202510/0007") di badan pesan.
 *  - Sertakan satu langkah tindakan yang jelas.
 *  - Tanpa tanda seru berlebihan; nada tenang tapi jelas.
 */

export type TemplateSeed = {
  key: string;
  name: string;
  category:
    | "ATTENDANCE"
    | "GRADE"
    | "FINANCE"
    | "ANNOUNCEMENT"
    | "ADMISSION"
    | "GENERAL";
  description: string;
  body: string;
};

export const TEMPLATE_SEEDS: TemplateSeed[] = [
  /* ================= ABSENSI ================= */
  {
    key: "attendance.absent",
    name: "Pemberitahuan alpa",
    category: "ATTENDANCE",
    description: "Dikirim saat siswa berstatus alpa (tanpa keterangan).",
    body: `Assalamualaikum, Bapak/Ibu {{nama_wali}}.

Kami memberitahukan bahwa *{{nama_siswa}}* ({{kelas}}) tidak hadir tanpa keterangan pada *{{tanggal}}*.

Mohon konfirmasi kepada wali kelas bila anak Anda sebenarnya sakit atau ada keperluan lain. Terima kasih.

— {{nama_sekolah}}`,
  },
  {
    key: "attendance.late",
    name: "Pemberitahuan terlambat",
    category: "ATTENDANCE",
    description: "Dikirim saat siswa datang terlambat.",
    body: `Assalamualaikum, Bapak/Ibu {{nama_wali}}.

*{{nama_siswa}}* ({{kelas}}) tercatat datang terlambat pada *{{tanggal}}* pukul {{jam}}.

Kami sampaikan agar Bapak/Ibu dapat membantu anak datang lebih awal. Terima kasih atas perhatiannya.

— {{nama_sekolah}}`,
  },
  {
    key: "attendance.summary",
    name: "Rekap kehadiran bulanan",
    category: "ATTENDANCE",
    description: "Ringkasan kehadiran satu bulan, biasanya dikirim akhir bulan.",
    body: `Assalamualaikum, Bapak/Ibu {{nama_wali}}.

Rekap kehadiran *{{nama_siswa}}* ({{kelas}}) untuk {{periode}}:

Hadir: {{hadir}} hari
Terlambat: {{terlambat}} hari
Sakit: {{sakit}} hari
Izin: {{izin}} hari
Alpa: {{alpa}} hari

Persentase kehadiran: *{{persentase}}%*

Terima kasih.

— {{nama_sekolah}}`,
  },

  /* ================= NILAI ================= */
  {
    key: "grade.below_kkm",
    name: "Nilai di bawah KKM",
    category: "GRADE",
    description: "Dikirim saat nilai siswa baru turun di bawah KKM.",
    body: `Assalamualaikum, Bapak/Ibu {{nama_wali}}.

Nilai *{{mata_pelajaran}}* untuk *{{nama_siswa}}* ({{kelas}}) adalah *{{nilai}}*, sedangkan batas ketuntasan (KKM) adalah {{kkm}}.

Anak Anda akan diikutkan program perbaikan (remedial). Mohon dukungan Bapak/Ibu di rumah.

— {{nama_sekolah}}`,
  },
  {
    key: "grade.report_ready",
    name: "Rapor siap diambil",
    category: "GRADE",
    description: "Pemberitahuan bahwa rapor sudah bisa diambil.",
    body: `Assalamualaikum, Bapak/Ibu {{nama_wali}}.

Rapor *{{nama_siswa}}* ({{kelas}}) untuk {{semester}} sudah siap.

Rapor dapat diambil pada {{tanggal_pengambilan}}. Mohon hadir tepat waktu agar dapat berbincang dengan wali kelas.

— {{nama_sekolah}}`,
  },

  /* ================= KEUANGAN ================= */
  {
    key: "finance.invoice",
    name: "Tagihan baru",
    category: "FINANCE",
    description: "Dikirim saat tagihan baru dibuat.",
    body: `Assalamualaikum, Bapak/Ibu {{nama_wali}}.

Tagihan baru untuk *{{nama_siswa}}* ({{kelas}}):

*{{judul_tagihan}}*
Jumlah: *{{jumlah}}*
Jatuh tempo: {{jatuh_tempo}}

{{tautan_bayar}}

Terima kasih.

— {{nama_sekolah}}`,
  },
  {
    key: "finance.reminder",
    name: "Pengingat jatuh tempo",
    category: "FINANCE",
    description: "Dikirim mendekati atau setelah jatuh tempo.",
    body: `Assalamualaikum, Bapak/Ibu {{nama_wali}}.

Kami mengingatkan tagihan *{{judul_tagihan}}* untuk *{{nama_siswa}}* ({{kelas}}) sebesar *{{jumlah}}* telah jatuh tempo pada {{jatuh_tempo}}.

Bila sudah membayar, mohon abaikan pesan ini dan kirimkan bukti transfer ke bendahara.

{{tautan_bayar}}

— {{nama_sekolah}}`,
  },
  {
    key: "finance.payment_received",
    name: "Konfirmasi pembayaran diterima",
    category: "FINANCE",
    description: "Kwitansi digital setelah pembayaran dicatat.",
    body: `Assalamualaikum, Bapak/Ibu {{nama_wali}}.

Pembayaran sebesar *{{jumlah}}* untuk *{{nama_siswa}}* ({{kelas}}) telah kami terima pada {{tanggal_bayar}}.

Sisa tagihan: *{{sisa}}*
Status: {{status}}

Terima kasih atas pembayarannya.

— {{nama_sekolah}}`,
  },

  /* ================= SPMB ================= */
  {
    key: "admission.received",
    name: "Pendaftaran diterima",
    category: "ADMISSION",
    description: "Konfirmasi pendaftaran SPMB sudah masuk.",
    body: `Assalamualaikum, Bapak/Ibu {{nama_pendaftar}}.

Pendaftaran {{nama_calon}} dengan nomor *{{nomor_pendaftaran}}* telah kami terima.

Kami akan menginformasikan tahapan selanjutnya. Mohon simpan nomor pendaftaran ini.

— {{nama_sekolah}}`,
  },
  {
    key: "admission.accepted",
    name: "Pengumuman diterima",
    category: "ADMISSION",
    description: "Hasil seleksi: calon murid diterima.",
    body: `Assalamualaikum, Bapak/Ibu {{nama_pendaftar}}.

Selamat! *{{nama_calon}}* dinyatakan *DITERIMA* sebagai murid baru {{nama_sekolah}}.

Nomor pendaftaran: {{nomor_pendaftaran}}
Langkah selanjutnya: {{langkah_selanjutnya}}

— {{nama_sekolah}}`,
  },

  /* ================= UMUM ================= */
  {
    key: "general.announcement",
    name: "Pengumuman umum",
    category: "ANNOUNCEMENT",
    description: "Pesan pengumuman yang dikirim ke banyak penerima.",
    body: `Assalamualaikum, Bapak/Ibu.

*{{judul}}*

{{isi}}

— {{nama_sekolah}}`,
  },
];

/** Ambil template bawaan berdasarkan kunci. */
export function getTemplateSeed(key: string): TemplateSeed | undefined {
  return TEMPLATE_SEEDS.find((t) => t.key === key);
}

/** Contoh nilai untuk pratinjau di UI (agar admin melihat wujud pesannya). */
export const SAMPLE_VARS: Record<string, string> = {
  nama_sekolah: "SMP Negeri 1 Sukamaju",
  nama_siswa: "Aisyah Putri",
  nama_wali: "Bapak Hendra",
  nama_pendaftar: "Bapak Hendra",
  nama_calon: "Aisyah Putri",
  kelas: "VII A",
  tanggal: "12 Oktober 2025",
  jam: "07:15",
  periode: "Oktober 2025",
  semester: "Semester Ganjil 2025/2026",
  hadir: "18",
  terlambat: "2",
  sakit: "1",
  izin: "1",
  alpa: "0",
  persentase: "92,5",
  mata_pelajaran: "Matematika",
  nilai: "65",
  kkm: "70",
  judul_tagihan: "SPP Oktober 2025",
  jumlah: "Rp250.000",
  jatuh_tempo: "31 Oktober 2025",
  tanggal_bayar: "15 Oktober 2025",
  sisa: "Rp0",
  status: "LUNAS",
  tautan_bayar: "https://smpn1.sch.id/bayar/INV2025100007",
  tanggal_pengambilan: "20 Desember 2025",
  nomor_pendaftaran: "SPMB-2026-00123",
  langkah_selanjutnya: "Daftar ulang sebelum 30 Juni 2026",
  judul: "Libur Semester",
  isi: "Kegiatan belajar mengajar diliburkan mulai 23 Desember 2025.",
};
