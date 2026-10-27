-- ============================================================
-- Pesanan paket langganan (plan_orders)
-- ============================================================
--
-- Tabel baru, tidak menyentuh data lama — aman dijalankan pada database
-- produksi yang sudah berisi sekolah dan langganan.
--
-- `provider` dan `externalId` sengaja NULLABLE:
--  - provider NULL  → pesanan MODE MANUAL (kredensial gateway belum ada).
--    Alur pembelian tidak boleh gagal hanya karena gateway belum siap.
--  - externalId NULL → belum ada order_id dari provider; banyak baris boleh
--    NULL sekaligus (PostgreSQL: NULL tidak saling bentrok pada UNIQUE).
--
-- Relasi ke users/user_id memakai ON DELETE SET NULL, bukan CASCADE: menghapus
-- akun admin tidak boleh ikut menghapus riwayat pesanan yang menjadi dasar
-- perpanjangan langganan.

-- ---------- Enum ----------
CREATE TYPE "PlanOrderStatus" AS ENUM ('PENDING', 'PAID', 'APPROVED', 'FAILED', 'EXPIRED', 'CANCELLED');

-- ---------- Tabel ----------
CREATE TABLE "plan_orders" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "requestedByUserId" TEXT,
    "months" INTEGER NOT NULL DEFAULT 12,
    "amount" INTEGER NOT NULL,
    "status" "PlanOrderStatus" NOT NULL DEFAULT 'PENDING',
    "provider" "GatewayProvider",
    "externalId" TEXT,
    "paymentLink" TEXT,
    "vaNumber" TEXT,
    "paidAt" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_orders_pkey" PRIMARY KEY ("id")
);

-- ---------- Kunci asing ----------
ALTER TABLE "plan_orders" ADD CONSTRAINT "plan_orders_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "plan_orders" ADD CONSTRAINT "plan_orders_planId_fkey"
  FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "plan_orders" ADD CONSTRAINT "plan_orders_requestedByUserId_fkey"
  FOREIGN KEY ("requestedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "plan_orders" ADD CONSTRAINT "plan_orders_approvedByUserId_fkey"
  FOREIGN KEY ("approvedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------- Indeks ----------
CREATE UNIQUE INDEX "plan_orders_externalId_key" ON "plan_orders"("externalId");
CREATE INDEX "plan_orders_schoolId_status_idx" ON "plan_orders"("schoolId", "status");
