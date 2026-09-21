-- CreateEnum
CREATE TYPE "SubjectGroup" AS ENUM ('UMUM', 'PEMINATAN', 'KEJURUAN', 'MUATAN_LOKAL');

-- CreateEnum
CREATE TYPE "InternshipStatus" AS ENUM ('PLANNED', 'ONGOING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CompetencyResult" AS ENUM ('COMPETENT', 'NOT_COMPETENT');

-- AlterEnum
ALTER TYPE "SchoolLevel" ADD VALUE 'MAK';

-- AlterTable
ALTER TABLE "classes" ADD COLUMN     "majorId" TEXT;

-- AlterTable
ALTER TABLE "registrations" ADD COLUMN     "majorId" TEXT;

-- AlterTable
ALTER TABLE "students" ADD COLUMN     "majorId" TEXT;

-- AlterTable
ALTER TABLE "subjects" ADD COLUMN     "group" "SubjectGroup" NOT NULL DEFAULT 'UMUM',
ADD COLUMN     "majorId" TEXT;

-- CreateTable
CREATE TABLE "majors" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "headTeacherId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "majors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "internships" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "teacherId" TEXT,
    "industryName" TEXT NOT NULL,
    "industryAddress" TEXT,
    "industryPhone" TEXT,
    "supervisorName" TEXT,
    "supervisorPhone" TEXT,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "status" "InternshipStatus" NOT NULL DEFAULT 'PLANNED',
    "score" INTEGER,
    "certificateNo" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "internships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competency_tests" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "majorId" TEXT NOT NULL,
    "examinerName" TEXT NOT NULL,
    "examinerOrg" TEXT,
    "testDate" DATE NOT NULL,
    "result" "CompetencyResult" NOT NULL,
    "score" INTEGER,
    "certificateNo" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "competency_tests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "majors_schoolId_idx" ON "majors"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "majors_schoolId_code_key" ON "majors"("schoolId", "code");

-- CreateIndex
CREATE INDEX "internships_schoolId_academicYearId_idx" ON "internships"("schoolId", "academicYearId");

-- CreateIndex
CREATE INDEX "internships_studentId_idx" ON "internships"("studentId");

-- CreateIndex
CREATE INDEX "competency_tests_schoolId_academicYearId_idx" ON "competency_tests"("schoolId", "academicYearId");

-- CreateIndex
CREATE INDEX "competency_tests_studentId_idx" ON "competency_tests"("studentId");

-- AddForeignKey
ALTER TABLE "majors" ADD CONSTRAINT "majors_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "majors" ADD CONSTRAINT "majors_headTeacherId_fkey" FOREIGN KEY ("headTeacherId") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_majorId_fkey" FOREIGN KEY ("majorId") REFERENCES "majors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_majorId_fkey" FOREIGN KEY ("majorId") REFERENCES "majors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_majorId_fkey" FOREIGN KEY ("majorId") REFERENCES "majors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_majorId_fkey" FOREIGN KEY ("majorId") REFERENCES "majors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internships" ADD CONSTRAINT "internships_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internships" ADD CONSTRAINT "internships_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internships" ADD CONSTRAINT "internships_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internships" ADD CONSTRAINT "internships_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_tests" ADD CONSTRAINT "competency_tests_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_tests" ADD CONSTRAINT "competency_tests_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_tests" ADD CONSTRAINT "competency_tests_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_tests" ADD CONSTRAINT "competency_tests_majorId_fkey" FOREIGN KEY ("majorId") REFERENCES "majors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
