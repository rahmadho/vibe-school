# Deploy School App di Coolify (via GitHub)

Panduan langkah demi langkah, dari repo GitHub sampai login berhasil.

**Yang harus dipahami lebih dulu:** aplikasi ini butuh **PostgreSQL dengan
peran owner dan peran aplikasi terpisah**. Selain itu tidak ada langkah SQL
manual — `bootstrap.sh` menyiapkan seluruh skema otomatis saat container
start. Yang perlu Anda lakukan hanya membuat database kosong dan mengisi
`DATABASE_URL`.

---

## 0. Ringkas alur

```
① DB PostgreSQL (Coolify resource terpisah)
      ↓  cukup buat DB kosong (skema diurus otomatis)
② Resource Docker Compose dari repo GitHub
      ↓  isi env di panel
③ Domain + port 3000
      ↓
④ Seed akun & data demo
      ↓
⑤ Verifikasi: login, angka benar, isolasi antar-sekolah
```

---

## 1. Siapkan PostgreSQL

Coolify: **+ New → Database → PostgreSQL 16**. Catat empat nilai dari tab
*General* / *Environment*:

- Host internal: nama service yang dibuat Coolify (mis. `postgresql-abc123`)
- Port: `5432`
- Database, user, password

Container DB harus berada di jaringan yang sama dengan aplikasi. Cara termudah:
buat DB di **project yang sama** dengan aplikasi, sehingga Coolify menaruh
keduanya di network project yang sama tanpa pengaturan tambahan.

### 1a. Buat peran owner dan peran aplikasi

Buka *Terminal* pada container PostgreSQL (Coolify menyediakan tombol
terminal), lalu:

```sql
-- Peran owner: pemilik skema, hanya dipakai untuk migrasi & DDL.
CREATE ROLE sekol OWNER_LOGIN PASSWORD 'GANTI_PASSWORD_OWNER';
-- Peran aplikasi: dipakai aplikasi. BUKAN owner -> tunduk pada RLS.
CREATE ROLE vibe LOGIN PASSWORD 'GANTI_PASSWORD_APP';

CREATE DATABASE "vibe-schools" OWNER sekol;
```

> **Kenapa dua peran?** RLS tidak berlaku bagi owner tabel. Bila aplikasi
> memakai peran owner, penyaringan tenant tidak akan pernah aktif, dan satu
> sekolah bisa membaca data sekolah lain. Pemisahan ini bukan formalitas.

### 1b. Tidak ada skrip SQL yang perlu dijalankan manual

Cukup **buat database kosong** dengan dua peran di atas. Segala persiapan
skema dikerjakan otomatis oleh `apps/web/prisma/bootstrap.sh` setiap kali
container aplikasi start:

| Urutan | Berkas | Fungsi |
|---|---|---|
| 0 | `prisma migrate deploy` | Buat semua tabel dari migrasi |
| 1 | `schema-layout.sql` | Tata tabel ke `data`/`public`, enum & buang sisa `app` |
| 2 | `enum-move.sql` | Pastikan enum berada di `public` |
| 3 | `rls-views.sql` | View penyaring tenant di `app` |
| 4 | `rls-global-views.sql` | Cermin tabel tanpa `schoolId` |
| 5 | `login-functions.sql` | Fungsi login lintas-tenant |
| 6 | `grants-app-role.sql` | Hak akses role aplikasi |

Semuanya idempoten — aman diulang di setiap restart. Di log container Anda
akan melihat:

```
[bootstrap] database siap.
[bootstrap] menjalankan migrasi…
[bootstrap] ok  schema-layout.sql
[bootstrap] ok  enum-move.sql
[bootstrap] ok  rls-views.sql
[bootstrap] ok  rls-global-views.sql
[bootstrap] ok  login-functions.sql
[bootstrap] ok  grants-app-role.sql
[bootstrap] selesai.
```

> **JANGAN menjalankan berkas SQL itu manual sebelum aplikasi pernah start.**
> Tabelnya belum ada — `migrate deploy` baru berjalan saat container start —
> sehingga `login-functions.sql` gagal dengan
> `relation "data.users" does not exist`. Bootstrap menangani urutan ini
> dengan benar; tangan manusia biasanya tidak.

> Bila migrasi Prisma menambah tabel baru di kemudian hari, **tidak ada yang
> perlu dijalankan manual**: bootstrap mengulang seluruh urutan di atas pada
> setiap restart, sehingga view dan hak akses untuk tabel baru ikut dibuat.

