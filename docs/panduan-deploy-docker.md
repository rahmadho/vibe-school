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
                  app-network (eksternal)
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

- **Satu network internal**, dibuat dan dinamai otomatis oleh Compose
  (`school-app_app-network`). Kedua service berbagi network itu, jadi `web`
  bisa menjangkau `wa-gateway` lewat nama service.
- **Tidak ada `external: true`.** Deklarasi itu sengaja dihapus: di panel
  seperti Coolify nama network dibuat per project/UUID, bukan nama tetap, dan
  `external: true` membuat deploy mati dengan
  `network school-db declared as external, but could not be found`.
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

## 2. Menyiapkan `.env` (VPS manual)

```bash
cp .env.docker.example .env
```

Di panel (Coolify dkk) langkah ini **tidak dipakai** — env diisi lewat panel,
lihat bagian 5.

Tabel env lengkap:

| Variabel | Status | Default di compose | Keterangan |
|---|---|---|---|
| `DATABASE_URL` | WAJIB | `postgresql://vibe:***@HOST_DB:5432/vibe-schools?schema=app&sslmode=require` | **`schema=app`, bukan `public`** — `app` lapisan view penyaring tenant. Peran harus peran aplikasi, bukan owner. Host = host DB (bukan `localhost`). Default hanya agar `compose config` valid tanpa `.env` — jangan dipakai produksi. |
| `OWNER_URL` | WAJIB sekali | — | Koneksi owner/superuser untuk `grants.sql` + `rls.sql`. Tidak dibaca aplikasi. |
| `NEXTAUTH_SECRET` | WAJIB | kosong | Min. 32 karakter. `openssl rand -base64 32`. |
| `NEXTAUTH_URL` | WAJIB | `http://localhost:3000` | URL publik, tanpa trailing slash. |
| `ROOT_DOMAIN` | WAJIB | `localhost` | Domain akar subdomain sekolah. |
| `PAYMENT_ENCRYPTION_KEY` | PENTING | kosong | 64 hex char (AES-256-GCM). `openssl rand -hex 32`. |
| `WA_GATEWAY_TOKEN` | WAJIB | kosong | Shared secret web ↔ wa-gateway. Harus sama di kedua service (keduanya membaca var yang sama). `openssl rand -hex 32`. |
| `WA_GATEWAY_URL` | OPSIONAL | `http://wa-gateway:3001` | Alamat gateway dari sudut pandang web. |
| `WA_SESSION_DIR` | OPSIONAL | `/data/sessions` | Direktori sesi Baileys (volume `school_wa_sessions`). |
| `STORAGE_DRIVER` | OPSIONAL | `local` | `local` menulis ke volume `school_uploads`. `minio` belum diimplementasikan. |
| `UPLOAD_DIR` | OPSIONAL | `/data/uploads` | Harus cocok dengan mount volume. |
| `NODE_ENV` | OPSIONAL | `production` | |
| `LOG_LEVEL` | OPSIONAL | `info` | wa-gateway saja. |
| `POSTGRES_USER` | OPSIONAL | `school` | Hanya untuk `docker-compose.db.yml` (profil `db`). |
| `POSTGRES_PASSWORD` | WAJIB bila profil `db` | — (compose menolak start) | Hanya untuk profil `db`. |
| `POSTGRES_DB` | OPSIONAL | `school` | Hanya untuk profil `db`. |
| `SEED_SUPERADMIN_EMAIL` / `SEED_SUPERADMIN_PASSWORD` | OPSIONAL | — | Hanya saat `db:seed`. |
| `SEED_DEMO_ACTIVITY` | OPSIONAL | `1` | `0` = lewati aktivitas demo. |
| `CLOUD` | OPSIONAL | — | Penanda manual, tidak dibaca compose. |

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

**Sekali per database baru** — grants + RLS. Tanpa langkah ini aplikasi
berjalan tapi semua query gagal `permission denied` / tabel terlihat kosong
karena RLS menolak role aplikasi. Jalankan dengan `OWNER_URL`, bukan
`DATABASE_URL`:

```bash
cd apps/web

# role di -v harus sama dengan user di DATABASE_URL
psql "$OWNER_URL" -v app_role=school -f prisma/grants.sql
psql "$OWNER_URL" -f prisma/rls.sql
```

Bila `psql` tidak ada di host, jalankan dari container (compose utama tidak
memuat klien postgres — pakai image sementara di jaringan DB):

