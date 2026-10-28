# Panduan Deploy: Docker (web + wa-gateway)

Dokumen ini menjelaskan cara menjalankan School App memakai Docker Compose.
Cakupan **hanya dua layanan**: aplikasi web (Next.js) dan wa-gateway (Baileys).
PostgreSQL berada di luar stack ini (eksternal/remote); Nginx boleh milik Anda
sendiri atau reverse proxy dari panel.

`docker-compose.yml` dibuat **general**: berkas yang sama dipakai di VPS manual
maupun di panel (Coolify/Dokploy). Tidak ada `container_name`, tidak ada
`ports:` publish, tidak ada `image:` tag tetap, dan `env_file` bersifat
opsional — semuanya karena itu sumber kegagalan deploy yang paling sering.

## 1. Arsitektur jaringan

```
                  network default project
  ┌───────────────┐        │         ┌──────────────┐
  │ Nginx / panel │────────┘         │ wa-gateway   │
  └───────┬───────┘                  │  :3001 (expose)
          │ proxy_pass               └──────┬───────┘
          ▼                                 │
  ┌───────────────┐                         │
  │ web (:3000)   │─────────────────────────┘ (web → wa-gateway)
  └───────┬───────┘
          │
          ▼
                  network project (internal)
          ┌───────────────┐
          │ PostgreSQL    │  ← stack lain, atau DB remote
          └───────────────┘
```

Aturan penting:

- **Tidak ada blok `networks:` sama sekali**, dan itu disengaja. Compose
  otomatis membuat satu network default per project (`school-app_default`) dan
  memasukkan semua service ke sana. Sudah cukup: `web` menjangkau
  `wa-gateway` lewat nama service, dan keduanya menjangkau DB.
- Mendeklarasikan network sendiri hanya mengganti nama default, tanpa menambah
  kemampuan. Yang benar-benar merusak adalah `external: true` dengan nama
  tetap: di Coolify network dibuat per project/UUID, jadi muncul
  `network school-db declared as external, but could not be found` dan deploy
  mati sebelum build.
- Service hanya memakai `expose:`. Tidak ada port yang dipublish ke host.
- Port yang **tidak** dipublish berarti `docker ps` tidak menampilkan
  `0.0.0.0:3000->3000`. Itu normal.

VPS manual tidak perlu menyiapkan network apa pun — cukup `docker compose up`.

Bila PostgreSQL berada di container lain di server yang sama, sambungkan
container DB ke network project **sekali**:

```bash
docker network ls | grep school-app       # temukan nama network nyatanya
docker network connect <network-itu> <nama-container-db>
```

Bila DB berada di host lain (remote), jaringan Docker tidak relevan sama
sekali — cukup `DATABASE_URL` menunjuk IP privat/publik DB.

## 2. Pilih mode deploy & isi `.env` (VPS manual)

Ada **dua mode**, dan **hanya satu yang dijalankan**. Mode dipilih lewat
`COMPOSE_FILE` di `.env`; service yang ikut stack ditentukan oleh berkas yang
disebut di situ.

| | **Mode A — tanpa DB** | **Mode B — dengan DB** |
|---|---|---|
| `COMPOSE_FILE` | `docker-compose.yml` | `docker-compose.yml:docker-compose.db.yml` |
| PostgreSQL | eksternal / terkelola / container lain | service `postgres` di stack yang sama |
| Service yang jalan | `web`, `wa-gateway` | `web`, `wa-gateway`, `postgres` |
| `DATABASE_URL` | **WAJIB diisi** (host DB Anda, `?schema=app`) | **TIDAK perlu** — disusun `docker-compose.db.yml` |
| `POSTGRES_PASSWORD` | tidak dipakai | **WAJIB** (compose menolak start) |
| `APP_DB_PASSWORD` | tidak dipakai | **WAJIB** (compose menolak start) |
| `POSTGRES_USER` / `POSTGRES_DB` / `APP_DB_ROLE` | tidak dipakai | opsional, ada default |
| Schema `app` + role non-owner | dibuat manual di DB eksternal | dibuat otomatis `deploy/postgres-init/01-app-role.sh` |
| Volume `school-app_postgres_data` | tidak ada | ada — wajib ikut backup |

