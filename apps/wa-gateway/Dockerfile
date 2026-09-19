# wa-gateway — WhatsApp (Baileys)
#
# Catatan penting: Baileys memerlukan Node (bukan serverless). Proses ini
# menyimpan kredensial sesi di volume agar tidak perlu memindai QR tiap restart.
FROM node:20-slim

# Baileys memerlukan beberapa pustaka native untuk WebSocket & media.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates \
      git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Salin manifest dulu agar layer instalasi di-cache.
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY src ./src

# Prisma client di-generate dari skema web; di produksi skema disalin saat build
# oleh pipeline. Untuk image mandiri, jalankan `prisma generate` bila tersedia.
ENV NODE_ENV=production \
    PORT=3001 \
    WA_SESSION_DIR=/data/sessions

# Jalankan sebagai pengguna non-root.
RUN mkdir -p /data/sessions && chown -R node:node /data /app
USER node

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/index.js"]
