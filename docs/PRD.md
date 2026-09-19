# PRD — School App (Sistem Informasi Sekolah Multi-Tenant)

**Versi:** 1.0
**Status:** Disetujui berdasarkan 10 keputusan pemilik produk
**Tanggal:** 2025

> Dokumen ini adalah **sumber kebenaran ruang lingkup**. Semua koding & prioritas
> mengacu ke sini. Bila ada pertentangan antara PRD dan dokumen lain, PRD menang.

---

## 1. Ringkasan Eksekutif

School App adalah **produk komersial (SaaS) Sistem Informasi Sekolah** yang:
- Melayani **banyak sekolah** dari satu instalasi (multi-tenant).
- Mencakup seluruh operasional sekolah: **web publik, SPMB, akademik, absensi,
  penilaian, keuangan, dan notifikasi WhatsApp**.
- **Dijual ke banyak sekolah** → fokus pada kemudahan onboarding, isolasi data yang
  kuat, dan white-label.

**Model bisnis:** langganan per sekolah (detail paket di §9).

---

## 2. Keputusan Produk (Baseline)

10 keputusan yang mengikat seluruh desain:

| # | Topik | Keputusan |
|---|-------|-----------|
| 1 | Kurikulum | **Nilai angka + rekap**; tanpa format resmi K13/Merdeka |
| 2 | Input nilai | **Guru mapel per kelas** menginput nilai |
| 3 | Pembayaran | **Integrasi payment gateway** (Midtrans/Xendit/QRIS otomatis) |
| 4 | Rapor | **PDF format resmi** (kop sekolah, tanda tangan) |
| 5 | Akun ortu | **1 akun ortu per anak** |
| 6 | Jadwal | **Jam ke-N** (jam ke-1, ke-2, ... dengan waktu mulai/selesai) |
| 7 | Biaya SPMB | **Opsional**, dikonfigurasi per gelombang |
| 8 | Deploy | **VPS sendiri** (Docker + Nginx + SSL) |
| 9 | Kenaikan kelas | **Massal + dukungan siswa tinggal kelas** |
| 10 | Pengguna | **Produk komersial** untuk dijual ke banyak sekolah |

---

## 3. Persona & Hak Akses

| Persona | Peran sistem | Kebutuhan utama |
|---------|--------------|-----------------|
| **Super Admin (kita)** | SUPER_ADMIN | Kelola semua sekolah, paket langganan, monitoring |
| **Admin Sekolah** | SCHOOL_ADMIN | Kelola seluruh data 1 sekolah |
| **Kepala Sekolah** | PRINCIPAL | Lihat dashboard, approval, tanpa edit keuangan |
| **Bendahara** | TREASURER | Tagihan, pembayaran, laporan keuangan |
| **Guru** | TEACHER | Absen & input **nilai mapel yang diampu** |
| **Wali Kelas** | TEACHER (flag) | Lihat rekap kelas, catatan wali kelas |
| **Siswa** | STUDENT | Lihat nilai, absen, jadwal sendiri (opsional) |
| **Orang Tua** | PARENT | Lihat data **anaknya** (1 akun = 1 anak) |
| **Staf/TU** | STAFF | Administrasi terbatas |

**Aturan:** Guru hanya bisa akses kelas & mapel yang diampu (via `TeacherSubject` +
`Schedule`). Ortu hanya lihat anaknya. Semua dibatasi juga oleh `schoolId`.

---

## 4. Ruang Lingkup Modul

### 4.1 Web Sekolah (Publik)
- Profil sekolah, visi-misi, fasilitas, kontak (peta, telepon, email).
- Berita & artikel, pengumuman, agenda, galeri foto.
- **White-label:** logo, warna tema, dan nama domain/subdomain per sekolah.
- SEO dasar (meta, sitemap).

