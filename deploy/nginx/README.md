# Nginx — School App (reverse proxy)

Konfigurasi Nginx siap pindah ke container reverse proxy Anda. Nginx harus
berada di network yang **sama** dengan service `web` — yaitu network default
project (`school-app_default`), sehingga `proxy_pass http://web:3000` mengenali
nama service secara otomatis.

## Berkas

| Berkas | Tujuan di container |
|---|---|
| `nginx.conf` | `/etc/nginx/nginx.conf` |
| `conf.d/school-app.conf` | `/etc/nginx/conf.d/school-app.conf` |

## Langkah pakai

1. **Ganti domain.** Di `conf.d/school-app.conf`, ganti setiap `sekolah.id`
   dengan domain akar Anda.
2. **Terbitkan sertifikat wildcard** (butuh DNS-01):
   lihat [../../docs/panduan-deploy-subdomain.md](../../docs/panduan-deploy-subdomain.md).
   Hasilnya di `/etc/letsencrypt/live/<domain>/`.
3. **Pindahkan berkas** ke container Nginx, atau mount. Nama network default
   mengikuti nama folder project, jadi cek dulu: `docker network ls | grep school`.
   ```bash
   docker run -d --name nginx \
     --network school-app_default \
     -p 80:80 -p 443:443 \
     -v "$PWD/deploy/nginx/nginx.conf:/etc/nginx/nginx.conf:ro" \
     -v "$PWD/deploy/nginx/conf.d:/etc/nginx/conf.d:ro" \
     -v /etc/letsencrypt:/etc/letsencrypt:ro \
     -v /var/www/certbot:/var/www/certbot:ro \
     nginx:1.27-alpine
   ```
4. **Uji konfigurasi** sebelum reload:
   ```bash
   docker exec nginx nginx -t && docker exec nginx nginx -s reload
   ```

## Yang perlu diperhatikan

- **`proxy_set_header Host $host;`** wajib. Tanpa ini, semua subdomain akan
  tampil sebagai portal (aplikasi tak tahu sekolah mana yang diminta).
- **Wildcard `server_name .sekolah.id`** (titik di depan) menangani domain akar
  **dan** semua subdomain satu tingkat. Subdomain bertingkat (`a.b.sekolah.id`)
  sengaja ditolak aplikasi.
- Jika container Nginx Anda belum berada di network project, sambungkan:
  `docker network connect <network-project> <nama-container-nginx>`
  (temukan nama nyatanya dengan `docker network ls`).
- Bila berkas `/etc/letsencrypt/options-ssl-nginx.conf` dan `ssl-dhparams.pem`
  tidak ada (belum dijalankan certbot), komentari tiga baris `include`/`ssl_*`
  terkait di server block HTTPS.
- Image `nginx` bawaan membawa `/etc/nginx/conf.d/default.conf` yang juga
  `listen 80 default_server`. Karena kita memakai `default_server` sendiri,
  hapus berkas itu agar tidak bentrok ("duplicate default server"):
  `docker exec nginx rm /etc/nginx/conf.d/default.conf` sebelum reload, atau
  mount folder `conf.d` sehingga menimpa seluruh isinya (seperti contoh di atas).
- Nama service upstream bisa diganti di blok `upstream school_app` — default
  `web:3000` mengikuti `container_name`/service di `docker-compose.yml`.

## Verifikasi cepat

```bash
curl -sI https://sekolah.id | head -1            # 200 (portal)
curl -sI https://smpn1.sekolah.id | head -1      # 200 (web sekolah)
curl -sI https://tidakada.sekolah.id | head -1   # 404 (isolasi tenant bekerja)
```

Lihat juga: [../../docs/panduan-deploy-docker.md](../../docs/panduan-deploy-docker.md)
dan [../../docs/panduan-deploy-subdomain.md](../../docs/panduan-deploy-subdomain.md).
