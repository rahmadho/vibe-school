-- ============================================================
-- Hak akses untuk role aplikasi (NON-OWNER) — tanpa meta-command psql.
--
-- Dijalankan oleh bootstrap.sh sebagai OWNER. Karena itu role sasaran TIDAK
-- BOLEH `current_user` (itu akan memberi hak ke owner sendiri, bukan ke role
-- aplikasi) — melainkan dibaca dari parameter.
--
-- Parameter (bisa lewat env atau `SET`):
--   app.role  — nama role aplikasi, mis. `vibe`
--
-- Bila tidak diset, skrip jatuh ke role pemilik koneksi aktif di
-- pg_stat_activity? Tidak — itu rapuh. Lebih baik gagal keras dengan pesan
-- jelas daripada diam-diam tidak memberi hak apa pun (bug yang pernah lolos).
--
-- Cakupan: `public` (tabel global + fungsi login), `data` (tabel tenant),
-- `app` (view penyaring). Ketiganya wajib — tanpa `app`, semua query aplikasi
-- gagal `permission denied for view`.
-- ============================================================

BEGIN;

DO $$
DECLARE
  app_role text;
  r record;
BEGIN
  app_role := current_setting('app.role', true);

  IF app_role IS NULL OR app_role = '' THEN
    RAISE EXCEPTION
      'Parameter app.role kosong. Jalankan: SET app.role = ''vibe''; sebelum skrip ini.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = app_role) THEN
    RAISE EXCEPTION 'Role "%" tidak ada di database ini.', app_role;
  END IF;

  -- Schema: tanpa USAGE, semua isinya tak terlihat.
  EXECUTE format('GRANT USAGE ON SCHEMA public, data, app TO %I', app_role);

  -- Tabel di public & data.
  EXECUTE format(
    'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO %I', app_role);
  EXECUTE format(
    'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA data TO %I', app_role);
  EXECUTE format(
    'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO %I', app_role);
  EXECUTE format(
    'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA data TO %I', app_role);

  -- View di `app`. WAJIB terpisah: `ALL TABLES` tidak mencakup view.
  EXECUTE format(
    'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA app TO %I', app_role);

  -- Fungsi login (SECURITY DEFINER). Tanpa EXECUTE, login selalu gagal
  -- `permission denied for function`.
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname LIKE 'app_login%'
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO %I', r.sig, app_role);
  END LOOP;

  -- Tabel/sequence yang dibuat migrasi BERIKUTNYA otomatis bisa diakses.
  -- Tanpa ini, deploy yang menambah tabel baru langsung 42501.
  EXECUTE format(
    'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO %I', app_role);
  EXECUTE format(
    'ALTER DEFAULT PRIVILEGES IN SCHEMA data GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO %I', app_role);
  EXECUTE format(
    'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO %I', app_role);
  EXECUTE format(
    'ALTER DEFAULT PRIVILEGES IN SCHEMA data GRANT USAGE, SELECT ON SEQUENCES TO %I', app_role);

  RAISE NOTICE 'hak akses diberikan kepada role %', app_role;
END $$;

COMMIT;
