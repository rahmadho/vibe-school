import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { terbitkanKwitansi } from "@/lib/kwitansi";
import {
  buatKwitansiPdf,
  pdfKeBuffer,
  type KopSekolah,
} from "@/lib/kwitansi-pdf";
import { tanggalIndonesia } from "@/lib/kwitansi-murni";

/**
 * ============================================================
 * UNDUH / CETAK KWITANSI  (GET /api/kwitansi/[paymentId])
 * ============================================================
 *
 * Siapa yang boleh mengunduh:
 *   1. Staf dengan izin `finance: read` untuk pembayaran di SEKOLAHNYA.
 *   2. Siswa/orang tua — HANYA untuk pembayaran milik anaknya sendiri.
 *
 * Aturan nomor 2 adalah yang paling mudah salah. Akun siswa memakai ID
 * pembayaran di URL, dan ID itu berpola teratur. Tanpa pemeriksaan pemilik,
 * seorang siswa bisa mengunduh kwitansi siswa lain hanya dengan mengubah URL —
 * dan kwitansi memuat nama, kelas, dan nominal tagihan keluarga lain.
 *
 * Kwitansi DITERBITKAN saat pertama diunduh (nomor dikunci di DB), lalu
 * dipakai ulang untuk unduhan berikutnya.
 */

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ paymentId: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Harus masuk." }, { status: 401 });
  }

  // Akun dengan password awal belum boleh mengunduh dokumen apa pun.
  if (session.user.mustChangePassword) {
    return NextResponse.json(
      { error: "Ganti password dulu sebelum mengunduh." },
      { status: 403 },
    );
  }

  const { paymentId } = await params;
  if (!paymentId) {
    return NextResponse.json({ error: "ID pembayaran kosong." }, { status: 400 });
  }

  const role = session.user.role;

  /* ---------- Tentukan pembayaran mana yang boleh dilihat ---------- */

  let schoolId: string;

  if (role === "STUDENT" || role === "PARENT") {
    // Jalur portal: schoolId dari SESI (bukan dari URL), dan pembayaran harus
    // milik siswa yang terhubung ke akun ini.
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { studentId: true, schoolId: true },
    });
    if (!user?.studentId || !user.schoolId) {
      return NextResponse.json({ error: "Akun belum terhubung ke siswa." }, { status: 403 });
    }

    const milikSendiri = await prisma.payment.findFirst({
      where: {
        id: paymentId,
        schoolId: user.schoolId,
        invoice: { studentId: user.studentId },
      },
      select: { id: true },
    });
    if (!milikSendiri) {
      // Sengaja 404, bukan 403: memberi tahu "ada tapi bukan milikmu" sudah
      // membocorkan bahwa ID itu sah ada.
      return NextResponse.json({ error: "Kwitansi tidak ditemukan." }, { status: 404 });
    }

    schoolId = user.schoolId;
  } else {
    // Jalur staf: wajib punya izin baca keuangan di sekolahnya.
    if (!session.user.schoolId) {
      return NextResponse.json({ error: "Sekolah tidak diketahui." }, { status: 403 });
    }
    if (!can(role, "finance", "read", session.user.permissions)) {
      return NextResponse.json({ error: "Tidak punya akses keuangan." }, { status: 403 });
    }
    schoolId = session.user.schoolId;

    const ada = await prisma.payment.findFirst({
      where: { id: paymentId, schoolId },
      select: { id: true },
    });
    if (!ada) {
      return NextResponse.json({ error: "Pembayaran tidak ditemukan." }, { status: 404 });
    }
  }

  /* ---------- Terbitkan (sekali) lalu susun PDF ---------- */

  const terbit = await terbitkanKwitansi({
    schoolId,
    paymentId,
    userId: session.user.id,
  });
  if (!terbit.ok) {
    return NextResponse.json({ error: terbit.error }, { status: 400 });
  }

  const kwitansi = await prisma.receipt.findFirst({
    where: { id: terbit.id, schoolId },
    select: {
      receiptNo: true,
      amountPaid: true,
      methodName: true,
      paidAt: true,
      note: true,
      cancelledAt: true,
      cancelReason: true,
      student: {
        select: {
          fullName: true,
          nis: true,
          class: { select: { name: true } },
          parents: {
            where: { isPrimary: true },
            select: { fullName: true },
            take: 1,
          },
        },
      },
      payment: {
        select: {
          reference: true,
          invoice: { select: { invoiceNo: true, title: true } },
        },
      },
    },
  });

  if (!kwitansi) {
    return NextResponse.json({ error: "Kwitansi tidak ditemukan." }, { status: 404 });
  }

  const sekolah = await prisma.school.findUnique({
    where: { id: schoolId },
    select: {
      name: true,
      npsn: true,
      address: true,
      phone: true,
      email: true,
      logoUrl: true,
    },
  });

  // Penanda tangan: cari staf berjabatan bendahara; bila tidak ada, kwitansi
  // tetap dicetak tanpa nama penandatangan (lebih baik daripada gagal).
  const bendahara = await prisma.staff.findFirst({
    where: {
      schoolId,
      deletedAt: null,
      isActive: true,
      position: { contains: "bendahara", mode: "insensitive" },
    },
    select: { fullName: true, position: true, nip: true },
  });

  const kop: KopSekolah = {
    name: sekolah?.name ?? "Sekolah",
    npsn: sekolah?.npsn ?? null,
    address: sekolah?.address ?? null,
    phone: sekolah?.phone ?? null,
    email: sekolah?.email ?? null,
    logoUrl: sekolah?.logoUrl ?? null,
  };

  const doc = buatKwitansiPdf({
    sekolah: kop,
    receiptNo: kwitansi.receiptNo,
    tanggal: kwitansi.paidAt,
    namaSiswa: kwitansi.student.fullName,
    nisSiswa: kwitansi.student.nis,
    kelasSiswa: kwitansi.student.class?.name ?? null,
    jumlah: kwitansi.amountPaid,
    dariNama: kwitansi.student.parents[0]?.fullName ?? null,
    keterangan:
      kwitansi.note ??
      `${kwitansi.payment.invoice.title} — ${kwitansi.payment.invoice.invoiceNo}`,
    metode: kwitansi.methodName,
    referensi: kwitansi.payment.reference,
    penandatangan: bendahara
      ? {
          nama: bendahara.fullName,
          jabatan: bendahara.position ?? "Bendahara",
          nip: bendahara.nip,
        }
      : null,
    cancelledAt: kwitansi.cancelledAt,
    cancelReason: kwitansi.cancelReason,
  });

  const buffer = await pdfKeBuffer(doc);

  // Nama berkas memakai nomor kwitansi supaya bendahara mudah mencarinya lagi.
  const namaBerkas = `${kwitansi.receiptNo.replace(/\//g, "-")}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      // `inline` membuka pratinjau di peramban (lebih sering diinginkan
      // daripada langsung terunduh); pengguna tetap bisa menyimpan dari sana.
      "Content-Disposition": `inline; filename="${namaBerkas}"`,
      "Cache-Control": "private, no-store",
      // Jejak bahwa dokumen pernah dicetak — berguna saat menelusuri
      // perselisihan pembayaran.
      "X-Kwitansi-No": kwitansi.receiptNo,
      "X-Kwitansi-Tanggal": tanggalIndonesia(kwitansi.paidAt),
    },
  });
}
