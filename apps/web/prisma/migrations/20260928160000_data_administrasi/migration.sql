-- ============================================================
-- Data administrasi: NIK, alamat berjenjang, data orang tua
-- ============================================================
--
-- SEMUA kolom baru NULLABLE (kecuali `isKipRecipient` yang punya default).
--
-- Alasannya penting: sekolah yang sudah memakai aplikasi ini punya ribuan
-- baris siswa tanpa NIK dan tanpa alamat berjenjang. Kalau kolom dibuat
-- NOT NULL, migrasi ini GAGAL TOTAL dan sekolah tidak bisa memakai
-- aplikasinya sama sekali sampai datanya dilengkapi — padahal datanya
-- memang belum ada.
--
-- `address` LAMA tidak diubah artinya: tetap dipertahankan sebagai alamat
-- jalan. Kolom baru (village/district/city/province/postalCode) diisi
-- belakangan oleh sekolah. Tidak ada data lama yang hilang.

-- ---------- Enum baru ----------
CREATE TYPE "ResidenceType" AS ENUM ('BERSAMA_ORANG_TUA', 'BERSAMA_WALI', 'KOST', 'ASRAMA', 'PANTI_ASUH', 'LAINNYA');
CREATE TYPE "LivingWith" AS ENUM ('ORANG_TUA', 'WALI', 'SENDIRI', 'LAINNYA');
CREATE TYPE "Transportation" AS ENUM ('JALAN_KAKI', 'SEPEDA', 'SEPEDA_MOTOR', 'MOBIL_PRIBADI', 'ANTAR_JEMPUT', 'ANGKUTAN_UMUM', 'OJEK_ONLINE', 'PERAHU', 'LAINNYA');
CREATE TYPE "EducationLevel" AS ENUM ('TIDAK_SEKOLAH', 'SD', 'SMP', 'SMA_SMK', 'D1_D3', 'D4_S1', 'S2', 'S3');
CREATE TYPE "IncomeRange" AS ENUM ('TIDAK_BERPERGHASILAN', 'KURANG_1_JUTA', 'JUTA_1_2', 'JUTA_2_5', 'JUTA_5_10', 'LEBIH_10_JUTA');

-- ---------- Siswa ----------
ALTER TABLE "students" ADD COLUMN "nik" TEXT;
ALTER TABLE "students" ADD COLUMN "kkNumber" TEXT;
ALTER TABLE "students" ADD COLUMN "village" TEXT;
ALTER TABLE "students" ADD COLUMN "district" TEXT;
ALTER TABLE "students" ADD COLUMN "city" TEXT;
ALTER TABLE "students" ADD COLUMN "province" TEXT;
ALTER TABLE "students" ADD COLUMN "postalCode" TEXT;
ALTER TABLE "students" ADD COLUMN "villageCode" TEXT;
ALTER TABLE "students" ADD COLUMN "residenceType" "ResidenceType";
ALTER TABLE "students" ADD COLUMN "transportation" "Transportation";
ALTER TABLE "students" ADD COLUMN "distanceKm" INTEGER;
ALTER TABLE "students" ADD COLUMN "livingWith" "LivingWith";
ALTER TABLE "students" ADD COLUMN "bloodType" TEXT;
ALTER TABLE "students" ADD COLUMN "heightCm" INTEGER;
ALTER TABLE "students" ADD COLUMN "weightKg" INTEGER;
ALTER TABLE "students" ADD COLUMN "isKipRecipient" BOOLEAN NOT NULL DEFAULT false;

-- NIK harus unik PER SEKOLAH bila diisi (banyak NULL diizinkan PostgreSQL).
-- NIK adalah identitas tunggal penduduk, jadi dua siswa dengan NIK sama
-- di sekolah yang sama pasti salah input. Tanpa batasan ini, duplikat NIK
-- baru ketahuan saat sinkronisasi Dapodik gagal — jauh lebih sulit dilacak.
CREATE UNIQUE INDEX "students_schoolId_nik_key" ON "students"("schoolId", "nik");

-- Pencarian by NIK dipakai operator saat mencocokkan data.
CREATE INDEX "students_schoolId_nik_idx" ON "students"("schoolId", "nik");

-- ---------- Orang tua / wali ----------
ALTER TABLE "parents" ADD COLUMN "nik" TEXT;
ALTER TABLE "parents" ADD COLUMN "kkNumber" TEXT;
ALTER TABLE "parents" ADD COLUMN "education" "EducationLevel";
ALTER TABLE "parents" ADD COLUMN "incomeRange" "IncomeRange";
ALTER TABLE "parents" ADD COLUMN "monthlyIncome" INTEGER;
ALTER TABLE "parents" ADD COLUMN "birthYear" INTEGER;
