-- ============================================================
-- Row Level Security (RLS) — Jaring Pengaman Kedua Multi-Tenant
-- ============================================================
--
-- LAPIS PERTAMA: helper `scopedDb(schoolId)` di aplikasi (lihat src/lib/scoped-db.ts).
-- LAPIS KEDUA: RLS di PostgreSQL ini. Kalau ada query yang "lolos" tanpa filter,
--              RLS tetap menahan data sekolah lain.
--
-- ⚠️  PRASYARAT — BACA SEBELUM MENJALANKAN
--
--   1. Aplikasi harus terhubung sebagai role DB NON-OWNER dan NON-SUPERUSER.
--      Role pemilik tabel & SUPERUSER MEMBYPASS RLS sepenuhnya — kebijakan di
--      bawah ini akan terpasang tetapi TIDAK BEREFEK APA PUN.
--      Periksa:  SELECT current_user, usesuper FROM pg_user WHERE usename = current_user;
--      Periksa:  SELECT tablename, tableowner FROM pg_tables WHERE schemaname='public';
--
--   2. Setiap request WAJIB menyetel variabel sesi:
--        SELECT set_config('app.current_school_id', '<schoolId>', true);
--      Tanpa itu, `app_current_school_id()` bernilai NULL dan SETIAP query
--      mengembalikan NOL baris — aplikasi tampak "kosong", bukan error.
--      Pembungkus yang benar sudah ada: `withRls(schoolId, fn)` di
--      src/lib/rls-context.ts. Saat berkas ini ditulis, `withRls()` BELUM
--      dipanggil di mana pun, sehingga mengaktifkan RLS akan mengosongkan
--      seluruh halaman. Sambungkan dulu sebelum memasang kebijakan ini.
--
--   3. Bootstrap/migrasi boleh memakai owner; runtime memakai role terbatas.
--
-- Jalankan: psql "$OWNER_URL" -f prisma/rls.sql   (SETELAH grants.sql)
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
    'student_class_histories','subscriptions',
    -- Fase 8: web sekolah publik + SPMB multi-jalur.
    -- WAJIB ada di sini: ini lapisan pertahanan KEDUA. Kode sudah memfilter
    -- schoolId, tetapi RLS memastikan query yang lupa memfilter tetap tidak
    -- bisa membaca data sekolah lain — dan satu query yang lupa cukup untuk
    -- membocorkan nama serta nomor HP anak orang lain.
    'site_themes','site_configs','site_blocks','pages','page_blocks',
    'navigation_items','admission_paths',
    -- Fase 7 yang terlewat (ditemukan test tenant-isolation):
    -- wa_sessions memuat KREDENSIAL sesi WhatsApp satu sekolah — kebocoran
    -- di sini berarti sekolah lain bisa mengirim pesan atas nama sekolah itu.
    'message_templates','announcement_campaigns','wa_sessions',
    -- school_payment_gateways menyimpan KUNCI API gateway terenkripsi.
    'school_payment_gateways',
    -- Fase SMK/SMA: jurusan/peminatan, PKL, dan UKK.
    -- WAJIB terdaftar: data jurusan & nilai PKL adalah data akademik per
    -- sekolah. Tanpa RLS, satu query yang lupa memfilter schoolId cukup untuk
    -- membocorkan daftar siswa beserta nilai praktik kerjanya.
    'majors','internships','competency_tests',
    -- Pustaka media web sekolah. Berkas sekolah lain tidak boleh terlihat
    -- (nama berkas & URL-nya bisa menyingkap kegiatan internal sekolah).
    'media',
    -- Penimpaan izin per sekolah. Bocor berarti sekolah lain bisa melihat
    -- (atau menebak) pengaturan akses internal sekolah ini.
    'role_permissions',
    -- Pengaturan AI menyimpan KUNCI API terenkripsi per sekolah. Kebocoran di
    -- sini berarti sekolah lain bisa memakai kuota AI sekolah ini.
    'ai_settings'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    -- Aktifkan RLS
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);

    -- Kebijakan: hanya baris dengan schoolId = sesi saat ini.
    -- USING untuk SELECT/UPDATE/DELETE; WITH CHECK untuk INSERT/UPDATE.
    --
    -- Nama kolom HARUS "schoolId" berkutip: Prisma tidak mengubah nama kolom
    -- menjadi snake_case (hanya nama TABEL yang di-@@map). Versi sebelumnya
    -- memakai `school_id` dan seluruh blok gagal dengan
    -- `column "school_id" does not exist` — sehingga RLS tidak pernah terpasang.
    EXECUTE format($f$
      DROP POLICY IF EXISTS tenant_isolation ON %I;
      CREATE POLICY tenant_isolation ON %I
        USING ("schoolId" = app_current_school_id())
        WITH CHECK ("schoolId" = app_current_school_id());
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
