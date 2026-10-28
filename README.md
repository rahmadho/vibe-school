# School App — Sistem Informasi Sekolah Multi-Tenant

Aplikasi lengkap untuk sekolah: **web sekolah, SPMB, akademik, absensi, penilaian, keuangan, dan notifikasi WhatsApp** — mendukung banyak sekolah (yayasan/unit) dalam satu instalasi.

> Status: **Fase 1–9 sebagian besar selesai** — kerangka multi-tenant, data master,
> keuangan, absensi, penilaian, SPMB, WA gateway, dan web sekolah publik sudah
> berjalan. Lihat [roadmap](docs/roadmap.md) untuk rincian yang belum ada.

---

## Fitur

- 🌐 **Web sekolah** — profil, berita, pengumuman, agenda, galeri
- 📝 **SPMB** — pendaftaran online, upload dokumen, seleksi, pengumuman
- 🎓 **Akademik** — tahun ajaran, kelas, mapel, jadwal (jam ke-N), guru & staf
- ✅ **Absensi** — siswa & guru, harian/per-mapel, rekap
- 📊 **Penilaian** — komponen nilai (UTS/UAS/tugas), rapor PDF
- 💰 **Keuangan** — tagihan, SPP, pembayaran via gateway, tunggakan, kwitansi
- 📱 **Notifikasi WA** — gateway sendiri (Baileys): absen, tagihan, nilai, pengumuman
- 🏢 **Multi-sekolah** — isolasi data per tenant (`schoolId` + RLS)
- 🔒 **Audit log** — jejak aksi penting untuk keuangan & nilai
- 🖼️ **Logo sekolah** — unggah berkas, disimpan di disk lokal (MinIO disiapkan)
- 💳 **Langganan** — paket sekolah, batas kuota siswa, fitur per paket

---

## Stack

| Lapisan | Teknologi |
|---------|-----------|
| Web + API | Next.js 15 (App Router, TypeScript) |
| ORM | Prisma 5 |
| Database | PostgreSQL 16 |
| Auth | NextAuth v5 (credentials + RBAC) |
| Validasi | Zod |
| UI | Tailwind CSS + komponen sendiri (design system "papan tulis") |
| Test | Vitest |
| WA | Node.js + Baileys (service terpisah) |

---

## Mulai

```bash
# 1. Install dependencies (monorepo workspaces)
npm install

# 2. Environment
cp apps/web/.env.example apps/web/.env
#    edit DATABASE_URL & NEXTAUTH_SECRET (min. 32 karakter)

# 3. Siapkan PostgreSQL (sudah berjalan di container/stack terpisah)
#    Arahkan DATABASE_URL di apps/web/.env ke DB tersebut, mis.:
#    postgresql://school:pass@localhost:5432/schoolapp?schema=public

# 4. Terapkan skema + seed data demo
npm run prisma:migrate        # buat & jalankan migrasi
npm run db:seed               # 2 sekolah contoh + akun demo

#    (opsional) lengkapi tata letak 3 schema + RLS + hak akses
#    DATABASE_URL harus memakai role owner saat menjalankan ini
sh apps/web/prisma/bootstrap.sh

# 5. Jalankan
npm run dev                   # http://localhost:3000
```

### Akun demo (dari seed)

| Peran | Email | Password |
|-------|-------|----------|
| Admin SMP | `admin@smpn1.sch.id` | `password12345` |
| Admin SD | `admin@tunasharapan.sch.id` | `password12345` |
| Guru | `guru@smpn1.sch.id` | `password12345` |
| Super admin | `admin@schoolapp.local` | `changeme12345` |

> Login sebagai admin SMP lalu admin SD — angka di dashboard berbeda.
> Itu bukti isolasi tenant bekerja.

---

## Isolasi Tenant (inti keamanan)

Dua lapis pertahanan:

1. **Aplikasi — `scopedDb(schoolId)`** (`apps/web/src/lib/scoped-db.ts`)
   Semua query data sekolah lewat helper ini; `schoolId` disuntik otomatis ke
   setiap `where` dan `create`. Query lintas-tenant **ditolak** dengan error.
   ```ts
   const db = scopedDb(session.user.schoolId);
   const students = await db.student.findMany();      // hanya sekolah ini
   await db.student.create({ data: { nis: "001" } }); // schoolId otomatis
   ```

