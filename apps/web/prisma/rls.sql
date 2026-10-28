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
--
-- PENTING: tidak semua tabel punya kolom `schoolId` langsung. `parents`
-- (anak dari `students`) dan `semesters` (anak dari `academic_years`) memakai
-- kolom `studentId` / `academicYearId`. Memasukkan keduanya ke daftar kolom-
-- `schoolId` membuat SELURUH blok gagal dengan `column "schoolId" does not
-- exist`, dan RLS tidak pernah terpasang sama sekali — tanpa pesan yang jelas,
-- karena bloknya dijalankan dalam satu DO. Itu sebabnya keduanya dipisah.
--
-- `page_blocks` tidak ada di skema saat ini. Tabel yang tidak ada dilewati
-- otomatis (lihat `to_regclass`), jadi daftar ini boleh memuat nama lama.
DO $$
DECLARE
  t text;
  tgt regclass;
  tenant_tables text[] := ARRAY[
    'users','students','teachers','staffs','classes','subjects',
    'schedules','academic_years','time_slots','admission_batches',
    'registrations','attendances','grade_items','grades','report_cards',
    'fee_types','invoices','payment_methods','payments',
    -- Kwitansi: memuat nama, kelas, dan nominal yang dibayar satu keluarga.
    'receipts',
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
    -- plan_orders: pesanan paket langganan (termasuk tautan pembayaran).
    -- WAJIB terdaftar — tanpa RLS, satu query yang lupa memfilter schoolId
    -- cukup untuk membocorkan tautan pembayaran sekolah lain.
    'plan_orders',
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
    'ai_settings',
    -- Domain tambahan per sekolah, termasuk TOKEN verifikasi DNS. Bocor berarti
    -- sekolah lain bisa membaca token milik sekolah ini (dan menyiapkan record
    -- TXT atas namanya sendiri lebih dulu).
    'school_host_aliases',
    -- Fase 5: publikasi nilai. Bocor berarti sekolah lain tahu hasil akademik
    -- kelas ini dan bisa membatalkan/mengubah status publikasinya.
    'grade_publications'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    -- Tabel tenant hidup di schema `data` (lihat schema-layout.sql); sebagian
    -- kecil di `public`. Cari yang benar-benar ada, jangan menganggap `public`.
    tgt := COALESCE(
      to_regclass('data.' || quote_ident(t)),
      to_regclass('public.' || quote_ident(t)),
      to_regclass('app.'  || quote_ident(t))
    );

    -- Lewati tabel yang tidak ada di skema ini (daftar memuat nama historis).
    -- Tanpa ini, satu nama lama menggagalkan seluruh blok.
    IF tgt IS NULL THEN
      RAISE NOTICE 'RLS: tabel % dilewati (tidak ada)', t;
      CONTINUE;
    END IF;

    -- Lewati tabel yang memang tidak punya kolom schoolId (ditangani terpisah
    -- di bawah sebagai tabel anak).
    IF NOT EXISTS (
      SELECT 1 FROM pg_attribute
      WHERE attrelid = tgt AND attname = 'schoolId'
        AND attnum > 0 AND NOT attisdropped
    ) THEN
      RAISE NOTICE 'RLS: tabel % dilewati (tanpa kolom schoolId)', t;
      CONTINUE;
    END IF;

    -- Aktifkan RLS
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY;', tgt);

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

-- ---------- Tabel anak: sekolah lewat induknya ----------
-- `parents` dan `semesters` tidak menyimpan `schoolId`; kepemilikan sekolah
-- diturunkan lewat induknya (students / academic_years). Tanpa kebijakan di
-- sini, tabel ini terbuka penuh untuk semua sekolah — dan `parents` memuat
-- nama, nomor HP, NIK, dan KK orang tua murid.
--
-- Biaya: satu sub-select per baris. Keduanya kecil dan selalu diakses lewat
-- studentId / academicYearId yang berindeks, jadi praktis tidak terasa.
ALTER TABLE "data"."parents" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "data"."parents";
CREATE POLICY tenant_isolation ON "data"."parents"
  USING (EXISTS (
    SELECT 1 FROM "data"."students" s
    WHERE s."id" = "parents"."studentId"
      AND s."schoolId" = app_current_school_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM "data"."students" s
    WHERE s."id" = "parents"."studentId"
      AND s."schoolId" = app_current_school_id()
  ));

ALTER TABLE "data"."semesters" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "data"."semesters";
CREATE POLICY tenant_isolation ON "data"."semesters"
  USING (EXISTS (
    SELECT 1 FROM "data"."academic_years" y
    WHERE y."id" = "semesters"."academicYearId"
      AND y."schoolId" = app_current_school_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM "data"."academic_years" y
    WHERE y."id" = "semesters"."academicYearId"
      AND y."schoolId" = app_current_school_id()
  ));

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
