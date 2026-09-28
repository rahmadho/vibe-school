-- AlterTable
-- Tambahan untuk Portal Orang Tua & Siswa.
--
-- `username`  : login alternatif, diisi NIS untuk akun siswa/wali.
-- `mustChangePassword` : akun yang dibuat massal (password awal seragam)
--               wajib mengganti password sebelum memakai aplikasi.
--
-- Keduanya nullable / punya default sehingga data lama aman tanpa backfill.
-- (Diuji: tabel users sudah ada sejak migrasi pertama.)

ALTER TABLE "users" ADD COLUMN "username" TEXT;
ALTER TABLE "users" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
-- Keunikan per sekolah, BUKAN global: NIS "2024001" bisa ada di beberapa
-- sekolah sekaligus.
--
-- Catatan penting: PostgreSQL memperlakukan NULL sebagai nilai yang berbeda,
-- jadi baris dengan username NULL (semua akun lama & super-admin) TIDAK saling
-- bentrok walaupun indeksnya unik biasa. Tidak perlu indeks parsial —
-- dan memang Prisma 5 tidak mendukungnya di schema.
CREATE UNIQUE INDEX "users_schoolId_username_key"
  ON "users"("schoolId", "username");