---

## 2. Buat resource aplikasi dari GitHub

Coolify: **+ New → Docker Compose** (bukan *Application* biasa, bukan
*Nixpacks*).

| Isian | Nilai |
|---|---|
| Source | GitHub App / Public Repository → `rahmadho/vibe-school` |
| Branch | `main` |
| Base Directory | `/` |
| Docker Compose Location | `/docker-compose.yml` |
| Build Pack | **Docker Compose** |

Base Directory **wajib `/`**, bukan `apps/web`. Build context compose adalah
root monorepo karena npm workspaces dan lockfile ada di root.

> **Mode dipilih lewat `COMPOSE_FILE`, bukan dengan menambah berkas kedua di
> kolom ini.**
>
> - **Mode A — tanpa DB:** `docker-compose.yml` (yang dijalankan).
> - **Mode B — DB ikut stack:** berkas compose tetap sama, tapi kalau
>   `COMPOSE_FILE=docker-compose.yml:docker-compose.db.yml` ikut terbaca,
>   `docker-compose.db.yml` **juga** dipakai sebagai override.
>
> Di Coolify env dari panel tidak otomatis terbaca sebagai `.env` untuk Compose,
> jadi paling aman: Mode A dengan satu berkas seperti di atas (DB dibuat di
> langkah 1 sebagai resource Database terpisah), **atau** Mode B (langkah 10) —
> **pilih satu**. Hanya satu mode yang dijalankan; jangan gabungkan.

---

## 3. Isi environment di panel

Tab **Environment Variables**. Jangan mengandalkan `.env` di repo — berkas itu
tidak ikut ter-commit.

### Wajib

| Variabel | Nilai |
|---|---|
| `DATABASE_URL` | `postgresql://vibe:PASSWORD_APP@HOST_DB:5432/vibe-schools?schema=app&sslmode=no-verify` |
| `NEXTAUTH_SECRET` | hasil `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `https://domain-anda` — tanpa slash di akhir |
| `AUTH_TRUST_HOST` | `true` |
| `ROOT_DOMAIN` | domain akar, mis. `sekolah.domain-anda` |
| `DOMAIN_TRUSTED_ZONES` | zona yang boleh dipakai domain kustom |
| `PAYMENT_ENCRYPTION_KEY` | hasil `openssl rand -hex 32` |
| `WA_GATEWAY_TOKEN` | hasil `openssl rand -hex 32` |

> Hanya untuk **Mode B** (DB ikut stack, langkah 10): `POSTGRES_PASSWORD` dan
> `APP_DB_PASSWORD` **wajib**; pada Mode B `DATABASE_URL` justru tidak perlu
> karena ditimpa override. Pada Mode A sebaliknya: `DATABASE_URL` wajib,
> `POSTGRES_*`/`APP_DB_*` tidak dipakai. Anda tidak perlu mengisi `COMPOSE_FILE`
> di panel untuk Mode A — itu urusan `.env` VPS (lihat
> [panduan-deploy-docker.md](panduan-deploy-docker.md) bagian 2).

### Penting

| Variabel | Nilai |
|---|---|
| `STORAGE_DRIVER` | `local` |
| `UPLOAD_DIR` | `/data/uploads` |

> **Tidak ada `DB_NETWORK` / `APP_NETWORK`, dan tidak ada blok `networks:`.**
> Compose otomatis membuat satu network default per project dan memasukkan
> semua service ke sana — sudah cukup. Deklarasi `external: true` dulu adalah
> penyebab deploy Coolify mati: panel membuat network per project/UUID, jadi
> network bernama tetap `school-db` tidak pernah ada.
>
> Bila PostgreSQL berada di container/resource lain, sambungkan container DB
> ke network project sekali saja:
>
> ```bash
> docker network ls | grep school-app          # temukan nama nyatanya
> docker network connect <network-itu> <container-db>
> ```

> **Tiga kesalahan yang paling sering terjadi di sini:**
>
> 1. **`?schema=app` bukan `?schema=public`.** Skema `app` adalah lapisan view
>    penyaring. Dengan `public`, query Prisma menyentuh tabel mentah dan
>    penyaringan tenant tidak berjalan.
> 2. **Peran `vibe`, bukan `sekol`.** Memakai owner mematikan RLS sepenuhnya.
> 3. **Host `DATABASE_URL` = host internal Coolify**, bukan `localhost` dan
>    bukan `127.0.0.1`. `localhost` di dalam container berarti container itu
>    sendiri.

