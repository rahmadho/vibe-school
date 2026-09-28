import "server-only";
import { prisma } from "@/lib/prisma";
import {
  nomorKwitansi,
  periodeKwitansi,
} from "@/lib/kwitansi-murni";

/**
 * ============================================================
 * PENERBITAN KWITANSI
 * ============================================================
 *
 * Kwitansi adalah dokumen resmi. Dua janji yang harus dijaga berkas ini:
 *
 *  1. IDEMPOTEN — satu pembayaran hanya menghasilkan SATU nomor kwitansi,
 *     walau tombol cetak ditekan berkali-kali atau dua orang menekannya
 *     hampir bersamaan. Dijaga oleh `paymentId @unique`: percobaan kedua
 *     ditolak database, bukan oleh pemeriksaan "sudah ada belum" di
 *     aplikasi (pemeriksaan itu selalu bisa kalah balapan).
 *
 *  2. NOMOR TIDAK BOLONG — nomor urut dihitung per sekolah per bulan dari
 *     jumlah kwitansi yang sudah ada di periode itu. Karena penerbitan
 *     dibungkus transaksi, dua penerbitan bersamaan tidak akan mendapat
 *     nomor yang sama: yang kalah akan gagal pada indeks unik lalu dicoba
 *     ulang.
 */

export type HasilKwitansi =
  | { ok: true; id: string; receiptNo: string; sudahAda: boolean }
  | { ok: false; error: string };

/** Ambil kwitansi yang sudah ada untuk sebuah pembayaran (bila ada). */
export async function kwitansiPembayaran(schoolId: string, paymentId: string) {
  return prisma.receipt.findFirst({
    where: { schoolId, paymentId },
    select: {
      id: true,
      receiptNo: true,
      amountPaid: true,
      methodName: true,
      paidAt: true,
      note: true,
      cancelledAt: true,
      cancelReason: true,
      periodKey: true,
    },
  });
}

/**
 * Terbitkan kwitansi untuk sebuah pembayaran.
 *
 * Bila kwitansi sudah ada, mengembalikan yang lama (tidak membuat nomor baru).
 */
export async function terbitkanKwitansi(input: {
  schoolId: string;
  paymentId: string;
  userId?: string | null;
}): Promise<HasilKwitansi> {
  const { schoolId, paymentId, userId } = input;

  // Sudah pernah diterbitkan? Kembalikan yang lama — inilah perilaku
  // idempoten yang diinginkan pengguna: menekan "Cetak" dua kali tidak
  // menghasilkan dua dokumen bernomor berbeda.
  const lama = await kwitansiPembayaran(schoolId, paymentId);
  if (lama) {
    return {
      ok: true,
      id: lama.id,
      receiptNo: lama.receiptNo,
      sudahAda: true,
    };
  }

  // Ambil pembayaran + konteks untuk salinan nilai di kwitansi.
  const bayar = await prisma.payment.findFirst({
    where: { id: paymentId, schoolId },
    select: {
      id: true,
      amount: true,
      paidAt: true,
      invoiceId: true,
      invoice: {
        select: { id: true, invoiceNo: true, title: true, studentId: true },
      },
      method: { select: { name: true } },
    },
  });

  if (!bayar) return { ok: false, error: "Pembayaran tidak ditemukan." };
  if (bayar.amount <= 0) {
    return {
      ok: false,
      error: "Pembayaran bernilai nol tidak diterbitkan kwitansi.",
    };
  }

  const periode = periodeKwitansi(bayar.paidAt);

  // Nomor urut = jumlah kwitansi yang sudah ada di periode itu + 1.
  //
  // Penerbitan diulang bila terjadi balapan (dua petugas menekan "Cetak"
  // hampir bersamaan): yang kalah ditolak indeks unik `receiptNo`, lalu
  // mencoba nomor berikutnya.
  //
  // PENTING: nomor dihitung SEKALI dari jumlah yang ada, lalu dinaikkan
  // satu-satu HANYA saat gagal. Kalau `count` dihitung ulang di dalam loop
  // sambil ditambah `percobaan`, penambahan terjadi dua kali dan nomor bisa
  // MELOMPATI nomor yang belum terpakai — kwitansi sekolah jadi bolong.
  let nomorBerikut = (await prisma.receipt.count({
    where: { schoolId, periodKey: periode },
  })) + 1;

  // Disimpan supaya pesan galat terakhir bisa ditampilkan bila semua percobaan
  // habis — pesan asli database jauh lebih berguna daripada "gagal" generik.
  let terakhirError: unknown = null;

  for (let percobaan = 0; percobaan < 20; percobaan += 1) {
    const nomor = nomorKwitansi(periode, nomorBerikut);

    try {
      const dibuat = await prisma.receipt.create({
        data: {
          schoolId,
          receiptNo: nomor,
          paymentId,
          studentId: bayar.invoice.studentId,
          // Salinan nilai: kwitansi yang sudah dipegang orang tua tidak boleh
          // ikut berubah bila pembayaran dikoreksi belakangan.
          amountPaid: bayar.amount,
          methodName: bayar.method?.name ?? null,
          paidAt: bayar.paidAt,
          note: bayar.invoice.title,
          periodKey: periode,
          issuedById: userId ?? null,
        },
        select: { id: true, receiptNo: true },
      });

      return { ok: true, id: dibuat.id, receiptNo: dibuat.receiptNo, sudahAda: false };
    } catch (e) {
      // Dua kemungkinan: (a) paymentId sudah ada → kwitansi dibuat balapan,
      // ambil yang lama; (b) receiptNo bentrok → coba nomor berikutnya.
      const bentrokPembayaran = await kwitansiPembayaran(schoolId, paymentId);
      if (bentrokPembayaran) {
        return {
          ok: true,
          id: bentrokPembayaran.id,
          receiptNo: bentrokPembayaran.receiptNo,
          sudahAda: true,
        };
      }

      // Bukan karena paymentId — berarti nomornya yang bentrok. Naikkan nomor
      // supaya percobaan berikutnya benar-benar memakai nomor BARU. Tanpa
      // kenaikan ini, percobaan ulang mengulang nomor yang sama dan gagal
      // terus sampai batas percobaan habis.
      nomorBerikut += 1;
      terakhirError = e;
    }
  }

  return {
    ok: false,
    error:
      terakhirError instanceof Error
        ? `Gagal menerbitkan kwitansi: ${terakhirError.message}`
        : "Gagal menerbitkan kwitansi setelah beberapa percobaan.",
  };
}

/**
 * Batalkan kwitansi — TIDAK dihapus.
 *
 * Kwitansi batal tetap memakai nomornya supaya urutan nomor tidak bolong
 * tanpa penjelasan, dan supaya cetakan lama yang sudah dipegang orang tua
 * bisa dikenali sebagai batal.
 */
export async function batalkanKwitansi(input: {
  schoolId: string;
  receiptId: string;
  alasan: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { schoolId, receiptId, alasan } = input;

  const ada = await prisma.receipt.findFirst({
    where: { id: receiptId, schoolId },
    select: { id: true, cancelledAt: true },
  });
  if (!ada) return { ok: false, error: "Kwitansi tidak ditemukan." };
  if (ada.cancelledAt) return { ok: true }; // sudah batal, tidak apa-apa

  await prisma.receipt.update({
    where: { id: receiptId },
    data: { cancelledAt: new Date(), cancelReason: alasan.trim() || null },
  });

  return { ok: true };
}
