# Modul Web Sekolah & SPMB

Web sekolah publik dan Sistem Penerimaan Murid Baru (SPMB). Dua modul ini
berkaitan: formulir pendaftaran tampil di web sekolah, dan web sekolah adalah
wajah yang dilihat calon orang tua sebelum mendaftar.

---

## 1. Keputusan produk yang mendasarinya

**"Satu mesin, banyak wajah."** Bukan satu template per sekolah (pemeliharaan
berlipat: satu perbaikan bug harus dikerjakan N kali), bukan pula satu template
seragam (semua sekolah terlihat sama, hanya ganti warna).

Melainkan: **satu set blok tampilan, disusun ulang per sekolah.**

Tiga lapisan identitas yang dipisahkan dengan sadar:

| Lapisan | Yang berbeda antar sekolah | Yang berubah kapan |
|---|---|---|
| Tampilan | Warna, huruf, sudut | Sekali pasang |
| Konten | Berita, profil, galeri, agenda | Harian |
| Struktur | Susunan blok, menu, halaman | Sesekali |

Produk memiliki **kode blok**; sekolah memiliki **susunan, gaya, isi, dan menu**.
Invarian yang menjaga ini aman: **tidak ada kombinasi varian terkurasi yang
menghasilkan halaman rusak.**

### Keputusan yang dipilih sekolah (dan alasannya)

| Pertanyaan | Pilihan | Alasan |
|---|---|---|
| Kebebasan tampilan | **Kurasi + Gaya** | Cukup berbeda agar terasa "milik sendiri", cukup terkurasi agar tidak ada sekolah dengan halaman kacau |
| Subdomain | **Wajib** | Subdomain adalah identitas publik sekolah |
| Jalur SPMB | **>1 jalur** | TK cukup satu jalur; SMA favorit butuh Reguler/Prestasi/Afirmasi dengan kuota berbeda |

---

## 2. Arsitektur

```
                    sekolah.id  (portal — halaman daftar sekolah)
                         │
      ┌──────────────────┼──────────────────┐
      ▼                  ▼                  ▼
smpn1.sekolah.id   tkit.sekolah.id   sman3.sekolah.id
      │                  │                  │
      └────────── resolusi host ────────────┘
                         │
                    schoolId (satu tenant)
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
   SiteTheme         SiteBlock          Page
  (warna/huruf)   (susunan halaman)  (halaman kustom)
```

### Penyelesaian subdomain

`lib/site-host.ts` (logika murni, teruji) + `lib/site-server.ts` (membaca header
host, menyentuh DB). Ini **bagian paling sensitif** dari seluruh web publik:
fungsi ini memutuskan sekolah mana yang datanya ditampilkan, dan salah sedetik
berarti kebocoran antar-sekolah.

Aturannya:

| Host | Hasil |
|---|---|
| `smpn1.sekolah.id` | sekolah `smpn1` |
| `sekolah.id` | portal |
| `www.sekolah.id` | ditolak (`www` dipesan sistem) |
| `a.b.sekolah.id` | ditolak (subdomain bertingkat tidak sah) |
| `192.168.1.10` | portal |
| `smpn1.sch.id` | sekolah lewat **custom domain** |
| `sekolah.id.evil.com` | sekolah lewat custom domain — **bukan** subdomain kita |

**`?school=` cadangan hanya aktif di luar produksi.** Di produksi, subdomain
adalah satu-satunya jalan masuk. Alasannya: dengan `?school=`, siapa pun bisa
membaca web sekolah lain hanya dengan menebak slug — dan itu meruntuhkan janji
isolasi data. Terkunci oleh test.

**Deployment:** butuh wildcard DNS (`*.sekolah.id`) dan sertifikat wildcard di
Nginx.

### Tema sebagai CSS variable

Layout publik menyuntikkan tema sekolah sebagai CSS variable:

```
--site-primary      --site-bg         --site-radius-card
--site-accent       --site-surface    --site-radius-button
--site-text         --site-muted      --site-heading-font
--site-border                         --site-body-font
```

Komponen blok menulis `bg-[var(--site-primary)]`, bukan `bg-blue-600`. Inilah
yang membuat satu komponen menghasilkan wajah berbeda per sekolah.

### Tema: preset, bukan pemilih warna bebas