---

## 4. Domain dan port

- **Configuration → Domains**: isi domain, arahkan ke service **`web`** port
  **3000**.
- `wa-gateway` **tidak perlu** domain — tidak ada port yang dipublish, ia
  dipanggil web lewat nama service di jaringan internal.
- Aktifkan HTTPS (Traefik Coolify mengurus sertifikat).

### Subdomain sekolah — syarat tambahan

Mode demo memakai `?school=<slug>`, itu sudah jalan tanpa DNS khusus. Untuk
subdomain sungguhan (`smpn1.domain-anda`):

- DNS wildcard `*.domain-anda` → IP VPS.
- `ROOT_DOMAIN` dan `DOMAIN_TRUSTED_ZONES` diisi sesuai domain itu.
- Aplikasi membaca `Host` header, jadi pastikan reverse proxy meneruskannya
  (Traefik Coolify melakukannya secara bawaan).

---

## 5. Deploy pertama

Tekan **Deploy**. Yang perlu diawasi di log:

- `npm ci` selesai tanpa error workspace.
- `npx prisma generate` sukses.
- `next build` selesai.
- Container `web` lulus healthcheck (`/api/health`).

Bila container `web` **crash-loop**, lihat log: hampir selalu `DATABASE_URL`
salah atau `NEXTAUTH_SECRET` kosong.

`prisma migrate deploy` dan seluruh persiapan skema dijalankan otomatis oleh
`bootstrap.sh` saat container start, dan semuanya idempoten. Container tetap
start walau migrasi gagal (disengaja agar tidak crash-loop) — periksa baris
`[bootstrap]` di log untuk tahu langkah mana yang bermasalah.

---

## 6. Isi data awal

Seed dijalankan **sekali**, di dalam container `web`:

```bash
node apps/web/node_modules/.bin/tsx apps/web/prisma/seed.ts
```

Atau lewat terminal Coolify pada container `web`:

```bash
cd apps/web && npx tsx prisma/seed.ts
```

Isi env ini sebelum seed bila ingin akun super admin tertentu:

- `SEED_SUPERADMIN_EMAIL`
- `SEED_SUPERADMIN_PASSWORD` (min. 8 karakter)

> **Catatan jujur:** `prisma/seed.ts` saat ini gagal pada data demo dengan
> `Unique constraint failed on the fields: (npsn)` bila dijalankan dua kali.
> Untuk deploy baru (DB kosong) seed berjalan normal. Untuk DB yang sudah
> berisi, lewati seed dan buat akun lewat panel super admin.

---

## 7. Verifikasi — jangan lewati

Jangan percaya "deploy sukses" dari panel. Uji tiga hal:

