-- ============================================================
-- Fase 5: publikasi nilai per kelas per semester
-- ============================================================
-- Tabel baru saja; tidak menyentuh data lama.
-- WAJIB terdaftar di `tenant_tables` (prisma/rls.sql) dan TENANT_MODELS
-- (src/lib/scoped-db.ts) — kalau tidak, isolasi tenant bocor.

CREATE TYPE "GradePublicationStatus" AS ENUM ('DRAFT', 'PUBLISHED');

CREATE TABLE "grade_publications" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "semesterId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "status" "GradePublicationStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "publishedById" TEXT,
    "studentCount" INTEGER NOT NULL DEFAULT 0,
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grade_publications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "grade_publications_classId_semesterId_key"
    ON "grade_publications"("classId", "semesterId");
CREATE INDEX "grade_publications_schoolId_idx" ON "grade_publications"("schoolId");

ALTER TABLE "grade_publications" ADD CONSTRAINT "grade_publications_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
