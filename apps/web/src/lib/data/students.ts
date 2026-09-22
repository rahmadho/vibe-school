import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  CLASS_FILTER_NONE,
  type StudentFilter,
} from "@/lib/validations/student";

/**
 * Query layer Siswa.
 *
 * CATATAN ISOLASI TENANT:
 * Setiap fungsi WAJIB menerima `schoolId` dan memasukkannya ke `where`.
 * schoolId SELALU berasal dari sesi (lihat requireSchoolSession()), bukan input
 * pengguna. Ini pola untuk query dengan relasi/include yang lebih kaya daripada
 * yang nyaman dilakukan lewat proxy scopedDb.
 */

const studentListSelect = {
  id: true,
  nis: true,
  nisn: true,
  fullName: true,
  gender: true,
  status: true,
  entryYear: true,
  createdAt: true,
  class: { select: { id: true, name: true } },
  major: { select: { id: true, code: true, name: true } },
} satisfies Prisma.StudentSelect;

export type StudentListItem = Prisma.StudentGetPayload<{
  select: typeof studentListSelect;
}>;

export async function listStudents(
  schoolId: string,
  filter: StudentFilter,
  /**
   * Sertakan siswa yang belum ditempatkan saat menyaring per tahun ajaran.
   *
   * Dipakai untuk tahun ajaran AKTIF saja: siswa tanpa kelas adalah siswa baru
   * yang sedang menunggu ditempatkan. Untuk tahun lain, mereka tidak relevan
   * dan justru menyesatkan.
   */
  opts: { includeUnassigned?: boolean } = {},
) {
  const { q, classId, majorId, academicYearId, status, page, perPage } = filter;
  const includeUnassigned = opts.includeUnassigned ?? false;

  // Kelas kosong ("none") punya arti sendiri: siswa yang BELUM ditempatkan.
  // Tidak bisa ditulis sebagai `{ classId: "none" }` — tidak akan ada hasilnya.
  const wantsUnassigned = classId === CLASS_FILTER_NONE;

  // `OR` dipakai oleh dua hal sekaligus (tahun ajaran dan pencarian), dan
  // menaruh keduanya di tingkat atas membuat yang satu menimpa yang lain —
  // filter tahun akan hilang begitu pengguna mengetik kata kunci. Karena itu
  // keduanya digabung lewat AND.
  const and: Prisma.StudentWhereInput[] = [];

  if (academicYearId) {
    // Siswa tanpa kelas ikut ditampilkan HANYA pada tahun aktif.
    //
    // Mereka memang belum punya tahun, tetapi merekalah yang sedang menunggu
    // ditempatkan — siswa baru hasil konversi SPMB. Menyembunyikannya membuat
    // panitia tidak bisa menemukannya di tampilan bawaan.
    //
    // Pada tahun LAIN, mereka tidak disertakan: memilih "2024/2025" lalu
    // melihat siswa yang sama sekali tidak terkait dengan tahun itu justru
    // menyesatkan. Untuk mencari yang belum ditempatkan, tersedia pilihan
    // khusus "Belum ada kelas" — jalan yang jelas dan disengaja.
    and.push(
      includeUnassigned
        ? { OR: [{ class: { academicYearId } }, { classId: null }] }
        : { class: { academicYearId } },
    );
  }

  if (q) {
    and.push({
      OR: [
        { fullName: { contains: q, mode: "insensitive" } },
        { nis: { contains: q, mode: "insensitive" } },
        { nisn: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  const where: Prisma.StudentWhereInput = {
    schoolId, // ← isolasi tenant (WAJIB)
    deletedAt: null,
    ...(status ? { status } : {}),
    ...(wantsUnassigned ? { classId: null } : classId ? { classId } : {}),
    ...(majorId ? { majorId } : {}),
    ...(and.length > 0 ? { AND: and } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.student.findMany({
      where,
      select: studentListSelect,
      orderBy: [{ fullName: "asc" }],
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.student.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    perPage,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  };
}

export async function getStudent(schoolId: string, id: string) {
  return prisma.student.findFirst({
    where: { id, schoolId, deletedAt: null }, // ← isolasi tenant
    include: {
      class: { select: { id: true, name: true } },
      major: { select: { id: true, code: true, name: true } },
      parents: { orderBy: { isPrimary: "desc" } },
    },
  });
}

export async function getStudentStats(schoolId: string) {
  const base = { schoolId, deletedAt: null } satisfies Prisma.StudentWhereInput;
  const [total, active, male, female] = await Promise.all([
    prisma.student.count({ where: base }),
    prisma.student.count({ where: { ...base, status: "ACTIVE" } }),
    prisma.student.count({ where: { ...base, gender: "MALE" } }),
    prisma.student.count({ where: { ...base, gender: "FEMALE" } }),
  ]);
  return { total, active, male, female };
}

/**
 * Opsi kelas untuk dropdown filter/form.
 *
 * Mengembalikan `studentCount` agar operator tahu kelas mana yang sudah penuh
 * tanpa harus membukanya. Juga menyertakan nama tahun ajaran — saat filter
 * tahun diset "Semua tahun", dua kelas bernama sama dari tahun berbeda muncul
 * bersamaan, dan tanpa tahunnya keduanya tampak identik.
 */
export async function getClassOptions(schoolId: string, academicYearId?: string) {
  return prisma.class.findMany({
    where: {
      schoolId,
      deletedAt: null,
      ...(academicYearId ? { academicYearId } : {}),
    },
    select: {
      id: true,
      name: true,
      level: true,
      capacity: true,
      academicYearId: true,
      majorId: true,
      academicYear: { select: { name: true, isActive: true } },
      _count: { select: { students: { where: { deletedAt: null } } } },
    },
    // Urut per tingkat lalu nama: "7A, 7B, 8A" — bukan urutan abjad yang
    // menaruh "10A" sebelum "7A".
    orderBy: [{ level: "asc" }, { name: "asc" }],
  });
}

/** Jumlah siswa yang belum ditempatkan di kelas mana pun. */
export async function countUnassignedStudents(schoolId: string): Promise<number> {
  return prisma.student.count({
    where: { schoolId, deletedAt: null, classId: null, status: "ACTIVE" },
  });
}

/** Cek duplikat NIS dalam satu sekolah (bukan lintas sekolah). */
export async function nisExists(
  schoolId: string,
  nis: string,
  exceptId?: string,
) {
  const found = await prisma.student.findFirst({
    where: {
      schoolId,
      nis,
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
    select: { id: true },
  });
  return Boolean(found);
}
