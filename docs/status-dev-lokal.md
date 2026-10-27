# Status Dev Lokal — School App

Diperbarui: 2026-10-27. Lingkungan dev lokal (bukan Docker).

## 1. Blocker saat ini: database `vibe-school` belum ada

DB dev `vibe-school` **belum bisa dibuat** dari container ini. Role yang tersedia
di `postgresql_dev` (172.27.0.3:5432):

| Role | Superuser | CREATEDB | CREATEROLE | Keterangan |
|------|-----------|----------|------------|------------|
| `sipedal` | ya | ya | ya | password TIDAK tersedia di workspace |
| `vibe` | tidak | **tidak** | tidak | role aplikasi; hanya pemilik DB `vibe-laundry` |

Perintah nyata dan hasilnya:

```
$ CREATE DATABASE "vibe-school"   -- sebagai user vibe
ERR permission denied to create database
```

Login sebagai `sipedal` tidak bisa (password tidak diketahui). Karena itu
langkah migrasi, grants, RLS, dan seed **belum dijalankan**.

**Yang dibutuhkan:** jalankan sekali sebagai `sipedal`/superuser:

```sql
CREATE DATABASE "vibe-school" OWNER vibe;
```

Setelah itu seluruh langkah di bawah bisa dijalankan apa adanya.

> Catatan: DB lain di server ini (`sipedal`, `vibe-schools`, `vibe-pos`,
> `vibe-laundry`, `inaproc`, dst.) **tidak disentuh sama sekali**.

## 2. Cara menyalakan ulang app

`apps/web/.env` sudah ditulis (gitignored oleh `/.gitignore` baris 14) dan
memuat `DATABASE_URL`, `OWNER_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`,
`ROOT_DOMAIN`, `DOMAIN_TRUSTED_ZONES`, `PAYMENT_ENCRYPTION_KEY`,
`STORAGE_DRIVER`, `UPLOAD_DIR`, `NODE_ENV`, serta
`SEED_SUPERADMIN_EMAIL`/`SEED_SUPERADMIN_PASSWORD`.

```bash
cd /opt/data/workspace/school-app/apps/web
npx next dev -p 3100
```

Verifikasi:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3100/
curl -s http://localhost:3100/api/health
```

Hasil nyata saat ini:

```
GET /            -> HTTP 200   (host localhost / sekolah.bakoding.my.id)
GET /api/health  -> HTTP 200
{"status":"ok","uptime":10,"config":{"NEXTAUTH_SECRET":"ok","DATABASE_URL":"ok","ROOT_DOMAIN":"ok","NEXTAUTH_URL":"ok"}}
```

Halaman web sekolah (subdomain) saat ini **500** karena DB belum ada. Pesan
error aslinya:

```
Database `vibe-school` does not exist on the database server at `172.27.0.3:5432`.
```

Artinya routing sudah jalan (proxy → `resolveSchoolFromRequest` →
`findSchoolByHost`) dan berhenti tepat di query DB. Setelah DB dibuat, error ini
hilang.

## 3. Langkah DB setelah `vibe-school` dibuat

```bash
cd /opt/data/workspace/school-app/apps/web
npx prisma migrate deploy --schema prisma/schema.prisma

# grants + RLS butuh pg client; psql TIDAK terpasang di container ini.
# Pakai node + pg (tersedia di /opt/data/workspace/formku/node_modules/pg):
#   sslmode=require -> sertifikat server self-signed, butuh rejectUnauthorized:false
```

Role aplikasi = `vibe`. Karena `vibe` juga owner DB (`CREATE DATABASE ...
OWNER vibe`), **RLS tidak akan berefek** (owner bypass RLS). Untuk dev ini
diterima; untuk menguji RLS sungguhan dibutuhkan role aplikasi terpisah
(mis. `vibe_app`) dengan `DATABASE_URL` menunjuk role itu dan `OWNER_URL`
menunjuk `vibe`.

## 4. Seed

`prisma/seed.ts` sudah menyediakan:

- 3 Plan: Basic (Rp 250.000/bln), Pro (Rp 500.000/bln), Enterprise (Rp 1.200.000/bln)
- 3 sekolah contoh (multi-tenant)
- 1 user `SUPER_ADMIN` dari env

```bash
cd /opt/data/workspace/school-app/apps/web
npm run db:seed     # = tsx prisma/seed.ts
```

### Kredensial dev (DB dev — aman ditulis di sini)

| Peran | Email | Password |
|-------|-------|----------|
| SUPER_ADMIN | `superadmin@schoolapp.local` | `SuperAdmin#2026` |
| Admin SMP | `admin@smpn1.sch.id` | `password12345` |
| Admin SD | `admin@tunasharapan.sch.id` | `password12345` |
| Admin SMK | `admin@smkn2.sch.id` | `password12345` |

