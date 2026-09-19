# School App — Sistem Informasi Sekolah Multi-Tenant

Aplikasi lengkap untuk sekolah: **web sekolah, SPMB, akademik, absensi, penilaian, keuangan, dan notifikasi WhatsApp** — mendukung banyak sekolah (yayasan/unit) dalam satu instalasi.

> Status: **Fase 1 (Kerangka & Multi-Tenant) ✅** — autentikasi, RBAC, isolasi tenant.

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

# 3. Nyalakan PostgreSQL (atau pakai DB yang sudah ada)
docker compose up -d postgres

# 4. Terapkan skema + seed data demo
npm run prisma:migrate        # buat & jalankan migrasi
npm run db:seed               # 2 sekolah contoh + akun demo

#    (opsional) aktifkan Row Level Security
psql "$DATABASE_URL" -f apps/web/prisma/rls.sql

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
├─ docker-compose.yml        # postgres (+ wa-gateway nanti)
├─ scripts/verify.sh         # typecheck + lint + test + build
├─ docs/                     # PRD, arsitektur, skema, roadmap
└─ apps/
   ├─ web/                   # Next.js app utama
   │  ├─ prisma/
   │  │  ├─ schema.prisma    # ⭐ skema (sumber kebenaran)
   │  │  ├─ seed.ts          # data demo multi-tenant
   │  │  └─ rls.sql          # Row Level Security
   │  └─ src/
   │     ├─ app/             # (login, dashboard, api/auth)
   │     ├─ components/      # sidebar, ui/
   │     ├─ lib/             # prisma, scoped-db, auth, rbac, ...
   │     └─ test/            # test isolasi tenant
   └─ wa-gateway/            # service WhatsApp (Fase 7)
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
npm run db:seed        # seed data demo
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
- [ ] Fase 2: Data master & onboarding
- [ ] Fase 3: Keuangan + payment gateway
- [ ] Fase 4: Absensi
- [ ] Fase 5: Penilaian + rapor PDF
- [ ] Fase 6: SPMB
- [x] Fase 7: WA Gateway (Baileys) — template pesan, antrean, pengumuman massal
- [ ] Fase 8: Web sekolah publik
- [ ] Fase 9: Kenaikan kelas
- [ ] Fase 10: Komersial & rilis