`lib/site-themes.ts` menyediakan preset terkurasi dengan **mesin kontras WCAG
sungguhan** (`contrastRatio`, `bestTextOn`). Sekolah memilih preset; warna
khusus boleh, tetapi peringatan kontras ditampilkan **sebelum** menyimpan —
dan peringatan itu **tidak memblokir** (operator bisa memutuskan sendiri).

Asimetri yang disengaja: nilai tak sah dari *data lama* diganti **diam-diam**
(halaman publik tidak boleh rusak), tetapi isian *baru yang salah* **diberi
peringatan** (operator perlu tahu).

---

## 3. Blok tampilan

10 blok, 24 varian gaya. Katalog di `lib/site-blocks.ts`.

| Blok | Varian |
|---|---|
`hero` | besar-tengah · belah-dua · ringkas |
`stats` | tiga-angka · bilah-capaian |
`profile` | teks-gambar · dua-kolom · akordeon |
`news` | kartu-kolom · daftar · korsel · sorotan |
`agenda` | linimasa · daftar |
`gallery` | kisi · mosaik |
`teachers` | kisi-foto · daftar |
`faq` | akordeon · dua-kolom |
`contact` | peta-jam · ringkas |
`spmb` | kartu · bilah |

**Blok tak dikenal dilewati diam-diam** (`return null` di renderer). Sekolah
bisa punya data blok lama dari fitur yang sudah dihapus; halaman publik tidak
boleh gagal render karenanya.

**Blok yang kehabisan data menampilkan `BlockEmpty` dengan petunjuk** — bukan
hilang. Blok yang diam-diam kosong menyembunyikan kekurangan isi dari sekolah
sendiri.

**Pengecualian:** blok SPMB. Ajakan mendaftar harus tetap menarik, jadi saat
belum ada gelombang terbuka ia menampilkan ajakan menghubungi sekolah, bukan
kotak kosong.

**Interaktivitas tanpa JavaScript:** akordeon FAQ, menu mobile, dan korsel
memakai `<details>`/`<summary>` dan `overflow-x-auto`. Nol `'use client'` di
seluruh blok publik — halaman sekolah tetap berfungsi di koneksi buruk, yang
umum di daerah.

---

## 4. Manajemen konten

Sekolah operator bukan teknisi. Kalau menambah berita terasa merepotkan, webnya
akan kosong dalam tiga bulan. Karena itu:

- **Editor ringan** dengan tab per jenis: Berita / Pengumuman / Agenda / Galeri
- **Draf → Terbit**, dengan `publishedAt` diisi sekali saat pertama terbit
- **Halaman status kelengkapan** di dasbor web: "6/5 terisi · 60%" dengan
  tautan "isi" per butir yang kurang — sekolah baru sering bingung harus
  mengisi apa
- **Peran `CONTENT_EDITOR`** — guru/staf dapat menulis berita **tanpa** akses
  nilai atau keuangan

### Catatan jujur tentang unggah gambar

Skema menyimpan `coverUrl` sebagai *string URL*, dan proyek ini **belum punya
penyimpanan berkas**. Untuk sementara operator menempel tautan gambar, dan UI
mengatakannya apa adanya. **Tidak dibuat fitur unggah palsu** yang tampak
menyimpan tetapi tidak menyimpan apa pun — itu lebih buruk dari tidak ada.

---

## 5. SPMB multi-jalur

```
AdmissionBatch  ("SPMB 2026/2027 Gelombang 1")
   │
   ├── AdmissionPath  REGULER    biaya 0        kuota 100
   ├── AdmissionPath  PRESTASI   biaya 150.000  kuota 30
   └── AdmissionPath  AFIRMASI   biaya 0        kuota 20
              │
              └── Registration   (pathId → jalur yang dipilih)
```

Keputusan yang diambil:

**Jalur "Reguler" dibuat otomatis** saat gelombang dibuat. Sekolah yang hanya
butuh satu formulir tidak perlu memahami konsep "jalur" lebih dulu. Sekolah
yang butuh lebih dari satu tinggal menambah.

**Kuota jalur tidak boleh melebihi kuota gelombang.** Ditolak dengan angka yang
dijelaskan (`"Total kuota semua jalur (150) melebihi kuota gelombang (120)"`),
bukan "isian salah". Kalau tidak dicegah, sekolah baru sadar saat pendaftaran
dibuka.

