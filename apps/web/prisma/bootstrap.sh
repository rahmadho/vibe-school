#!/bin/sh
# ============================================================
# Bootstrap database — dijalankan setiap container start.
#
# Kenapa ada: `prisma migrate deploy` hanya membuat tabel, dan pada DB baru ia
# membuatnya di schema yang SALAH (`?schema=app` di DATABASE_URL membuat semua
# tabel & enum mendarat di `app`). Arsitektur tiga schema yang terbukti jalan:
#
#   data   — tabel ber-schoolId (data milik sekolah)
#   public — tabel global + enum + fungsi login
#   app    — view penyaring tenant
#
# Urutan di bawah memaksa tata letak itu. Semua idempoten: aman diulang tiap
# restart, dan pada DB yang sudah tertata tidak ada yang berubah.
#
# Skrip ini SENGAJA tidak menyentuh data sekolah. Seed demo dijalankan
# terpisah (`npm run db:seed`), tidak otomatis di produksi.
#
# Pakai `pg` (bukan `@prisma/client`) karena skrip SQL di sini berisi blok
# `DO $$ ... $$` dengan banyak perintah. `pg` memakai protokol simple query
# yang mengizinkannya — sama seperti `psql`. Prepared statement Prisma
# menolaknya.
# ============================================================
set -eu

PRISMA_DIR="apps/web/prisma"
SCHEMA="$PRISMA_DIR/schema.prisma"

log() { echo "[bootstrap] $*"; }

if [ -z "${DATABASE_URL:-}" ]; then
  log "DATABASE_URL kosong — bootstrap dilewati, server tetap dijalankan."
  exit 0
fi

# Jalankan satu berkas SQL. Satu koneksi, satu round-trip, tanpa psql.
# $2 = nama role aplikasi (dipakai grants-app-role.sql lewat `SET app.role`).
run_sql() {
  node -e '
    const fs = require("fs");
    const { Client } = require("pg");
    const c = new Client({ connectionString: process.env.DATABASE_URL });
    const sql = fs.readFileSync(process.argv[1], "utf8");
    const role = process.argv[2] || "";
    c.connect()
      // Tabel tenant ada di `data`; tanpa search_path ini rujukan tanpa schema
      // di berkas SQL gagal dengan `relation "users" does not exist`.
      .then(() => c.query("SET search_path TO data, app, public"))
      .then(() => (role ? c.query("SET app.role = " + c.escapeLiteral(role)) : null))
      .then(() => c.query(sql))
      .then(() => c.end())
      .catch((e) => {
        console.error("[bootstrap] " + process.argv[1] + ": " + e.message);
        process.exit(1);
      });
  ' "$1" "${2:-}"
}

# 1. Tunggu database menerima koneksi. Bukan `sleep` tetap: Postgres pertama
#    kali start butuh inisialisasi yang durasinya bervariasi.
i=0
until node -e '
  const { Client } = require("pg");
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  c.connect().then(() => c.end()).catch((e) => {
    console.error("[bootstrap] koneksi: " + e.message);
    process.exit(1);
  });
'; do
  i=$((i + 1))
  if [ "$i" -ge 30 ]; then
    # JANGAN exit 0. Dulu di sini `exit 0` sehingga container start dengan
    # database kosong dan tanpa satu pun tabel — aplikasi tampak hidup tapi
    # setiap halaman error, dan log Coolify tidak menunjukkan kegagalan.
    log "GAGAL: database tidak merespons setelah 30 percobaan — start dibatalkan."
    exit 1
  fi
  sleep 2
done
log "database siap."

