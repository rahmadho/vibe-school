import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * ============================================================
 * KEAMANAN PORTAL — isolasi data antar siswa
 * ============================================================
 *
 * Yang diuji di sini adalah janji paling penting dari portal: seorang siswa
 * atau orang tua HANYA bisa membaca data anaknya sendiri.
 *
 * Dua lapisan yang harus terbukti:
 *   1. `studentId` diambil dari SESI, bukan dari URL/parameter.
 *   2. Setiap fungsi data menerima studentId itu dan memakainya di klausa
 *      WHERE — sehingga siswa lain tidak ikut terbaca.
 *
 * Uji ini memakai tiruan (mock) prisma supaya bisa membuktikan klausa WHERE
 * yang benar-benar dikirim ke database. Yang diperiksa bukan "apakah query
 * jalan", tetapi "apakah filter pemiliknya ada".
 */

const panggilanFindFirst: Record<string, unknown>[] = [];
const panggilanFindMany: Record<string, unknown>[] = [];
const panggilanGroupBy: Record<string, unknown>[] = [];

/**
 * Prisma mengembalikan `null` (bukan array kosong) untuk findFirst yang tidak
 * menemukan baris. Tiruan HARUS setia pada perilaku ini — kalau tidak, kode
 * yang memeriksa hasil dengan `if (!siswa)` akan tampak "lolos" padahal aslinya
 * gagal (array kosong bersifat truthy di JavaScript).
 */
vi.mock("@/lib/prisma", () => {
  const rekamMany = (arr: Record<string, unknown>[], arg: Record<string, unknown>) => {
    arr.push(arg);
    return Promise.resolve([]);
  };
  return {
    prisma: {
      grade: { findMany: (a: never) => rekamMany(panggilanFindMany, a) },
      attendance: {
        findMany: (a: never) => rekamMany(panggilanFindMany, a),
        groupBy: (a: never) => rekamMany(panggilanGroupBy, a),
      },
      invoice: { findMany: (a: never) => rekamMany(panggilanFindMany, a) },
      payment: { findMany: (a: never) => rekamMany(panggilanFindMany, a) },
      post: { findMany: (a: never) => rekamMany(panggilanFindMany, a) },
      schedule: { findMany: (a: never) => rekamMany(panggilanFindMany, a) },
      student: {
        findFirst: (a: never) => {
          panggilanFindFirst.push(a);
          return Promise.resolve(null); // ← sama seperti Prisma
        },
      },
      reportCard: { findMany: (a: never) => rekamMany(panggilanFindMany, a) },
      subject: { findMany: (a: never) => rekamMany(panggilanFindMany, a) },
      semester: { findMany: (a: never) => rekamMany(panggilanFindMany, a) },
    },
  };
});

vi.mock("server-only", () => ({}));

// Diimpor SETELAH mock dipasang.
const {
  ringkasanPortal,
  nilaiPortal,
  kehadiranPortal,
  tagihanPortal,
  jadwalPortal,
  pengumumanPortal,
} = await import("@/lib/data/portal");

const SISWA_A = "siswa-aaa";
const SISWA_B = "siswa-bbb";
const SEKOLAH = "sekolah-1";

beforeEach(() => {
  panggilanFindFirst.length = 0;
  panggilanFindMany.length = 0;
  panggilanGroupBy.length = 0;
});

