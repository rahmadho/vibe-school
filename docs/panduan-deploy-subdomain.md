# Panduan Deploy: Subdomain Multi-Sekolah

Dokumen ini menjelaskan cara memasang School App sehingga **setiap sekolah
punya subdomain sendiri** (`smpn1.sekolah.id`, `tkit.sekolah.id`, …).

Ini bukan pilihan gaya: **di produksi, subdomain adalah satu-satunya jalan masuk
web sekolah.** Cadangan `?school=slug` sengaja dimatikan di produksi karena
siapa pun bisa membaca web sekolah lain hanya dengan menebak slug — dan itu
meruntuhkan janji isolasi data antar-sekolah. Penolakan itu dikunci oleh test.

---

## 1. Ringkasan yang harus ada

| Komponen | Yang dibutuhkan |
|---|---|
| DNS | Satu record **wildcard**: `*.sekolah.id` → IP VPS |
| Nginx | `server_name .sekolah.id` (titik di depan = wildcard) |
| Sertifikat | **Wildcard** Let's Encrypt (butuh DNS-01 challenge) |
| Aplikasi | Variabel `ROOT_DOMAIN` + `ALLOW_SCHOOL_QUERY` tidak diset di produksi |

Urutannya penting: **DNS dulu**, karena penerbitan sertifikat wildcard butuh
verifikasi DNS.

---

## 2. DNS

Di panel DNS domain Anda:

```
A     sekolah.id         →  203.0.113.10      (portal)
A     *.sekolah.id       →  203.0.113.10      (semua sekolah)
```

`*.sekolah.id` mencakup `smpn1.sekolah.id`, `tkit.sekolah.id`, dan seterusnya —
Anda tidak perlu menambah record setiap kali ada sekolah baru. Inilah alasan
pendekatan subdomain dipilih: onboarding sekolah = satu baris di database, bukan
tiket ke penyedia DNS.

**Verifikasi sebelum lanjut:**

```bash
dig +short smpn1.sekolah.id     # harus menjawab IP VPS Anda
dig +short tkit.sekolah.id      # harus menjawab IP VPS yang sama
```

Kalau keduanya kosong, jangan lanjut — sertifikat pasti gagal.

**Custom domain sekolah.** Sekolah yang sudah punya domain sendiri
(`smpn1jkt.sch.id`) memakai **record A/CNAME terpisah** yang menunjuk ke VPS
yang sama. Aplikasi mengenali custom domain lewat kolom `School.customDomain`.
Catatan: subdomain bertingkat (`a.b.sekolah.id`) **sengaja ditolak** — tidak sah
dan membuka celah.

---

## 3. Sertifikat wildcard

Sertifikat biasa (`certbot --nginx`) **tidak cukup**: ia hanya berlaku untuk
nama yang didaftarkan. Untuk `*.sekolah.id` dibutuhkan challenge **DNS-01**,
karena Let's Encrypt tidak bisa memverifikasi nama yang belum ada secara HTTP.

### Dengan plugin DNS penyedia Anda

```bash
# Contoh untuk Cloudflare (plugin: python3-certbot-dns-cloudflare)
sudo apt install -y certbot python3-certbot-dns-cloudflare

sudo mkdir -p /root/.secrets
sudo tee /root/.secrets/cf.ini >/dev/null <<'EOF'
dns_cloudflare_api_token = TOKEN_ANDA
EOF
sudo chmod 600 /root/.secrets/cf.ini

sudo certbot certonly \
  --dns-cloudflare \
  --dns-cloudflare-credentials /root/.secrets/cf.ini \
  -d "sekolah.id" -d "*.sekolah.id" \
  --agree-tos -m admin@sekolah.id --non-interactive
```

Sertifikat tersimpan di `/etc/letsencrypt/live/sekolah.id/`.

**Perpanjangan otomatis** sudah ditangani `certbot.timer`. Uji sekali:

```bash
sudo certbot renew --dry-run
```

> **Kalau sekolah memakai custom domain**, sertifikat wildcard sekolah.id TIDAK
> berlaku. Domain itu butuh entri sertifikatnya sendiri (tambahkan `-d
> smpn1jkt.sch.id`, tetap dengan DNS-01 bila DNS dikelola penyedia yang sama).

---

## 4. Nginx

```nginx
# ---------- Web sekolah (wildcard) ----------
server {
    listen 80;
    listen [::]:80;
    server_name .sekolah.id;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    # Titik di depan = cocokkan APAPUN subdomainnya.
    server_name .sekolah.id;

    ssl_certificate     /etc/letsencrypt/live/sekolah.id/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/sekolah.id/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # WAJIB: teruskan host asli ke aplikasi. Tanpa ini aplikasi tidak tahu
    # sekolah mana yang diminta dan seluruh situs jatuh ke portal.
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # Nama host asli juga dikirim eksplisit (beberapa proxy menimpanya).
    proxy_set_header X-Forwarded-Host  $host;

    client_max_body_size 12M;   # unggahan gambar/berkas SPMB

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade    $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 60s;
    }
}
```

