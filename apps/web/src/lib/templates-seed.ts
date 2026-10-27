/**
 * Template pesan bawaan.
 *
 * Dibuat sebagai "pabrik" agar setiap sekolah baru langsung punya pesan yang
 * rapi, tanpa harus menulis dari nol. Sekolah bebas mengubahnya di UI.
 *
 * Bentuk baku setiap pesan (lihat docs/format-pesan-wa.md):
 *
 *   Assalamualaikum, Bapak/Ibu {{nama_wali}}.
 *                                                    <- satu baris kosong
 *   *{{judul_kejadian}}*
 *   {{nama_siswa}} · {{kelas}} · {{tanggal}}
 *                                                    <- satu baris kosong
 *   {{isi_rinci}}                                    <- maks 3 baris
 *                                                    <- satu baris kosong
 *   {{satu_langkah_tindakan}}
 *                                                    <- satu baris kosong
 *   — {{nama_sekolah}}
 *
 * Aturan penulisan:
 *  - Nama siswa & kelas hanya di baris meta, tidak diulang di paragraf isi.
 *  - Daftar panjang memakai placeholder {{daftar_*}} yang diisi
 *    formatDaftarNilai() / formatDaftarTagihan() dari notification-format.ts.
 *  - Hindari istilah teknis (nomor tagihan internal) di badan pesan.
 *  - Tepat satu langkah tindakan; nada tenang, tanpa tanda seru berlebihan.
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

*Tidak hadir tanpa keterangan*
{{nama_siswa}} · {{kelas}} · {{tanggal}}

Sampai pesan ini terkirim, kami belum menerima kabar dari Bapak/Ibu.

Mohon balas pesan ini atau hubungi wali kelas untuk memberi keterangan.

— {{nama_sekolah}}`,
  },
  {
    key: "attendance.late",
    name: "Pemberitahuan terlambat",
    category: "ATTENDANCE",
    description: "Dikirim saat siswa datang terlambat.",
    body: `Assalamualaikum, Bapak/Ibu {{nama_wali}}.

*Datang terlambat*
{{nama_siswa}} · {{kelas}} · {{tanggal}} pukul {{jam}}

Catatan keterlambatan sudah kami masukkan ke rekap kehadiran.

Mohon bantu anak agar besok datang lebih awal, ya, Bapak/Ibu.

— {{nama_sekolah}}`,
  },
  {
    key: "attendance.summary",
    name: "Rekap kehadiran bulanan",
    category: "ATTENDANCE",
    description:
      "Ringkasan kehadiran satu bulan, biasanya dikirim akhir bulan. Variabel {{rekap_kehadiran}} diisi baris rekap (lihat docs/format-pesan-wa.md).",
    body: `Assalamualaikum, Bapak/Ibu {{nama_wali}}.

*Rekap kehadiran {{periode}}*
{{nama_siswa}} · {{kelas}} · persentase kehadiran {{persentase}}%

{{rekap_kehadiran}}

Bila ada hari yang menurut Bapak/Ibu tidak sesuai, mohon hubungi wali kelas.

— {{nama_sekolah}}`,
  },

  /* ================= NILAI ================= */
  {
    key: "grade.below_kkm",
    name: "Nilai di bawah KKM",
    category: "GRADE",
    description:
      "Dikirim saat nilai siswa turun di bawah KKM. {{daftar_nilai}} diisi hasil formatDaftarNilai() dari notification-format.ts (baris '• Mapel — nilai', tanda * untuk nilai di bawah KKM).",
    body: `Assalamualaikum, Bapak/Ibu {{nama_wali}}.

*Nilai di bawah KKM*
{{nama_siswa}} · {{kelas}} · {{tanggal}}

{{daftar_nilai}}

Anak akan diikutkan program perbaikan (remedial).

Mohon dukungan Bapak/Ibu di rumah dan hubungi wali kelas bila ingin berdiskusi.

— {{nama_sekolah}}`,
  },
  {
    key: "grade.report_ready",
    name: "Rapor siap diambil",
    category: "GRADE",
    description: "Pemberitahuan bahwa rapor sudah bisa diambil.",
    body: `Assalamualaikum, Bapak/Ibu {{nama_wali}}.

*Rapor siap diambil*
{{nama_siswa}} · {{kelas}} · {{semester}}

Rapor dapat diambil pada {{tanggal_pengambilan}}.

Mohon hadir tepat waktu agar bisa berbincang dengan wali kelas.

— {{nama_sekolah}}`,
  },

  /* ================= KEUANGAN ================= */
  {
    key: "finance.invoice",
    name: "Tagihan baru",
    category: "FINANCE",
    description:
      "Dikirim saat tagihan baru dibuat. {{daftar_tagihan}} diisi hasil formatDaftarTagihan() dari notification-format.ts (baris '• Judul — Rp250.000 (tempo 31 Okt)').",
    body: `Assalamualaikum, Bapak/Ibu {{nama_wali}}.

*Tagihan baru*
{{nama_siswa}} · {{kelas}} · {{tanggal}}

{{daftar_tagihan}}
Jatuh tempo terdekat: {{jatuh_tempo}}

Mohon lakukan pembayaran melalui {{tautan_bayar}}.

— {{nama_sekolah}}`,
  },
  {
    key: "finance.reminder",
    name: "Pengingat jatuh tempo",
    category: "FINANCE",
    description:
      "Dikirim mendekati atau setelah jatuh tempo. {{daftar_tagihan}} diisi hasil formatDaftarTagihan() dari notification-format.ts.",
    body: `Assalamualaikum, Bapak/Ibu {{nama_wali}}.

*Pengingat pembayaran*
{{nama_siswa}} · {{kelas}} · {{tanggal}}

{{daftar_tagihan}}

Bila sudah membayar, mohon abaikan pesan ini dan kirimkan bukti transfer ke bendahara.

Pembayaran dapat dilakukan melalui {{tautan_bayar}}.

— {{nama_sekolah}}`,
  },
  {
    key: "finance.payment_received",
    name: "Konfirmasi pembayaran diterima",
    category: "FINANCE",
    description: "Kwitansi digital setelah pembayaran dicatat.",
    body: `Assalamualaikum, Bapak/Ibu {{nama_wali}}.

*Pembayaran diterima*
{{nama_siswa}} · {{kelas}} · {{tanggal_bayar}}

Terima kasih, pembayaran sebesar {{jumlah}} sudah kami catat dengan status {{status}}.
Sisa tagihan: {{sisa}}

Kwitansi dapat diunduh dari portal orang tua.

— {{nama_sekolah}}`,
  },

  /* ================= SPMB ================= */
  {
    key: "admission.received",
    name: "Pendaftaran diterima",
    category: "ADMISSION",
    description: "Konfirmasi pendaftaran SPMB sudah masuk.",
    body: `Assalamualaikum, Bapak/Ibu {{nama_pendaftar}}.

*Pendaftaran SPMB diterima*
{{nama_calon}} · {{nomor_pendaftaran}} · {{tanggal}}

Berkas pendaftaran sudah masuk ke sistem kami dan akan diperiksa panitia.

Mohon simpan pesan ini; kabar tahapan berikutnya dikirim ke nomor ini juga.

— {{nama_sekolah}}`,
  },
  {
    key: "admission.accepted",
    name: "Pengumuman diterima",
    category: "ADMISSION",
    description: "Hasil seleksi: calon murid diterima.",
    body: `Assalamualaikum, Bapak/Ibu {{nama_pendaftar}}.

*Diterima sebagai murid baru*
{{nama_calon}} · {{nomor_pendaftaran}} · {{tanggal}}

Selamat, {{nama_calon}} dinyatakan diterima di {{nama_sekolah}}.

{{langkah_selanjutnya}}

— {{nama_sekolah}}`,
  },
  {
    key: "admission.rejected",
    name: "Pengumuman tidak diterima",
    category: "ADMISSION",
    description: "Hasil seleksi: calon murid belum dapat diterima.",
    // Nada pesan ini disengaja: tidak memakai kata "gagal" terhadap ANAK, dan
    // selalu menyebut langkah berikutnya. Orang tua menerima kabar buruk lewat
    // pesan otomatis — kalimatnya harus tetap menghormati.
    body: `Assalamualaikum, Bapak/Ibu {{nama_pendaftar}}.

*Hasil seleksi SPMB*
{{nama_calon}} · {{nomor_pendaftaran}} · {{tanggal}}

Terima kasih atas kepercayaan Bapak/Ibu. Setelah menimbang daya tampung dan hasil seleksi, dengan berat hati kami sampaikan bahwa {{nama_calon}} belum dapat kami terima pada gelombang ini.

{{langkah_selanjutnya}}

Kami mendoakan yang terbaik untuk {{nama_calon}}.

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
{{nama_sekolah}} · {{tanggal}}

{{isi}}

Mohon membaca sampai selesai dan menyampaikan ke anggota keluarga lain.

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
  tanggal: "Senin, 3 November 2025",
  jam: "07:15",
  periode: "Oktober 2025",
  semester: "Semester Ganjil 2025/2026",
  persentase: "92,5",
  rekap_kehadiran: "• Hadir — 18 hari\n• Terlambat — 2 hari\n• Sakit — 1 hari\n• Izin — 1 hari\n• Alpa — 0 hari",
  daftar_nilai: "• Matematika — 65 *\n• IPA — 82\n* di bawah KKM 70",
  daftar_tagihan: "• SPP November 2025 — Rp350.000 (tempo 10 Nov)\n• Kegiatan Semester — Rp150.000 (tempo 20 Nov)",
  judul_tagihan: "SPP Oktober 2025",
  jumlah: "Rp250.000",
  jatuh_tempo: "31 Oktober 2025",
  tanggal_bayar: "15 Oktober 2025",
  sisa: "Rp0",
  status: "LUNAS",
  tautan_bayar: "https://smpn1.sch.id/bayar/INV2025100007",
  tanggal_pengambilan: "20 Desember 2025",
  nomor_pendaftaran: "SPMB-2026-00123",
  langkah_selanjutnya: "Mohon lakukan daftar ulang sebelum 30 Juni 2026 melalui portal SPMB.",
  judul: "Libur Semester",
  isi: "Kegiatan belajar mengajar diliburkan mulai 23 Desember 2025 dan dimulai kembali 5 Januari 2026.",
};
