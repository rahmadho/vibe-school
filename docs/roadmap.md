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

## Fase 1 — Kerangka & Multi-Tenant (PALING PENTING)
Karena ini produk komersial, isolasi tenant harus dibangun kuat sejak awal.
- [ ] Setup Next.js (App Router) + TypeScript + Tailwind + shadcn/ui
- [ ] Prisma client + helper `scopedDb(schoolId)`
- [ ] NextAuth: login, sesi bawa `role` + `schoolId`
- [ ] Middleware otorisasi RBAC (9 role, lihat PRD §3)
- [ ] **PostgreSQL Row Level Security (RLS)** — jaring pengaman kedua
- [ ] **Test isolasi tenant** (sekolah A ≠ sekolah B) — WAJIB
- [ ] Seed: super-admin + plan (Basic/Pro/Enterprise) + 1 sekolah contoh
- [ ] Layout dashboard + navigasi per-role

---

## Fase 2 — Data Master & Onboarding
- [ ] CRUD Sekolah (super-admin) + white-label (logo, warna, domain)
- [ ] CRUD User, Guru, Staf
- [ ] CRUD Siswa + Wali
- [ ] CRUD Tahun Ajaran, Semester, Kelas, Mapel
- [ ] **Master Jam Pelajaran (`TimeSlot`, jam ke-N)**
- [ ] Jadwal (pakai TimeSlot)
- [ ] **Import Excel** (siswa/guru) + wizard onboarding sekolah baru
- [ ] Audit log otomatis pada semua mutasi

---

## Fase 3 — Keuangan + Payment Gateway ⭐
Prioritas bisnis tertinggi — sekolah paling sakit di sini.
- [ ] Master biaya (`FeeType`) & metode bayar
- [ ] Generate tagihan (satuan & massal bulanan)
- [ ] **Integrasi Midtrans/Xendit**: generate VA/link, QRIS
- [ ] **Endpoint webhook** + verifikasi signature
- [ ] Auto-update Invoice + buat Payment saat settlement
- [ ] Pencatatan pembayaran manual (tunai) oleh bendahara
- [ ] Kwitansi PDF
- [ ] Laporan tunggakan & rekap penerimaan
- [ ] Cron penandaan OVERDUE + reminder WA (H-3 & jatuh tempo)

---

## Fase 4 — Absensi
- [ ] Absen siswa (harian & per-jam pelajaran)
- [ ] Absen guru
- [ ] Rekap harian/bulanan + export
- [ ] Trigger notifikasi WA saat ALPA (dapat dikonfigurasi)

---

## Fase 5 — Penilaian + Rapor PDF
- [ ] Guru mapel: buat komponen nilai + bobot
- [ ] Input nilai (mendukung input massal)
- [ ] Hitung nilai akhir (weighted) → `ReportCard`
- [ ] **Rapor PDF format resmi** (kop, logo, tanda tangan, catatan wali kelas)
- [ ] Rekap nilai digital untuk ortu/siswa
- [ ] Publikasi nilai + notif WA

---

## Fase 6 — SPMB
- [ ] Halaman publik pendaftaran + upload dokumen
- [ ] Verifikasi dokumen oleh admin
- [ ] Input skor & seleksi (peringkat)
- [ ] **Biaya pendaftaran opsional per gelombang** → bayar via gateway
- [ ] Pengumuman hasil + cek status + notif WA
- [ ] Konversi pendaftar diterima → Student + User

---

## Fase 7 — WA Gateway (Baileys)
- [ ] Service Node.js + Baileys (di VPS)
- [ ] Multi-sesi per sekolah + scan QR
- [ ] Worker ambil `NotificationQueue` → kirim
- [ ] Retry + backoff + jam wajar (07:00–21:00 WIB)
- [ ] Halaman admin kelola sesi WA + status QR

---

## Fase 8 — Web Sekolah Publik
- [ ] Landing page + profil sekolah
- [ ] Berita / pengumuman / agenda / galeri
- [ ] **White-label** (logo, warna, domain per sekolah)
- [ ] SEO + sitemap

---

## Fase 9 — Kenaikan Kelas & Administrasi
- [ ] **Wizard kenaikan kelas massal** (tahun ajaran baru)
- [ ] Tandai siswa **tinggal kelas** & **lulus** (alumni)
- [ ] Riwayat kelas (`StudentClassHistory`)

---

## Fase 10 — Komersial & Rilis
- [ ] Plan (`Plan`) & langganan (`Subscription`) per sekolah
- [ ] Halaman billing sekolah + pembatasan fitur per paket
- [ ] Hardening keamanan (rate limit, RLS penuh)
- [ ] Backup otomatis (pg_dump harian)
- [ ] Deploy VPS: Docker Compose + Nginx + SSL (Let's Encrypt)
- [ ] Monitoring & alert (termasuk kegagalan WA)

---

## Catatan Prioritas

Bila waktu terbatas, urutan nilai bisnis:
**Keuangan+Gateway** > **Absensi** > **Nilai+Rapor** > **SPMB** > **Web publik**.

Alasan:
1. **Keuangan** langsung menyentuh uang sekolah → nilai jual utama.
2. **Absensi** menyelesaikan masalah operasional harian.
3. **SPMB** penting tapi musiman (sekali setahun).
4. **Web publik** bagus untuk citra, tapi bukan penyelesaian masalah inti.