# 2. Migrasi. Idempoten, tanpa prompt.
#    Kegagalan di sini WAJIB menghentikan start: kalau migrasi tidak jalan,
#    semua langkah setelahnya bekerja pada tabel yang tidak ada.
#
#    ⚠️ MIGRATE MEMAKAI URL TANPA `?schema=app` — JANGAN diseragamkan.
#
#    `?schema=app` membuat Prisma MENGKUALIFIKASI nama tabel, sehingga ia
#    mencari `app._prisma_migrations`. Tabel itu ada di `public`; di `app`
#    hanya ada view penyaring. Hasilnya Prisma menyimpulkan "schema tidak
#    kosong tanpa riwayat migrasi" -> P3005 -> container gagal start
#    SELAMANYA, dan restart tidak pernah memperbaikinya.
#
#    Tanpa `?schema=app`, Prisma memakai nama polos + search_path, dan tabel
#    migrasi di `public` ditemukan ("Database schema is up to date!").
#    Aplikasi runtime di sisi lain MEMBUTUHKAN `schema=app` supaya membaca
#    view penyaring tenant — dua kebutuhan berbeda, dua URL berbeda.
log "menjalankan migrasi…"
PRISMA_URL=$(node -e '
  const u = new URL(process.env.DATABASE_URL);
  u.searchParams.delete("schema");
  process.stdout.write(u.toString());
') || { log "GAGAL: DATABASE_URL tidak bisa dibaca — start dibatalkan."; exit 1; }
DATABASE_URL="$PRISMA_URL" PGOPTIONS="-c search_path=app,public,data" \
  node node_modules/prisma/build/index.js migrate deploy --schema "$SCHEMA" \
  || { log "GAGAL: migrate deploy — start dibatalkan."; exit 1; }

# Nama role aplikasi diambil dari DATABASE_URL. Bootstrap biasanya berjalan
# sebagai OWNER, jadi role sasaran tidak bisa ditebak dari current_user —
# dan salah tebak berarti tidak ada hak yang diberikan sama sekali.
APP_ROLE="${APP_DB_ROLE:-$(node -e '
  try { process.stdout.write(decodeURIComponent(new URL(process.env.DATABASE_URL).username)) }
  catch { process.exit(0) }
')}"
log "role aplikasi: ${APP_ROLE:-(tidak diketahui)}"

# 3. Tata letak schema -> enum -> view -> login -> hak akses. Urutan ini WAJIB.
# 5. Kebijakan RLS. WAJIB sebelum view, karena view hanya MENYARING, sedangkan
#    RLS adalah lapisan yang menahan query yang lupa memfilter schoolId.
#
#    `rls.sql` dulu TIDAK PERNAH dipanggil di sini — akibatnya 51 tabel tenant
#    berjalan tanpa RLS dan isolasi sekolah bergantung pada view saja. Bug ini
#    tidak terlihat: aplikasi tetap benar selama setiap query lewat scopedDb.
for f in schema-layout.sql enum-move.sql rls.sql rls-views.sql rls-global-views.sql login-functions.sql; do
  if run_sql "$PRISMA_DIR/$f"; then
    log "ok  $f"
  else
    log "GAGAL $f — start dibatalkan."
    exit 1
  fi
done

# GRANT butuh nama role aplikasi.
if [ -z "$APP_ROLE" ]; then
  log "GAGAL: nama role aplikasi tidak terbaca dari DATABASE_URL — set APP_DB_ROLE."
  exit 1
fi
if run_sql "$PRISMA_DIR/grants-app-role.sql" "$APP_ROLE"; then
  log "ok  grants-app-role.sql (role: $APP_ROLE)"
else
  log "GAGAL grants-app-role.sql — start dibatalkan."
  exit 1
fi

# 4. Penanda selesai, supaya "bootstrap jalan" bisa dibuktikan, bukan diasumsikan.
node -e '
  const { Client } = require("pg");
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  c.connect()
    .then(() => c.query("CREATE SCHEMA IF NOT EXISTS app"))
    .then(() => c.query("CREATE TABLE IF NOT EXISTS app._bootstrap (ok boolean, at timestamptz default now())"))
    .then(() => c.query("DELETE FROM app._bootstrap"))
    .then(() => c.query("INSERT INTO app._bootstrap (ok) VALUES (true)"))
    .then(() => c.end())
    .catch((e) => console.error("[bootstrap] penanda: " + e.message));
'
log "selesai."
