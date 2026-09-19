# Arsitektur Sistem — School App

## 1. Gambaran Besar

```
                    ┌─────────────────────────────┐
   Publik  ────────▶│  Web Sekolah (publik)       │
   (ortu/siswa)     │  profil, berita, SPMB        │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────▼──────────────┐
   Admin/Guru ─────▶│  Dashboard Next.js           │
   Bendahara        │  (auth + role + schoolId)    │
                    └──────────────┬──────────────┘
                                   │ Prisma
                    ┌──────────────▼──────────────┐
                    │  PostgreSQL                  │
                    │  (multi-tenant: schoolId)    │
                    └──────────────┬──────────────┘
                                   │ NotificationQueue
                    ┌──────────────▼──────────────┐
                    │  WA Gateway (Baileys)        │
                    │  worker → kirim WhatsApp     │
                    └─────────────────────────────┘
```

## 2. Multi-Tenancy

**Model: shared database, shared schema, kolom `schoolId`.**

- Setiap tabel data sekolah punya kolom `schoolId`.
- Setiap request user menyimpan `schoolId` di sesi (JWT).
- Semua query data sekolah **wajib** difilter `where: { schoolId: session.schoolId }`.
- Hanya `SUPER_ADMIN` yang `schoolId = null` dan boleh lintas-sekolah.

### Pencegahan kebocoran data (defense in depth)

1. **Middleware/helper** `scopedDb(schoolId)` yang otomatis menambahkan filter.
2. **Row Level Security (opsional, PostgreSQL RLS)** sebagai jaring pengaman kedua.
3. **Test** yang memverifikasi user sekolah A tidak bisa akses data sekolah B.

> Aturan emas: kalau menulis query ke tabel ber-`schoolId`, selalu tanyakan
> "di mana filter schoolId-nya?"

## 3. Autentikasi & Otorisasi

- **Auth:** NextAuth, kredensial (email + password, hash argon2/bcrypt).
- **Sesi:** JWT membawa `userId`, `role`, `schoolId`.
- **Otorisasi:** RBAC per-route + per-aksi.

| Role | Ringkasan hak |
|------|---------------|
| SUPER_ADMIN | Semua sekolah, semua modul |
| SCHOOL_ADMIN | Semua modul dalam 1 sekolah |
| PRINCIPAL | Lihat semua, approval, tanpa edit keuangan |
| TREASURER | Modul keuangan/pembayaran |
| TEACHER | Absen & nilai kelas yang diampu |
| STUDENT | Lihat nilai/absen/jadwal sendiri |
| PARENT | Lihat anaknya saja |
| STAFF | Administrasi terbatas |

## 4. Alur Modul Utama

### 4.1 SPMB
```
Pendaftar → /spmb/daftar → Registration (DRAFT)
   → submit → PENDING
   → admin verifikasi dokumen → VERIFIED
   → tes/seleksi → TESTED (isi score)
   → keputusan → ACCEPTED/REJECTED/WAITLIST
   → ACCEPTED → buat Student + User(role STUDENT/ PARENT)
             → NotificationQueue (WA pengumuman)
```

### 4.2 Keuangan
```
Admin buat Invoice (items dari FeeType)
   → Student dapat tagihan (UNPAID)
   → jatuh tempo lewat → OVERDUE (cron harian)
   → Payment dicatat → paidAmount bertambah
        → paidAmount >= totalAmount → PAID, else PARTIAL
   → NotificationQueue (WA reminder / kwitansi)
Semua perubahan status → AuditLog
```

### 4.3 Absensi
```
Guru pilih kelas+mapel+tanggal → tandai status per siswa
   → Attendance tersimpan (dengan markedById)
   → bila ABSENT → NotificationQueue (WA alert ke ortu)
   → rekap harian/bulanan → laporan
```

### 4.4 Penilaian
```
Guru buat GradeItem (mis. UTS bobot 30%)
   → input Grade per siswa
   → hitung nilai akhir (weighted) → ReportCard
   → publikasi rapor → NotificationQueue (WA nilai rilis)
```

### 4.5 Notifikasi WA
```
Aksi apa pun yang memicu WA
   → insert NotificationQueue (status QUEUED, scheduledAt)
   → WA Gateway worker polling → ambil batch
   → kirim via Baileys → update status SENT/FAILED
   → retry dengan backoff bila gagal (max N kali)
```

**Aturan pengiriman:**
- Hormati jam wajar (default 07:00–21:00 WIB). Di luar itu → `scheduledAt` digeser.
- Normalisasi nomor ke E.164 tanpa `+`.
- Batasi retry (mis. 3x) agar tidak spam.
- Simpan `waMessageId` untuk pelacakan.

## 5. WA Gateway (Baileys)

Service terpisah (`apps/wa-gateway`), alasan:
- Baileys menjaga koneksi WebSocket persisten (tidak cocok di serverless).
- Bisa di-restart independen dari web app.
- Multi-sesi: satu sesi per sekolah (`school.waGatewayId`).

**Komponen:**
- Session manager (scan QR, simpan kredensial sesi).
- Worker polling `NotificationQueue` (atau via webhook/queue internal).
- Endpoint status (terhubung / terputus / QR terbaru).

## 6. Stack Keputusan

| Area | Pilihan | Alasan |
|------|---------|--------|
| Framework | Next.js | Full-stack, SSR untuk web publik, App Router |
| ORM | Prisma | Type-safe, migrasi rapi |
| DB | PostgreSQL | Andalan, dukung JSONB & RLS |
| Auth | NextAuth | Terintegrasi Next.js |
| Validasi | Zod | Skema tunggal untuk form & API |
| WA | Baileys | Gateway sendiri, hemat biaya |
| UI | Tailwind + shadcn/ui | Cepat, konsisten |

## 7. Non-Functional

- **Keamanan:** argon2/bcrypt, HTTPS, rate limit login, audit log, isolasi tenant.
- **Performa:** index pada FK & kolom filter (`schoolId`, `date`, `status`).
- **Backup:** pg_dump harian + retensi 30 hari.
- **Observability:** log terstruktur + alert kegagalan kirim WA.
- **Zona waktu:** simpan UTC, tampilkan `Asia/Jakarta`.
