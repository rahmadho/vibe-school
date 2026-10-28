# Panduan Environment Produksi

Dokumen ini menjelaskan setiap variabel `.env` yang dipakai saat deploy, mana
yang wajib, dan cara membuat nilainya. Untuk deploy Docker, lihat
[panduan-deploy-docker.md](panduan-deploy-docker.md).

## 1. Di mana `.env` diletakkan?

| Konteks | Berkas | Dibaca oleh |
|---|---|---|
| **Deploy (Docker)** | `.env` di **root repo** | `docker compose` (mengisi container) |
| **Dev lokal — web** | `apps/web/.env` | `next dev` (Next.js, otomatis) |
| **Dev lokal — wa-gateway** | `apps/wa-gateway/.env` | `npm run dev`/`start` (lewat `--env-file-if-exists`) |

Di produksi **tidak ada** `.env` yang ikut ke dalam image (dikecualikan oleh
`.dockerignore`). Rahasia masuk lewat `env_file: .env` di compose, jadi
di-inject sebagai environment process container — bukan dari berkas di dalam
image. Ini disengaja: image bisa dibagikan tanpa membawa rahasia.

```bash
cp .env.docker.example .env   # untuk deploy
# atau
cp .env.example apps/web/.env           # untuk dev lokal — web
cp apps/wa-gateway/.env.example apps/wa-gateway/.env   # untuk dev lokal — gateway
```

> wa-gateway memakai flag Node `--env-file-if-exists=.env` pada script
> `dev`/`start`, jadi berkas `.env`-nya dibaca otomatis — dan tidak menggagalkan
> start bila berkasnya belum dibuat (memakai nilai bawaan di kode).

## 2. Daftar variabel

### Wajib

| Variabel | Contoh | Catatan |
|---|---|---|
| `DATABASE_URL` | `postgresql://vibe:***@HOST_DB:5432/vibe-schools?schema=app&sslmode=no-verify` | Host = host DB yang dapat dijangkau dari container `web`, bukan `localhost`. **`schema=app`**, bukan `public` — `app` adalah lapisan view penyaring tenant. Peran harus peran aplikasi (bukan owner tabel), kalau tidak RLS mati. |
| `NEXTAUTH_URL` | `https://sekolah.id` | URL publik, tanpa trailing slash. Dipakai untuk URL webhook payment. |
| `NEXTAUTH_SECRET` | hasil `openssl rand -base64 32` | Minimal 32 karakter. Ganti = semua sesi login hangus. |
| `ROOT_DOMAIN` | `sekolah.id` | Domain akar subdomain. Di produksi, subdomain satu-satunya jalan masuk web sekolah. |

### Penting (fitur mati bila kosong)

| Variabel | Fungsi |
|---|---|
| `PAYMENT_ENCRYPTION_KEY` | Kunci AES-256-GCM (64 karakter hex) untuk enkripsi kredensial payment gateway. Tanpa ini, simpan kredensial ditolak. |
| `WA_GATEWAY_TOKEN` | Shared secret web ↔ wa-gateway. **Harus sama** di kedua layanan. |
| `WA_GATEWAY_URL` | Base URL gateway. Di compose di-override ke `http://wa-gateway:3001`. |
| `WA_SESSION_DIR` | Folder sesi Baileys di container. Bawaan `/data/sessions`. |
| `STORAGE_DRIVER` | `local` (bawaan) menyimpan unggahan di volume Docker. |

### Opsional / hanya saat seed

| Variabel | Fungsi |
|---|---|
| `SEED_SUPERADMIN_EMAIL` | Email super admin yang dibuat `npm run db:seed`. |
| `SEED_SUPERADMIN_PASSWORD` | Password super admin tersebut (min. 8 karakter). |
| `SEED_DEMO_ACTIVITY` | Set `0` untuk melewati data aktivitas demo saat seed. |

> **Catatan jujur:** `WA_SEND_HOUR_START/END`, `WA_MAX_RETRY`, `DEFAULT_TIMEZONE`,
> dan `APP_URL` pernah ada di contoh `.env` lama tetapi **tidak dibaca kode
> saat ini**. Jangan mengandalkannya untuk mengatur jam kirim WA — jam wajar
> kirim ditentukan di modul notifikasi, bukan lewat env.

## 3. Membuat nilai rahasia

```bash
# Sesi NextAuth (base64, 32 byte)
openssl rand -base64 32

# Shared secret WA gateway & kunci enkripsi payment (hex, 32 byte = 64 char)
openssl rand -hex 32
```

## 4. Aturan keselamatan

- **Jangan commit `.env`.** Sudah masuk `.gitignore` dan `.dockerignore`.
- **Jangan pernah menaruh rahasia di variabel `NEXT_PUBLIC_*`** — variabel itu
  di-inline ke bundle klien dan terlihat siapa pun.
- **Backup `NEXTAUTH_SECRET` dan `PAYMENT_ENCRYPTION_KEY`.** Kehilangan yang
  pertama = semua pengguna logout; kehilangan yang kedua = kredensial payment
  gateway tidak bisa didekripsi.
- Untuk mencegah rahasia tampil di `docker inspect`, pertimbangkan Docker
  secrets alih-alih `env_file` (penguatan lanjutan, belum dipakai di sini).

## 5. Mengubah nilai setelah deploy

```bash
# 1. Edit .env
# 2. Terapkan ulang (tanpa rebuild image)
docker compose up -d
```

`docker compose up -d` akan membuat ulang container yang environment-nya
berubah. Rebuild (`--build`) hanya perlu bila kode berubah.
