-- ============================================================
-- Verifikasi kepemilikan domain (DNS TXT) + multi-domain per sekolah
-- ============================================================
--
-- Dua perubahan, keduanya AMAN pada database produksi yang sudah berisi data:
--  1. Kolom verifikasi pada `schools` — semuanya NULLABLE atau ber-DEFAULT,
--     sehingga baris lama langsung sah tanpa backfill. Status lama otomatis
--     UNVERIFIED: BETUL, karena domain yang dulu diketik bebas tanpa bukti
--     memang belum terbukti milik siapa pun.
--  2. Tabel baru `school_host_aliases` — tidak menyentuh data lama.
--
-- `School.customDomain` TETAP dipertahankan sebagai domain UTAMA.

-- ---------- Enum ----------
CREATE TYPE "DomainVerifyStatus" AS ENUM ('UNVERIFIED', 'PENDING', 'VERIFIED', 'FAILED');

-- ---------- Kolom verifikasi pada schools ----------
ALTER TABLE "schools" ADD COLUMN "domainVerifyToken" TEXT;
ALTER TABLE "schools" ADD COLUMN "domainVerifyStatus" "DomainVerifyStatus" NOT NULL DEFAULT 'UNVERIFIED';
ALTER TABLE "schools" ADD COLUMN "domainVerifiedAt" TIMESTAMP(3);
ALTER TABLE "schools" ADD COLUMN "domainVerifyAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "schools" ADD COLUMN "domainVerifyLastError" TEXT;
ALTER TABLE "schools" ADD COLUMN "domainVerifyCheckedAt" TIMESTAMP(3);

-- ---------- Tabel domain tambahan ----------
CREATE TABLE "school_host_aliases" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "verifyStatus" "DomainVerifyStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "verifyToken" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "checkedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "school_host_aliases_pkey" PRIMARY KEY ("id")
);

-- ON DELETE CASCADE: domain tambahan tidak punya arti tanpa sekolahnya, dan
-- barisnya tidak memuat data yang perlu diaudit setelah sekolah dihapus
-- (sekolah sendiri memakai soft delete; CASCADE hanya untuk hard delete).
ALTER TABLE "school_host_aliases" ADD CONSTRAINT "school_host_aliases_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Satu host hanya boleh milik SATU sekolah. Ini yang mencegah dua sekolah
-- memperebutkan domain yang sama pada tingkat database.
CREATE UNIQUE INDEX "school_host_aliases_host_key" ON "school_host_aliases"("host");
CREATE INDEX "school_host_aliases_schoolId_idx" ON "school_host_aliases"("schoolId");
