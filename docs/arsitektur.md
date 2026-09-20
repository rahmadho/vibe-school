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
| CONTENT_EDITOR | Berita & pengumuman saja (tanpa akses siswa/nilai/keuangan) |

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
| Framework | Next.js 15 (App Router) | Full-stack, SSR untuk web publik |
| ORM | Prisma 5 | Type-safe, migrasi rapi |
| DB | PostgreSQL 16 | JSONB & RLS |
| Auth | NextAuth v5 (JWT) | Terintegrasi Next.js |
| Validasi | Zod | Skema tunggal untuk form & API |
| WA | Baileys | Gateway sendiri, hemat biaya |
| UI | Tailwind + komponen sendiri | Tanpa pustaka komponen; arah visual "papan tulis" |
| Test | Vitest | Logika murni & isolasi tenant |
| Berkas | Driver sendiri (`lib/storage.ts`) | Disk lokal bawaan, MinIO disiapkan |

### Catatan yang mudah salah diingat

- **Password pakai `scrypt` bawaan Node**, bukan argon2/bcrypt seperti tertulis di
  PRD. Alasan: tidak butuh kompilasi native di VPS sekolah. Format tersimpan
  `scrypt$N$r$p$salt$hash`, sehingga parameternya bisa dinaikkan tanpa merusak
  hash lama.
- **UI bukan shadcn/ui.** Komponen ditulis sendiri di `src/components/`.
- **NextAuth v5**, bukan v4 — nama opsi berbeda (`redirectTo`, bukan `callbackUrl`).

---

## 7. Web Sekolah Publik (Subdomain)

Setiap sekolah punya web sendiri di `slug.domain-akar`. Sekolah ditentukan dari
nama host, **bukan** parameter yang bisa dipalsukan pengunjung.

- Logika penentuan host: `src/lib/site-host.ts` (murni, teruji)
- Jembatan ke database: `src/lib/site-server.ts`
- Query: `src/lib/data/site.ts`

**Preview di pengembangan:** `?school=<slug>` diterjemahkan middleware menjadi
header `x-dev-school` dan diingat lewat cookie, sehingga navigasi menu tetap di
sekolah yang sama. Di produksi jalan pintas ini **mati total**.

**White-label:** sekolah memilih preset tema (bukan pemilih warna bebas) supaya
kontras teks selalu aman. Katalog blok halaman depan ada di
`src/lib/site-blocks.ts` — blok dikurasi, gaya boleh dipilih. Alasannya: memberi
kebebasan penuh berarti ada sekolah yang halaman depannya berantakan, dan itu
merusak nama produk.

---

## 8. Penyimpanan Berkas

Abstraksi driver di `src/lib/storage.ts`: `local` (bawaan, disk) dan `minio`
(sambungan disiapkan). Berkas disimpan di `var/uploads/` — **bukan** `public/`,
karena Next.js hanya menyajikan isi `public/` yang ada saat build.

Jenis berkas ditentukan dari byte awal, dan **SVG ditolak** (boleh memuat
`<script>`; disajikan dari origin yang sama = XSS pada sesi admin).

Rincian: [penyimpanan-berkas.md](penyimpanan-berkas.md).

---

## 9. Non-Functional

- **Keamanan:** scrypt, HTTPS, rate limit login, audit log, isolasi tenant.
- **Database:** RLS sebagai lapisan kedua, tetapi **wajib berpasangan dengan
  `grants.sql`** — role non-owner tidak otomatis punya hak ke tabel, dan tanpa
  GRANT setiap query gagal `42501`.
- **Performa:** index pada FK & kolom filter (`schoolId`, `date`, `status`).
- **Backup:** pg_dump harian + retensi 30 hari, **termasuk `var/uploads/`**
  (backup database saja tidak menyelamatkan logo sekolah).
- **Observability:** log terstruktur + alert kegagalan kirim WA.
- **Zona waktu:** simpan UTC, tampilkan `Asia/Jakarta`.