**Jalur yang sudah punya pendaftar tidak dihapus, hanya dinonaktifkan.** Kalau
dihapus, riwayat "mendaftar lewat jalur apa" hilang — padahal itu penting untuk
laporan seleksi.

**Status enum** ada di `RegistrationStatus`: `DRAFT`, `PENDING`, `VERIFIED`,
`TESTED`, `ACCEPTED`, `REJECTED`, `WAITLIST`, `WITHDRAWN`.

### Keputusan penting: tagihan daftar ulang

Tagihan daftar ulang **tidak** dibuat saat pendaftar diterima. Alasan teknis
yang menentukan: `Invoice` **wajib** terhubung ke `Student`, sedangkan pendaftar
baru menjadi siswa setelah panitia membuatkan akunnya. Membuat tagihan lebih
awal berarti invoice tanpa pemilik — dan itu justru menimbulkan tagihan hantu di
laporan keuangan.

Nominal daftar ulang disimpan pada pendaftaran, siap dipakai saat siswa dibuat.

### Notifikasi hasil seleksi

Status `ACCEPTED`/`REJECTED` memasukkan pesan ke `notification_queue`
(template `spmb.accepted`/`spmb.rejected`), bukan mengirim langsung. Aturan
proyek: WA selalu lewat antrean, dikirim worker, menghormati jam wajar.

### Cek status pendaftar

`/spmb/status` mencari berdasarkan `registrationNo`, **dibatasi pada `schoolId`
dari subdomain**, dan hanya menampilkan **nama depan** + status. Nomor
pendaftaran bisa ditebak orang lain; menampilkan data lengkap berarti
membocorkan data anak orang lain.

---

## 6. Berkas penting

| Berkas | Isi |
|---|---|
`lib/site-blocks.ts` | Katalog blok & varian, validasi komposisi (murni) |
`lib/site-themes.ts` | Preset tema + mesin kontras WCAG (murni) |
`lib/site-host.ts` | Resolusi host → sekolah (murni) |
`lib/site-server.ts` | Resolusi host sisi server (baca header + DB) |
`lib/data/site.ts` | Query layer publik |
`lib/validations/site.ts` | Skema Zod web + SPMB |
`components/site/site-ui.tsx` | Komponen bersama semua blok |
`components/site/site-nav.tsx` | Header & footer |
`components/site/block-renderer.tsx` | Dispatcher blok |
`components/site/blocks/*.tsx` | 10 komponen blok |
`app/(public)/` | Halaman publik (layout, depan, berita, agenda, galeri, spmb, halaman kustom) |
`app/(dashboard)/dashboard/website/` | Editor (blok, tema, halaman, menu, pengaturan) |
`app/(dashboard)/dashboard/spmb/` | Panel panitia (gelombang, jalur, seleksi) |
`app/(dashboard)/dashboard/content/` | Manajemen konten |

---

## 7. Pengujian

Logika kritis dites sebagai **fungsi murni** (tanpa DB):

- `site-blocks.test.ts` — katalog, komposisi, susunan awal
- `site-themes.test.ts` — kontras WCAG, preset, penggantian nilai tak sah
- `site-host.test.ts` — resolusi host, termasuk **upaya jahat**
- `site-validation.test.ts` — skema Zod web + SPMB
- `site-block-alignment.test.ts` — **penyelarasan komponen ↔ skema ↔ katalog**

Test terakhir ada karena bug nyata: skema Zod menyimpan `subheading` sementara
komponen `NewsBlock` membaca `subtitle`. Akibatnya operator mengetik judul
sekunder, menyimpan, dan teksnya **tidak pernah muncul**. `tsc` tidak bisa
menangkapnya karena props blok di-cast dari `Record<string, unknown>` di
renderer. Test itu mengunci keselarasan agar tidak terulang.

---

## 8. Yang belum ada (jujur)

- **Penyimpanan berkas** — belum ada. Unggah gambar masih lewat URL.
- **Migrasi Prisma** belum dijalankan (dilakukan operator saat deploy).
- **Wildcard DNS + sertifikat** belum disiapkan di panduan deploy.
- **Editor blok belum punya pratinjau langsung** — operator menyimpan, lalu
  membuka web sekolah untuk melihat hasilnya.
- **Unggah massal foto galeri** belum ada.
