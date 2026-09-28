import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * ============================================================
 * PENERBITAN KWITANSI — idempotensi & penomoran
 * ============================================================
 *
 * Dua janji yang diuji:
 *  1. Menekan "Cetak" dua kali TIDAK menghasilkan dua nomor.
 *  2. Nomor urut tidak bolong & urut per bulan.
 *
 * Prisma ditiru supaya perilaku kunci (indeks unik `paymentId`) bisa
 * dibuktikan tanpa database.
 */

type Baris = {
  id: string;
  schoolId: string;
  paymentId: string;
  receiptNo: string;
  periodKey: string;
  amountPaid: number;
};

// "Database" tiruan — sengaja menyimpan baris agar penomoran bisa diuji.
let tabel: Baris[] = [];
let paymentAda: Record<string, unknown> | null = null;
let nomorBentrokSekali = false;

vi.mock("server-only", () => ({}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    receipt: {
      findFirst: ({ where }: { where: Record<string, unknown> }) => {
        const cocok = tabel.find(
          (b) =>
            b.schoolId === where.schoolId &&
            (where.paymentId === undefined || b.paymentId === where.paymentId) &&
            (where.id === undefined || b.id === where.id),
        );
        return Promise.resolve(
          cocok
            ? {
                id: cocok.id,
                receiptNo: cocok.receiptNo,
                amountPaid: cocok.amountPaid,
                methodName: null,
                paidAt: new Date(),
                note: null,
                cancelledAt: null,
                cancelReason: null,
                periodKey: cocok.periodKey,
              }
            : null,
        );
      },
      count: ({ where }: { where: Record<string, unknown> }) =>
        Promise.resolve(
          tabel.filter(
            (b) =>
              b.schoolId === where.schoolId && b.periodKey === where.periodKey,
          ).length,
        ),
      create: ({ data }: { data: Record<string, unknown> }) => {
        // Tiruan indeks unik paymentId.
        if (tabel.some((b) => b.paymentId === data.paymentId)) {
          const e = new Error("Unique constraint failed on paymentId");
          return Promise.reject(e);
        }
        // Sekali saja, tiru nomor bentrok untuk menguji percobaan ulang.
        if (nomorBentrokSekali) {
          nomorBentrokSekali = false;
          return Promise.reject(new Error("Unique constraint failed on receiptNo"));
        }
        if (tabel.some((b) => b.receiptNo === data.receiptNo && b.schoolId === data.schoolId)) {
          return Promise.reject(new Error("Unique constraint failed on receiptNo"));
        }
        const baris: Baris = {
          id: `rcp-${tabel.length + 1}`,
          schoolId: data.schoolId as string,
          paymentId: data.paymentId as string,
          receiptNo: data.receiptNo as string,
          periodKey: data.periodKey as string,
          amountPaid: data.amountPaid as number,
        };
        tabel.push(baris);
        return Promise.resolve({ id: baris.id, receiptNo: baris.receiptNo });
      },
      update: () => Promise.resolve({}),
    },
    payment: {
      findFirst: () => Promise.resolve(paymentAda),
    },
  },
}));

const { terbitkanKwitansi } = await import("@/lib/kwitansi");

function bayar(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: "pay-1",
    amount: 1_500_000,
    paidAt: new Date(2026, 8, 20),
    invoiceId: "inv-1",
    invoice: {
      id: "inv-1",
      invoiceNo: "INV/202609/0003",
      title: "SPP September 2026",
      studentId: "siswa-1",
    },
    method: { name: "Transfer BCA" },
    ...over,
  };
}

beforeEach(() => {
  tabel = [];
  paymentAda = bayar();
  nomorBentrokSekali = false;
});