Pemisah antar-berkas:

- Linux / macOS → **titik dua** `:`
- Windows (PowerShell / cmd) → **titik koma** `;`
  `COMPOSE_FILE=docker-compose.yml;docker-compose.db.yml`

Karena `COMPOSE_FILE` sudah menunjuk berkasnya, perintah jalan selalu polos:
`docker compose up -d --build`. Tidak ada flag `-f` dan tidak ada `--profile`.
Jangan jalankan kedua mode sekaligus — satu `.env`, satu mode.

### Langkah menyiapkan `.env`

```bash
cp .env.docker.example .env
```

Berkas contoh itu sudah memuat **satu** baris `COMPOSE_FILE` aktif (Mode A) dan
**satu** baris Mode B yang dikomentari. Pilih dengan meng-uncomment tepat satu.

Bila Anda tidak ingin menyunting contoh itu, salin templat per mode:

```bash
cat deploy/compose/without-db.env >> .env   # Mode A
cat deploy/compose/with-db.env   >> .env    # Mode B
```

Di panel (Coolify dkk) langkah ini **tidak dipakai** — env diisi lewat panel,
lihat bagian 5.

Tabel env lengkap:

**Wajib di kedua mode:** `NEXTAUTH_SECRET` (min. 32 karakter,
`openssl rand -base64 32`), `NEXTAUTH_URL`, `ROOT_DOMAIN`, `PAYMENT_ENCRYPTION_KEY`
(`openssl rand -hex 32`), `WA_GATEWAY_TOKEN` (`openssl rand -hex 32`).

| Variabel | Mode A | Mode B | Keterangan |
|---|---|---|---|
| `COMPOSE_FILE` | `docker-compose.yml` | `docker-compose.yml:docker-compose.db.yml` | Pemilih mode. Satu baris saja. |
| `DATABASE_URL` | **WAJIB** | diabaikan (ditimpa) | Format: `postgresql://ROLE_APP:pass@HOST:5432/DB?schema=app&sslmode=no-verify`. **`schema=app`, bukan `public`** — `app` lapisan view penyaring tenant. Peran harus peran aplikasi, bukan owner. Jangan pasang default dari compose; itu hanya agar `compose config` valid tanpa `.env`. |
| `POSTGRES_PASSWORD` | — | **WAJIB** | Password **superuser** + pemilik tabel. Hanya dipakai bootstrap. Compose menolak start bila kosong. |
| `APP_DB_PASSWORD` | — | **WAJIB** | Password role aplikasi **non-owner** (dipakai isi `DATABASE_URL`). Compose menolak start bila kosong. |
| `POSTGRES_USER` | — | opsional, default `school` | Superuser/owner. **Jangan dipakai aplikasi** — owner membypass RLS. |
| `POSTGRES_DB` | — | opsional, default `vibe-schools` | Nama DB. Hanya berlaku saat volume dibuat pertama kali. |
| `APP_DB_ROLE` | — | opsional, default `vibe` | Role aplikasi non-owner. |
| `OWNER_URL` | tidak dibaca compose | tidak dibaca compose | Sisa alur lama. Bootstrap memakai `DATABASE_URL` + `POSTGRES_*`. |
| `NEXTAUTH_SECRET` | WAJIB | WAJIB | — |
| `NEXTAUTH_URL` | WAJIB | WAJIB | URL publik, tanpa trailing slash. |
| `ROOT_DOMAIN` | WAJIB | WAJIB | Domain akar subdomain sekolah. |
| `PAYMENT_ENCRYPTION_KEY` | PENTING | PENTING | 64 hex char (AES-256-GCM). |
| `WA_GATEWAY_TOKEN` | WAJIB | WAJIB | Shared secret web ↔ wa-gateway. Satu var untuk keduanya. |
| `WA_GATEWAY_URL` | OPSIONAL | OPSIONAL | Default `http://wa-gateway:3001`. |
| `WA_SESSION_DIR` | OPSIONAL | OPSIONAL | Default `/data/sessions`. |
| `STORAGE_DRIVER` | OPSIONAL | OPSIONAL | `local` → volume `school_uploads`. `minio` belum ada. |
| `UPLOAD_DIR` | OPSIONAL | OPSIONAL | Default `/data/uploads`. |
| `NODE_ENV` | OPSIONAL | OPSIONAL | Default `production`. |
| `LOG_LEVEL` | OPSIONAL | OPSIONAL | wa-gateway saja. |
| `SEED_SUPERADMIN_EMAIL` / `SEED_SUPERADMIN_PASSWORD` | OPSIONAL | OPSIONAL | Hanya saat `seed`. |
| `SEED_DEMO_ACTIVITY` | OPSIONAL | OPSIONAL | `0` = lewati aktivitas demo. |
| `CLOUD` | OPSIONAL | OPSIONAL | Penanda manual, tidak dibaca compose. |