### 4.2 SPMB (Penerimaan Murid Baru)
- **Gelombang pendaftaran** (`AdmissionBatch`): rentang tanggal + kuota.
- **Biaya pendaftaran opsional per gelombang** (field `registrationFee`).
- Formulir online + upload dokumen (KK, akta, foto, ijazah).
- Verifikasi dokumen oleh admin.
- Input skor seleksi + peringkat.
- Keputusan: ACCEPTED / REJECTED / WAITLIST.
- **Pembayaran biaya pendaftaran** (bila diaktifkan) via payment gateway.
- Pengumuman hasil → notifikasi WA + portal cek status.
- Pendaftar diterima → dikonversi jadi `Student` + `User` (siswa/ortu).

### 4.3 Akademik
- Tahun ajaran & semester.
- **Jam pelajaran (Jam ke-N):** master `TimeSlot` per sekolah
  (jam ke-1 = 07:00–07:45, dst.).
- Kelas + wali kelas, mata pelajaran + KKM, jadwal (kelas × mapel × guru × jam × hari).
- **Kenaikan kelas massal:** wizard akhir tahun ajaran.
  - Pindahkan seluruh siswa ke kelas berikutnya.
  - **Tandai siswa tinggal kelas** (tidak naik).
  - Tandai siswa **lulus** (status GRADUATED) & alumni.
- Riwayat kelas per siswa (`StudentClassHistory`).

### 4.4 Absensi
- Absen siswa: harian atau per-mapel (per jam pelajaran).
- Absen guru.
- Status: HADIR, TERLAMBAT, SAKIT, IZIN, ALPA.
- Rekap harian/bulanan + export.
- **Trigger WA** ke ortu saat anak ALPA (dapat dikonfigurasi).

### 4.5 Penilaian
- **Guru mapel** membuat komponen nilai (Tugas, UTS, UAS, Praktik) + bobot.
- Input nilai per siswa (mendukung input massal seperti spreadsheet).
- Hitung **nilai akhir** = Σ(nilai × bobot).
- **Rekap nilai digital** untuk ortu/siswa di dashboard.
- **Rapor PDF format resmi:** kop sekolah, logo, daftar nilai per mapel,
  catatan wali kelas, tanda tangan kepala sekolah.
- Publikasi nilai → notifikasi WA.

### 4.6 Keuangan
- Master jenis biaya (`FeeType`): SPP bulanan, uang pangkal, seragam, kegiatan, dll.
- Generate tagihan (`Invoice`): satuan atau massal (misal SPP sebulan untuk semua siswa).
- **Pembayaran via payment gateway** (Midtrans/Xendit):
  - Generate VA / link pembayaran per invoice.
  - **Webhook** menerima status: pending → settlement → expired/refund.
  - Auto-update `Invoice.status` & buat `Payment` saat settlement.
- Pencatatan pembayaran manual (tunai) tetap didukung bendahara.
- Kwitansi (PDF), laporan tunggakan, rekap penerimaan.
- **Reminder otomatis** H-3 dan saat jatuh tempo lewat WA.

### 4.7 Notifikasi WhatsApp (Gateway sendiri — Baileys)
- Service Node.js terpisah (`apps/wa-gateway`), di VPS.
- Multi-sesi: satu sesi WhatsApp per sekolah (scan QR).
- Worker membaca `NotificationQueue` → kirim via Baileys.
- Template pesan per sekolah (`NotificationTemplate`).
- Jenis notifikasi: tagihan baru, reminder, kwitansi, absen alpa, nilai rilis,
  pengumuman SPMB, pengumuman umum.
- Aturan: hormati jam wajar (07:00–21:00 WIB), retry maks 3x, simpan `waMessageId`.

### 4.8 Administrasi & Audit
- Manajemen user, guru, staf, siswa, wali.
- Role-based access control.
- **Audit log** untuk semua mutasi penting (keuangan, nilai, absensi, data siswa).
- Import data awal dari Excel (onboarding sekolah baru).
- White-label: logo & warna sekolah.

---

## 5. Alur Utama (Ringkas)

