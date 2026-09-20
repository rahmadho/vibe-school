-- ============================================================
-- GRANT — Hak Akses untuk Role Aplikasi
-- ============================================================
--
-- MASALAH YANG DIPERBAIKI BERKAS INI:
--   Postgres error 42501 "permission denied for table schools".
--
--   RLS (lihat rls.sql) mewajibkan aplikasi terhubung sebagai role NON-OWNER
--   dan NON-SUPERUSER — kalau tidak, RLS dilewati. Tetapi role yang bukan owner
--   juga TIDAK otomatis punya hak baca/tulis ke tabel yang dibuat owner. Tanpa
--   GRANT di bawah, setiap query gagal dengan "permission denied".
--
--   Karena itu RLS dan GRANT harus dipasang BERPASANGAN. rls.sql sendiri tidak
--   cukup.
--
-- CARA PAKAI (jalankan sebagai OWNER tabel / superuser, BUKAN role aplikasi):
--
--   psql "postgresql://OWNER:PASSWORD@HOST:5432/vibe-schools" \
--     -v app_role=sipedal \
--     -f apps/web/prisma/grants.sql
--
-- Ganti `sipedal` dengan nama role di DATABASE_URL aplikasi Anda.
--
-- URUTAN PEMASANGAN YANG BENAR:
--   1. prisma migrate deploy   (owner membuat tabel)
--   2. psql … -f prisma/grants.sql   (beri hak ke role aplikasi)  ← berkas ini
--   3. psql … -f prisma/rls.sql      (pasang kebijakan RLS)
-- ============================================================

-- Nama role aplikasi. Bisa di-override: psql -v app_role=nama_role
\if :{?app_role}
\else
  \set app_role sipedal
\endif

\echo 'Memberi hak akses ke role:' :app_role

-- ---------- 1. Skema ----------
-- Tanpa USAGE, role tidak bisa "melihat" tabel sama sekali walau sudah di-GRANT.
GRANT USAGE ON SCHEMA public TO :"app_role";

-- ---------- 2. Tabel yang sudah ada ----------
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO :"app_role";

-- ---------- 3. Sequence (kolom auto-increment) ----------
-- Tanpa ini, INSERT ke tabel ber-serial akan gagal.
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO :"app_role";

-- ---------- 4. Tabel yang akan dibuat KEMUDIAN ----------
-- Prisma migrate berikutnya membuat tabel baru sebagai owner. Tanpa default
-- privileges ini, tabel baru langsung tidak bisa diakses aplikasi dan error
-- 42501 muncul lagi — persis setelah deploy berikutnya, saat paling merepotkan.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO :"app_role";
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO :"app_role";

\echo 'Selesai. Role aplikasi sekarang bisa membaca & menulis tabel.'
\echo 'Langkah berikutnya: pasang RLS dengan prisma/rls.sql'

-- ============================================================
-- CATATAN KEAMANAN
-- ============================================================
--
-- 1. Role aplikasi TIDAK diberi CREATE / DROP / ALTER. Perubahan skema hanya
--    lewat `prisma migrate deploy` sebagai owner — sesuai AGENTS.md aturan #2.
--
-- 2. JANGAN jadikan role aplikasi sebagai owner atau superuser demi
--    "menyelesaikan" error ini. Keduanya MEMBYPASS RLS sepenuhnya, sehingga
--    lapisan pertahanan kedua hilang dan satu query yang lupa memfilter
--    schoolId akan membocorkan data antar-sekolah.
--
-- 3. DATABASE_URL untuk runtime aplikasi memakai role terbatas ini.
--    DATABASE_URL untuk migrasi memakai owner — pisahkan bila memungkinkan.
-- ============================================================