Super-admin memakai `SEED_SUPERADMIN_EMAIL` / `SEED_SUPERADMIN_PASSWORD` di
`apps/web/.env`; ganti bila ingin nilai lain.

## 5. Akses multi-tenant lewat header `Host`

Tanpa DNS nyata, kirim header `Host` langsung ke dev server:

```bash
# Portal (akar ROOT_DOMAIN)
curl -s -H 'Host: sekolah.bakoding.my.id' http://localhost:3100/ | grep -o '<title>[^<]*</title>'

# Web sekolah per subdomain
curl -s -H 'Host: smpn1-nusantara.sekolah.bakoding.my.id' http://localhost:3100/
```

Hasil nyata **sebelum DB ada**:

```
Host: sekolah.bakoding.my.id                     -> HTTP 200  <title>Web Sekolah</title>
Host: localhost:3100                             -> HTTP 200  <title>Web Sekolah</title>
Host: sd.bakoding.my.id                          -> HTTP 500  (DB belum ada)
Host: smp.bakoding.my.id                         -> HTTP 500  (DB belum ada)
Host: sma.bakoding.my.id                         -> HTTP 500  (DB belum ada)
Host: smpn1-nusantara.sekolah.bakoding.my.id     -> HTTP 500  (DB belum ada)
```

Setelah seed, ganti `smpn1-nusantara` dengan slug sekolah nyata. Portal
dikenali dari `Host` = `ROOT_DOMAIN`; subdomain lain dianggap tenant.

`ALLOW_SCHOOL_QUERY=true` juga aktif sehingga tanpa header Host:
`http://localhost:3100/?school=smpn1-nusantara`.

## 6. Migrasi (11 berkas, BELUM diterapkan)

Belum ada satu pun yang jalan. Daftar yang akan diterapkan berurutan:

```
20260920005951_dev
20260920181633_add_major_pkl_ukk
20260921005951_add_media
20260921032847_add_ai_setting
20260921140647_add_role_permissions
20260921160931_add_registration_source_refee
20260928120000_portal_akun_siswa
20260928140000_kwitansi_pembayaran
20260928160000_data_administrasi
20261027090000_plan_orders
20261027120000_domain_verification
```

## 7. Gerbang mutu (dijalankan ulang setelah app start)

```
npx tsc --noEmit   -> exit 0 (bersih)
npx vitest run     -> 45 lulus / 1 gagal, 856 lulus / 1 gagal dari 857 test
```

Satu kegagalan **bukan dari pekerjaan ini** dan bukan akibat migrasi:

```
FAIL src/lib/domain-verify.test.ts
  > huruf besar pada TOKEN tidak cocok (token peka huruf)
  AssertionError: expected true to be false
```

`src/lib/domain-verify.ts` + `.test.ts` masih **untracked** (ditulis sub-agent
lain). Dua test di berkas itu saling bertentangan: satu mengharap token
`toUpperCase()` tetap cocok, satu lagi mengharap tidak cocok. Implementasi
(`nilai.includes(expected.toLowerCase())`) membuat keduanya lowercase → test
kedua gagal. Tidak diubah karena file sedang dikerjakan pemiliknya.

Catatan `tsc`: jangan jalankan `tsc --noEmit` saat dev server hidup dengan
cache `.next/dev/types` setengah tertulis (muncul 8 error palsu di
`.next/dev/types/validator.ts`). Hapus `.next/dev/types` lalu ulangi.
