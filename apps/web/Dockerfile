# ============================================================
# Aplikasi web (Next.js) — image produksi
#
# PENTING: konteks build = ROOT monorepo (lihat `context: .` di
# docker-compose.yml), bukan folder apps/web. Alasannya npm workspaces:
# lockfile & node_modules hoisted ada di root, dan schema Prisma ada di
# apps/web/prisma. Menjalankan build dari root membuat resolusi workspace
# (web + wa-gateway) konsisten.
#
#   docker build -f apps/web/Dockerfile -t school-app-web .
# ============================================================

# ---------- Stage 1: builder ----------
# Instalasi & build dilakukan di SATU stage agar struktur node_modules Linux
# dibuat di tempat (npm workspaces kadang menyimpankan paket tertentu ke
# apps/web/node_modules, bukan hoisted ke root). Menyalin node_modules antar
# stage berisiko kehilangan paket itu.
FROM node:24-slim AS builder
WORKDIR /app

# openssl dibutuhkan Prisma engine di Debian slim.
RUN apt-get update && apt-get install -y --no-install-recommends \
      openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Manifest root + kedua workspace: `npm ci` (workspaces) mencocokkan
# package-lock.json root, jadi semua manifest harus ada.
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/package.json
COPY apps/wa-gateway/package.json ./apps/wa-gateway/package.json

# `npm ci` = instalasi bersih & deterministik (butuh package-lock.json).
# --include=dev karena build butuh prisma, typescript, tailwind, dll.
RUN npm ci --include=dev

# Salin sumber web (node_modules & .next lokal dikecualikan oleh .dockerignore
# sehingga tidak menimpa hasil instalasi Linux di atas).
COPY apps/web ./apps/web

ENV NEXT_TELEMETRY_DISABLED=1
# Variabel dummy agar `prisma generate` & build tidak gagal validasi env.
# Nilai nyata di-inject saat runtime lewat env_file.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public"
ENV NEXTAUTH_SECRET="build-time-placeholder-secret-min-32-characters"

# Generate Prisma Client dulu, lalu build Next (output: standalone).
RUN cd apps/web && npx prisma generate && npx next build

# ---------- Stage 2: runner ----------
# Image akhir ramping: hanya artefak standalone + static + public.
FROM node:24-slim AS runner
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
      openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Standalone menyertakan server.js + node_modules minimal yang dipakai.
COPY --from=builder --chown=node:node /app/apps/web/.next/standalone ./
# Static & public TIDAK ikut standalone — disalin manual ke lokasi yang benar.
COPY --from=builder --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=node:node /app/apps/web/public ./apps/web/public
# Schema + migrasi Prisma (dibutuhkan CLI `migrate deploy`).
COPY --from=builder --chown=node:node /app/apps/web/prisma ./apps/web/prisma
# Prisma CLI: standalone hanya membawa library runtime, bukan CLI. CLI v5 hanya
# bergantung pada @prisma/engines (+ transitifnya), jadi paket berikut cukup.
COPY --from=builder --chown=node:node /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=node:node /app/node_modules/@prisma/engines ./node_modules/@prisma/engines
COPY --from=builder --chown=node:node /app/node_modules/@prisma/engines-version ./node_modules/@prisma/engines-version
COPY --from=builder --chown=node:node /app/node_modules/@prisma/fetch-engine ./node_modules/@prisma/fetch-engine
COPY --from=builder --chown=node:node /app/node_modules/@prisma/get-platform ./node_modules/@prisma/get-platform
COPY --from=builder --chown=node:node /app/node_modules/@prisma/debug ./node_modules/@prisma/debug
# `pg` dipakai bootstrap.sh untuk menjalankan skrip SQL tata-letak schema.
# Tidak ikut Next standalone (bukan bagian bundel aplikasi), jadi dipasang
# sendiri. Versinya MENGIKUTI package-lock.json (`npm ci`, bukan `npm install`)
# supaya deterministik dan tidak berubah diam-diam antar-build.
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/package.json
COPY apps/wa-gateway/package.json ./apps/wa-gateway/package.json
RUN mkdir -p /app/tools && cd /app/tools \
    && cp /app/package.json /app/package-lock.json . \
    && npm ci --omit=dev --no-audit --no-fund --workspaces=false >/dev/null 2>&1 \
       && test -d /app/tools/node_modules/pg
ENV NODE_PATH=/app/tools/node_modules

# Folder unggahan runtime (di-mount volume di compose pada /data/uploads).
RUN mkdir -p /data/uploads && chown -R node:node /data

# Jalankan sebagai pengguna non-root `node` (bawaan image).
USER node
EXPOSE 3000

# Saat container start: lengkapi skema database lalu jalankan server.
#
# `bootstrap.sh` mengerjakan SELURUH persiapan skema (migrasi, tata letak tiga
# schema, view penyaring tenant, fungsi login, hak akses). Tanpa itu aplikasi
# hidup tetapi menampilkan angka 0 dan login gagal. Skripnya idempoten
# sehingga aman dijalankan di setiap restart.
#
# Ditulis tanpa `|| echo` supaya kegagalan TERLIHAT di log Coolify. Skrip itu
# sendiri sudah menangani DB yang belum siap dengan retry, jadi kegagalan di
# sini berarti ada yang benar-benar salah dan harus dibaca, bukan ditelan.
CMD ["sh", "-c", "sh apps/web/prisma/bootstrap.sh; node apps/web/server.js"]
