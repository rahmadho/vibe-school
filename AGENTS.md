# AGENTS.md

> Instruksi kerja untuk AI agent (dan developer) yang bekerja di repo **School App**.
> File ini dibaca otomatis oleh agent. Fokus: **cara kerja di project ini**.

---

## 1. Apa itu Aplikasi Ini

Sistem Informasi Sekolah (SIS) multi-tenant yang mencakup:

| Modul | Deskripsi |
|-------|-----------|
| **Web Sekolah** | Website publik: profil, berita, pengumuman, galeri, kontak |
| **SPMB** | Sistem Penerimaan Murid Baru: pendaftaran online, seleksi, pengumuman |
| **Akademik** | Kelas, mata pelajaran, jadwal, tahun ajaran, semester, **kenaikan kelas massal** |
| **Jurusan** | Jurusan / peminatan / kompetensi keahlian. Satu model `Major` untuk SMA ("Peminatan") dan SMK ("Kompetensi Keahlian"); label menyesuaikan jenjang di UI. |
| **PKL & UKK** | Praktik Kerja Lapangan dan Uji Kompetensi Keahlian — **hanya jenjang SMK/MAK**; menu otomatis tersembunyi di jenjang lain |
| **Absensi** | Absen siswa & guru (harian, per-mapel), rekap otomatis |
| **Penilaian** | Nilai tugas/UTS/UAS, rapor, KKM, peringkat |
| **Keuangan** | Tagihan, pembayaran (SPP/uang pangkal), kwitansi, tunggakan |
| **Notifikasi WA** | Gateway sendiri pakai Baileys → absen, tagihan, pengumuman, nilai |
| **Administrasi** | Data siswa/guru/staf, user & role, log aktivitas |
| **Multi-tenant** | Satu instalasi melayani banyak sekolah (yayasan/unit) |

---

## 2. Stack & Arsitektur

- **Frontend + Backend:** Next.js (App Router, TypeScript)
- **ORM:** Prisma
- **Database:** PostgreSQL
- **Auth:** NextAuth (credentials + role-based)
- **WA Gateway:** Node.js microservice terpisah + Baileys
- **Validasi:** Zod
- **UI:** Tailwind CSS + shadcn/ui

### Struktur Folder

```
school-app/
├─ AGENTS.md            # file ini
├─ SOUL.md              # kepribadian/nilai agent
├─ docker-compose.yml   # postgres + wa-gateway
├─ prisma/
│  └─ schema.prisma     # skema database (single source of truth)
├─ docs/                # dokumentasi arsitektur & modul
├─ apps/
│  ├─ web/              # Next.js app utama
│  └─ wa-gateway/       # service WhatsApp (Baileys)
```

---

## 3. Aturan Main (WAJIB)

1. **Multi-tenant disiplin.** Setiap tabel data milik sekolah HARUS punya `schoolId`.
   Setiap query data sekolah WAJIB difilter `schoolId` dari sesi user. Dilarang query lintas-tenant tanpa cek role super-admin.
2. **Prisma = sumber kebenaran skema.** Jangan ubah DB manual. Semua perubahan skema lewat `prisma migrate`.
3. **Jangan commit rahasia.** Kredensial hanya di `.env` (lihat `.env.example`).
4. **Soft delete.** Gunakan `deletedAt` untuk data penting (siswa, tagihan). Jangan hard delete.
5. **Audit log.** Aksi yang mengubah data (create/update/delete) penting harus dicatat ke `AuditLog`.
6. **Uang = integer.** Simpan nominal sebagai integer rupiah (bukan float). Field nama `*Amount` satuan Rupiah.
7. **Tanggal uang ≠ tanggal input.** `dueDate` (jatuh tempo) dan `paidAt` (dibayar) terpisah.
8. **Nomor WA = format E.164 tanpa `+`** (contoh: `628123456789`). Normalisasi di satu util.
9. **Notifikasi lewat queue.** Jangan kirim WA langsung di request handler; masukkan ke tabel `NotificationQueue`, worker yang proses.
10. **TypeScript strict.** Tidak ada `any` tanpa alasan jelas disertai komentar.

---

## 4. Perintah Penting

```bash
npm install                 # install deps
npm run dev                 # jalankan dev server
npm run build               # build produksi
npm run lint                # lint
npm run test                # test
npm run typecheck           # tsc --noEmit
npm run db:seed             # seed data demo (2 sekolah + riwayat 2 tahun)
docker compose up -d        # postgres + wa-gateway
```

### Perintah Prisma dijalankan dari `apps/web`

`schema.prisma` ada di `apps/web/prisma/`, bukan di akar repo. Prisma mencari
skema di lokasi default, jadi menjalankan perintah Prisma dari **akar repo**
gagal dengan:

```
Error: Could not find Prisma Schema that is required for this command.
```

Karena itu selalu `cd apps/web` lebih dulu (atau pakai `-w apps/web`):

```bash
cd apps/web
npx prisma generate
npx prisma migrate dev      # buat & jalankan migrasi (dev)
npx prisma migrate deploy   # jalankan migrasi (produksi)
npx prisma studio           # GUI database
```

### Izin database (sekali per database baru)

