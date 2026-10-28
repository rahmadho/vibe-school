-- ============================================================
-- Bentangkan schema setelah `prisma migrate deploy` pada DB BARU.
--
-- MASALAH: `DATABASE_URL` memakai `?schema=app`, jadi Prisma membuat SELURUH
-- tabel & enum di `app`. Padahal arsitektur yang terbukti jalan memakai:
--   data   — tabel ber-`schoolId` (data milik sekolah)
--   public — tabel global tanpa `schoolId` + enum + fungsi login
--   app    — view penyaring tenant (dibuat rls-views.sql, BUKAN di sini)
--
-- Skrip ini memindahkannya SETELAH migrasi dan SEBELUM rls-views.sql.
-- Idempoten: pada DB yang sudah tertata, tidak ada yang berubah.
--
-- CATATAN enum: enum WAJIB pindah ke `public`, bukan `app`. Kalau enum ada di
-- `app` sedangkan tabel di `data`, kolomnya perlu cast dan view menjadi tidak
-- updatable. Prod memakai enum di `public` (lihat enum-move.sql).
-- ============================================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS app;
CREATE SCHEMA IF NOT EXISTS data;
CREATE SCHEMA IF NOT EXISTS public;

-- 1. Enum: app -> public. `SET SCHEMA` memindahkan tipe yang SAMA, jadi kolom
--    yang memakainya ikut valid tanpa perlu ubah apa pun.
DO $$
DECLARE r record; v record;
BEGIN
  FOR r IN
    SELECT t.typname
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typtype = 'e' AND n.nspname = 'app'
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE t.typtype = 'e' AND n.nspname = 'public' AND t.typname = r.typname
    ) THEN
      -- Sudah ada di public: buang yang di app, tapi hanya bila tidak dipakai
      -- kolom mana pun (tabel sudah lama memakai versi public).
      IF NOT EXISTS (
        SELECT 1 FROM pg_attribute a
        JOIN pg_class c ON c.oid = a.attrelid
        JOIN pg_namespace cn ON cn.oid = c.relnamespace
        JOIN pg_type ty ON ty.oid = a.atttypid
        JOIN pg_namespace tyn ON tyn.oid = ty.typnamespace
        WHERE tyn.nspname = 'app' AND ty.typname = r.typname AND cn.nspname = 'data'
      ) THEN
        EXECUTE format('DROP TYPE app.%I', r.typname);
      END IF;
    ELSE
      -- Enum dipakai kolom tabel LAIN (mis. data.teachers.role) dan view di
      -- `app`. Postgres menolak SET SCHEMA bila view di skema yang sama
      -- memakai tipe itu. Karena view di `app` masih lama/basi pada titik ini
      -- (rls-views.sql belum jalan), buang dulu — skrip itu membuatnya ulang.
      IF EXISTS (
        SELECT 1 FROM pg_depend d
        JOIN pg_rewrite w ON w.oid = d.objid
        JOIN pg_class c ON c.oid = w.ev_class
        JOIN pg_namespace cn ON cn.oid = c.relnamespace
        WHERE d.refobjid = (SELECT t2.oid FROM pg_type t2
                            JOIN pg_namespace n2 ON n2.oid = t2.typnamespace
                            WHERE n2.nspname = 'app' AND t2.typname = r.typname)
          AND cn.nspname = 'app'
      ) THEN
        FOR v IN
          SELECT c.relname FROM pg_depend d
          JOIN pg_rewrite w ON w.oid = d.objid
          JOIN pg_class c ON c.oid = w.ev_class
          JOIN pg_namespace cn ON cn.oid = c.relnamespace
          WHERE d.refobjid = (SELECT t2.oid FROM pg_type t2
                              JOIN pg_namespace n2 ON n2.oid = t2.typnamespace
                              WHERE n2.nspname = 'app' AND t2.typname = r.typname)
            AND cn.nspname = 'app'
        LOOP
          EXECUTE format('DROP VIEW IF EXISTS app.%I CASCADE', v.relname);
        END LOOP;
      END IF;
      EXECUTE format('ALTER TYPE app.%I SET SCHEMA public', r.typname);
    END IF;
  END LOOP;
END $$;

-- 2. Tabel ber-`schoolId` -> `data`. Daftar TIDAK di-hardcode: dibaca dari
--    katalog, sehingga model baru otomatis ikut tanpa menyunting skrip ini.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'app' AND c.relkind = 'r'
      AND EXISTS (
        SELECT 1 FROM pg_attribute a
        WHERE a.attrelid = c.oid AND a.attname = 'schoolId'
          AND a.attnum > 0 AND NOT a.attisdropped
      )
  LOOP
    EXECUTE format('ALTER TABLE app.%I SET SCHEMA data', r.relname);
  END LOOP;
END $$;

-- 3. Tabel TANPA `schoolId` -> `data`, KECUALI daftar `public` di bawah.
--
--    Awalnya aturannya "tanpa schoolId -> public", dan itu SALAH: produksi
--    menaruh sebagian tabel tanpa schoolId (parents, semesters,
--    teacher_subjects) di `data`. Mengikuti aturan lama membuat DB baru
--    berbeda tata letak dari produksi — persis jenis selisih yang baru
--    ketahuan saat deploy.
--
--    Daftar `public` mengikuti produksi apa adanya. Tabel baru tanpa
--    schoolId otomatis masuk `data`; pindahkan ke daftar ini HANYA bila
--    memang global lintas-sekolah.
DO $$
DECLARE
  r record;
  public_tables text[] := ARRAY[
    '_prisma_migrations',
    'announcement_reads',
    'invoice_items',
    'plans',
    'schools',
    'sessions'
  ];
BEGIN
  FOR r IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'app' AND c.relkind = 'r'
      AND NOT EXISTS (
        SELECT 1 FROM pg_attribute a
        WHERE a.attrelid = c.oid AND a.attname = 'schoolId'
          AND a.attnum > 0 AND NOT a.attisdropped
      )
  LOOP
    IF r.relname = ANY (public_tables) THEN
      EXECUTE format('ALTER TABLE app.%I SET SCHEMA public', r.relname);
    ELSE
      EXECUTE format('ALTER TABLE app.%I SET SCHEMA data', r.relname);
    END IF;
  END LOOP;
END $$;

COMMIT;