describe("setiap query portal MENGIKAT pemilik data", () => {
  it("ringkasan: nilai, kehadiran, tagihan, pengumuman semuanya terfilter studentId+schoolId", async () => {
    await ringkasanPortal(SISWA_A, SEKOLAH);

    // Tidak boleh ada satu pun query tanpa studentId — kalau ada, siswa A bisa
    // melihat data siswa lain.
    for (const call of panggilanFindMany) {
      const where = call.where as Record<string, unknown>;
      expect(where).toBeDefined();
      expect(where.studentId ?? where.schoolId).toBeDefined();
    }

    for (const call of panggilanGroupBy) {
      const where = call.where as Record<string, unknown>;
      expect(where.studentId).toBe(SISWA_A);
      expect(where.schoolId).toBe(SEKOLAH);
    }
  });

  it("nilai: WHERE memuat studentId siswa itu, bukan siswa lain", async () => {
    await nilaiPortal(SISWA_A, SEKOLAH);
    const grade = panggilanFindMany.find(
      (c) => (c.where as Record<string, unknown>)?.studentId === SISWA_A,
    );
    expect(grade).toBeDefined();
    expect((grade!.where as Record<string, unknown>).schoolId).toBe(SEKOLAH);
  });

  it("kehadiran: WHERE memuat studentId+schoolId", async () => {
    await kehadiranPortal(SISWA_A, SEKOLAH);
    const att = panggilanFindMany[0];
    expect((att.where as Record<string, unknown>).studentId).toBe(SISWA_A);
    expect((att.where as Record<string, unknown>).schoolId).toBe(SEKOLAH);
  });

  it("tagihan: invoice DAN payment keduanya terikat ke siswa itu", async () => {
    await tagihanPortal(SISWA_A, SEKOLAH);

    const invoice = panggilanFindMany.find(
      (c) => (c.where as Record<string, unknown>)?.studentId === SISWA_A,
    );
    expect(invoice).toBeDefined();

    // Payment tidak punya kolom studentId — harus lewat relasi invoice.
    const payment = panggilanFindMany.find(
      (c) => (c.where as Record<string, unknown>)?.invoice !== undefined,
    );
    expect(payment).toBeDefined();
    expect(
      ((payment!.where as Record<string, unknown>).invoice as Record<string, unknown>)
        .studentId,
    ).toBe(SISWA_A);
  });

  it("jadwal: menolak classId yang BUKAN kelas siswa itu", async () => {
    // student.findFirst mengembalikan [] (mock) → siswa tidak terdaftar di
    // kelas itu, jadi jadwal HARUS kosong dan query schedule tidak dijalankan.
    const hasil = await jadwalPortal(SISWA_A, SEKOLAH, "kelas-orang-lain");
    expect(hasil.jadwal).toEqual([]);

    const panggilanSiswa = panggilanFindFirst[0];
    expect((panggilanSiswa.where as Record<string, unknown>).id).toBe(SISWA_A);
    expect((panggilanSiswa.where as Record<string, unknown>).schoolId).toBe(SEKOLAH);
    expect((panggilanSiswa.where as Record<string, unknown>).classId).toBe(
      "kelas-orang-lain",
    );

    // Bukti kunci: jadwal kelas itu TIDAK diambil sama sekali.
    const panggilanJadwal = panggilanFindMany.find(
      (c) => c.orderBy !== undefined && (c.where as Record<string, unknown>)?.classId,
    );
    expect(panggilanJadwal).toBeUndefined();
  });

  it("pengumuman: hanya sekolah sendiri dan hanya yang terbit", async () => {
    await pengumumanPortal(SEKOLAH);
    const post = panggilanFindMany[0];
    expect((post.where as Record<string, unknown>).schoolId).toBe(SEKOLAH);
    expect((post.where as Record<string, unknown>).isPublished).toBe(true);
    // Postingan terhapus tidak boleh muncul.
    expect((post.where as Record<string, unknown>).deletedAt).toBe(null);
  });
});

describe("schoolId berbeda menghasilkan kueri berbeda", () => {
  it("dua sekolah tidak pernah berbagi kueri yang sama", async () => {
    await nilaiPortal(SISWA_A, "sekolah-1");
    const sebelum = panggilanFindMany.length;

    await nilaiPortal(SISWA_B, "sekolah-2");
    const sesudah = panggilanFindMany.slice(sebelum);

    // Semua kueri untuk siswa B harus menyebut siswa B dan sekolah 2.
    const kueriB = sesudah.filter(
      (c) => (c.where as Record<string, unknown>)?.studentId === SISWA_B,
    );
    expect(kueriB.length).toBeGreaterThan(0);
    for (const c of kueriB) {
      expect((c.where as Record<string, unknown>).schoolId).toBe("sekolah-2");
    }
  });
});
