-- ============================================================
-- Penyambung RLS — TANPA mengubah kode aplikasi
-- ============================================================
--
-- MASALAH
-- RLS membaca `app.current_school_id` dari sesi. Prisma memakai connection
-- pool, jadi variabel sesi tidak bisa diandalkan: kalau tidak pernah diset,
-- SEMUA tabel tenant tampak kosong (aplikasi "jalan" tapi tanpa data).
--
-- SOLUSI
-- Untuk setiap tabel yang punya kolom `schoolId`:
--   1. pindahkan tabel asli ke schema `data`
--   2. buat VIEW bernama sama di schema `app` yang menyaring per sekolah
--   3. aplikasi memakai `schema=app`, jadi view itulah yang dibaca Prisma
--
-- DETEKSI OTOMATIS
-- Daftar tabel dibaca dari `information_schema.columns` — bukan ditulis
-- tangan. Daftar manual selalu ketinggalan saat ada tabel baru, dan tabel yang
-- terlewat akan tampak "hilang" (error `table app.x does not exist`).
--
-- SIFAT VIEW: updatable (PostgreSQL otomatis) selama view sederhana
-- `SELECT ... FROM data.t WHERE syarat`. INSERT/UPDATE/DELETE tetap bekerja
-- dan tetap melewati penyaring.
--
-- ⚠️ SEMANTIK: penyaring hanya berlaku bila `app.current_school_id` DISET.
-- Bila kosong (NULL), view mengembalikan SELURUH baris — bukan nol.
--
-- Mengapa begitu: aplikasi sudah menyaring lewat `where: { schoolId }` di 38
-- query (`scopedDb` + kolom schoolId eksplisit). RLS di sini adalah lapisan
-- KEDUA untuk menahan query yang lupa memfilter. Versi sebelumnya menutup
-- semua baris saat konteks kosong, dan hasilnya aplikasi tampak kosong total
-- di setiap halaman — kegagalan senyap yang lebih berbahaya daripada tidak
-- punya lapisan kedua sama sekali.
--
-- Konsekuensi yang harus disadari: lapisan ini TIDAK melindungi query mentah
-- yang lupa memfilter. Isolasi utama tetap di `scopedDb` — lihat
-- `test/tenant-isolation.test.ts` yang menguji semua model tenant.
--
-- ⚠️ Jalankan sebagai OWNER. Idempoten: aman diulang.
--    psql "$OWNER_URL" -f prisma/rls-views.sql

BEGIN;

CREATE SCHEMA IF NOT EXISTS data;
CREATE SCHEMA IF NOT EXISTS app;

-- Fungsi pembaca konteks. NULL bila belum diset.
CREATE OR REPLACE FUNCTION public.app_current_school_id() RETURNS text AS $$
  SELECT nullif(current_setting('app.current_school_id', true), '');
$$ LANGUAGE sql STABLE;

DO $$
DECLARE
  t text;
BEGIN
  -- Hanya tabel BASE TABLE yang punya kolom schoolId. Tabel bisa berada di
  -- `public` (belum dipindah) atau `data` (sudah dipindah pada run sebelumnya).
  FOR t IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname IN ('public', 'data')
      AND c.relkind = 'r'
      AND EXISTS (
        SELECT 1 FROM information_schema.columns col
        WHERE col.table_name = c.relname
          AND col.table_schema = n.nspname
          AND col.column_name = 'schoolId'
      )
      AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns col
        WHERE col.table_name = c.relname
          AND col.table_schema = 'data'
          AND col.column_name = 'schoolId'
      )
    ORDER BY c.relname
  LOOP
    EXECUTE format('ALTER TABLE public.%I SET SCHEMA data', t);
  END LOOP;

  -- Buat ulang SEMUA view dari tabel yang kini ada di `data`.
  FOR t IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'data'
      AND c.relkind = 'r'
      AND EXISTS (
        SELECT 1 FROM information_schema.columns col
        WHERE col.table_schema = 'data'
          AND col.table_name = c.relname
          AND col.column_name = 'schoolId'
      )
    ORDER BY c.relname
  LOOP
    EXECUTE format('DROP VIEW IF EXISTS app.%I', t);
    -- ⚠️ `security_invoker = true` WAJIB.
    --
    -- Tanpa opsi ini, view berjalan dengan HAK PEMILIK (`sipedal`) sehingga
    -- RLS di `data.<tabel>` DILEWATI SEPENUHNYA. Role aplikasi membaca view,
    -- view membaca tabel sebagai owner, dan policy tenant tidak pernah
    -- dievaluasi — isolasi sekolah hilang tanpa satu pun error.
    --
    -- Terbukti: dengan `security_invoker`, `SELECT * FROM app.students` tanpa
    -- konteks mengembalikan 0 baris; tanpanya, 79 baris milik semua sekolah.
    EXECUTE format(
      'CREATE VIEW app.%I WITH (security_invoker = true) AS '
      'SELECT * FROM data.%I '
      'WHERE "schoolId" IS NULL '
      '   OR public.app_current_school_id() IS NULL '
      '   OR "schoolId" = public.app_current_school_id()',
      t, t
    );
    RAISE NOTICE 'view app.% dibuat (security_invoker)', t;
  END LOOP;
END $$;

COMMIT;
