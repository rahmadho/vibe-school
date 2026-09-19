# Modul Notifikasi WhatsApp

> Status: **Fase 7 selesai**. Pengiriman async via `apps/wa-gateway` (Baileys).

## 1. Gambaran

Tiga bagian yang bekerja bersama:

```
[Modul web]                    [wa-gateway]                [WhatsApp]
absensi/nilai/keuangan   →   worker klaim pesan    →   kirim via Baileys
      ↓                             ↑
 notification_queue ────────────────┘
   (PostgreSQL)
```

**Aturan mutlak (AGENTS.md #9):** tidak ada kode yang mengirim WhatsApp dari
request handler. Semua pesan masuk tabel `notification_queue`, lalu worker di
gateway yang mengirim. Alasan praktisnya: kalau pengiriman dilakukan saat
request, halaman admin akan menggantung menunggu jaringan WhatsApp — dan gagal
total saat internet sekolah buruk.

## 2. Komponen

### 2.1 `notification_queue` (tabel)
| Kolom | Fungsi |
|---|---|
| `to` | nomor E.164 tanpa `+`, mis. `6281234567890` |
| `body` | isi pesan final, sudah di-render |
| `templateKey` | jejak template mana yang dipakai |
| `status` | `QUEUED` → `PROCESSING` → `SENT`/`FAILED`/`CANCELLED` |
| `priority` | 1=tinggi … 9=rendah. Absensi=3, tagihan=5, nilai=6 |
| `scheduledAt` | waktu kirim (menghormati jam wajar) |
| `nextAttemptAt` | waktu percobaan berikutnya setelah gagal |
| `lockedAt` / `lockedBy` | klaim worker, mencegah duplikat |
| `attempts` | sudah berapa kali dicoba (maks 4) |

### 2.2 Jam wajar kirim
Tidak ada WA yang dikirim di luar **07.00–20.00, Senin–Sabtu**.

Alasannya bukan teknis melainkan manusiawi: notifikasi absen bisa dibuat guru
jam 23.30. Mengirim "anak Anda alpa hari ini" tengah malam akan membuat orang
tua panik. Pesan ditahan sampai jendela kirim berikutnya.

### 2.3 Backoff
Jeda antar percobaan: **1 → 5 → 15 → 60 menit**, lalu menyerah setelah 4×.

Ini melindungi nomor sekolah: WhatsApp memblokir nomor yang mengirim terlalu
cepat setelah gagal berulang kali. Menunggu lebih lama juga memberi kesempatan
internet pulih sendiri.

**Kegagalan permanen** (nomor tidak terdaftar) tidak diulang sama sekali —
langsung `FAILED`. Tanpa ini, nomor mati akan dicoba 4× dan membuang waktu.

### 2.4 Klaim aman (anti kirim ganda)
Worker mengklaim pesan dengan operasi atomik:

```js
updateMany({ where: { id, status: "QUEUED" }, data: { status: "PROCESSING" } })
```

Hanya satu worker yang mendapat `count === 1`. Worker lain melewatinya. Aman
dijalankan **lebih dari satu proses** sekaligus.

Kunci yang tertinggal (worker mati mendadak) dilepas otomatis setelah 5 menit
oleh `releaseStaleLocks()` — tanpa ini pesan akan tersangkut `PROCESSING`
selamanya dan tidak pernah terkirim.

### 2.5 Template pesan
Sekolah dapat mengubah bunyi pesan **tanpa mengubah kode**. Template disimpan
per sekolah di `message_templates`.

Variabel: `{{nama_siswa}}`, `{{kelas}}`, `{{tanggal}}`, `{{jumlah}}`, dst.
Variabel tanpa nilai diganti `-` (bukan dibiarkan `{{...}}`) agar pesan tidak
terlihat seperti sistem rusak.

Template bawaan tersedia di `src/lib/templates-seed.ts`:
absen alpa/terlambat/rekap, nilai di bawah KKM, rapor siap, tagihan baru,
pengingat jatuh tempo, konfirmasi pembayaran, SPMB diterima/lolos, umum.

## 3. Menyiapkan gateway

### 3.1 Konfigurasi
```bash
cp apps/wa-gateway/.env.example apps/wa-gateway/.env
cp apps/web/.env.example apps/web/.env
```

Token harus **sama** di kedua sisi:
- `apps/wa-gateway/.env` → `WA_GATEWAY_TOKEN`
- `apps/web/.env` → `WA_GATEWAY_TOKEN`
- `apps/web/.env` → `WA_GATEWAY_URL` (default `http://127.0.0.1:3001`)

Hasilkan token: `openssl rand -hex 32`

### 3.2 Jalankan
```bash
docker compose up -d          # postgres + wa-gateway
cd apps/web && npx prisma migrate dev && npm run db:seed
```

### 3.3 Tautkan WhatsApp
1. Masuk sebagai admin sekolah.
2. Buka **Notifikasi WA → Koneksi WhatsApp**.
3. Klik **Sambungkan WhatsApp**.
4. Pindai QR dari HP: WhatsApp → Perangkat Tertaut → Tautkan Perangkat.

Kredensial disimpan di volume `school_wa_sessions`, jadi **tidak perlu pindai
ulang setiap restart**. QR hanya muncul saat pertama kali atau setelah logout.

> Gunakan nomor khusus sekolah, bukan nomor pribadi. Semua pesan terkirim dari
> nomor ini.

## 4. Keamanan

| Aspek | Penanganan |
|---|---|
| Token API | Wajib di semua endpoint gateway kecuali `/health`. Dibandingkan waktu-konstan (`timingSafeEqual`) untuk mencegah timing attack |
| Port | Compose hanya mengikat `127.0.0.1:3001` — tidak terbuka ke internet |
| QR | Tidak disimpan di DB (bersifat sementara dan berisi kredensial) |
| Nomor di UI | Disamarkan: `6281•••890` |
| Isolasi tenant | Semua query difilter `schoolId` dari sesi |

**Endpoint gateway:**
| Metode | Rute | Fungsi |
|---|---|---|
| GET | `/health` | Cek service (tanpa token) |
| GET | `/sessions` | Daftar sesi aktif |
| POST | `/sessions/start` | Mulai sesi (memicu QR) |
| GET | `/sessions/qr?session=` | Status + QR (data URL PNG) |
| POST | `/sessions/stop` | Putuskan, kredensial tetap |
| POST | `/sessions/logout` | Keluar & hapus kredensial |

## 5. Alur pesan

1. Modul memanggil `queueNotification()` dari `src/lib/notification-queue.ts`.
2. Pesan di-render dengan template sekolah, masuk `QUEUED`.
3. Worker klaim → `PROCESSING`.
4. Kirim via Baileys (dengan jeda acak 1,5–4 detik antar pesan).
5. Sukses → `SENT` + `waMessageId`. Gagal → hitung backoff, kembali `QUEUED`.
   Permanen/jatah habis → `FAILED`.

`queueNotification()` **tidak pernah melempar galat**. Notifikasi bersifat
tambahan — kalau WA gagal diantrekan, menyimpan absensi/nilai/pembayaran harus
tetap berhasil.

## 6. Pengumuman massal

**Notifikasi WA → Pengumuman.** Pilih audiens:

| Audiens | Sumber nomor |
|---|---|
| Orang tua satu kelas | wali utama, fallback wali lain, fallback nomor siswa |
| Siswa satu kelas | nomor siswa |
| Seluruh orang tua sekolah | seperti di atas |
| Guru & staf | nomor guru |

Nomor dinormalisasi dan **diduplikasi** sebelum masuk antrean, jadi tidak ada
orang tua yang menerima pesan sama dua kali. Nomor tidak valid dilewati dan
jumlahnya dilaporkan.

## 7. Pemecahan masalah

| Gejala | Sebab & solusi |
|---|---|
| Status "Terputus" terus | Gateway mati → `docker compose ps`. Cek log: `docker compose logs wa-gateway` |
| Pesan tetap `QUEUED` | Jam di luar 07.00–20.00 → normal, akan terkirim pagi. Atau WhatsApp belum tersambung |
| Semua pesan `FAILED` | Sesi logout. Buka Koneksi WhatsApp → Keluar → pindai ulang |
| QR tidak muncul | Gateway tidak merespons. Cek `WA_GATEWAY_TOKEN` sama di kedua sisi |
| Nomor valid tapi gagal | Pastikan nomor aktif di WhatsApp (format `62…`, tanpa `0` di depan) |

**Verifikasi gateway:**
```bash
curl -s localhost:3001/health
docker compose logs --tail=50 wa-gateway
```

## 8. Berkas terkait

**Web:**
- `src/lib/notification.ts` — render template, jam wajar, backoff, normalisasi nomor
- `src/lib/notification-queue.ts` — jembatan ke modul lain
- `src/lib/templates-seed.ts` — template bawaan + contoh variabel
- `src/lib/validations/notification.ts` — skema Zod
- `src/lib/data/notifications.ts` — query layer
- `src/lib/gateway-web.ts` — klien HTTP ke gateway
- `src/app/(dashboard)/dashboard/notifications/**` — halaman & actions

**Gateway:**
- `src/wa.js` — sesi Baileys, sambung ulang otomatis, pengiriman
- `src/worker.js` — klaim, backoff, pengiriman
- `src/worker-core.js` — logika murni (teruji)
- `src/api.js` — HTTP API + autentikasi token
- `src/index.js` — titik masuk

## 9. Pengujian

```bash
cd apps/web && npx vitest run              # 312 test
cd apps/wa-gateway && npm test             # 9 test (logika worker)
```

Yang diuji: render template (termasuk variabel kosong), jam wajar (termasuk
penahanan tengah malam & hari Minggu), backoff, normalisasi nomor
(`0812…`/`+62 812…`/`812…`), deduplikasi penerima, klasifikasi kegagalan
permanen (Indonesia **dan** Inggris), serta validasi template & pengumuman.
