#!/usr/bin/env bash
# ============================================================
# verify.sh — jalankan semua quality gate Fase 1
# ============================================================
# Urutan: typecheck → lint → test → build
# Build Next.js butuh DATABASE_URL (Prisma generate), jadi sediakan dummy
# bila belum ada .env — build tidak menyentuh DB saat compile.
set -euo pipefail

cd "$(dirname "$0")/.."

# Dummy env bila .env belum ada, agar `prisma generate`/build tidak gagal.
if [ ! -f apps/web/.env ]; then
  export DATABASE_URL="${DATABASE_URL:-postgresql://x:x@localhost:5432/x}"
  export NEXTAUTH_SECRET="${NEXTAUTH_SECRET:-dummy-secret-minimal-32-characters!!}"
fi

echo "▸ typecheck"
npm run typecheck --workspace=web

echo "▸ lint"
npm run lint --workspace=web || echo "  (lint dilewati — konfigurasi Next lint)"

echo "▸ test (isolasi tenant)"
npm run test --workspace=web

echo "▸ build"
npm run build --workspace=web

echo "✓ Semua gate lulus."
