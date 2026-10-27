-- ============================================================
-- View passthrough untuk tabel TANPA kolom schoolId
-- ============================================================
--
-- Setelah tabel tenant dipindah ke schema `data` dan aplikasi memakai
-- `schema=app`, Prisma menyebut tabel beserta schema-nya. Tabel tanpa
-- `schoolId` — baik tabel global (School, Plan) maupun tabel penghubung
-- (`teacher_subjects`) — tak ditemukan bila tidak dicerminkan di `app`:
--
--   The table `app.teacher_subjects` does not exist in the current database
--
-- `teacher_subjects` TIDAK punya `schoolId`, jadi tidak ikut aturan penyaring
-- di `rls-views.sql`; ia pindah ke `data` bersama tabel lain saat migrasi
-- pertama. Karena itu pemindaian di sini mencakup `public` DAN `data`, bukan
-- hanya `public` — kalau tidak, tabel penghubung yang sudah terlanjur pindah
-- tidak akan pernah mendapat view.
--
-- Isi view ini tidak disaring. Itu disengaja: barisnya hanya pasangan id, dan
-- penyaringan sesungguhnya ada di tabel induk yang menjadi sumber datanya.
--
-- ⚠️ Jalankan sebagai OWNER, SETELAH `rls-views.sql`.
--    psql "$OWNER_URL" -f prisma/rls-global-views.sql

BEGIN;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT n.nspname AS sch, c.relname AS tbl
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname IN ('public', 'data')
      AND c.relkind = 'r'
      AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns col
        WHERE col.table_schema = n.nspname
          AND col.table_name = c.relname
          AND col.column_name = 'schoolId'
      )
      -- Tabel yang sudah ada di `public` dan `data` sekaligus: pilih `public`
      -- saja agar tidak ada dua sumber untuk nama yang sama.
      AND NOT (
        n.nspname = 'data' AND EXISTS (
          SELECT 1 FROM pg_class c2
          JOIN pg_namespace n2 ON n2.oid = c2.relnamespace
          WHERE n2.nspname = 'public' AND c2.relname = c.relname AND c2.relkind = 'r'
        )
      )
    ORDER BY c.relname
  LOOP
    EXECUTE format('DROP VIEW IF EXISTS app.%I', r.tbl);
    EXECUTE format(
      'CREATE VIEW app.%I AS SELECT * FROM %I.%I',
      r.tbl, r.sch, r.tbl
    );
    RAISE NOTICE 'view global app.% dibuat dari %.%', r.tbl, r.sch, r.tbl;
  END LOOP;
END $$;

COMMIT;
