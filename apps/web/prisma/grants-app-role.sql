-- ============================================================
-- Hak akses untuk role aplikasi (NON-OWNER) — versi tanpa meta-command psql.
--
-- Beda dengan grants.sql: berkas ini murni SQL, sehingga bisa dijalankan oleh
-- driver mana pun (termasuk `pg` di bootstrap.sh), tanpa `psql`.
--
-- Nama role TIDAK ditulis di sini. Skrip memakainya dari `current_user`
-- hanya bila dijalankan sebagai role aplikasi; pada bootstrap, nama role
-- dikirim lewat parameter `app_role`. Bila parameter kosong, dipakai nama
-- dari env `APP_DB_ROLE`.
--
-- Cakupan: `public` (tabel global + fungsi login) dan `data` (tabel tenant).
-- `app` berisi view; hak dibaca diberikan setelah view dibuat
-- (lihat rls-views.sql / bootstrap.sh yang menjalankan GRANT ulang).
-- ============================================================

BEGIN;

-- Sudah ada di prod? Tidak: `app` dibuat rls-views.sql. Grant di sini aman
-- walau belum ada isinya.
GRANT USAGE ON SCHEMA public, data, app TO current_user;

-- Tabel yang sudah ada.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO current_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA data   TO current_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO current_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA data   TO current_user;

-- Tabel yang dibuat KEMUDIAN (migrasi berikutnya) harus otomatis bisa diakses
-- role aplikasi, supaya deploy berikutnya tidak gagal `42501`.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO current_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA data
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO current_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO current_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA data
  GRANT USAGE, SELECT ON SEQUENCES TO current_user;

COMMIT;
