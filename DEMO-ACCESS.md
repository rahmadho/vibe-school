# Aturan Demo School App

Berlaku SETIAP kali pekerjaan pada `school-app` selesai. Tanpa diminta.

## Blok wajib di akhir setiap jawaban

```
## Akses demo

Portal   : <TUNNEL>/
SD       : <TUNNEL>/?school=sd
SMP      : <TUNNEL>/?school=smp
SMK      : <TUNNEL>/?school=smk

Login    : <TUNNEL>/login
  admin@tunasharapan.sch.id   SD  (SD Tunas Harapan)
  admin@smpn1.sch.id          SMP (SMP Negeri 1)
  admin@smkn2.sch.id          SMK (SMK Negeri 2 Nusantara)
  password12345
```

## Cara mengambil URL tunnel

URL `trycloudflare.com` berubah setiap sesi. Jangan pakai yang lama.

```bash
grep -oE 'https://[a-z-]+\.trycloudflare\.com' /opt/data/cf_school.log | tail -1
```

Bila log tak ada / proses mati, hidupkan ulang:

```bash
cd /opt/data/workspace/school-app/apps/web && \
DEV_ORIGINS=<host-tunnel> npx next dev -p 3100 > /opt/data/school-dev.log 2>&1 &
/opt/data/cloudflared tunnel --url http://localhost:3100 --no-autoupdate > /opt/data/cf_school.log 2>&1 &
```

`DEV_ORIGINS` **wajib**. Tanpa itu Next memblokir aset dev lintas-origin,
hidrasi React gagal, dan semua form jatuh ke submit native (kata sandi bocor
ke query string, login tak pernah jalan).

## Verifikasi sebelum melaporkan

Jangan klaim jalan tanpa ketiga hal ini:

1. `curl -s -o /dev/null -w '%{http_code}' <TUNNEL>/?school=sd|smp|smk` → 200
2. Jumlah siswa per sekolah benar: SD **1**, SMP **73**, SMK **2**
3. `npx tsc --noEmit` bersih dan `npx vitest run` lulus

Catatan: `curl` ke localhost BUKAN bukti — pernah 200 lokal tapi 503 dari
internet. Selalu lewat tunnel.