Penjelasan panjang per variabel: [panduan-env-produksi.md](panduan-env-produksi.md).

## 3. Build & jalankan

```bash
docker compose up -d --build
docker compose ps            # web & wa-gateway harus "healthy"
docker compose logs -f web   # pantau log
```

Healthcheck:

- `web` → `GET /api/health` (200 OK; sengaja tidak memeriksa DB, agar
  container tidak ikut restart-loop saat DB sedang down).
- `wa-gateway` → `GET /health` (200 OK).

Debug dari host tanpa publish port (mis. ingin `curl` langsung ke web):

```bash
docker compose port web 3000     # kosong = memang tidak dipublish
docker compose exec web node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>console.log(r.status))"
# atau sementara:
docker compose run --rm --service-ports web   # hanya bila butuh port di host
```

## 4. Migrasi, grants, & seed

Migrasi dijalankan **otomatis** saat container `web` start
(`prisma migrate deploy` di entrypoint). Bila gagal (mis. DB belum siap),
container tetap start dan migrasi bisa diulang manual:

```bash
docker compose exec web node node_modules/prisma/build/index.js \
  migrate deploy --schema apps/web/prisma/schema.prisma
```

Bagian "Migrasi, grants, & seed" — tidak ada langkah manual. Container `web`
menjalankan `apps/web/prisma/bootstrap.sh` di setiap start: migrasi, tata letak
tiga schema, view penyaring tenant, fungsi login, lalu hak akses role aplikasi.
Tidak ada `psql` manual, tidak perlu image `postgres:16-alpine` sementara.

Pada **Mode B**, `deploy/postgres-init/01-app-role.sh` jalan lebih dulu — hanya
**sekali**, saat volume `postgres_data` masih kosong — untuk membuat schema
`app` dan role aplikasi non-owner. Sesudah itu `bootstrap.sh` melanjutkan
(migrasi, tabel, view, GRANT). Urutan ini yang membuat `?schema=app` valid di
koneksi pertama.

Cara memastikan berhasil — log-nya menyebut tiap langkah:

```bash
docker compose logs web | grep '\[bootstrap\]'
docker compose logs postgres | grep '\[initdb\]'   # Mode B saja
```

Seed data demo (sekali saja):

```bash
docker compose exec web sh -c "cd apps/web && npx tsx prisma/seed.ts"
```

## 5. Deploy di Coolify

Ringkas: Coolify memperlakukan repo sebagai satu resource Docker Compose dan
menyuntik env dari panel. Karena compose ini sudah general, tidak ada berkas
tambahan yang perlu dibuat.

> **Panduan lengkap langkah demi langkah:**
> [panduan-deploy-coolify.md](panduan-deploy-coolify.md). Bagian di bawah ini
> hanya ringkasan.