### Pendaftaran SPMB → Siswa
```
Calon ortu daftar online → Registration (PENDING)
  → [opsional] bayar biaya pendaftaran via gateway
  → admin verifikasi dokumen → VERIFIED
  → seleksi → skor → keputusan
  → ACCEPTED → Student + User dibuat → notif WA
```

### Pembayaran SPP (gateway)
```
Bendahara generate invoice SPP (massal/satuan)
  → Invoice (UNPAID) + payment link/VA
  → notif WA ke ortu (tagihan baru)
  → ortu bayar via QRIS/VA
  → webhook gateway → settlement
  → Payment dibuat, Invoice → PAID
  → notif WA kwitansi
```

### Akhir Tahun Ajaran
```
Admin jalankan wizard kenaikan kelas
  → pilih tahun ajaran baru
  → sistem usulkan kenaikan massal per kelas
  → tandai yang tinggal kelas / lulus
  → Student.classId diperbarui + StudentClassHistory dicatat
  → status alumni untuk yang lulus
```

### Input Nilai (guru mapel)
```
Guru login → pilih kelas yang diampu → pilih mapel
  → buat pilih komponen (UTS/USAS/Tugas) + bobot
  → input nilai (mendukung input massal)
  → sistem hitung nilai akhir → ReportCard
  → saat publikasi → notif WA ke ortu
```

---

## 6. Kebutuhan Data (perubahan dari skema v0)

Skema yang sudah ada perlu diperluas:

### 6.1 Pembayaran Gateway (BARU)
- Tabel `PaymentGatewayTransaction`:
  `id, schoolId, invoiceId, provider(MIDTRANS|XENDIT), externalId,
   vaNumber, paymentLink, amount, status(PENDING|SETTLEMENT|EXPIRE|REFUND),
   rawPayload(Json), createdAt, updatedAt`.
- Tambahan di `Invoice`: `paymentLink`, `vaNumber`, `gatewayProvider`.
- Endpoint webhook: `POST /api/webhooks/<provider>`.

### 6.2 Jam Pelajaran (BARU)
- Tabel `TimeSlot`: `schoolId, slotNumber (jam ke-N), startTime, endTime, label`.
- `Schedule` direferensikan ke `TimeSlot` (ganti `startTime/endTime` langsung).

### 6.3 Riwayat Kelas (BARU)
- Tabel `StudentClassHistory`: `studentId, classId, academicYearId,
   result(NAIK|TINGGAL|LULUS), note`.

### 6.4 Rapor PDF
- Perlu `ReportCard` (sudah ada) + template PDF.
- Tambah field `homeroomNote` (catatan wali kelas) di rapor.

### 6.5 Fitur Komersial (BARU — karena produk dijual)
- Tabel `Plan`: `name, pricePerMonth, maxStudents, features(Json)`.
- Tabel `Subscription`: `schoolId, planId, status(TRIAL|ACTIVE|SUSPENDED|EXPIRED),
   startedAt, expiresAt, billingCycle`.
- White-label di `School`: sudah ada `logoUrl`; tambah `themeColor`, `customDomain`.

### 6.6 Onboarding
- Import siswa/guru via Excel (`xlsx`).
- Wizard setup sekolah: identitas → jam pelajaran → kelas → mapel → tahun ajaran.

---

## 7. Kebutuhan Non-Fungsional

- **Isolasi tenant (KRITIS — karena produk komersial):**
  - Setiap query difilter `schoolId`.
  - **Row Level Security (PostgreSQL)** diaktifkan sebagai jaring pengaman kedua.
  - Test otomatis membuktikan sekolah A tak bisa akses data sekolah B.
- **Skala:** dirancang untuk puluhan–ratusan sekolah di satu VPS (horizontal scaling
  untuk WA gateway bila perlu).
- **Keamanan:** argon2/bcrypt, rate limit login, validasi Zod, audit log,
  webhook signature verification.
- **Ketersediaan:** Docker + restart policy; backup pg_dump harian.
- **White-label:** tema & logo per sekolah.
- **Zona waktu:** simpan UTC, tampilkan `Asia/Jakarta`.
- **Bahasa:** Indonesia (UI).

