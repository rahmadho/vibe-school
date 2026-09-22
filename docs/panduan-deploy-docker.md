# Panduan Deploy: Docker (web + wa-gateway)

Dokumen ini menjelaskan cara menjalankan School App di produksi memakai
Docker Compose. Cakupan **hanya dua layanan**: aplikasi web (Next.js) dan
wa-gateway (Baileys). PostgreSQL dan Nginx berada di stack terpisah.

## 1. Arsitektur jaringan

```
                  app-network (eksternal)
  ┌───────────────┐        │         ┌──────────────┐
  │ Nginx (luar)  │────────┘         │ wa-gateway   │
  └───────┬───────┘                  │  :3001       │
          │ proxy_pass               └──────┬───────┘
          ▼                                 │
  ┌───────────────┐                         │
  │ web (:3000)   │─────────────────────────┘ (web → wa-gateway)
  └───────┬───────┘
          │
          ▼
                  db-network (eksternal)
          ┌───────────────┐
          │ PostgreSQL    │  ← sudah berjalan di stack lain
          └───────────────┘
```

- **db-network** dan **app-network** harus sudah ada lebih dulu (dibuat oleh
  stack DB / reverse proxy). Bila belum:
  `docker network create db-network` dan `docker network create app-network`.
- Container `web` dan `wa-gateway` ikut dua network itu. DB & Nginx **tidak**
  didefinisikan di `docker-compose.yml`.

## 2. Menyiapkan `.env`

```bash
cp .env.docker.example .env
```

Wajib diisi:

| Variabel | Keterangan |
|---|---|
| `DATABASE_URL` | Host = **nama container/ service DB** di `db-network` (bukan `localhost`). |
| `NEXTAUTH_SECRET` | Min. 32 karakter. `openssl rand -base64 32`. |
| `NEXTAUTH_URL` | URL publik aplikasi, mis. `https://sekolah.id`. |
| `ROOT_DOMAIN` | Domain akar subdomain sekolah, mis. `sekolah.id`. |
| `WA_GATEWAY_TOKEN` | Shared secret web ↔ wa-gateway. `openssl rand -hex 32`. |
| `PAYMENT_ENCRYPTION_KEY` | 64 hex char (AES-256-GCM). `openssl rand -hex 32`. |

Penjelasan lengkap tiap variabel (termasuk yang opsional) ada di
[panduan-env-produksi.md](panduan-env-produksi.md).

Nilai `WA_GATEWAY_URL` dan `WA_SESSION_DIR` di `.env` di-override otomatis oleh
compose (`http://wa-gateway:3001` dan `/data/sessions`) — tak perlu diubah.

## 3. Build & jalankan

```bash
docker compose up -d --build
docker compose ps            # web & wa-gateway harus "healthy"
docker compose logs -f web   # pantau log
```

Healthcheck:

- `web` → `GET /api/health` (200 OK; tidak memeriksa DB).
- `wa-gateway` → `GET /health` (200 OK).

## 4. Migrasi & seed

Migrasi dijalankan **otomatis** saat container `web` start
(`prisma migrate deploy` di entrypoint). Bila gagal (mis. DB belum siap),
container tetap start dan migrasi bisa diulang manual:

```bash
docker compose exec web node node_modules/prisma/build/index.js \
  migrate deploy --schema apps/web/prisma/schema.prisma
```

Seed data demo (sekali saja):

```bash
docker compose exec web sh -c "cd apps/web && npx tsx prisma/seed.ts"
```

## 5. Volume & backup

| Volume | Isi | Backup? |
|---|---|---|
| `school_uploads` | Berkas unggahan (logo sekolah, sampul, dokumen SPMB) | **Ya** — tidak tercakup `pg_dump` |
| `school_wa_sessions` | Kredensial sesi WhatsApp (Baileys) | Ya — sangat sensitif |

Backup DB dilakukan di stack DB (di luar compose ini). Backup berkas:

```bash
docker run --rm -v school_uploads:/data -v "$PWD":/backup alpine \
  tar czf /backup/uploads-$(date +%F).tgz -C /data .
```

## 6. Update / redeploy

```bash
git pull
docker compose up -d --build
```

Container lama diganti; volume (`uploads`, `sessions`) tidak hilang.
Karena driver penyimpanan `local` tidak aman untuk lebih dari satu replika,
compose dikunci pada **satu** service `web`.

## 7. Subdomain (multi-sekolah)

Produksi **wajib** memakai subdomain (`sekolah1.sekolah.id`). Pastikan:

- DNS wildcard `*.sekolah.id` → IP VPS.
- Nginx (milik Anda, di `app-network`) memakai
  `server_name .sekolah.id;` dan `proxy_set_header Host $host;`.
- Sertifikat wildcard Let's Encrypt.

Detail: [panduan-deploy-subdomain.md](panduan-deploy-subdomain.md).

Konfigurasi Nginx siap pakai ada di [../deploy/nginx/](../deploy/nginx/)
(`nginx.conf` + `conf.d/school-app.conf`) — tinggal mengganti `sekolah.id`
dengan domain Anda lalu memindahkannya ke container Nginx.

## 8. Troubleshooting

| Gejala | Sebab & solusi |
|---|---|
| `web` unhealthy | Cek `docker compose logs web`. Pastikan `DATABASE_URL` bisa dijangkau dari `db-network`. |
| Prisma "Query engine not found" | Engine salah platform. Schema sudah mendeklarasikan `binaryTargets` (`native` + `debian-openssl-3.0.x`). Rebuild image di Linux. |
| WA tidak mengirim | Cek `docker compose logs -f wa-gateway`; pastikan `WA_GATEWAY_TOKEN` sama di kedua layanan. |
| Sesi WA hilang tiap restart | Volume `school_wa_sessions` tidak ter-mount. |
| Berkas unggahan 404 | `UPLOAD_DIR`/volume `school_uploads` tidak ter-mount di `/data/uploads`. |