1. **Resource baru** → tipe **Docker Compose** (bukan "Nixpacks"/"Application
   only"). Pilih repo + branch `main`, base directory `/`, compose file
   `docker-compose.yml`.
2. **Environment variables** diisi di tab *Environment Variables* panel —
   **jangan** mengandalkan `.env` di repo. `.env` biasanya tidak ter-commit,
   dan container panel tidak membacanya dari working dir repo. Salin variabel
   dari tabel bagian 2 (`DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`,
   `ROOT_DOMAIN`, `PAYMENT_ENCRYPTION_KEY`, `WA_GATEWAY_TOKEN`, dst) — hanya
   yang berlaku untuk mode Anda.

   `DATABASE_URL` **wajib** berakhir `?schema=app`, bukan `public`. Skema `app`
   adalah lapisan view penyaring tenant; dengan `public` angka dan daftar akan
   kosong. Peran DB-nya juga harus peran aplikasi (bukan owner).
3. **Jaringan**:
   - Tidak ada yang perlu diatur. Compose membuat network internal sendiri dan
     kedua service berbagi network itu.
   - Berkas compose **tidak punya blok `networks:`** sama sekali. Compose
     membuat network default per project dan memasukkan semua service ke sana.
     Deklarasi `external: true` lama adalah penyebab deploy gagal: Coolify
     membuat network per project/UUID, bukan nama tetap `school-db`, sehingga
     muncul `network school-db declared as external, but could not be found`.
   - Bila DB berada di container lain, sambungkan container itu ke network
     project sekali: `docker network connect <network-project> <container-db>`.
     Bila DB di host lain (remote), jaringan Docker tidak relevan sama sekali —
     cukup `DATABASE_URL` menunjuk host publik/IP privat DB.
4. **Domain**: set domain aplikasi dan arahkan ke **port 3000** (container
   `web`). Coolify/Traefik yang menjadi reverse proxy; wa-gateway tidak perlu
   domain (tidak ada port yang dipublish).
5. **Deploy**. Perhatikan log build: build context root monorepo (butuh
   Dockerfile `apps/web/Dockerfile`), bukan subfolder.
6. Selesai deploy pertama, biarkan `bootstrap.sh` bekerja — ia menjalankan
   migrasi sampai GRANT role aplikasi secara otomatis (`docker compose logs web
   | grep '\[bootstrap\]'`). Tanpa itu aplikasi tampil normal tetapi seluruh
   daftar kosong dan login gagal. Jangan menjalankan berkas SQL manual sebelum
   container pernah start: tabelnya belum ada.

Yang **tidak** perlu dilakukan di Coolify (dan sebaiknya tidak ditambahkan
oleh siapa pun ke compose): `container_name`, `ports:`, label khusus Coolify,
atau `image:`. Coolify mendeteksi compose biasa; tambahan itu justru yang
membuat deploy gagal.

## 6. Mode B: DB ikut stack (opsional)

Untuk dev atau self-host skala kecil. Produksi sungguhan tetap disarankan
memakai DB terkelola/terpisah (backup, upgrade, dan skalabilitas bukan urusan
compose ini).

Aktifkan lewat `.env` — **bukan** flag:

```bash
# Linux / macOS
COMPOSE_FILE=docker-compose.yml:docker-compose.db.yml
# Windows
COMPOSE_FILE=docker-compose.yml;docker-compose.db.yml

# DATABASE_URL tidak perlu diisi. Yang wajib hanya:
POSTGRES_PASSWORD=...
APP_DB_PASSWORD=...
```

Lalu perintah biasa saja:

```bash
docker compose up -d --build
```

Yang terjadi:

- Hanya stack ini yang jalan — `web`, `wa-gateway`, `postgres`. Mode A tidak
  ikut; memang tidak boleh dua mode bersamaan.
- `deploy/postgres-init/01-app-role.sh` membuat schema `app` + role aplikasi
  non-owner saat volume masih kosong.
- `docker-compose.db.yml` menyusun sendiri
  `DATABASE_URL=postgresql://$APP_DB_ROLE:$APP_DB_PASSWORD@postgres:5432/$POSTGRES_DB?schema=app&sslmode=disable`
  untuk `web` dan `wa-gateway`. Isi `DATABASE_URL` di `.env` ditimpa — biarkan
  apa adanya.
- `web` dan `wa-gateway` menunggu `postgres` sehat (`depends_on:
  condition: service_healthy`) sebelum start, lalu `bootstrap.sh` jalan.
- `POSTGRES_USER` adalah superuser + pemilik tabel. Aplikasi **tidak** memakainya;
  aplikasi memakai `APP_DB_ROLE`. Kalau keduanya disamakan, RLS mati diam-diam.
- Port **tidak** dipublish ke host (hanya `expose: 5432`). Bila DB ini perlu
  dipakai stack lain, buka publish dan bind ke IP privat VPS
  (`"10.0.0.5:5432:5432"`), **jangan** `"5432:5432"`/`0.0.0.0`.
- Data di volume `postgres_data`. `docker compose down -v` menghapusnya.
- `POSTGRES_DB` hanya berlaku saat volume dibuat pertama kali. Untuk mengganti
  nama DB: hapus volume (data hilang) atau ganti dengan DB baru.

Tidak ada `psql` manual di mode ini — tidak ada `grants.sql`/`rls.sql` yang
dijalankan tangan. Semuanya lewat `01-app-role.sh` + `bootstrap.sh`.

Kembali ke Mode A: ubah satu baris `COMPOSE_FILE=docker-compose.yml`, isi
`DATABASE_URL`, lalu `docker compose up -d --build`. Container `postgres`
berhenti ikut stack; volume `postgres_data` tetap ada di disk (tidak dihapus)
sampai Anda sendiri yang menghapusnya.

## 7. Volume & backup

| Volume | Isi | Backup? |
|---|---|---|
| `school-app_school_uploads` | Berkas unggahan (logo sekolah, sampul, dokumen SPMB) | **Ya** — tidak tercakup `pg_dump` |
| `school-app_school_wa_sessions` | Kredensial sesi WhatsApp (Baileys) | Ya — sangat sensitif |
| `school-app_postgres_data` | Data Postgres (hanya Mode B) | Ya — via `pg_dump` |

Prefix `school-app_` berasal dari `name: school-app` di compose. Cek nama nyata:

```bash
docker volume ls | grep school
```

Backup berkas:

```bash
docker run --rm -v school-app_school_uploads:/data -v "$PWD":/backup alpine \
  tar czf /backup/uploads-$(date +%F).tgz -C /data .
```

## 8. Update / redeploy

```bash
git pull
docker compose up -d --build
```

Container lama diganti; volume (`uploads`, `sessions`) tidak hilang, karena
tidak ada `container_name` yang mengunci nama lama. Driver penyimpanan `local`
tidak aman untuk lebih dari satu replika, jadi biarkan satu service `web`.

## 9. Subdomain (multi-sekolah)

Produksi **wajib** memakai subdomain (`sekolah1.sekolah.id`). Pastikan:

- DNS wildcard `*.sekolah.id` → IP VPS.
- Nginx (milik Anda, di network project yang sama dengan `web`) memakai
  `server_name .sekolah.id;` dan `proxy_set_header Host $host;`.
- Sertifikat wildcard Let's Encrypt.

Detail: [panduan-deploy-subdomain.md](panduan-deploy-subdomain.md).
Konfigurasi Nginx siap pakai ada di [../deploy/nginx/](../deploy/nginx/).

## 10. Troubleshooting

### Error khas Coolify / panel

| Gejala persis | Sebab | Solusi |
|---|---|---|
| `network ... declared as external, but could not be found` | Compose menyatakan network `external: true` padahal tidak ada | Sudah diperbaiki: deklarasi external dihapus. Jangan ditambahkan kembali. Bila DB di container lain: `docker network connect <network-project> <container-db>` |
| `Error response from daemon: Conflict. The container name "/school-web" is already in use by container "..."` | Versi lama compose memakai `container_name: school-web`; nama itu global per daemon sehingga bentrok dengan stack lain. | `docker-compose.yml` sekarang **tidak** memakai `container_name` (nama menjadi `<project>-web-1`). Bila masih muncul, itu container sisa versi lama: `docker rm -f school-web school-wa-gateway`. |
| `Bind for 127.0.0.1:3000 failed: port is already allocated` / `port is already allocated` | Ada publish `ports:` yang berebut port host dengan stack/proxy lain. | `docker-compose.yml` sekarang hanya `expose:` — hapus blok override yang menambahkan `ports:`, atau matikan stack lain yang memegang 3000 (`docker ps --format '{{.Names}}\t{{.Ports}}'`). |
| `pull access denied for school-app-web, repository does not exist or may require 'docker login'` | `image:` tag lokal dipakai tanpa registry, Compose mencoba pull. | Sudah dihapus (cukup `build:`). Pastikan build dijalankan dari repo (`docker compose up -d --build`), bukan `docker compose pull`. |
| Env tidak masuk / `NEXTAUTH_SECRET` kosong padahal sudah diisi | Nilai diisi di `.env` repo, padahal panel menyuntik env sendiri dan `.env` tidak ada di server. | Isi di tab Environment Variables panel. `env_file` di compose `required: false` — bila `.env` tidak ada, compose tidak gagal, tapi env harus datang dari panel. |
| `Error: .env not found` | Compose < 2.24 tidak mendukung `env_file: {path, required}`. | Upgrade Docker Compose (`>= 2.24`) atau sediakan `.env` kosong. |

### Error umum lainnya

| Gejala | Sebab & solusi |
|---|---|
| `web` unhealthy | Cek `docker compose logs web`. Healthcheck sengaja tidak cek DB; unhealthy berarti proses web benar-benar mati (cek log untuk error env skema, mis. variabel wajib kosong dari `apps/web/src/lib/env.ts`). |
| Prisma "Query engine not found" | Engine salah platform. Schema mendeklarasikan `binaryTargets` (`native` + `debian-openssl-3.0.x`). Rebuild image di Linux. |
| `permission denied for table ...` / daftar data kosong | Mode A: schema `app`/view/GRANT untuk role di `DATABASE_URL` belum ada di DB eksternal. Mode B: `bootstrap.sh` belum selesai — cek log. Lihat bagian 4. |
| WA tidak mengirim | Cek `docker compose logs -f wa-gateway`; pastikan `WA_GATEWAY_TOKEN` terisi (sama untuk kedua service — dibaca dari satu var). |
| Sesi WA hilang tiap restart | Volume `school_wa_sessions` tidak ter-mount. |
| Berkas unggahan 404 | `UPLOAD_DIR`/volume `school_uploads` tidak ter-mount di `/data/uploads`. |
| `database "...." does not exist` (Mode B) | `POSTGRES_DB` tidak sama dengan nama DB yang tertanam di volume lama. `POSTGRES_DB` hanya berlaku saat volume dibuat pertama kali — pakai nama lama, atau DB baru/volume baru. |
| `POSTGRES_PASSWORD wajib diisi` / `APP_DB_PASSWORD wajib diisi` saat `docker compose up` | Mode B aktif tapi env-nya kosong | Isi keduanya di `.env` (atau panel). Compose sengaja menolak start. |
| `service "postgres" is not running` / `docker compose exec postgres` gagal | `.env` masih Mode A (`COMPOSE_FILE=docker-compose.yml`) | Mode B butuh `COMPOSE_FILE=docker-compose.yml:docker-compose.db.yml` (`;` di Windows). |
| Schema `app` tidak ada / `schema "app" does not exist` (Mode B) | `01-app-role.sh` tidak jalan karena volume `postgres_data` sudah terisi dari percobaan lama | Isi volume lama tidak diinit ulang. Mulai dari volume kosong (data lama hilang) atau buat schema+role manual dengan hak akses setara. |
