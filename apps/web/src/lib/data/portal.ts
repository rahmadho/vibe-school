import "server-only";
import { prisma } from "@/lib/prisma";
import { semesterTerpublikasi } from "@/lib/data/grade-publication";

/**
 * ============================================================
 * DATA PORTAL SISWA & ORANG TUA
 * ============================================================
 *
 * ATURAN WAJIB untuk seluruh berkas ini:
 *   Setiap fungsi menerima `studentId` dan `schoolId` dari `wajibKonteksPortal()`
 *   — yang berasal dari SESI, bukan dari URL. Tidak ada satu pun fungsi di sini
 *   yang boleh menerima studentId langsung dari parameter halaman.
 *
 * Ini lapisan kedua di atas RLS: walaupun RLS memisahkan sekolah, di dalam
 * satu sekolah masih ada banyak siswa. Tanpa pengikatan ke studentId sesi,
 * seorang siswa bisa membaca nilai siswa lain di sekolah yang sama.
 *
 * CATATAN nama field (dicek dari schema.prisma, bukan ditebak):
 *   Grade.score / recordedAt (bukan createdAt untuk waktu penilaian)
 *   Post.isPublished (Boolean) + publishedAt — BUKAN `status: "PUBLISHED"`
 *   Payment.reference (bukan referenceNo), Payment terhubung lewat invoiceId
 *   Schedule.dayOfWeek (Int 1..7) + timeSlot.slotNumber
 *   ReportCard.semesterId (tidak ada relasi `semester` yang di-select langsung)
 */

/** Ringkasan untuk beranda portal. */
export async function ringkasanPortal(studentId: string, schoolId: string) {
  const [nilaiTerakhir, kehadiranBulanIni, tagihanBelumLunas, pengumuman] =
    await Promise.all([
      // Nilai terbaru (5 baris) — siswa melihat perkembangan terakhirnya.
      prisma.grade.findMany({
        where: { studentId, schoolId },
        orderBy: { recordedAt: "desc" },
        take: 5,
        select: {
          id: true,
          score: true,
          recordedAt: true,
          subject: { select: { name: true } },
          gradeItem: { select: { name: true } },
        },
      }),

      // Rekap kehadiran bulan berjalan.
      prisma.attendance.groupBy({
        by: ["status"],
        where: {
          studentId,
          schoolId,
          date: { gte: awalBulanIni() },
        },
        _count: { _all: true },
      }),

      // Tagihan yang belum lunas.
      prisma.invoice.findMany({
        where: {
          studentId,
          schoolId,
          status: { in: ["UNPAID", "PARTIAL", "OVERDUE"] },
          deletedAt: null,
        },
        orderBy: { dueDate: "asc" },
        select: {
          id: true,
          invoiceNo: true,
          title: true,
          dueDate: true,
          totalAmount: true,
          paidAmount: true,
          status: true,
        },
      }),

      // Pengumuman terbaru sekolah.
      prisma.post.findMany({
        where: { schoolId, isPublished: true, deletedAt: null },
        orderBy: { publishedAt: "desc" },
        take: 3,
        select: { id: true, title: true, slug: true, publishedAt: true },
      }),
    ]);

  const totalTagihan = tagihanBelumLunas.reduce(
    (n, t) => n + (t.totalAmount - t.paidAmount),
    0,
  );

  const hadir =
    kehadiranBulanIni.find((k) => k.status === "PRESENT")?._count._all ?? 0;
  const totalHadir = kehadiranBulanIni.reduce((n, k) => n + k._count._all, 0);

  return {
    nilaiTerakhir,
    kehadiran: { hadir, total: totalHadir },
    tagihanBelumLunas,
    totalTagihan,
    pengumuman,
  };
}