describe("terbitkanKwitansi", () => {
  it("menerbitkan kwitansi dengan nomor bulan berjalan", async () => {
    const h = await terbitkanKwitansi({ schoolId: "s1", paymentId: "pay-1" });
    expect(h.ok).toBe(true);
    if (h.ok) {
      expect(h.receiptNo).toBe("KWT/202609/0001");
      expect(h.sudahAda).toBe(false);
    }
  });

  it("IDEMPOTEN: memanggil dua kali tidak membuat nomor kedua", async () => {
    const a = await terbitkanKwitansi({ schoolId: "s1", paymentId: "pay-1" });
    const b = await terbitkanKwitansi({ schoolId: "s1", paymentId: "pay-1" });

    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) {
      expect(b.receiptNo).toBe(a.receiptNo);
      expect(b.sudahAda).toBe(true);
    }
    // Yang paling penting: hanya SATU baris di database.
    expect(tabel.length).toBe(1);
  });

  it("nomor urut naik untuk pembayaran berbeda di bulan yang sama", async () => {
    paymentAda = bayar({ id: "pay-1" });
    const a = await terbitkanKwitansi({ schoolId: "s1", paymentId: "pay-1" });

    paymentAda = bayar({ id: "pay-2" });
    const b = await terbitkanKwitansi({ schoolId: "s1", paymentId: "pay-2" });

    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) {
      expect(a.receiptNo).toBe("KWT/202609/0001");
      expect(b.receiptNo).toBe("KWT/202609/0002");
    }
  });

  it("urutan nomor di-reset di bulan berikutnya", async () => {
    paymentAda = bayar({ id: "pay-1", paidAt: new Date(2026, 8, 20) });
    const sept = await terbitkanKwitansi({ schoolId: "s1", paymentId: "pay-1" });

    paymentAda = bayar({ id: "pay-2", paidAt: new Date(2026, 9, 3) });
    const okt = await terbitkanKwitansi({ schoolId: "s1", paymentId: "pay-2" });

    if (sept.ok && okt.ok) {
      expect(sept.receiptNo).toBe("KWT/202609/0001");
      expect(okt.receiptNo).toBe("KWT/202610/0001");
    }
  });

  it("nomor terpisah per sekolah — dua sekolah sama-sama mulai dari 0001", async () => {
    paymentAda = bayar({ id: "pay-1" });
    const a = await terbitkanKwitansi({ schoolId: "s1", paymentId: "pay-1" });

    paymentAda = bayar({ id: "pay-2" });
    const b = await terbitkanKwitansi({ schoolId: "s2", paymentId: "pay-2" });

    if (a.ok && b.ok) {
      expect(a.receiptNo).toBe("KWT/202609/0001");
      // Sekolah lain juga 0001 — penomoran milik masing-masing sekolah.
      expect(b.receiptNo).toBe("KWT/202609/0001");
    }
  });

  it("mencoba nomor berikutnya bila nomor bentrok (balapan)", async () => {
    // Tiruan menolak sekali dengan "receiptNo bentrok", meniru dua petugas
    // yang menekan cetak hampir bersamaan.
    nomorBentrokSekali = true;
    const h = await terbitkanKwitansi({ schoolId: "s1", paymentId: "pay-1" });
    expect(h.ok).toBe(true);
    if (h.ok) {
      // Nomor 0001 gagal → memakai 0002. Tidak ada dokumen bernomor ganda.
      expect(h.receiptNo).toBe("KWT/202609/0002");
    }
  });

  it("NOMOR TIDAK MELOMPATI saat nomor bentrok (regresi)", async () => {
    // Skenario nyata balapan: nomor 0002 sudah dipakai petugas lain SESUDAH
    // kita menghitung `count`, jadi percobaan pertama ditolak.
    // Bug lama: `count` dihitung ulang di dalam loop SAMBIL ditambah indeks
    // percobaan → penambahan terjadi dua kali → nomor melompati 0002 yang
    // sebenarnya belum terpakai (kwitansi bolong).
    paymentAda = bayar({ id: "pay-1" });
    const a = await terbitkanKwitansi({ schoolId: "s1", paymentId: "pay-1" });
    expect(a.ok && a.receiptNo === "KWT/202609/0001").toBe(true);

    // Petugas lain menerbitkan 0002 lebih dulu (di luar jalur ini).
    tabel.push({
      id: "rcp-lain",
      schoolId: "s1",
      paymentId: "pay-lain",
      receiptNo: "KWT/202609/0002",
      periodKey: "202609",
      amountPaid: 1,
    });

    // Namun kita masih memegang `count` lama (1) → mencoba 0002 → bentrok →
    // harus naik ke 0003, BUKAN melompat ke 0004.
    paymentAda = bayar({ id: "pay-3" });
    const b = await terbitkanKwitansi({ schoolId: "s1", paymentId: "pay-3" });

    expect(b.ok).toBe(true);
    if (b.ok) {
      expect(b.receiptNo).toBe("KWT/202609/0003");
    }

    // Deret nomor tetap rapat — tidak ada lubang.
    const nomor = tabel.map((t) => t.receiptNo).sort();
    expect(nomor).toEqual([
      "KWT/202609/0001",
      "KWT/202609/0002",
      "KWT/202609/0003",
    ]);
  });

  it("menolak pembayaran bernilai nol (tidak ada uang = tidak ada kwitansi)", async () => {
    paymentAda = bayar({ amount: 0 });
    const h = await terbitkanKwitansi({ schoolId: "s1", paymentId: "pay-1" });
    expect(h.ok).toBe(false);
    if (!h.ok) expect(h.error).toMatch(/nol/i);
    expect(tabel.length).toBe(0);
  });

  it("menolak pembayaran yang tidak ada di sekolah itu", async () => {
    paymentAda = null;
    const h = await terbitkanKwitansi({ schoolId: "s1", paymentId: "pay-x" });
    expect(h.ok).toBe(false);
    if (!h.ok) expect(h.error).toMatch(/tidak ditemukan/i);
  });
});
