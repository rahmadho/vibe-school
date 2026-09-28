-- CreateTable
-- Kwitansi / nota pembayaran (lihat model Receipt di schema.prisma).
--
-- Nomor kwitansi disimpan sekali di sini (bukan dihitung saat cetak) supaya
-- tidak berubah/bolong. `paymentId` unik membuat penerbitan kwitansi
-- idempoten: satu pembayaran = satu kwitansi.

CREATE TABLE "receipts" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "receiptNo" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "amountPaid" INTEGER NOT NULL,
    "methodName" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "issuedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "periodKey" TEXT NOT NULL,

    CONSTRAINT "receipts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "receipts_paymentId_key" ON "receipts"("paymentId");
CREATE UNIQUE INDEX "receipts_schoolId_receiptNo_key" ON "receipts"("schoolId", "receiptNo");
CREATE INDEX "receipts_schoolId_periodKey_idx" ON "receipts"("schoolId", "periodKey");
CREATE INDEX "receipts_schoolId_studentId_idx" ON "receipts"("schoolId", "studentId");

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_paymentId_fkey"
  FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_issuedById_fkey"
  FOREIGN KEY ("issuedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