2. **Database — Row Level Security** (`apps/web/prisma/rls.sql`)
   Jaring pengaman bila ada query yang lolos. Butuh koneksi sebagai role
   DB non-owner. Konteks per-request lewat `withRls(schoolId, fn)`.

Diuji otomatis: `apps/web/src/test/tenant-isolation.test.ts`.

---

## Struktur Repo

```
school-app/
├─ AGENTS.md                 # instruksi kerja agent/developer
├─ SOUL.md                   # kepribadian & nilai agent
├─ .impeccable.md            # konteks desain (dibaca skill desain)
├─ docker-compose.yml        # produksi: web + wa-gateway (DB & Nginx eksternal)
├─ deploy/nginx/             # nginx.conf siap pindah ke container Nginx
├─ scripts/verify.sh         # typecheck + lint + test + build
├─ docs/                     # PRD, arsitektur, skema, roadmap, deploy
└─ apps/
   ├─ web/                   # Next.js app utama
   │  ├─ prisma/
   │  │  ├─ schema.prisma    # ⭐ skema (sumber kebenaran)
   │  │  ├─ seed.ts          # data demo multi-tenant
   │  │  ├─ seed-activity.ts # riwayat demo 2 tahun (1 sekolah)
   │  │  ├─ grants.sql       # hak akses role aplikasi
   │  │  └─ rls.sql          # Row Level Security
   │  ├─ var/uploads/        # berkas unggahan (TIDAK di-commit)
   │  └─ src/
   │     ├─ app/             # (public), (dashboard), login, api, uploads
   │     ├─ components/      # sidebar, data-table, ui, site/
   │     ├─ lib/             # prisma, scoped-db, storage, auth, rbac, ...
   │     │  └─ data/         # query layer per modul
   │     └─ test/            # test isolasi tenant, host, blok, storage
   └─ wa-gateway/            # service WhatsApp (Baileys)
```

---

## Perintah

```bash
npm run dev            # jalankan dev server
npm run build          # build produksi
npm run typecheck      # tsc --noEmit
npm run test           # vitest (isolasi tenant)
npm run verify         # semua gate sekaligus
npm run prisma:migrate # migrasi dev
npm run prisma:studio  # GUI database
npm run db:seed        # seed data demo (2 sekolah + riwayat 2 tahun di SMP)
```

Seed demo bisa dimatikan dan aman dijalankan ulang:

```bash
SEED_DEMO_ACTIVITY=0 npm run db:seed   # hanya data dasar, tanpa riwayat
```

> Riwayat demo memakai PRNG berbenih tetap, jadi dua kali menjalankan
> menghasilkan data yang sama. Fungsi ini berhenti sendiri bila absensi sudah
> ada, sehingga tidak menggandakan tagihan.

### Izin database

RLS mewajibkan aplikasi terhubung sebagai role **non-owner**. Role seperti itu
TIDAK otomatis punya hak ke tabel, sehingga query gagal dengan
`42501 permission denied`. Semua ini sudah diurus otomatis:

- **Di Docker/Coolify** — `bootstrap.sh` jalan sendiri tiap container start.
- **Di dev lokal** — jalankan sekali sebagai owner:

```bash
DATABASE_URL="postgresql://OWNER:***@HOST:5432/DBNAME" sh apps/web/prisma/bootstrap.sh
```

---

## Dokumentasi

- 📋 [PRD (Product Requirements)](docs/PRD.md) — ⭐ ruang lingkup & keputusan resmi
- 📐 [Arsitektur & alur modul](docs/arsitektur.md)
- 🗄️ [Skema database](docs/skema-database.md)
- 🗺️ [Roadmap](docs/roadmap.md)
- 🤖 [AGENTS.md](AGENTS.md) — aturan kerja
- 💭 [SOUL.md](SOUL.md) — prinsip & nilai

---

## Prinsip Penting