/** Nilai siswa, dikelompokkan per mata pelajaran. */
export async function nilaiPortal(studentId: string, schoolId: string) {
  // Fase 5: portal hanya menampilkan nilai semester yang SUDAH dipublikasikan
  // sekolah. Nilai yang masih digodok guru tidak boleh bocor ke orang tua.
  // `nilai` (Grade) tidak selalu punya semesterId — selalu ditampilkan sebagai
  // "nilai berjalan"; `rapor` (ReportCard, nilai akhir) digerbangi publikasi.
  const terbit = await semesterTerpublikasi(studentId, schoolId);
  const [nilai, rapor] = await Promise.all([
    prisma.grade.findMany({
      where: { studentId, schoolId },
      orderBy: [{ subject: { name: "asc" } }, { recordedAt: "desc" }],
      select: {
        id: true,
        score: true,
        note: true,
        recordedAt: true,
        subject: { select: { id: true, name: true } },
        gradeItem: { select: { name: true, weight: true } },
      },
    }),

    // Rapor (kalau sudah dihitung) — sumber unduhan PDF nanti.
    // ReportCard hanya punya subjectId (bukan relasi `subject`), jadi nama
    // mapel diambil terpisah di bawah.
    prisma.reportCard.findMany({
      where: { studentId, schoolId, semesterId: { in: [...terbit] } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        finalScore: true,
        predicate: true,
        note: true,
        semesterId: true,
        subjectId: true,
      },
    }),
  ]);

  // Lengkapi nama mapel & semester untuk rapor (hindari select relasi yang
  // tidak ada di schema).
  const mapelIds = [...new Set(rapor.map((r) => r.subjectId))];
  const semesterIds = [...new Set(rapor.map((r) => r.semesterId))];

  const [mapelList, semesterList] = await Promise.all([
    mapelIds.length
      ? prisma.subject.findMany({
          where: { id: { in: mapelIds } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    semesterIds.length
      ? prisma.semester.findMany({
          where: { id: { in: semesterIds } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
  ]);

  const namaMapel = new Map(mapelList.map((m) => [m.id, m.name]));
  const namaSemester = new Map(semesterList.map((s) => [s.id, s.name]));

  const raporLengkap = rapor.map((r) => ({
    ...r,
    subjectName: namaMapel.get(r.subjectId) ?? "—",
    semesterName: namaSemester.get(r.semesterId) ?? "—",
  }));

  return { nilai, rapor: raporLengkap };
}

/** Rekap kehadiran per bulan (12 bulan terakhir). */
export async function kehadiranPortal(studentId: string, schoolId: string) {
  const sejak = new Date();
  sejak.setMonth(sejak.getMonth() - 11);
  sejak.setDate(1);
  sejak.setHours(0, 0, 0, 0);

  const baris = await prisma.attendance.findMany({
    where: { studentId, schoolId, date: { gte: sejak } },
    select: { date: true, status: true },
    orderBy: { date: "desc" },
  });

  // Rekap per bulan: { "2026-09": { PRESENT: 20, ABSENT: 1, ... } }
  const perBulan = new Map<string, Record<string, number>>();
  for (const b of baris) {
    const kunci = `${b.date.getFullYear()}-${String(b.date.getMonth() + 1).padStart(2, "0")}`;
    const bucket = perBulan.get(kunci) ?? {};
    bucket[b.status] = (bucket[b.status] ?? 0) + 1;
    perBulan.set(kunci, bucket);
  }

  // Catatan terakhir (30 baris) untuk dilihat orang tua.
  const terakhir = baris.slice(0, 30);

  return {
    perBulan: [...perBulan.entries()].map(([bulan, hitung]) => ({ bulan, hitung })),
    terakhir,
  };
}

/** Tagihan + riwayat pembayaran. */
export async function tagihanPortal(studentId: string, schoolId: string) {
  const tagihan = await prisma.invoice.findMany({
    where: { studentId, schoolId, deletedAt: null },
    orderBy: { dueDate: "desc" },
    select: {
      id: true,
      invoiceNo: true,
      title: true,
      dueDate: true,
      totalAmount: true,
      paidAmount: true,
      status: true,
      items: { select: { description: true, amount: true, quantity: true } },
      // Payment tidak punya studentId: terhubung lewat invoiceId.
      payments: {
        orderBy: { paidAt: "desc" },
        select: {
          id: true,
          amount: true,
          paidAt: true,
          reference: true,
          method: { select: { name: true } },
        },
      },
    },
  });

  // Riwayat pembayaran lintas tagihan (untuk daftar kronologis).
  const pembayaran = await prisma.payment.findMany({
    where: { schoolId, invoice: { studentId } },
    orderBy: { paidAt: "desc" },
    take: 30,
    select: {
      id: true,
      amount: true,
      paidAt: true,
      reference: true,
      method: { select: { name: true } },
      invoice: { select: { invoiceNo: true, title: true } },
    },
  });

  const belumLunas = tagihan
    .filter((t) => ["UNPAID", "PARTIAL", "OVERDUE"].includes(t.status))
    .reduce((n, t) => n + (t.totalAmount - t.paidAmount), 0);

  return { tagihan, pembayaran, belumLunas };
}

/** Jadwal pelajaran kelas siswa. */
export async function jadwalPortal(
  studentId: string,
  schoolId: string,
  classId: string | null,
) {
  if (!classId) return { jadwal: [], adaKelas: false };

  // Pastikan kelas yang diminta memang kelas siswa itu — jangan sampai
  // classId dari luar membuat siswa membaca jadwal kelas lain.
  const siswa = await prisma.student.findFirst({
    where: { id: studentId, schoolId, classId },
    select: { id: true },
  });
  if (!siswa) return { jadwal: [], adaKelas: true };

  const jadwal = await prisma.schedule.findMany({
    where: { classId, schoolId },
    orderBy: [{ dayOfWeek: "asc" }, { timeSlot: { slotNumber: "asc" } }],
    select: {
      id: true,
      dayOfWeek: true,
      room: true,
      timeSlot: {
        select: { slotNumber: true, startTime: true, endTime: true, label: true },
      },
      subject: { select: { name: true } },
      teacher: { select: { fullName: true } },
    },
  });

  return { jadwal, adaKelas: true };
}

/** Postingan yang dipublikasikan sekolah. */
export async function pengumumanPortal(schoolId: string, batas = 20) {
  return prisma.post.findMany({
    where: { schoolId, isPublished: true, deletedAt: null },
    orderBy: { publishedAt: "desc" },
    take: batas,
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      publishedAt: true,
      type: true,
    },
  });
}

function awalBulanIni(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}
