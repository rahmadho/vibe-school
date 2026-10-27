-- ============================================================
-- Jalur login lintas-tenant
-- ============================================================
--
-- MASALAH
-- `users` ikut RLS karena punya kolom schoolId. Saat login, sekolah pengguna
-- BELUM diketahui — justru itu yang sedang dicari. Tanpa konteks sekolah,
-- view `app.users` mengembalikan nol baris dan login selalu gagal
-- ("email atau password salah") padahal kredensialnya benar.
--
-- MENGAPA BUKAN MEMBUKA view users
-- Membuat `app.users` menampilkan semua baris akan mematikan isolasi tenant
-- untuk seluruh aplikasi hanya demi satu alur.
--
-- SOLUSI
-- Dua fungsi SECURITY DEFINER yang kembali PERSIS satu baris, berdasarkan
-- kunci unik (email, atau username + schoolId). Tidak ada endpoint yang bisa
-- memakainya untuk membaca daftar pengguna: tidak ada parameter "limit",
-- tidak ada pencarian bebas, dan hasilnya satu baris.
--
-- `passwordHash` ikut dikembalikan — hanya untuk dibandingkan di server, tidak
-- pernah dikirim ke klien.
--
-- ⚠️ Jalankan sebagai OWNER, SETELAH `rls-views.sql`.
--    psql "$OWNER_URL" -f prisma/login-functions.sql

BEGIN;

-- CREATE OR REPLACE menolak perubahan tipe kembalian; drop dulu agar skrip ini
-- idempoten walau definisi fungsinya berubah.
DROP FUNCTION IF EXISTS app_login_user_by_email(text);
DROP FUNCTION IF EXISTS app_login_user_by_username(text, text);

CREATE FUNCTION app_login_user_by_email(p_email text)
RETURNS TABLE (
  id text,
  "schoolId" text,
  email text,
  "passwordHash" text,
  name text,
  role text,
  "isActive" boolean,
  "mustChangePassword" boolean,
  "deletedAt" timestamptz
) AS $$
  SELECT u.id, u."schoolId", u.email, u."passwordHash", u.name, u.role,
         u."isActive", u."mustChangePassword", u."deletedAt"
  FROM data.users u
  WHERE lower(u.email) = lower(p_email)
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = data, public;

CREATE OR REPLACE FUNCTION app_login_user_by_username(p_username text, p_school_id text)
RETURNS TABLE (
  id text,
  "schoolId" text,
  email text,
  "passwordHash" text,
  name text,
  role text,
  "isActive" boolean,
  "mustChangePassword" boolean,
  "deletedAt" timestamptz
) AS $$
  SELECT u.id, u."schoolId", u.email, u."passwordHash", u.name, u.role,
         u."isActive", u."mustChangePassword", u."deletedAt"
  FROM data.users u
  WHERE u.username = p_username AND u."schoolId" = p_school_id
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = data, public;

-- Hanya role aplikasi yang boleh memanggil.
REVOKE ALL ON FUNCTION app_login_user_by_email(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_login_user_by_username(text, text) FROM PUBLIC;

COMMIT;