1. **Isolasi tenant:** setiap query data sekolah WAJIB lewat `scopedDb(schoolId)`.
2. **Uang = integer Rupiah**, bukan float.
3. **Notifikasi WA async** lewat `notification_queue` (jangan kirim di request handler).
4. **Soft delete** untuk data penting (`deletedAt`).
5. **Audit log** untuk aksi keuangan, nilai, dan absensi.
6. **Tanpa kompilasi native** — password pakai `scrypt` bawaan Node (portabel di VPS sekolah).
7. **Unggahan lewat driver penyimpanan** — `lib/storage.ts`; bawaan disk lokal,
   MinIO disiapkan sebagai sambungan. Lihat [docs/penyimpanan-berkas.md](docs/penyimpanan-berkas.md).
8. **Subdomain wajib di produksi** — `?school=` hanya aktif di luar produksi.
   Lihat [docs/panduan-deploy-subdomain.md](docs/panduan-deploy-subdomain.md).

---

## Deploy dengan Docker (produksi)

`docker-compose.yml` menjalankan **dua** layanan: `web` (Next.js standalone)
dan `wa-gateway`. PostgreSQL dan Nginx **tidak** dikelola di sini — keduanya
dianggap sudah berjalan di stack terpisah.

Berkas ini **tidak punya blok `networks:`** dan tidak perlu. Compose otomatis
membuat satu network default per project (`school-app_default`) dan memasukkan
semua service ke sana — cukup untuk `web` menjangkau `wa-gateway` maupun DB.

```bash
# 1. Siapkan .env di root repo
cp .env.docker.example .env
#    isi DATABASE_URL, NEXTAUTH_SECRET, ROOT_DOMAIN, WA_GATEWAY_TOKEN,
#    PAYMENT_ENCRYPTION_KEY, dst.

# 2. Build & jalankan
docker compose up -d --build
```

> Bila PostgreSQL berada di container lain di server yang sama, sambungkan
> container itu ke network project sekali:
> `docker network connect school-app_default <container-db>`.
> Bila DB di host lain (remote), jaringan Docker tidak relevan — cukup
> `DATABASE_URL` menunjuk host DB tersebut.
>
> `DATABASE_URL` wajib memakai `?schema=app` (bukan `public`) dan peran
> aplikasi (bukan owner). Tanpa itu seluruh daftar dan angka kosong.

Panduan lengkap (backup, migrasi, TLS, troubleshooting):
[docs/panduan-deploy-docker.md](docs/panduan-deploy-docker.md).
Penjelasan tiap variabel `.env`: [docs/panduan-env-produksi.md](docs/panduan-env-produksi.md).

---

## Desain (design system)

Arah visual: **"papan tulis & arsip sekolah"** — tenang, informatif, sedikit hangat.

- **Warna:** `ink` (biru-arang) · `paper` (kertas) · `board` (hijau papan tulis, aksen utama) · `chalk` · `marker` (peringatan)
- **Tipografi:** `Public Sans` (UI) + `Fraunces` (angka penting & judul, nuansa cetakan rapor)
- **Prinsip:** hijau papan tulis dipakai hemat; hierarki lewat border & ruang, bukan shadow.

---

## Status

- [x] Skema database multi-tenant lengkap
- [x] Dokumentasi (PRD, arsitektur, skema, roadmap)
- [x] **Fase 1: Next.js + NextAuth + Prisma + RBAC + isolasi tenant (scopedDb + RLS) + test**
- [x] Fase 2: Data master & onboarding (siswa, guru, staf, pengguna, akademik, jadwal, jam pelajaran, impor Excel, audit log)
- [x] Fase 3: Keuangan + payment gateway + kwitansi + tunggakan
- [x] Fase 4: Absensi + rekap + trigger WA
- [x] Fase 5: Penilaian + rapor
- [x] Fase 6: SPMB (pendaftaran, jalur, verifikasi, pengumuman, konversi)
- [x] Fase 7: WA Gateway (Baileys) — template pesan, antrean, pengumuman massal
- [x] Fase 8: Web sekolah publik (blok, halaman, menu, tema, SEO)
- [ ] Fase 9: Kenaikan kelas massal (schema `StudentClassHistory` sudah ada)
- [ ] Fase 10: Komersial penuh — halaman Langganan sudah ada (baca saja);
      pembelian/perpanjangan paket, backup otomatis, deploy VPS belum

**Ditambahkan di luar rencana awal:** unggah logo sekolah dengan abstraksi
penyimpanan berkas ([docs/penyimpanan-berkas.md](docs/penyimpanan-berkas.md)),
halaman Log Aktivitas, dan halaman Langganan.
