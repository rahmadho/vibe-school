import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * ============================================================
 * DATA RAPOR — dikumpulkan sekali untuk dibentuk jadi PDF
 * ============================================================
 *
 * KENAPA dikumpulkan dulu, bukan dibaca di dalam pembuat PDF:
 *   Pembuat PDF (kwitansi-pdf-inti.ts) sengaja bebas `server-only` supaya
 *   bisa dipakai worker. Kalau pembuat PDF ikut menyentuh Prisma, ia
 *   terikat runtime Next.js lagi dan pembuatan rapor massal (satu kelas =
 *   30 berkas) harus dikerjakan di dalam request HTTP.
 *
 * Karena itu: kumpulkan data di sini → bentuk jadi PDF di file inti.
 */

export type BarisNilaiRapor = {
  subjectId: string;
  kodeMapel: string;
  namaMapel: string;
  kkm: number;
  finalScore: number;
  predicate: string | null;
  note: string | null;
};

export type DataRapor = {
  sekolah: {
    name: string;
    npsn: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
    logoUrl: string | null;
  };
  siswa: {
    fullName: string;
    nis: string;
    nisn: string | null;
    gender: string | null;
    birthPlace: string | null;
    birthDate: Date | null;
  };
  kelas: string | null;
  /** Wali kelas — nama orangnya, bukan hanya nama kelas. */
  waliKelas: string | null;
  semester: {
    nama: string;
    jenis: string;
    tahunAjaran: string;
  };
  nilai: BarisNilaiRapor[];
  /** Catatan wali kelas: ReportCard punya `homeroomNote` PER MAPEL; rapor
   *  mengambil yang pertama terisi sebagai catatan umum. */
  catatanWali: string | null;
  /** Jumlah hari ketidakhadiran pada semester itu (bila data absensi ada). */
  kehadiran: {
    hadir: number;
    sakit: number;
    izin: number;
    alpa: number;
  } | null;
  kepalaSekolah: { nama: string; nip: string | null } | null;
  waliKelasTtd: { nama: string; nip: string | null } | null;
};

/**
 * Ambil semua data satu siswa untuk satu semester.
 *
 * Mengembalikan `null` bila siswa / semester tidak ditemukan DI SEKOLAH ITU —
 * pemanggil wajib menampilkan 404, bukan rapor kosong.
 */
export async function ambilDataRapor(params: {
  schoolId: string;
  studentId: string;
  semesterId: string;
}): Promise<DataRapor | null> {
  const { schoolId, studentId, semesterId } = params;

  const siswa = await prisma.student.findFirst({
    where: { id: studentId, schoolId, deletedAt: null },
    select: {
      id: true,
      fullName: true,
      nis: true,
      nisn: true,
      gender: true,
      birthPlace: true,
      birthDate: true,
      class: {
        select: {
          name: true,
          homeroomTeacher: { select: { fullName: true, nip: true } },
        },
      },
      school: {
        select: {
          name: true,
          npsn: true,
          address: true,
          phone: true,
          email: true,
          logoUrl: true,
        },
      },
    },
  });

  if (!siswa) return null;

  // Semester harus benar-benar milik sekolah ini. `Semester` tidak punya
  // schoolId langsung (ia milik AcademicYear), jadi harus lewat relasi —
  // kalau tidak, rapor sekolah A bisa memuat semester sekolah B.
  const semester = await prisma.semester.findFirst({
    where: { id: semesterId, academicYear: { schoolId } },
    select: {
      name: true,
      type: true,
      startDate: true,
      endDate: true,
      academicYear: { select: { name: true } },
    },
  });

  if (!semester) return null;

  const kartu = await prisma.reportCard.findMany({
    where: { schoolId, studentId, semesterId },
    orderBy: { subjectId: "asc" },
    select: {
      subjectId: true,
      finalScore: true,
      predicate: true,
      note: true,
      homeroomNote: true,
    },
  });

  // Nama & KKM mapel diambil terpisah — ReportCard hanya menyimpan subjectId.
  const subjectIds = kartu.map((k) => k.subjectId);
  const mapel: { id: string; code: string; name: string; kkm: number }[] =
    subjectIds.length
      ? await prisma.subject.findMany({
          where: { id: { in: subjectIds }, schoolId },
          select: { id: true, code: true, name: true, kkm: true },
        })
      : [];
  const petaMapel = new Map(mapel.map((m) => [m.id, m]));

  const nilai: BarisNilaiRapor[] = kartu.map((k) => {
    const m = petaMapel.get(k.subjectId);
    return {
      subjectId: k.subjectId,
      kodeMapel: m?.code ?? "—",
      // Mapel bisa sudah dihapus (soft delete) sementara nilainya tersimpan.
      // Rapor tetap menampilkan barisnya supaya angka tidak hilang diam-diam.
      namaMapel: m?.name ?? "(mapel dihapus)",
      kkm: m?.kkm ?? 70,
      finalScore: k.finalScore,
      predicate: k.predicate,
      note: k.note,
    };
  });

  // Urutkan sesuai kode mapel supaya rapor antar-siswa konsisten urutannya.
  nilai.sort((a, b) => a.kodeMapel.localeCompare(b.kodeMapel));

  // Catatan wali: ambil yang pertama terisi (biasanya guru mengisi satu saja).
  const catatanWali =
    kartu.map((k) => k.homeroomNote?.trim()).find((n) => n && n.length > 0) ??
    null;

  /* ---------- Kehadiran (opsional) ---------- */

  // Absensi dihitung HANYA dalam rentang semester, bukan seluruh riwayat —
  // kalau tidak, rapor semester ini akan memuat absen semester lain.
  let kehadiran: DataRapor["kehadiran"] = null;
  const rekap = await prisma.attendance.groupBy({
    by: ["status"],
    where: {
      schoolId,
      studentId,
      date: { gte: semester.startDate, lte: semester.endDate },
    },
    _count: { _all: true },
  });

  if (rekap.length > 0) {
    const ambil = (s: string) =>
      rekap.find((r) => r.status === s)?._count._all ?? 0;
    kehadiran = {
      hadir: ambil("PRESENT"),
      sakit: ambil("SICK"),
      izin: ambil("PERMISSION"),
      alpa: ambil("ABSENT"),
    };
  }

  /* ---------- Penanda tangan ---------- */

  // Kepala sekolah: cari staf berjabatan kepala sekolah.
  const kepsek = await prisma.staff.findFirst({
    where: {
      schoolId,
      deletedAt: null,
      isActive: true,
      position: { contains: "kepala sekolah", mode: "insensitive" },
    },
    select: { fullName: true, nip: true },
  });

  return {
    sekolah: siswa.school,
    siswa: {
      fullName: siswa.fullName,
      nis: siswa.nis,
      nisn: siswa.nisn,
      gender: siswa.gender,
      birthPlace: siswa.birthPlace,
      birthDate: siswa.birthDate,
    },
    kelas: siswa.class?.name ?? null,
    waliKelas: siswa.class?.homeroomTeacher?.fullName ?? null,
    semester: {
      nama: semester.name,
      jenis: semester.type,
      tahunAjaran: semester.academicYear.name,
    },
    nilai,
    catatanWali,
    kehadiran,
    kepalaSekolah: kepsek
      ? { nama: kepsek.fullName, nip: kepsek.nip }
      : null,
    waliKelasTtd: siswa.class?.homeroomTeacher
      ? {
          nama: siswa.class.homeroomTeacher.fullName,
          nip: siswa.class.homeroomTeacher.nip,
        }
      : null,
  };
}
