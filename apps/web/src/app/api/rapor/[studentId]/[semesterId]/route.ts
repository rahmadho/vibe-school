import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { ambilDataRapor } from "@/lib/data/rapor";
import { buatRaporPdf, pdfKeBuffer } from "@/lib/rapor-pdf";
import { semesterTerpublikasi } from "@/lib/data/grade-publication";
import { namaBerkasRapor } from "@/lib/rapor-bentuk";
import { bolehFitur } from "@/lib/entitlement";

/**
 * ============================================================
 * UNDUH RAPOR  (GET /api/rapor/[studentId]/[semesterId])
 * ============================================================
 *
 * Siapa yang boleh mengunduh:
 *   1. Staf dengan izin `academic: read` untuk siswa DI SEKOLAHNYA.
 *   2. Siswa/orang tua — HANYA rapor anak yang terhubung ke akunnya.
 *
 * Aturan nomor 2 yang paling mudah salah. Rapor memuat SELURUH nilai seorang
 * anak. Tanpa pemeriksaan pemilik, seorang siswa bisa mengunduh rapor siswa
 * lain hanya dengan mengubah ID di URL.
 *
 * IDENTITAS SELALU DARI SESI, tidak pernah dari URL. URL hanya membawa
 * "apa yang mau dilihat", bukan "siapa yang melihat".
 */
export async function GET(
  _request: Request,
  {
    params,
  }: { params: Promise<{ studentId: string; semesterId: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Harus masuk." }, { status: 401 });
  }

  // Akun berpassword awal belum boleh mengunduh dokumen apa pun.
  if (session.user.mustChangePassword) {
    return NextResponse.json(
      { error: "Ganti password dulu sebelum mengunduh." },
      { status: 403 },
    );
  }

  const { studentId, semesterId } = await params;
  if (!studentId || !semesterId) {
    return NextResponse.json({ error: "Permintaan tidak lengkap." }, { status: 400 });
  }

  const role = session.user.role;
  let schoolId: string;

  if (role === "STUDENT" || role === "PARENT") {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { studentId: true, schoolId: true },
    });

    if (!user?.studentId || !user.schoolId) {
      return NextResponse.json(
        { error: "Akun belum terhubung ke siswa." },
        { status: 403 },
      );
    }

    // Rapor milik anak SENDIRI saja.
    if (user.studentId !== studentId) {
      // 404, bukan 403: membalas 403 sudah memberi tahu bahwa ID itu sah ada.
      return NextResponse.json({ error: "Rapor tidak ditemukan." }, { status: 404 });
    }

    schoolId = user.schoolId;

    // Fase 5: rapor hanya untuk semester yang sudah dipublikasikan sekolah.
    // 404 (bukan 403) agar tidak membocorkan bahwa rapor itu sudah dihitung.
    const terbit = await semesterTerpublikasi(studentId, schoolId);
    if (!terbit.has(semesterId)) {
      return NextResponse.json({ error: "Rapor belum dipublikasikan." }, { status: 404 });
    }
  } else {
    if (!session.user.schoolId) {
      return NextResponse.json({ error: "Sekolah tidak diketahui." }, { status: 403 });
    }
    if (!can(role, "academic", "read", session.user.permissions)) {
      return NextResponse.json({ error: "Tidak punya akses akademik." }, { status: 403 });
    }
    schoolId = session.user.schoolId;

    // Pastikan siswa ini memang milik sekolah staf tersebut.
    const siswaAda = await prisma.student.findFirst({
      where: { id: studentId, schoolId, deletedAt: null },
      select: { id: true },
    });
    if (!siswaAda) {
      return NextResponse.json({ error: "Siswa tidak ditemukan." }, { status: 404 });
    }
  }

  // Rapor PDF adalah fitur berbayar (paket Pro ke atas). Diperiksa SETELAH
  // kepemilikan siswa, supaya ID milik orang lain tetap 404 (tidak membocorkan
  // keberadaan siswa lewat pesan paket).
  //
  // 402 = "butuh pembayaran/upgrade", bukan 403: penggunanya punya izin, yang
  // kurang adalah paket. Klien bisa membedakan dan menampilkan ajakan upgrade.
  if (!(await bolehFitur(schoolId, "reportPdf"))) {
    return NextResponse.json(
      {
        error:
          "Paket langganan sekolah ini belum mencakup cetak Rapor PDF. " +
          "Hubungi admin sekolah untuk menaikkan paket.",
        kode: "FITUR_TIDAK_TERMASUK",
      },
      { status: 402 },
    );
  }

  const data = await ambilDataRapor({ schoolId, studentId, semesterId });
  if (!data) {
    return NextResponse.json(
      { error: "Data rapor tidak ditemukan." },
      { status: 404 },
    );
  }

  const doc = await buatRaporPdf({ data, dicetakPada: new Date() });
  const buffer = await pdfKeBuffer(doc);

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${namaBerkasRapor(data)}"`,
      // Rapor berisi data pribadi anak → jangan pernah di-cache bersama.
      "Cache-Control": "private, no-store",
    },
  });
}
