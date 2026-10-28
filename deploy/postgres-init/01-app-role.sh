#!/bin/bash
# ============================================================
# Dijalankan Postgres SEKALI, saat volume data masih kosong.
#
# Di sini hanya tiga hal yang bisa dikerjakan SEBELUM aplikasi hidup:
#   1. membuat schema `app` (DATABASE_URL memakai ?schema=app)
#   2. membuat role aplikasi NON-OWNER
#   3. memberi USAGE schema itu kepada role aplikasi
#
# Tabel, view, RLS, dan fungsi login TIDAK dibuat di sini — itu tugas
# bootstrap.sh di container web, setelah Prisma bermigrasi. Tidak bisa
# dipindah ke sini: skrip initdb jalan sebelum Prisma pernah menyentuh DB.
#
# Kenapa role non-owner: PostgreSQL membiarkan PEMILIK tabel melewati RLS.
# Kalau aplikasi konek sebagai pemilik (POSTGRES_USER), isolasi antar-sekolah
# mati total tanpa error apa pun.
#
# Ditulis sebagai shell, bukan .sql: skrip initdb TIDAK meneruskan variabel
# compose ke psql, jadi `:'app_role'` akan kosong. Shell membaca env langsung.
# ============================================================
set -euo pipefail

role="${APP_DB_ROLE:-vibe}"
pass="${APP_DB_PASSWORD:-}"

if [ -z "$pass" ]; then
  echo "[initdb] APP_DB_PASSWORD kosong — role aplikasi tidak bisa dibuat." >&2
  exit 1
fi

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
     -v role="$role" -v pass="$pass" <<'SQL'
-- Schema tempat Prisma mendarat. Dibuat lebih dulu supaya migrasi pertama
-- tidak perlu CREATE SCHEMA (migrasi Prisma tidak melakukannya).
CREATE SCHEMA IF NOT EXISTS app AUTHORIZATION current_user;

SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'role', :'pass')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'role')
\gexec

SELECT format('ALTER ROLE %I LOGIN PASSWORD %L', :'role', :'pass')
WHERE EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'role')
\gexec

SELECT format('GRANT USAGE ON SCHEMA app TO %I', :'role') \gexec
SELECT format('GRANT USAGE ON SCHEMA public TO %I', :'role') \gexec
SQL

echo "[initdb] role '$role' siap, schema app dibuat."
