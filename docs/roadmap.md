# Roadmap Pengembangan

> Ruang lingkup & keputusan resmi ada di [`PRD.md`](PRD.md). Dokumen ini hanya urutan pengerjaan.

Prinsip: **jangan lompat tahap**. Setiap fase harus lolos Definition of Done (lihat PRD §11) sebelum lanjut.

---

## Fase 0 — Fondasi ✅ (SELESAI)
- [x] Skema database Prisma multi-tenant
- [x] Dokumentasi arsitektur, skema, roadmap
- [x] **PRD** berdasarkan 10 keputusan produk
- [x] Docker compose (postgres + wa-gateway)
- [x] AGENTS.md & SOUL.md

---

## Fase 1 — Kerangka & Multi-Tenant ✅ (SELESAI)
- [x] Setup Next.js (App Router) + TypeScript + Tailwind
- [x] Prisma client + helper `scopedDb(schoolId)`
- [x] NextAuth: login, sesi bawa `role` + `schoolId`
- [x] Middleware otorisasi RBAC (9 role)
- [x] **PostgreSQL Row Level Security (RLS)**
- [x] **Test isolasi tenant** — membandingkan `TENANT_MODELS` dengan `rls.sql`
- [x] Seed: super-admin + plan + 2 sekolah contoh
- [x] Layout dashboard + navigasi per-role

---

## Fase 2 — Data Master & Onboarding ✅ (SELESAI)
- [x] CRUD Sekolah (super-admin) + white-label
- [x] CRUD User, Guru, Staf
- [x] CRUD Siswa + Wali
- [x] CRUD Tahun Ajaran, Semester, Kelas, Mapel
- [x] **Master Jam Pelajaran (`TimeSlot`, jam ke-N)**
- [x] Jadwal (pakai TimeSlot)
- [x] **Impor Excel siswa** + unduh template
- [x] Audit log otomatis pada mutasi

---

## Fase 3 — Keuangan + Payment Gateway ✅ (SELESAI)
- [x] Master biaya (`FeeType`) & metode bayar
- [x] Tagihan satuan & massal bulanan
- [x] Integrasi gateway: generate VA/link, QRIS
- [x] **Endpoint webhook** + verifikasi signature + idempotensi
- [x] Auto-update Invoice + buat Payment saat settlement
- [x] Pencatatan pembayaran manual (tunai) oleh bendahara
- [x] Laporan tunggakan & rekap penerimaan
- [ ] Kwitansi PDF — belum
- [ ] Cron penandaan OVERDUE — belum (status bisa diset manual)

---

## Fase 4 — Absensi ✅ (SELESAI)
- [x] Absen siswa (harian & per-jam pelajaran)
- [x] Absen guru
- [x] Rekap + ekspor CSV
- [x] Trigger notifikasi WA saat alpa

---

## Fase 5 — Penilaian + Rapor (SEBAGIAN)
- [x] Guru mapel: komponen nilai + bobot
- [x] Input nilai per siswa
- [x] Hitung nilai akhir (terbobot) → `ReportCard`
- [x] Rekap nilai digital
- [ ] **Rapor PDF format resmi** — belum
- [ ] Publikasi nilai + notif WA — template WA sudah ada, alur publikasi belum

---

## Fase 6 — SPMB ✅ (SELESAI)
- [x] Halaman publik pendaftaran + multi-jalur
- [x] Verifikasi dokumen oleh panitia
- [x] Input skor & seleksi
- [x] **Biaya pendaftaran opsional per jalur**
- [x] Pengumuman hasil + cek status publik (disamarkan)
- [x] Konversi pendaftar diterima → Student

---

## Fase 7 — WA Gateway (Baileys) ✅ (SELESAI)
- [x] Service Node.js + Baileys
- [x] Multi-sesi per sekolah + QR lewat dasbor
- [x] Worker ambil `NotificationQueue` → kirim
- [x] Retry + backoff + jam wajar (07:00–20:00 WIB)
- [x] Halaman admin kelola sesi WA

---

## Fase 8 — Web Sekolah Publik ✅ (SELESAI)
- [x] Landing page tersusun dari blok + varian gaya
- [x] Berita / agenda / galeri / halaman kustom
- [x] **White-label** (logo, warna, menu)
- [x] SEO + sitemap
- [x] Subdomain per sekolah + preview pengembangan

---

## Fase 9 — Kenaikan Kelas & Administrasi (BELUM)
- [ ] **Wizard kenaikan kelas massal**
- [ ] Tandai siswa **tinggal kelas** & **lulus**
- [x] Riwayat kelas (`StudentClassHistory`) — tabel sudah ada, alur belum

---

## Fase 10 — Komersial & Rilis (SEBAGIAN)
- [x] Plan (`Plan`) & langganan (`Subscription`) per sekolah — data & seed
- [x] Halaman Langganan (baca paket, pemakaian kuota, fitur)
- [ ] Pembelian / perpanjangan paket dari dasbor
- [ ] Pembatasan fitur otomatis per paket
- [ ] Backup otomatis (pg_dump harian)
- [ ] Deploy VPS: web app belum ada di docker-compose; Nginx wildcard ada di docs
- [ ] Monitoring & alert

---

## Di Luar Rencana Awal (SUDAH DIKERJAKAN)

- [x] **Unggah logo sekolah** + abstraksi driver penyimpanan berkas
      (`local` bawaan, MinIO disiapkan) — [penyimpanan-berkas.md](penyimpanan-berkas.md)
- [x] **Halaman Log Aktivitas** — filter aksi/jenis data/tanggal, tampilkan
      perubahan nilai (before → after)
- [x] **`grants.sql`** — hak akses role aplikasi (pasangan wajib `rls.sql`)
- [x] **Seed riwayat 2 tahun** (`seed-activity.ts`) untuk menilai tampilan
      dengan data padat

---

## Catatan Prioritas

Bila waktu terbatas, urutan nilai bisnis:
**Rapor PDF** > **Kenaikan kelas** > **Kwitansi PDF** > **Pembelian paket** > **Deploy VPS**.

Alasan:
1. **Rapor PDF** menutup alur penilaian yang sekarang berhenti di rekap digital —
   sekolah tetap butuh dokumen cetak bertanda tangan.
2. **Kenaikan kelas** hanya dikerjakan sekali setahun, tetapi bila belum ada,
   operator harus memindahkan siswa satu per satu di akhir tahun ajaran.
3. **Kwitansi PDF** melengkapi keuangan yang sudah berjalan.
4. **Pembelian paket** baru perlu saat jumlah sekolah bertambah.
5. **Deploy VPS** perlu sebelum sekolah pertama memakai sungguhan.