RLS mewajibkan aplikasi terhubung sebagai role **non-owner**. Role seperti itu
TIDAK otomatis punya hak ke tabel, sehingga query gagal dengan
`42501 permission denied`. Urutan pemasangan yang benar:

```bash
cd apps/web                                                  # path relatif di bawah dari sini

npx prisma migrate deploy                                   # 1. owner buat tabel
psql "$OWNER_URL" -v app_role=<role_di_DATABASE_URL> \
  -f prisma/grants.sql                                      # 2. hak akses
psql "$OWNER_URL" -f prisma/rls.sql                         # 3. RLS
```

**Ulangi langkah 2 & 3 setiap kali ada TABEL BARU** (model baru ber-`schoolId`).
Migrasi yang hanya menambah kolom pada tabel lama tidak perlu RLS ulang.

**Jangan** menjadikan role aplikasi sebagai owner atau superuser demi
menyelesaikan error ini — keduanya membypass RLS sepenuhnya.

### Preview web sekolah di pengembangan

```bash
npm run dev
# lalu buka:
http://localhost:3000/?school=smpn1-nusantara
```

Pilihan sekolah diingat lewat cookie sehingga navigasi menu tetap di sekolah yang
sama. Di produksi `?school=` **mati total** — subdomain wajib. Lihat
[docs/panduan-deploy-subdomain.md](docs/panduan-deploy-subdomain.md).

---

## 5. Konvensi Penamaan

- **Tabel/model Prisma:** PascalCase singular → `Student`, `Invoice` (`@@map` ke snake_case plural `students`, `invoices`).
- **Field:** camelCase → `schoolId`, `dueDate`, `paidAmount`.
- **Enum:** SCREAMING_SNAKE → `PAID`, `UNPAID`, `PRESENT`, `ABSENT`.
- **File komponen:** kebab-case → `student-form.tsx`.
- **Route API:** `/api/<modul>/<aksi>` → `/api/students/create`.

---

## 6. Definition of Done

Sebuah fitur dianggap selesai jika:
- [ ] Kode lolos `lint` + `build` + `test`.
- [ ] Query sudah difilter `schoolId`.
- [ ] Ada validasi input (Zod).
- [ ] Aksi penting tercatat di `AuditLog`.
- [ ] Kalau memicu WA → masuk `NotificationQueue` (bukan kirim langsung).
- [ ] Dokumentasi modul di `docs/` diperbarui bila perlu.

---

## 7. Yang HARUS Dihindari

- ❌ Query tanpa filter `schoolId` (kebocoran data antar-sekolah).
- ❌ Simpan uang sebagai `Float`/`Decimal` tanpa alasan.
- ❌ Kirim WA sinkron di dalam transaksi DB panjang.
- ❌ `prisma db push` di produksi (pakai `migrate deploy`).
- ❌ Hard delete data siswa/tagihan/keuangan.
- ❌ Jadikan role aplikasi sebagai owner/superuser database (mematikan RLS).
- ❌ Terima unggahan SVG (XML boleh memuat `<script>` → XSS pada sesi admin).
- ❌ Tulis berkas unggahan ke `public/` (tidak dijamin tersaji di produksi).
- ❌ Pasang `rls.sql` tanpa `grants.sql` (query langsung gagal `42501`).
- ❌ **Menambah model baru lalu langsung `next build`/`next dev` tanpa
  `prisma generate`.** Gejalanya halaman 500 dengan
  `Cannot read properties of undefined (reading 'findMany')` — Prisma client
  lama tidak mengenal model itu. Jalankan `npm run prisma:generate` (atau
  `prisma migrate dev` yang sudah memuatnya).
- ❌ **Menambah model ber-`schoolId` tanpa mendaftarkannya di DUA tempat:**
  `TENANT_MODELS` (`src/lib/scoped-db.ts`) dan `tenant_tables`
  (`prisma/rls.sql`). Tanpa keduanya, tabel itu berjalan tanpa isolasi tenant.
  `src/test/tenant-isolation.test.ts` akan gagal — jangan menonaktifkan test
  itu; itulah gerbangnya.
- ❌ **Memakai `defaultValue` pada input React yang nilainya bergantung pada
  input lain.** `defaultValue` hanya dibaca saat mount; field seperti "jurusan
  mengikuti siswa" harus memakai state terkendali, atau form terkirim dengan
  nilai kosong walaupun layar terlihat terisi.
- ❌ **Menyimpan HTML dari pengguna tanpa `sanitizeRichText()`
  (`lib/rich-text.ts`).** Isi berita tampil di halaman publik sekolah; satu
  `<script>` yang lolos cukup untuk mencuri sesi orang tua.

## 8. Referensi Dokumentasi

| Topik | Berkas |
|---|---|
| Ruang lingkup & keputusan produk | `docs/PRD.md` |
| Arsitektur & alur modul | `docs/arsitektur.md` |
| Skema database | `docs/skema-database.md` |
| Urutan pengerjaan | `docs/roadmap.md` |
| Deploy subdomain multi-sekolah | `docs/panduan-deploy-subdomain.md` |
| Penyimpanan berkas unggahan | `docs/penyimpanan-berkas.md` |
| Konteks desain (untuk skill desain) | `.impeccable.md` |