**a. Halaman hidup**

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://domain-anda/
curl -s -o /dev/null -w '%{http_code}\n' https://domain-anda/login
```

Harus `200`. **Jangan** menguji lewat `localhost` — itu tidak membuktikan
apa pun tentang akses dari internet.

**b. Login berhasil**

Buka `/login`, masuk dengan akun yang dibuat. Setelah masuk, header harus
menampilkan nama sekolah yang benar.

**c. Angka tidak nol**

Halaman **Ringkasan** harus menampilkan jumlah siswa/guru/kelas sesuai isi
database. Bila semuanya `0` padahal data ada, artinya `DATABASE_URL` masih
`?schema=public` atau peran yang dipakai adalah owner — ulangi langkah 3.

**d. Isolasi tenant**

Masuk sebagai admin sekolah A, pastikan daftar siswa hanya berisi siswa
sekolah A. Ini yang diuji otomatis oleh `test/tenant-isolation.test.ts`.

---

## 8. Setelah deploy

### Volume yang wajib di-backup

| Volume | Isi | Backup |
|---|---|---|
| `school-app_school_uploads` | Logo sekolah, sampul, dokumen SPMB | **Ya** — tidak tercakup `pg_dump` |
| `school-app_school_wa_sessions` | Kredensial sesi WhatsApp | Ya — sangat sensitif |
| DB PostgreSQL | Seluruh data | Ya — `pg_dump` terjadwal |

Cek nama nyata volume: `docker volume ls | grep school`.

### Redeploy

Push ke `main` → Coolify menarik perubahan (aktifkan auto-deploy) atau tekan
**Deploy** manual. Volume tidak hilang.

### Mengubah env

Ubah di panel → **Restart**. Rebuild hanya perlu bila kode berubah.

---

## 9. Masalah yang sudah pernah terjadi

| Gejala | Sebab | Perbaikan |
|---|---|---|
| `pull access denied` | `image:` ditulis eksplisit di compose | Compose ini sengaja tanpa `image:` — jangan ditambahkan |
| `network ... not found` / `declared as external, but could not be found` | Compose menyatakan network `external: true` padahal tidak ada | Sudah diperbaiki: deklarasi external dihapus, network dibuat otomatis. Jangan tambahkan `external: true` kembali |
| `port is already allocated` | Ada `ports:` publish yang ditambahkan | Compose ini hanya memakai `expose:` — jangan tambahkan `ports:` |
| `.env not found` | `env_file` wajib tapi berkas tidak ada | Sudah diperbaiki: `required: false`. Env diisi dari panel |
| Aplikasi 200 tapi semua angka 0 | `?schema=public`, atau peran owner, atau skrip langkah 1b belum jalan | Ulangi langkah 3 dan 1b |
| Login selalu gagal | `login-functions.sql` belum dijalankan, atau GRANT EXECUTE belum | Jalankan skrip nomor 5 + GRANT |
| `operator does not exist: public."UserRole" = "UserRole"` | `enum-move.sql` belum jalan | Jalankan, lalu redeploy |
| Logo 404 | Berkas hilang dari volume | Unggah ulang lewat panel sekolah |

---

## 10. Kalau ingin database ikut di dalam compose (Mode B)

Bagian ini **opsional**. Deploy normal (langkah 1–9 = Mode A) tidak memakai
`docker-compose.db.yml` sama sekali.

Ringkas perbandingan:

| | **Mode A — tanpa DB** (langkah 1–9) | **Mode B — dengan DB** (bagian ini) |
|---|---|---|
| Berkas compose | `docker-compose.yml` | `docker-compose.yml` + `docker-compose.db.yml` |
| Cara memilih | `COMPOSE_FILE=docker-compose.yml` | `COMPOSE_FILE=docker-compose.yml:docker-compose.db.yml` (`;` di Windows) |
| PostgreSQL | resource Database Coolify terpisah | service `postgres` di stack ini |
| `DATABASE_URL` | **WAJIB diisi** | **TIDAK perlu** — disusun `docker-compose.db.yml` |
| `POSTGRES_PASSWORD` | — | **WAJIB** |
| `APP_DB_PASSWORD` | — | **WAJIB** |
| `POSTGRES_USER` / `POSTGRES_DB` / `APP_DB_ROLE` | — | opsional, default `school` / `vibe-schools` / `vibe` |
| Schema `app` + role non-owner | dibuat di langkah 1a | otomatis `deploy/postgres-init/01-app-role.sh` |
| Data di volume stack | tidak | ya |

Hanya **satu** mode yang dijalankan. Jangan mencampur: kolom *Docker Compose
Location* tetap satu nilai; pemilihan mode dilakukan dengan `COMPOSE_FILE`.

Pada Mode B yang jalan:

- `postgres` + `web` + `wa-gateway`. DB tidak perlu dibuat di langkah 1.
- `01-app-role.sh` (mount `./deploy/postgres-init`) jalan **sekali** saat volume
  kosong: buat schema `app` + role aplikasi non-owner + GRANT USAGE.
- `web`/`wa-gateway` menunggu `postgres` sehat, lalu `bootstrap.sh` menjalankan
  migrasi dan seluruh persiapan skema. Tidak ada `psql` manual.
- `DATABASE_URL` ditimpa override menjadi
  `postgresql://$APP_DB_ROLE:$APP_DB_PASSWORD@postgres:5432/$POSTGRES_DB?schema=app&sslmode=disable`.
  Isi `DATABASE_URL` di panel boleh dibiarkan — nilainya tidak dipakai.
- `POSTGRES_USER` superuser/pemilik tabel; aplikasi memakai `APP_DB_ROLE`.
  Menyamakan keduanya = RLS mati tanpa error.

Perhatikan konsekuensinya: data tersimpan di volume milik stack ini. Menghapus
stack menghapus data sekolah. Pasang backup sebelum dipakai sungguhan.

Untuk produksi sungguhan, DB terpisah tetap lebih baik: backup, upgrade, dan
skalabilitasnya bukan urusan stack aplikasi.
