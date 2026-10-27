-- ============================================================
-- Pindahkan ENUM ke schema `app`
-- ============================================================
--
-- MASALAH
-- `DATABASE_URL` memakai `?schema=app`, jadi Prisma mengirim parameter bertipe
-- `app.UserRole`. Kolom asli bertipe `public.UserRole`. PostgreSQL menolak:
--
--   operator does not exist: public."UserRole" = "UserRole"
--
-- MENGAPA BUKAN MENYALIN ENUM
-- Menyalin menghasilkan dua tipe berbeda yang tidak bisa saling di-cast.
-- `ALTER TYPE ... SET SCHEMA` memindahkan SATU tipe yang sama, sehingga kolom
-- tabel, view, dan parameter Prisma semuanya merujuk tipe identik.
--
-- Sebelum skrip ini, `enum-copy.sql` mungkin sudah membuat duplikat di `app`.
-- Duplikat itu harus dibuang lebih dulu — kalau tidak, `SET SCHEMA` gagal
-- karena nama sudah dipakai.
--
-- ⚠️ URUTAN: jalankan sebagai OWNER, SEBELUM `rls-views.sql`.
--    psql "$OWNER_URL" -f prisma/enum-move.sql
--    psql "$OWNER_URL" -f prisma/rls-views.sql
--    psql "$OWNER_URL" -f prisma/rls-global-views.sql
--    psql "$OWNER_URL" -f prisma/login-functions.sql

BEGIN;

CREATE SCHEMA IF NOT EXISTS app;

DO $$
DECLARE
  r record;
  refcount int;
BEGIN
  FOR r IN
    SELECT t.typname
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typtype = 'e' AND n.nspname = 'public'
  LOOP
    -- 1. Buang duplikat di `app` (hasil enum-copy.sql) bila ada.
    IF EXISTS (
      SELECT 1 FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE t.typtype = 'e' AND n.nspname = 'app' AND t.typname = r.typname
    ) THEN
      -- Duplikat hanya boleh dibuang kalau tidak dipakai kolom mana pun selain
      -- view (view dibuat ulang oleh rls-views.sql).
      SELECT count(*) INTO refcount
      FROM pg_attribute a
      JOIN pg_class c ON c.oid = a.attrelid
      JOIN pg_namespace cn ON cn.oid = c.relnamespace
      JOIN pg_type ty ON ty.oid = a.atttypid
      JOIN pg_namespace tyn ON tyn.oid = ty.typnamespace
      WHERE tyn.nspname = 'app' AND ty.typname = r.typname
        AND cn.nspname = 'data' AND c.relkind = 'r';

      IF refcount > 0 THEN
        RAISE EXCEPTION
          'enum app.% masih dipakai % kolom tabel di schema data — tidak aman dipindah',
          r.typname, refcount;
      END IF;

      EXECUTE format('DROP TYPE app.%I', r.typname);
    END IF;

    -- 2. Pindahkan tipe asli. Kolom tabel & view ikut menunjuk tipe yang sama.
    EXECUTE format('ALTER TYPE public.%I SET SCHEMA app', r.typname);
  END LOOP;
END $$;

GRANT USAGE ON SCHEMA app TO PUBLIC;

COMMIT;