Perhatikan khusus `proxy_set_header Host $host;` — **ini bagian paling mudah
salah**. Kalau Nginx mengirim `Host: localhost`, aplikasi akan menampilkan
portal untuk SEMUA sekolah, dan seluruh web sekolah tampak "rusak" padahal
aplikasinya benar.

---

## 5. Environment aplikasi

```bash
# .env (produksi)
DATABASE_URL="postgresql://school:PASSWORD@postgres:5432/schoolapp?schema=public"
NEXTAUTH_SECRET="hasil-openssl-rand-base64-32"
PAYMENT_ENCRYPTION_KEY="64-karakter-hex"

# WAJIB: domain akar untuk menyusun tautan sekolah.
ROOT_DOMAIN="sekolah.id"

# CADANGAN ?school= — JANGAN diset di produksi.
# Hanya berguna di pengembangan lokal (localhost tanpa subdomain).
# Kalau diset di produksi, siapa pun bisa membaca web sekolah lain dengan
# menebak slug.
# ALLOW_SCHOOL_QUERY=true
```

Aplikasi memutuskan boleh-tidaknya cadangan `?school=` dari **nilai variabel
ini**, bukan dari perilaku tersembunyi — jadi ada satu tempat untuk memeriksa.

---

## 6. Menambah sekolah baru

1. Tambahkan sekolah di panel super-admin, isi **slug** (mis. `smpn1`).
2. Slug langsung jadi `smpn1.sekolah.id`. **Tidak ada langkah DNS.**

Slug divalidasi di `lib/site-host.ts`. Aturannya:

- Huruf kecil, angka, dan tanda hubung
- Tidak boleh diawali/diakhiri tanda hubung
- **Tidak boleh** memakai nama yang dipesan sistem: `www`, `api`, `admin`,
  `app`, `mail`, `portal`, `static`, dan sejenisnya — supaya web sekolah tidak
  menabrak layanan internal.

Kalau sekolah mengubah slug, **alamat lama mati**. Aplikasi memperingatkan ini di
halaman pengaturan web sekolah sebelum menyimpan. Tautan lama di brosur atau
media sosial tidak bisa dialihkan otomatis (aplikasi tidak tahu sekolah mana
yang dimaksud dari alamat yang sudah tidak ada), jadi rencanakan penggantian
slug bersamaan dengan pengumuman.

---

## 7. Memeriksa setelah deploy

```bash
# 1. Portal
curl -sI https://sekolah.id | head -1                 # 200

# 2. Subdomain sekolah
curl -sI https://smpn1.sekolah.id | head -1           # 200

# 3. Pastikan sekolah BERBEDA menampilkan isi berbeda
curl -s https://smpn1.sekolah.id | grep -o '<title>[^<]*'
curl -s https://tkit.sekolah.id  | grep -o '<title>[^<]*'

# 4. Isolasi tenant: slug tak dikenal TIDAK boleh menampilkan sekolah lain
curl -sI https://tidakada.sekolah.id | head -1        # 404
```

Langkah 3 dan 4 adalah **pemeriksaan terpenting**. Kalau langkah 4 menampilkan
sekolah mana pun, hentikan layanan dan periksa header `Host` di Nginx — berarti
resolusi tenant tidak bekerja dan data sekolah bisa tercampur.

---

## 8. Kesalahan yang paling sering terjadi

| Gejala | Penyebab | Perbaikan |
|---|---|---|
Semua subdomain menampilkan portal | Nginx tidak meneruskan `Host` | Tambah `proxy_set_header Host $host;` |
Sertifikat tidak berlaku di subdomain | Sertifikat bukan wildcard | Terbitkan ulang dengan DNS-01 `-d "*.sekolah.id"` |
Sertifikat wildcard gagal | Belum ada record `*.sekolah.id` | Tambah DNS dulu, verifikasi dengan `dig`, baru terbitkan |
Subdomain bertingkat tidak jalan | Memang ditolak sistem | Pakai satu tingkat (`smpn1.sekolah.id`) |
`www.sekolah.id` menampilkan sekolah | `www` nama dipesan sistem | `www` harus tetap portal; periksa `RESERVED_SUBDOMAINS` |
Unggahan gagal | Batas Nginx terlalu kecil | Naikkan `client_max_body_size` |
Beranda sekolah kosong | Belum ada blok tersusun | Susun blok di dasbor → Web Sekolah |

---

## 9. Yang belum ada

- **Penyimpanan berkas** (mis. S3/MinIO) belum ada. `coverUrl` masih string URL,
  jadi unggah gambar langsung belum bisa — operator menempel tautan.
- **Layanan `web` belum ada di `docker-compose.yml`.** Aplikasi Next.js masih
  dijalankan terpisah (atau ditambahkan sendiri ke compose).
- **Penyegaran sertifikat** untuk custom domain perlu entri `renew` tersendiri;
  wildcard tidak mencakupnya.
