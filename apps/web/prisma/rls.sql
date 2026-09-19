-- ============================================================
-- Row Level Security (RLS) — Jaring Pengaman Kedua Multi-Tenant
-- ============================================================
--
-- LAPIS PERTAMA: helper `scopedDb(schoolId)` di aplikasi (lihat src/lib/scoped-db.ts).
-- LAPIS KEDUA: RLS di PostgreSQL ini. Kalau ada query yang "lolos" tanpa filter,
--              RLS tetap menahan data sekolah lain.
--
-- CARA PAKAI:
--   Aplikasi harus terhubung sebagai role DB NON-OWNER dan NON-SUPERUSER.
--   Setiap request set variabel sesi:
--     SET LOCAL app.current_school_id = '<schoolId>';
--   (dilakukan oleh wrapper koneksi / Prisma middleware di produksi)
--
-- CATATAN KEAMANAN:
--   - Role pemilik tabel & SUPERUSER MEMBYPASS RLS. Jangan pakai role itu untuk
--     koneksi aplikasi di produksi.
--   - Bootstrap/migrasi boleh pakai owner; runtime aplikasi gunakan role terbatas.
--
-- Jalankan: npx prisma migrate dev --name rls   (setelah migration utama)
-- atau:     psql $DATABASE_URL -f prisma/rls.sql
-- ============================================================

-- Helper: ambil schoolId dari sesi. NULL bila tidak diset.
CREATE OR REPLACE FUNCTION app_current_school_id() RETURNS text AS $$
  SELECT nullif(current_setting('app.current_school_id', true), '');
$$ LANGUAGE sql STABLE;

-- Daftar tabel tenant yang diberi RLS.
DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY[
    'users','students','parents','teachers','staffs','classes','subjects',
    'schedules','academic_years','semesters','time_slots','admission_batches',
    'registrations','attendances','grade_items','grades','report_cards',
    'fee_types','invoices','payment_methods','payments',
    'payment_gateway_transactions','posts','announcements',
    'notification_templates','notification_queue','audit_logs',
    'student_class_histories','subscriptions'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    -- Aktifkan RLS
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);

    -- Kebijakan: hanya baris dengan schoolId = sesi saat ini.
    -- USING untuk SELECT/UPDATE/DELETE; WITH CHECK untuk INSERT/UPDATE.
    EXECUTE format($f$
      DROP POLICY IF EXISTS tenant_isolation ON %I;
      CREATE POLICY tenant_isolation ON %I
        USING (school_id = app_current_school_id())
        WITH CHECK (school_id = app_current_school_id());
    $f$, t, t);
  END LOOP;
END $$;

-- ============================================================
-- Model GLOBAL (schools, plans) TIDAK diberi RLS — dikelola SUPER_ADMIN
-- lewat jalur aplikasi khusus (lihat `unscoped()` di scoped-db.ts).
-- Bila ingin mengunci juga, buat kebijakan berbasis role:
--
--   ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
--   CREATE POLICY super_admin_only ON schools
--     USING (current_setting('app.is_super_admin', true) = 'true');
-- ============================================================

-- ============================================================
-- Cara aplikasi set konteks tiap request (contoh Prisma):
--
--   await prisma.$executeRawUnsafe(
--     `SET LOCAL app.current_school_id = '${schoolId}'`
--   );
--
-- Idealnya dilakukan otomatis via Prisma Client Extension `$extends` pada
-- `query` hook, agar setiap query berjalan dalam transaksi dengan setting
-- ini. Implementasi lengkap ada di src/lib/rls-context.ts.
-- ============================================================