```bash
docker run --rm -it --network "<network-project>" \
  -v "$PWD/apps/web/prisma:/sql:ro" \
  -e OWNER_URL="$OWNER_URL" postgres:16-alpine \
  sh -c 'psql "$OWNER_URL" -v app_role=school -f /sql/grants.sql && \
         psql "$OWNER_URL" -f /sql/rls.sql'
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
   `ROOT_DOMAIN`, `PAYMENT_ENCRYPTION_KEY`, `WA_GATEWAY_TOKEN`, dst).

   `DATABASE_URL` **wajib** berakhir `?schema=app`, bukan `public`. Skema `app`
   adalah lapisan view penyaring tenant; dengan `public` angka dan daftar akan
   kosong. Peran DB-nya juga harus peran aplikasi (bukan owner).
3. **Jaringan**:
   - Tidak ada yang perlu diatur. Compose membuat network internal sendiri dan
     kedua service berbagi network itu.
   - Deklarasi `external: true` **sudah dihapus** dari compose. Itu penyebab
     langsung deploy gagal: Coolify membuat network per project/UUID, bukan
     nama tetap `school-db`, sehingga muncul
     `network school-db declared as external, but could not be found`.
   - Bila DB berada di container lain, sambungkan container itu ke network
     project sekali: `docker network connect <network-project> <container-db>`.
     Bila DB di host lain (remote), jaringan Docker tidak relevan sama sekali —
     cukup `DATABASE_URL` menunjuk host publik/IP privat DB.
4. **Domain**: set domain aplikasi dan arahkan ke **port 3000** (container
   `web`). Coolify/Traefik yang menjadi reverse proxy; wa-gateway tidak perlu
   domain (tidak ada port yang dipublish).
5. **Deploy**. Perhatikan log build: build context root monorepo (butuh
   Dockerfile `apps/web/Dockerfile`), bukan subfolder.
6. Selesai deploy pertama, jalankan **skrip SQL sekali** (bagian 1b di
   [panduan-deploy-coolify.md](panduan-deploy-coolify.md)) — urutannya wajib:
   `rls.sql` → `enum-move.sql` → `rls-views.sql` → `rls-global-views.sql` →
   `login-functions.sql`. Tanpa ini aplikasi tampil normal tetapi seluruh
   daftar kosong dan login gagal.

Yang **tidak** perlu dilakukan di Coolify (dan sebaiknya tidak ditambahkan
oleh siapa pun ke compose): `container_name`, `ports:`, label khusus Coolify,
atau `image:`. Coolify mendeteksi compose biasa; tambahan itu justru yang
membuat deploy gagal.

## 6. Deploy DB bersama aplikasi (opsional)

Untuk dev atau self-host skala kecil. Produksi sungguhan tetap disarankan
memakai DB terkelola/terpisah (backup, upgrade, dan skalabilitas bukan urusan
compose ini).

```bash
# .env: isi POSTGRES_PASSWORD dan arahkan DATABASE_URL ke host `postgres`
docker compose -f docker-compose.yml -f docker-compose.db.yml \
  --profile db up -d --build
```

Detail:

- Service bernama `postgres` → `DATABASE_URL` harus
  `postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@postgres:5432/$POSTGRES_DB?schema=public`.
  **Bukan** `localhost` dan **bukan** `school-db`.
- Tanpa `--profile db`, service `postgres` diabaikan; pemakaian normal tidak
  berubah.
- Port **tidak** dipublish ke host (hanya `expose: 5432`). Bila DB ini perlu
  dipakai stack lain di luar compose, buka publish dan bind ke IP privat VPS
  (`"10.0.0.5:5432:5432"`), **jangan** `"5432:5432"`/`0.0.0.0`.
- Data di volume `postgres_data`. `docker compose down -v` menghapusnya.

Setelah DB hidup, jalankan grants + RLS sekali:

```bash
docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -v app_role=school -f - < apps/web/prisma/grants.sql
docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -f - < apps/web/prisma/rls.sql
```

(`-f -` membaca dari stdin; `psql` di dalam container tidak punya akses ke
folder repo.)

## 7. Volume & backup

| Volume | Isi | Backup? |
|---|---|---|
| `school-app_school_uploads` | Berkas unggahan (logo sekolah, sampul, dokumen SPMB) | **Ya** — tidak tercakup `pg_dump` |
| `school-app_school_wa_sessions` | Kredensial sesi WhatsApp (Baileys) | Ya — sangat sensitif |
| `school-app_postgres_data` | Data Postgres (hanya bila memakai profil `db`) | Ya — via `pg_dump` |

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
- Nginx (milik Anda, di `app-network`) memakai
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
| `permission denied for table ...` / daftar data kosong | `grants.sql` / `rls.sql` belum dijalankan untuk role di `DATABASE_URL`. Lihat bagian 4. |
| WA tidak mengirim | Cek `docker compose logs -f wa-gateway`; pastikan `WA_GATEWAY_TOKEN` terisi (sama untuk kedua service — dibaca dari satu var). |
| Sesi WA hilang tiap restart | Volume `school_wa_sessions` tidak ter-mount. |
| Berkas unggahan 404 | `UPLOAD_DIR`/volume `school_uploads` tidak ter-mount di `/data/uploads`. |
| `database "school" does not exist` (profil `db`) | `POSTGRES_DB` tidak sama dengan nama DB di `DATABASE_URL`. Ubah salah satunya; `POSTGRES_DB` hanya berlaku saat volume dibuat pertama kali. |
