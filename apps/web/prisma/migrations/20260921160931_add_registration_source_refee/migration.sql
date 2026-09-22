-- CreateEnum
CREATE TYPE "RegistrationSource" AS ENUM ('PUBLIC', 'WALK_IN', 'PHONE');

-- AlterTable
ALTER TABLE "registrations" ADD COLUMN     "reRegistrationFee" INTEGER,
ADD COLUMN     "source" "RegistrationSource" NOT NULL DEFAULT 'PUBLIC';
