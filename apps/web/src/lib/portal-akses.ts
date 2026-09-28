import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { scopedDb } from "@/lib/scoped-db";

/**
 * ============================================================
 * GERBANG PORTAL ORANG TUA & SISWA
 * ============================================================
 *
 * Portal ini menampilkan data yang SANGAT sensitif: nilai anak, kehadiran,
 * dan tagihan. Karena itu identitas anak yang boleh dilihat TIDAK PERNAH
 * diambil dari URL/parameter — selalu dari sesi.
 *
 * Aturan yang dijaga berkas ini:
 *   1. Hanya role STUDENT atau PARENT yang boleh masuk portal.
 *   2. `studentId` diambil dari `User.studentId` milik sesi, bukan dari input.
 *      Kalau diambil dari URL, siapa pun bisa mengganti angkanya dan membaca
 *      data anak orang lain.
 *   3. Siswa yang sudah nonaktif/lulus tetap bisa membaca riwayatnya sendiri.
 *   4. Akun yang wajib ganti password dipantulkan ke halaman ganti password.
 *
 * CATATAN PENTING soal `User.schoolId`:
 *   Akun siswa selalu punya schoolId, jadi query lewat scopedDb tetap
 *   terisolasi per sekolah. Pemeriksaan "anak ini milik siapa" adalah lapisan
 *   KEDUA di atas isolasi tenant — keduanya wajib.
 */

export type AnakPortal = {
  id: string;
  nis: string;
  fullName: string;
  classId: string | null;
  className: string | null;
  majorName: string | null;
  photoUrl: string | null;
  status: string;
  schoolId: string;
  schoolName: string;
};

/**
 * Bentuk baris hasil query (setelah `select`). Didefinisikan terpisah karena
 * `scopedDb` mengembalikan tipe longgar sehingga tipe hasil select tidak
 * terbawa otomatis.
 */
type SiswaPortalMentah = {
  id: string;
  nis: string;
  fullName: string;
  photoUrl: string | null;
  status: string;
  schoolId: string;
  class: { id: string; name: string; major: { name: string } | null } | null;
  school: { name: string };
};

/**
 * Ambil konteks portal untuk pemakai yang sedang login.
 *
 * Mengembalikan null bila pemakai bukan siswa/wali, atau akunnya tidak
 * terhubung ke data siswa mana pun. Pemanggil yang memutuskan langkahnya
 * (biasanya redirect) — fungsi ini tidak melempar agar mudah diuji & dipakai
 * di banyak halaman.
 */
export async function ambilKonteksPortal(): Promise<
  | { status: "ok"; anak: AnakPortal; peran: "STUDENT" | "PARENT" }
  | { status: "bukan_portal" }
  | { status: "tanpa_siswa" }
> {
  const session = await auth();
  if (!session?.user?.id) return { status: "bukan_portal" };

  const role = session.user.role;
  if (role !== "STUDENT" && role !== "PARENT") return { status: "bukan_portal" };

  // `studentId` dari SESI (diambil dari DB saat login), bukan dari URL.
  // Inilah inti keamanan portal ini.
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { studentId: true, schoolId: true },
  });

  if (!user?.studentId) return { status: "tanpa_siswa" };

  const db = scopedDb(user.schoolId ?? undefined);

  // Query memakai scopedDb → terfilter schoolId. Ditambah pencarian by id:
  // dua lapisan, supaya kekeliruan di satu lapisan tidak langsung membocorkan
  // data anak lain.
  //
  // `scopedDb` mengembalikan tipe longgar, jadi hasilnya diberi tipe eksplisit
  // (pola yang sama dipakai modul lain di repo ini).
  const siswa = (await db.student.findFirst({
    where: { id: user.studentId, ...(user.schoolId ? { schoolId: user.schoolId } : {}) },
    select: {
      id: true,
      nis: true,
      fullName: true,
      photoUrl: true,
      status: true,
      schoolId: true,
      class: { select: { id: true, name: true, major: { select: { name: true } } } },
      school: { select: { name: true } },
    },
  })) as SiswaPortalMentah | null;

  if (!siswa) return { status: "tanpa_siswa" };

  return {
    status: "ok",
    peran: role,
    anak: {
      id: siswa.id,
      nis: siswa.nis,
      fullName: siswa.fullName,
      classId: siswa.class?.id ?? null,
      className: siswa.class?.name ?? null,
      majorName: siswa.class?.major?.name ?? null,
      photoUrl: siswa.photoUrl,
      status: siswa.status,
      schoolId: siswa.schoolId,
      schoolName: siswa.school.name,
    },
  };
}

/**
 * Versi untuk halaman: memastikan pemakai boleh melihat portal, atau
 * dialihkan. Mengembalikan konteks anak bila boleh.
 */
export async function wajibKonteksPortal(): Promise<{
  anak: AnakPortal;
  peran: "STUDENT" | "PARENT";
}> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // Akun dengan password awal belum boleh masuk portal.
  if (session.user.mustChangePassword) redirect("/ganti-password");

  const ctx = await ambilKonteksPortal();

  if (ctx.status === "bukan_portal") {
    // Staf/guru yang membuka /portal diarahkan ke dashboard — mereka punya
    // tempat sendiri, dan portal sengaja hanya untuk siswa/wali.
    redirect("/dashboard");
  }

  if (ctx.status === "tanpa_siswa") {
    // Role portal tapi tidak terhubung ke siswa: data rusak / akun yatim.
    // Jangan tampilkan halaman kosong tanpa penjelasan.
    redirect("/portal/tanpa-data");
  }

  return { anak: ctx.anak, peran: ctx.peran };
}

/**
 * Apakah pemakai boleh membuka portal? Dipakai layout untuk memutuskan
 * tampilan tanpa langsung mengalihkan.
 */
export async function bolehPortal(): Promise<boolean> {
  const ctx = await ambilKonteksPortal();
  return ctx.status === "ok";
}
