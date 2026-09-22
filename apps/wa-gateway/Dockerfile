# ============================================================
# wa-gateway — WhatsApp (Baileys)
#
# PENTING: konteks build = ROOT monorepo (lihat `context: .` di
# docker-compose.yml). Wa-gateway TIDAK punya schema Prisma sendiri; satu-
# satunya schema ada di apps/web/prisma/schema.prisma dan dipakai bersama.
# Karena itu Prisma Client di-generate dari schema web agar wa-gateway bisa
# query tabel yang sama (notification_queue, wa_session, school).
#
#   docker build -f apps/wa-gateway/Dockerfile -t school-wa-gateway .
# ============================================================

# ---------- Stage 1: builder ----------
FROM node:20-slim AS builder
WORKDIR /app

# Baileys butuh pustaka native (libsignal, ws) — sediakan openssl & git.
RUN apt-get update && apt-get install -y --no-install-recommends \
      openssl ca-certificates git \
    && rm -rf /var/lib/apt/lists/*

# Manifest root + kedua workspace agar resolusi npm workspaces valid.
COPY package.json package-lock.json ./
COPY apps/wa-gateway/package.json ./apps/wa-gateway/package.json
COPY apps/web/package.json ./apps/web/package.json

# Dependensi produksi saja (Baileys, pino, @prisma/client, dll).
RUN npm ci --omit=dev

# Salin sumber wa-gateway + schema Prisma milik web (sumber tunggal skema).
COPY apps/wa-gateway/src ./apps/wa-gateway/src
COPY apps/web/prisma ./apps/web/prisma

# Prisma CLI sebagai tool sementara untuk generate (tidak ikut ke image akhir).
# `--no-save` agar package.json tak berubah.
RUN npm i --no-save prisma@5.22.0 --no-audit --no-fund

# Generate client memakai schema web + engine Linux (debian-openssl-3.0.x).
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public"
RUN npx prisma generate --schema apps/web/prisma/schema.prisma

# Buang CLI sementara agar tidak ikut ke image akhir.
RUN rm -rf node_modules/prisma node_modules/.bin/prisma

# ---------- Stage 2: runner ----------
FROM node:20-slim AS runner
WORKDIR /app

# Runtime Baileys tetap butuh openssl & ca-certificates.
RUN apt-get update && apt-get install -y --no-install-recommends \
      openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    PORT=3001 \
    WA_SESSION_DIR=/data/sessions

# Dependensi produksi, sudah termasuk Prisma Client yang di-generate di builder
# (@prisma/client menulis ke node_modules/.prisma saat generate).
COPY --from=builder /app/node_modules ./node_modules
COPY apps/wa-gateway/package.json ./apps/wa-gateway/package.json
COPY apps/wa-gateway/src ./apps/wa-gateway/src

# Folder sesi WA + jalankan sebagai non-root (user `node`).
RUN mkdir -p /data/sessions && chown -R node:node /data /app
USER node

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/wa-gateway/src/index.js"]