---

## 8. Arsitektur & Teknologi

- **Web + API:** Next.js (App Router, TypeScript)
- **ORM:** Prisma · **DB:** PostgreSQL
- **Auth:** NextAuth (RBAC)
- **Validasi:** Zod · **UI:** Tailwind + shadcn/ui
- **PDF:** `@react-pdf/renderer` (rapor & kwitansi)
- **WA:** Node.js + Baileys (service terpisah)
- **Payment:** Midtrans (rekomendasi) — QRIS + VA + webhook
- **Deploy:** VPS (Docker Compose + Nginx + Let's Encrypt)

---

## 9. Paket Langganan (Usulan Awal)

| Paket | Target | Fitur |
|-------|--------|-------|
| **Basic** | Sekolah kecil | Web publik, akademik, absensi, nilai, keuangan manual |
| **Pro** | Sekolah menengah | + SPMB, payment gateway, rapor PDF, notifikasi WA |
| **Enterprise** | Yayasan | + white-label penuh, custom domain, multi-unit, prioritas support |

*(Detail harga & limit ditentukan kemudian; struktur data `Plan`/`Subscription` disiapkan dari awal.)*

---

## 10. Roadmap (Disesuaikan dengan Keputusan)

### Fase 0 — Fondasi ✅
Skema dasar, dokumentasi, docker, AGENTS.md/SOUL.md.

### Fase 1 — Kerangka & Multi-Tenant
Next.js + NextAuth + Prisma client + `scopedDb(schoolId)` + RBAC + seed.
**Termasuk RLS & test isolasi tenant** (karena komersial).

### Fase 2 — Data Master & Onboarding
CRUD sekolah/user/guru/staf/siswa/wali, tahun ajaran, **TimeSlot (jam ke-N)**,
kelas, mapel, jadwal. Import Excel + wizard onboarding. Audit log.

### Fase 3 — Keuangan + Payment Gateway ⭐ (prioritas bisnis)
FeeType, generate invoice (satuan & massal), Midtrans/Xendit + webhook,
kwitansi PDF, laporan tunggakan.

### Fase 4 — Absensi
Absen siswa/guru, rekap, trigger WA alpa.

### Fase 5 — Penilaian + Rapor PDF
Komponen nilai + bobot, input massal, hitung nilai akhir, **rapor PDF format resmi**,
publikasi + notif WA.

### Fase 6 — SPMB
Pendaftaran online, upload dokumen, verifikasi, seleksi, biaya opsional via gateway,
pengumuman WA, konversi ke Student.

### Fase 7 — WA Gateway (Baileys)
Service, multi-sesi + QR, worker queue, retry, jam wajar, halaman admin sesi.

### Fase 8 — Web Sekolah Publik
Landing, profil, berita/agenda/galeri, white-label, SEO.

### Fase 9 — Kenaikan Kelas & Administrasi Lanjutan
Wizard kenaikan massal, siswa tinggal kelas, alumni, riwayat kelas.

### Fase 10 — Komersial & Rilis
Plan/Subscription, halaman billing sekolah, hardening keamanan, backup,
deploy VPS + monitoring.

---

## 11. Definisi Selesai (Definition of Done)

Sebuah fitur selesai bila:
- Lolos `lint` + `build` + `test`.
- Query difilter `schoolId` + lolos test isolasi tenant.
- Input divalidasi (Zod).
- Aksi penting tercatat di `AuditLog`.
- Notifikasi WA lewat `NotificationQueue` (bukan kirim langsung).
- Dokumentasi diperbarui.

---

## 12. Di Luar Lingkup (Out of Scope) — versi awal

- Kurikulum Merdeka / K13 format resmi (hanya nilai angka + rekap).
- Aplikasi mobile native (fokus web responsif).
- CBT / ujian online.
- Perpustakaan, inventaris, kepegawaian payroll.
- Integrasi DAPODIK (bisa jadi fase lanjutan).

*(Daftar ini bisa dinegosiasi ulang di versi PRD berikutnya.)*
