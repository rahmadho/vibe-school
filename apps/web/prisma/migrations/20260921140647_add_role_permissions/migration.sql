-- CreateTable
CREATE TABLE "role_permissions" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "module" TEXT NOT NULL,
    "actions" TEXT[],
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "role_permissions_schoolId_role_idx" ON "role_permissions"("schoolId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_schoolId_role_module_key" ON "role_permissions"("schoolId", "role", "module");

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
