import type { PrismaClient } from "@prisma/client";

/**
 * ============================================================
 * SEED AKTIVITAS DEMO — 2 tahun ajaran
 * ============================================================
 *
 * Mengisi satu sekolah dengan riwayat yang menyerupai sekolah sungguhan, supaya
 * tampilan (daftar siswa, absensi, tagihan, log aktivitas) bisa dinilai dengan
 * data nyata — bukan layar kosong yang tidak memberi tahu apa pun soal
 * kepadatannya.
 *
 * TUJUAN PEMAKAIAN: hanya untuk demo/pengembangan. Dipanggil dari `seed.ts`
 * untuk satu sekolah saja. JANGAN dijalankan di produksi.
 *
 * PENTING — DETERMINISTIK:
 * Semua keacakan berasal dari `mulberry32(seed)` dengan benih tetap. Dua kali
 * menjalankan seed menghasilkan data yang SAMA, sehingga perbandingan tangkapan
 * layar dan laporan selalu konsisten. `Math.random()` tidak dipakai sama sekali.
 *
 * PENTING — AMAN DIJALANKAN ULANG:
 * Fungsi ini memeriksa lebih dulu apakah sekolah sudah punya absensi. Kalau ya,
 * ia berhenti tanpa menyentuh apa pun. Tanpa penjaga ini, menjalankan seed dua
 * kali akan menggandakan tagihan — dan itu merusak data keuangan.
 */

/* ============================================================
 * UTIL: ACAK DETERMINISTIK
 * ============================================================ */

/** PRNG kecil (mulberry32) — cukup untuk data demo, tanpa dependensi. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rnd = () => number;

/** Bilangan bulat dalam [min, max]. */
function int(rnd: Rnd, min: number, max: number): number {
  return min + Math.floor(rnd() * (max - min + 1));
}

/** Ambil satu elemen. */
function pick<T>(rnd: Rnd, arr: readonly T[]): T {
  return arr[Math.floor(rnd() * arr.length)];
}

/** Ambil `n` elemen unik (tanpa pengembalian). */
function sample<T>(rnd: Rnd, arr: readonly T[], n: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  for (let i = 0; i < n && copy.length > 0; i += 1) {
    out.push(copy.splice(Math.floor(rnd() * copy.length), 1)[0]);
  }
  return out;
}

/** Tanggal pada tengah malam UTC — bentuk yang diminta kolom `@db.Date`. */
function day(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Tambah hari. */
function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000);
}

/**
 * Hari sekolah dalam rentang: Senin–Jumat, minus libur nasional besar.
 * Sabtu/Minggu dan libur sengaja dilewati supaya rekap kehadiran tidak
 * menampilkan "alpa" pada hari yang memang tidak ada pelajaran.
 */
function schoolDays(start: Date, end: Date): Date[] {
  // Libur panjang Indonesia — cukup untuk membuat rekap terasa nyata.
  const holidays = new Set<string>([
    "2024-08-17", "2024-12-25", "2025-01-01", "2025-03-31", "2025-04-01",
    "2025-04-02", "2025-04-03", "2025-04-04", "2025-05-01", "2025-05-12",
    "2025-05-29", "2025-06-01", "2025-08-17", "2025-12-25", "2026-01-01",
  ]);

  const out: Date[] = [];
  for (let d = day(start); d <= end; d = addDays(d, 1)) {
    const dow = d.getUTCDay();
    if (dow === 0 || dow === 6) continue; // akhir pekan
    if (holidays.has(d.toISOString().slice(0, 10))) continue;
    out.push(d);
  }
  return out;
}

/* ============================================================
 * DATA REFERENSI
 * ============================================================ */

const MALE_NAMES = [
  "Ahmad Fauzi", "Bagas Prakoso", "Candra Wijaya", "Dimas Saputra",
  "Eko Nugroho", "Fajar Ramadhan", "Gilang Pratama", "Hendra Kusuma",
  "Irfan Maulana", "Joko Susilo", "Krisna Bayu", "Lukman Hakim",
  "Maulana Yusuf", "Naufal Rizki", "Oka Prasetya", "Putra Ardiansyah",
  "Rafi Hidayat", "Satria Wibowo", "Taufik Hidayat", "Umar Abdullah",
  "Vino Bastian", "Wahyu Setiawan", "Yoga Pratama", "Zaki Firmansyah",
];

const FEMALE_NAMES = [
  "Aisyah Putri", "Bella Anjani", "Citra Dewi", "Dinda Ayu",
  "Eka Lestari", "Fitri Handayani", "Gita Puspita", "Hana Salsabila",
  "Indah Permata", "Julia Rahmawati", "Kartika Sari", "Laila Nurjanah",
  "Maya Anggraini", "Nadia Safira", "Olivia Rahma", "Putri Wulandari",
  "Rani Kusuma", "Sinta Maharani", "Tiara Ananda", "Umi Kalsum",
  "Vera Nanda", "Wulan Sari", "Yuni Astuti", "Zahra Amelia",
];

const SUBJECTS = [
  { code: "MAT", name: "Matematika", kkm: 70 },
  { code: "BIN", name: "Bahasa Indonesia", kkm: 72 },
  { code: "BIG", name: "Bahasa Inggris", kkm: 70 },
  { code: "IPA", name: "Ilmu Pengetahuan Alam", kkm: 70 },
  { code: "IPS", name: "Ilmu Pengetahuan Sosial", kkm: 72 },
  { code: "PAI", name: "Pendidikan Agama Islam", kkm: 75 },
  { code: "PKN", name: "Pendidikan Kewarganegaraan", kkm: 72 },
  { code: "SEN", name: "Seni Budaya", kkm: 70 },
  { code: "PJOK", name: "Pendidikan Jasmani", kkm: 70 },
  { code: "INF", name: "Informatika", kkm: 70 },
] as const;

const TEACHER_NAMES = [
  "Dewi Lestari, S.Pd.", "Bambang Sutrisno, M.Pd.", "Sri Wahyuni, S.Pd.",
  "Agus Setiawan, S.Pd.", "Ratna Dewi, M.Pd.", "Hadi Purnomo, S.Pd.",
  "Nurhayati, S.Pd.", "Slamet Riyadi, M.Pd.", "Endang Kuswati, S.Pd.",
  "Yusuf Maulana, S.Kom.", "Retno Palupi, S.Pd.", "Wahid Hasyim, S.Ag.",
];

const FEE_TYPES = [
  { code: "SPP", name: "SPP Bulanan", amount: 350_000, recurring: true },
  { code: "PANGKAL", name: "Uang Pangkal", amount: 2_500_000, recurring: false },
  { code: "SERAGAM", name: "Seragam Sekolah", amount: 650_000, recurring: false },
  { code: "KEGIATAN", name: "Biaya Kegiatan", amount: 250_000, recurring: false },
] as const;

const NEWS_TITLES = [
  "Peringatan Hari Kemerdekaan di Lapangan Sekolah",
  "Juara Olimpiade Sains Tingkat Kabupaten",
  "Kegiatan Pramuka Perkemahan Sabtu Minggu",
  "Sosialisasi Bahaya Narkoba bersama Polres",
  "Pekan Olahraga dan Seni Antar Kelas",
  "Pentas Seni Akhir Tahun Ajaran",
  "Bakti Sosial Ramadan ke Panti Asuhan",
  "Workshop Literasi Digital untuk Guru",
  "Kunjungan Industri ke Balai Teknologi",
  "Peringatan Hari Guru Nasional",
  "Lomba Cerdas Cermat Tingkat Kecamatan",
  "Pelatihan Kepemimpinan OSIS",
  "Pemeriksaan Kesehatan Berkala Siswa",
  "Peringatan Maulid Nabi di Aula Sekolah",
  "Turnamen Futsal Antar Sekolah",
  "Seminar Parenting untuk Orang Tua",
  "Peringatan Hari Kartini",
  "Simulasi Bencana Gempa Bumi",
  "Penerimaan Rapor Tengah Semester",
  "Masa Pengenalan Lingkungan Sekolah",
  "Pelatihan Jurnalistik Siswa",
  "Kunjungan Museum Sejarah Nasional",
  "Lomba Mewarnai Tingkat Sekolah Dasar",
  "Peringatan Hari Lingkungan Hidup",
];

const AUDIT_ACTIONS = ["CREATE", "UPDATE", "DELETE", "LOGIN", "EXPORT"] as const;

const AUDIT_TARGETS = [
  { entity: "Invoice", fields: ["status", "paidAmount", "totalAmount"] },
  { entity: "Payment", fields: ["amount", "reference", "note"] },
  { entity: "Student", fields: ["fullName", "classId", "status"] },
  { entity: "Grade", fields: ["score", "note"] },
  { entity: "Attendance", fields: ["status", "note"] },
  { entity: "User", fields: ["name", "role", "isActive"] },
  { entity: "Class", fields: ["name", "capacity"] },
] as const;

/* ============================================================
 * SEED UTAMA
 * ============================================================ */

export type ActivityOptions = {
  /** Benih PRNG — beda benih = beda data, tetap deterministik. */
  seed?: number;
  /** Jumlah siswa. 72 cukup untuk 6 kelas tanpa terasa kosong. */
  students?: number;
  /** Cetak ringkasan ke console. */
  verbose?: boolean;
};

export async function seedActivityForSchool(
  prisma: PrismaClient,
  schoolId: string,
  options: ActivityOptions = {},
): Promise<void> {
  const { seed = 20252026, students: studentCount = 72, verbose = true } = options;
  const rnd = mulberry32(seed);
  const log = (msg: string) => {
    if (verbose) console.log(msg);
  };

  // ---- PENJAGA: jangan gandakan data bila sudah pernah di-seed ----
  const existingAttendance = await prisma.attendance.count({ where: { schoolId } });
  if (existingAttendance > 0) {
    log("  ↷ aktivitas demo sudah ada — dilewati (tidak digandakan)");
    return;
  }

  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { id: true, name: true, slug: true },
  });
  if (!school) throw new Error(`Sekolah ${schoolId} tidak ditemukan.`);

  /* ---------- 1. GURU ---------- */
  //
  // `createMany` + `skipDuplicates`, bukan loop `create`: seed dasar sudah
  // membuat satu guru untuk sekolah ini, dan menjalankan ulang seed tidak boleh
  // gagal karena data yang sudah ada.
  const teacherNips = TEACHER_NAMES.map((_, i) => `G-${String(i + 1).padStart(3, "0")}`);
  await prisma.teacher.createMany({
    data: TEACHER_NAMES.map((fullName, i) => ({
      schoolId,
      nip: teacherNips[i],
      fullName,
      gender: i % 3 === 0 ? ("MALE" as const) : ("FEMALE" as const),
      email: `guru${i + 1}@${school.slug}.sch.id`,
      phone: `62812${String(int(rnd, 10_000_000, 99_999_999))}`,
      isActive: true,
    })),
    skipDuplicates: true,
  });
  const teachers = await prisma.teacher.findMany({
    where: { schoolId, nip: { in: teacherNips } },
    select: { id: true, fullName: true },
    orderBy: { nip: "asc" },
  });
  log(`  ✓ ${teachers.length} guru`);

  /* ---------- 2. MAPEL ---------- */
  // MAT sudah dibuat seed dasar → `skipDuplicates` mencegah P2002.
  await prisma.subject.createMany({
    data: SUBJECTS.map((s) => ({
      schoolId,
      code: s.code,
      name: s.name,
      kkm: s.kkm,
    })),
    skipDuplicates: true,
  });
  const subjects = await prisma.subject.findMany({
    where: { schoolId, code: { in: SUBJECTS.map((s) => s.code) } },
    select: { id: true, code: true, name: true, kkm: true },
    orderBy: { code: "asc" },
  });
  log(`  ✓ ${subjects.length} mata pelajaran`);

  /* ---------- 3. JAM PELAJARAN ---------- */
  // Jam 1–4 juga sudah ada dari seed dasar.
  await prisma.timeSlot.createMany({
    data: Array.from({ length: 8 }, (_, idx) => {
      const i = idx + 1;
      // Jeda istirahat setelah jam ke-4.
      const startH = i <= 4 ? 7 + (i - 1) : 10 + (i - 1);
      return {
        schoolId,
        slotNumber: i,
        startTime: `${String(startH).padStart(2, "0")}:00`,
        endTime: `${String(startH).padStart(2, "0")}:45`,
        label: i === 5 ? "Setelah istirahat" : null,
      };
    }),
    skipDuplicates: true,
  });
  const slots = await prisma.timeSlot.findMany({
    where: { schoolId },
    select: { id: true, slotNumber: true },
    orderBy: { slotNumber: "asc" },
  });

  /* ---------- 4. TAHUN AJARAN & SEMESTER ---------- */
  const years = [];
  const yearDefs = [
    { name: "2024/2025", start: "2024-07-15", end: "2025-06-20", active: false },
    { name: "2025/2026", start: "2025-07-14", end: "2026-06-19", active: true },
  ];

  for (const y of yearDefs) {
    // 2025/2026 sudah dibuat seed dasar → `upsert`, bukan `create`.
    const ay = await prisma.academicYear.upsert({
      where: { schoolId_name: { schoolId, name: y.name } },
      update: {},
      create: {
        schoolId,
        name: y.name,
        startDate: new Date(`${y.start}T00:00:00Z`),
        endDate: new Date(`${y.end}T00:00:00Z`),
        isActive: y.active,
      },
      select: { id: true, name: true, startDate: true, endDate: true },
    });

    // Semester tidak punya batasan unik, jadi dibuat hanya bila belum ada —
    // tanpa pemeriksaan ini, menjalankan seed dua kali menggandakan semester.
    const semesterDefs = [
      {
        name: "Ganjil",
        type: "GANJIL" as const,
        startDate: ay.startDate,
        endDate: new Date(`${y.start.slice(0, 4)}-12-20T00:00:00Z`),
        isActive: y.active,
      },
      {
        name: "Genap",
        type: "GENAP" as const,
        startDate: new Date(`${Number(y.start.slice(0, 4)) + 1}-01-06T00:00:00Z`),
        endDate: ay.endDate,
        isActive: false,
      },
    ];

    const semesters: { id: string; name: string }[] = [];
    for (const sd of semesterDefs) {
      const existing = await prisma.semester.findFirst({
        where: { academicYearId: ay.id, name: sd.name },
        select: { id: true, name: true },
      });
      semesters.push(
        existing ??
          (await prisma.semester.create({
            data: { academicYearId: ay.id, ...sd },
            select: { id: true, name: true },
          })),
      );
    }

    years.push({ ...ay, semesters });
  }
  log(`  ✓ ${years.length} tahun ajaran × 2 semester`);

  /* ---------- 5. KELAS ---------- */
  const classDefs: { name: string; level: number }[] = [];
  for (const level of [7, 8, 9]) {
    for (const suffix of ["A", "B"]) {
      classDefs.push({ name: `${level}${suffix}`, level });
    }
  }

  // Kelas "7A" untuk 2025/2026 sudah dibuat seed dasar → `skipDuplicates`.
  await prisma.class.createMany({
    data: years.flatMap((ay) =>
      classDefs.map((c) => ({
        schoolId,
        academicYearId: ay.id,
        name: c.name,
        level: c.level,
        capacity: 32,
        homeroomTeacherId: pick(rnd, teachers).id,
      })),
    ),
    skipDuplicates: true,
  });

  const classes = await prisma.class.findMany({
    where: { schoolId, academicYearId: { in: years.map((y) => y.id) } },
    select: { id: true, name: true, level: true, academicYearId: true },
    orderBy: [{ academicYearId: "asc" }, { name: "asc" }],
  });
  log(`  ✓ ${classes.length} kelas (2 tahun ajaran)`);

  const currentYear = years.find((y) => y.name === "2025/2026")!;
  const currentClasses = classes.filter((c) => c.academicYearId === currentYear.id);

  /* ---------- 6. SISWA + WALI ---------- */
  const students = [];
  const usedNames = new Set<string>();

  for (let i = 0; i < studentCount; i += 1) {
    const gender: "MALE" | "FEMALE" = i % 2 === 0 ? "MALE" : "FEMALE";
    const pool = gender === "MALE" ? MALE_NAMES : FEMALE_NAMES;

    // Nama unik: tambahkan nama belakang bila sudah terpakai.
    let fullName = pool[i % pool.length];
    if (usedNames.has(fullName)) fullName = `${fullName} ${pick(rnd, ["Putra", "Wijaya", "Santoso", "Hidayat", "Ramadhan"])}`;
    usedNames.add(fullName);

    const targetClass = currentClasses[i % currentClasses.length];
    const entryYear = targetClass.level === 7 ? 2025 : targetClass.level === 8 ? 2024 : 2023;

    const student = await prisma.student.create({
      data: {
        schoolId,
        nis: `2025${String(i + 1).padStart(4, "0")}`,
        nisn: `00${String(int(rnd, 10000000, 99999999))}`,
        fullName,
        gender,
        birthPlace: pick(rnd, ["Jakarta", "Bandung", "Surabaya", "Yogyakarta", "Semarang", "Medan"]),
        birthDate: new Date(
          Date.UTC(entryYear - 13, int(rnd, 0, 11), int(rnd, 1, 28)),
        ),
        religion: pick(rnd, ["Islam", "Islam", "Islam", "Kristen", "Katolik", "Hindu"]),
        address: `Jl. ${pick(rnd, ["Melati", "Kenanga", "Mawar", "Anggrek", "Cempaka"])} No. ${int(rnd, 1, 120)}, RT ${int(rnd, 1, 8)}/RW ${int(rnd, 1, 12)}`,
        phone: rnd() > 0.4 ? `62813${String(int(rnd, 10_000_000, 99_999_999))}` : null,
        entryYear,
        classId: targetClass.id,
        status: "ACTIVE",
      },
      select: { id: true, fullName: true, gender: true, classId: true },
    });

    // Satu wali utama per siswa — sesuai keputusan produk: 1 akun ortu per anak.
    const parentGender = gender === "MALE" ? "MOTHER" : "FATHER";
    const parentFirst = gender === "MALE" ? pick(rnd, FEMALE_NAMES).split(" ")[0] : "Bapak";
    await prisma.parent.create({
      data: {
        studentId: student.id,
        fullName: `${gender === "MALE" ? "Ibu" : "Bapak"} ${parentFirst} ${fullName.split(" ").slice(-1)[0]}`,
        relation: parentGender,
        phone: `62812${String(int(rnd, 10_000_000, 99_999_999))}`,
        occupation: pick(rnd, ["Karyawan swasta", "Wirausaha", "PNS", "Guru", "Petani", "Buruh", "Ibu rumah tangga"]),
        isPrimary: true,
      },
    });

    students.push(student);
  }
  log(`  ✓ ${students.length} siswa + wali`);

  /* ---------- 7. JADWAL ---------- */
  const schedules = [];
  for (const cls of currentClasses) {
    for (let d = 1; d <= 5; d += 1) {
      const daySlots = sample(rnd, slots, 6);
      for (const slot of daySlots) {
        const subject = pick(rnd, subjects);
        schedules.push(
          await prisma.schedule.create({
            data: {
              schoolId,
              classId: cls.id,
              subjectId: subject.id,
              teacherId: pick(rnd, teachers).id,
              dayOfWeek: d,
              timeSlotId: slot.id,
              room: `${cls.name}`,
            },
            select: { id: true, classId: true, subjectId: true },
          }),
        );
      }
    }
  }
  log(`  ✓ ${schedules.length} jadwal pelajaran`);

  /* ---------- 8. ABSENSI (2 TAHUN) ---------- */
  //
  // Volume dijaga dengan sengaja: tahun berjalan dihitung penuh (setiap hari
  // sekolah × setiap siswa), tahun sebelumnya hanya 3 hari per bulan. Mengisi
  // dua tahun penuh menghasilkan puluhan ribu baris yang membuat `seed` lambat
  // tanpa menambah nilai demo — rekap bulanan sudah terlihat lengkap.
  const attendanceRows: {
    schoolId: string;
    date: Date;
    status: "PRESENT" | "LATE" | "SICK" | "EXCUSED" | "ABSENT";
    studentId: string;
    classId: string;
  }[] = [];

  const statusFor = (): "PRESENT" | "LATE" | "SICK" | "EXCUSED" | "ABSENT" => {
    const r = rnd();
    if (r < 0.88) return "PRESENT";
    if (r < 0.93) return "LATE";
    if (r < 0.96) return "SICK";
    if (r < 0.985) return "EXCUSED";
    return "ABSENT";
  };

  for (const student of students) {
    const cls = currentClasses.find((c) => c.id === student.classId)!;

    // Tahun berjalan: seluruh hari sekolah sejak awal tahun ajaran.
    for (const d of schoolDays(new Date("2025-07-14T00:00:00Z"), new Date())) {
      attendanceRows.push({
        schoolId,
        date: d,
        status: statusFor(),
        studentId: student.id,
        classId: cls.id,
      });
    }

    // Tahun sebelumnya: 3 hari sampel per bulan.
    for (let m = 0; m < 11; m += 1) {
      const monthStart = new Date(Date.UTC(2024, 6 + m, 1));
      const monthDays = schoolDays(
        monthStart,
        new Date(Date.UTC(2024, 6 + m, 28)),
      );
      for (const d of sample(rnd, monthDays, Math.min(3, monthDays.length))) {
        attendanceRows.push({
          schoolId,
          date: d,
          status: statusFor(),
          studentId: student.id,
          classId: cls.id,
        });
      }
    }
  }

  // createMany berkelompok — satu perintah raksasa bisa kehabisan parameter.
  for (let i = 0; i < attendanceRows.length; i += 2000) {
    await prisma.attendance.createMany({
      data: attendanceRows.slice(i, i + 2000),
      skipDuplicates: true,
    });
  }
  log(`  ✓ ${attendanceRows.length.toLocaleString("id-ID")} catatan absensi (2 tahun)`);

  /* ---------- 9. KOMPONEN NILAI + NILAI ---------- */
  let gradeCount = 0;
  const gradeItemsDefs = [
    { name: "Tugas 1", type: "ASSIGNMENT" as const, weight: 20 },
    { name: "Kuis", type: "QUIZ" as const, weight: 15 },
    { name: "UTS", type: "MIDTERM" as const, weight: 30 },
    { name: "UAS", type: "FINAL" as const, weight: 35 },
  ];

  for (const subject of subjects) {
    const teacher = pick(rnd, teachers);
    const subjectGradeItems: { id: string }[] = [];

    // Buat tepat 1 paket komponen per mapel (total bobot = 100%)
    for (const item of gradeItemsDefs) {
      const gradeItem = await prisma.gradeItem.create({
        data: {
          schoolId,
          subjectId: subject.id,
          academicYearId: currentYear.id,
          teacherId: teacher.id,
          name: `${item.name} — ${subject.code}`,
          type: item.type,
          weight: item.weight,
          maxScore: 100,
        },
        select: { id: true },
      });
      subjectGradeItems.push(gradeItem);
    }

    // Isi nilai untuk siswa di kelas-kelas berjalan
    for (const cls of currentClasses) {
      const classStudents = students.filter((s) => s.classId === cls.id);
      for (const gradeItem of subjectGradeItems) {
        const rows = classStudents
          .filter(() => rnd() > 0.05)
          .map((s) => ({
            schoolId,
            gradeItemId: gradeItem.id,
            studentId: s.id,
            subjectId: subject.id,
            classId: cls.id,
            score: Math.min(100, Math.max(35, Math.round(58 + rnd() * 40))),
          }));

        if (rows.length > 0) {
          await prisma.grade.createMany({ data: rows, skipDuplicates: true });
          gradeCount += rows.length;
        }
      }
    }
  }
  log(`  ✓ ${gradeCount.toLocaleString("id-ID")} nilai siswa`);

  /* ---------- 10. JENIS BIAYA ---------- */
  // Jenis biaya & metode bayar punya batasan unik (schoolId, code) →
  // `skipDuplicates` agar seed bisa dijalankan ulang tanpa P2002.
  await prisma.feeType.createMany({
    data: FEE_TYPES.map((f) => ({
      schoolId,
      name: f.name,
      code: f.code,
      amount: f.amount,
      recurring: f.recurring,
      isActive: true,
    })),
    skipDuplicates: true,
  });
  const feeTypes = await prisma.feeType.findMany({
    where: { schoolId, code: { in: FEE_TYPES.map((f) => f.code) } },
    select: { id: true, code: true, name: true, amount: true },
  });

  const spp = feeTypes.find((f) => f.code === "SPP")!;

  /* ---------- 11. METODE BAYAR ---------- */
  const METHOD_DEFS = [
    { name: "Tunai", code: "CASH" },
    { name: "Transfer BCA", code: "TRF-BCA" },
    { name: "QRIS", code: "QRIS" },
  ];
  await prisma.paymentMethod.createMany({
    data: METHOD_DEFS.map((m) => ({
      schoolId,
      name: m.name,
      code: m.code,
      isActive: true,
    })),
    skipDuplicates: true,
  });
  const methods = await prisma.paymentMethod.findMany({
    where: { schoolId, code: { in: METHOD_DEFS.map((m) => m.code) } },
    select: { id: true, code: true },
  });

  /* ---------- 12. TAGIHAN SPP 18 BULAN ---------- */
  //
  // 18 bulan (bukan 24) supaya beban seed wajar: 72 siswa × 18 = 1.296 tagihan.
  // Status sengaja bervariasi — sebagian lunas, sebagian menunggak — karena
  // halaman Tunggakan tidak ada gunanya bila semua tagihan lunas.
  const months: { label: string; due: Date }[] = [];
  for (let i = 0; i < 18; i += 1) {
    const d = new Date(Date.UTC(2024, 6 + i, 1));
    months.push({
      label: d.toLocaleDateString("id-ID", { month: "long", year: "numeric" }),
      due: new Date(Date.UTC(2024, 6 + i, 10)),
    });
  }

  let invoiceNo = 1;
  let paidCount = 0;
  let overdueCount = 0;
  const now = new Date();

  for (const month of months) {
    const rows: {
      schoolId: string;
      studentId: string;
      invoiceNo: string;
      title: string;
      totalAmount: number;
      paidAmount: number;
      status: "UNPAID" | "PAID" | "OVERDUE" | "PARTIAL";
      dueDate: Date;
    }[] = [];

    for (const student of students) {
      // Sebagian tagihan belum terbit untuk bulan berjalan.
      if (rnd() < 0.04) continue;

      const r = rnd();
      let status: "UNPAID" | "PAID" | "OVERDUE" | "PARTIAL";
      let paid = 0;

      if (month.due < now) {
        // Bulan yang sudah lewat: sebagian besar lunas, sisanya menunggak.
        if (r < 0.82) {
          status = "PAID";
          paid = spp.amount;
        } else if (r < 0.9) {
          status = "PARTIAL";
          paid = Math.round(spp.amount * 0.5);
        } else {
          status = "OVERDUE";
        }
      } else {
        if (r < 0.45) {
          status = "PAID";
          paid = spp.amount;
        } else if (r < 0.55) {
          status = "PARTIAL";
          paid = Math.round(spp.amount * 0.5);
        } else {
          status = "UNPAID";
        }
      }

      if (status === "PAID") paidCount += 1;
      if (status === "OVERDUE") overdueCount += 1;

      rows.push({
        schoolId,
        studentId: student.id,
        invoiceNo: `INV/${month.due.getUTCFullYear()}/${String(month.due.getUTCMonth() + 1).padStart(2, "0")}/${String(invoiceNo++).padStart(5, "0")}`,
        title: `SPP ${month.label}`,
        totalAmount: spp.amount,
        paidAmount: paid,
        status,
        dueDate: month.due,
      });
    }

    if (rows.length === 0) continue;

    await prisma.invoice.createMany({ data: rows, skipDuplicates: true });

    // Item + pembayaran menyusul, diambil dari invoice yang baru dibuat.
    const created = await prisma.invoice.findMany({
      where: {
        schoolId,
        invoiceNo: { in: rows.map((r) => r.invoiceNo) },
      },
      select: { id: true, invoiceNo: true, totalAmount: true, paidAmount: true, dueDate: true },
    });

    await prisma.invoiceItem.createMany({
      data: created.map((inv) => ({
        invoiceId: inv.id,
        feeTypeId: spp.id,
        description: `SPP ${month.label}`,
        amount: spp.amount,
        quantity: 1,
      })),
    });

    const payments = created
      .filter((inv) => inv.paidAmount > 0)
      .map((inv) => ({
        schoolId,
        invoiceId: inv.id,
        amount: inv.paidAmount,
        methodId: pick(rnd, methods).id,
        // Dibayar beberapa hari setelah tagihan terbit.
        paidAt: addDays(inv.dueDate, -int(rnd, 0, 9)),
        reference: rnd() > 0.5 ? `TRF${int(rnd, 100000, 999999)}` : null,
        note: null,
      }));

    if (payments.length > 0) {
      await prisma.payment.createMany({ data: payments, skipDuplicates: true });
    }
  }
  log(`  ✓ 18 bulan tagihan SPP · ${paidCount} lunas · ${overdueCount} menunggak`);

  /* ---------- 13. NOTIFIKASI WA ---------- */
  const notifRows: {
    schoolId: string;
    to: string;
    recipientName: string;
    templateKey: string;
    body: string;
    status: "QUEUED" | "SENT" | "FAILED";
    attempts: number;
    sentAt: Date | null;
    scheduledAt: Date;
    refType: string;
    createdAt: Date;
  }[] = [];

  for (let i = 0; i < 260; i += 1) {
    const student = pick(rnd, students);
    const when = addDays(now, -int(rnd, 0, 540));
    const r = rnd();
    const status = r < 0.86 ? "SENT" : r < 0.95 ? "FAILED" : "QUEUED";

    notifRows.push({
      schoolId,
      to: `62812${String(int(rnd, 10_000_000, 99_999_999))}`,
      recipientName: `Wali ${student.fullName}`,
      templateKey: pick(rnd, ["finance.invoice", "finance.reminder", "attendance.absent", "grade.report_ready"]),
      body: `Pemberitahuan untuk ${student.fullName}. Mohon diperiksa. — ${school.name}`,
      status,
      attempts: status === "SENT" ? 1 : int(rnd, 1, 4),
      sentAt: status === "SENT" ? addDays(when, 0) : null,
      scheduledAt: when,
      refType: pick(rnd, ["Invoice", "Attendance", "Grade"]),
      createdAt: when,
    });
  }

  for (let i = 0; i < notifRows.length; i += 500) {
    await prisma.notificationQueue.createMany({ data: notifRows.slice(i, i + 500) });
  }
  log(`  ✓ ${notifRows.length} riwayat notifikasi WA`);

  /* ---------- 14. BERITA ---------- */
  // Berita: `(schoolId, slug)` unik → `skipDuplicates`.
  await prisma.post.createMany({
    data: NEWS_TITLES.map((title, i) => {
      const slug = title
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .trim()
        .replace(/\s+/g, "-")
        .slice(0, 60);

      const publishedAt = addDays(now, -int(rnd, 5, 700));
      const isAgenda = i % 5 === 0;

      return {
        schoolId,
        title,
        slug,
        excerpt: `Kegiatan ${title.toLowerCase()} berlangsung dengan lancar dan diikuti seluruh siswa.`,
        content: `## ${title}\n\nKegiatan ini merupakan bagian dari program tahunan sekolah untuk mengembangkan karakter dan prestasi peserta didik.\n\nSeluruh siswa mengikuti rangkaian acara dengan tertib. Sekolah mengucapkan terima kasih kepada orang tua yang telah mendukung.`,
        type: isAgenda ? ("AGENDA" as const) : ("NEWS" as const),
        isPublished: true,
        publishedAt,
        eventDate: isAgenda ? addDays(now, int(rnd, 5, 90)) : null,
        eventLocation: isAgenda
          ? pick(rnd, ["Aula Sekolah", "Lapangan Utama", "Ruang Kelas 7A"])
          : null,
      };
    }),
    skipDuplicates: true,
  });
  const postCount = await prisma.post.count({ where: { schoolId } });
  log(`  ✓ ${postCount} berita & agenda`);

  /* ---------- 15. LOG AKTIVITAS (2 TAHUN) ---------- */
  //
  // Log dibuat dengan `before`/`after` yang benar-benar berbeda pada satu-dua
  // field, karena itulah yang dibaca halaman Log Aktivitas. Baris tanpa
  // perubahan nilai tidak memberi informasi apa pun.
  const users = await prisma.user.findMany({
    where: { schoolId, deletedAt: null },
    select: { id: true, role: true },
  });

  const auditRows: {
    schoolId: string;
    userId: string | null;
    action: (typeof AUDIT_ACTIONS)[number];
    entity: string;
    entityId: string | null;
    before: object | undefined;
    after: object | undefined;
    ipAddress: string;
    userAgent: string;
    createdAt: Date;
  }[] = [];

  const ipPool = ["36.85.12.44", "114.122.9.180", "180.243.77.5", "103.28.14.90"];
  const uaPool = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1",
    "Mozilla/5.0 (Linux; Android 14) Chrome/131.0 Mobile",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1) Safari/604.1",
  ];

  for (let i = 0; i < 1400; i += 1) {
    const action = pick(rnd, AUDIT_ACTIONS);
    const target = pick(rnd, AUDIT_TARGETS);
    const field = pick(rnd, target.fields);
    const when = addDays(now, -int(rnd, 0, 730));
    const actor = users.length > 0 ? pick(rnd, users) : null;

    // Nilai sebelum/sesudah dibuat berbeda agar baris "Perubahan" bermakna.
    let before: Record<string, unknown> | undefined;
    let after: Record<string, unknown> | undefined;

    if (action === "CREATE") {
      after = { [field]: sampleValue(rnd, field) };
    } else if (action === "DELETE") {
      before = { [field]: sampleValue(rnd, field) };
    } else if (action === "UPDATE") {
      const from = sampleValue(rnd, field);
      let to = sampleValue(rnd, field);
      let guard = 0;
      while (String(to) === String(from) && guard < 5) {
        to = sampleValue(rnd, field);
        guard += 1;
      }
      before = { [field]: from };
      after = { [field]: to };
    } else {
      // LOGIN / EXPORT tidak mengubah nilai.
      after = action === "EXPORT" ? { rows: int(rnd, 20, 800), format: "xlsx" } : undefined;
    }

    auditRows.push({
      schoolId,
      // Pelaku log: pengguna yang sedang bertindak. Untuk LOGIN/EXPORT tetap
      // pengguna yang sama — tidak ada cabang khusus yang diperlukan.
      userId: actor?.id ?? null,
      action,
      entity: target.entity,
      entityId: null,
      before,
      after,
      ipAddress: pick(rnd, ipPool),
      userAgent: pick(rnd, uaPool),
      createdAt: when,
    });
  }

  for (let i = 0; i < auditRows.length; i += 500) {
    await prisma.auditLog.createMany({ data: auditRows.slice(i, i + 500) });
  }
  log(`  ✓ ${auditRows.length} log aktivitas (2 tahun)`);

  /* ---------- 16. SPMB ---------- */
  const batch = await prisma.admissionBatch.create({
    data: {
      schoolId,
      academicYearId: currentYear.id,
      name: "SPMB 2026/2027 Gelombang 1",
      openDate: new Date("2026-01-05T00:00:00Z"),
      closeDate: new Date("2026-03-31T00:00:00Z"),
      quota: 96,
      isActive: true,
      description: "Penerimaan murid baru tahun ajaran 2026/2027 untuk jenjang SMP.",
      requirements:
        "1. Fotokopi akta kelahiran\n2. Fotokopi kartu keluarga\n3. Pas foto 3×4 sebanyak 2 lembar\n4. Fotokopi ijazah SD/MI",
      resultAnnouncement: null,
    },
    select: { id: true },
  });

  const paths = [];
  for (const p of [
    { name: "Reguler", code: "REGULER", quota: 60, fee: 150_000 },
    { name: "Prestasi", code: "PRESTASI", quota: 24, fee: 150_000 },
    { name: "Afirmasi", code: "AFIRMASI", quota: 12, fee: null },
  ]) {
    paths.push(
      await prisma.admissionPath.create({
        data: {
          schoolId,
          batchId: batch.id,
          name: p.name,
          code: p.code,
          quota: p.quota,
          registrationFee: p.fee,
          isActive: true,
          order: paths.length,
        },
        select: { id: true, name: true, code: true },
      }),
    );
  }

  const REG_STATUS = ["PENDING", "VERIFIED", "TESTED", "ACCEPTED", "REJECTED", "WAITLIST"] as const;
  let regNo = 1;
  for (let i = 0; i < 84; i += 1) {
    const gender: "MALE" | "FEMALE" = rnd() > 0.5 ? "MALE" : "FEMALE";
    const pool = gender === "MALE" ? MALE_NAMES : FEMALE_NAMES;
    const fullName = pool[int(rnd, 0, pool.length - 1)];
    const path = pick(rnd, paths);
    const status = pick(rnd, REG_STATUS);

    await prisma.registration.create({
      data: {
        schoolId,
        batchId: batch.id,
        pathId: path.id,
        registrationNo: `SPMB-2026-${path.code}-${String(regNo++).padStart(5, "0")}`,
        status,
        fullName,
        gender,
        birthPlace: pick(rnd, ["Jakarta", "Bogor", "Depok", "Tangerang", "Bekasi"]),
        birthDate: new Date(Date.UTC(2014, int(rnd, 0, 11), int(rnd, 1, 28))),
        religion: "Islam",
        address: `Jl. ${pick(rnd, ["Merdeka", "Sudirman", "Diponegoro", "Gatot Subroto"])} No. ${int(rnd, 1, 99)}`,
        phone: `62813${String(int(rnd, 10_000_000, 99_999_999))}`,
        email: null,
        parentName: `Bapak/Ibu ${pick(rnd, MALE_NAMES).split(" ")[0]}`,
        parentPhone: `62812${String(int(rnd, 10_000_000, 99_999_999))}`,
        parentRelation: rnd() > 0.5 ? "FATHER" : "MOTHER",
        previousSchool: `SD Negeri ${int(rnd, 1, 20)} ${pick(rnd, ["Jakarta", "Bogor", "Depok"])}`,
        score: status === "TESTED" || status === "ACCEPTED" ? int(rnd, 55, 98) : null,
        submittedAt: addDays(new Date("2026-01-05T00:00:00Z"), int(rnd, 0, 80)),
        verifiedAt: ["VERIFIED", "TESTED", "ACCEPTED", "REJECTED", "WAITLIST"].includes(status)
          ? addDays(new Date("2026-01-10T00:00:00Z"), int(rnd, 0, 70))
          : null,
        decidedAt: ["ACCEPTED", "REJECTED", "WAITLIST"].includes(status)
          ? addDays(new Date("2026-04-05T00:00:00Z"), int(rnd, 0, 5))
          : null,
      },
    });
  }
  log(`  ✓ 1 gelombang SPMB · 3 jalur · 84 pendaftar`);

  log("  ✓ Aktivitas demo 2 tahun selesai");
}

/* ============================================================
 * NILAI CONTOH UNTUK LOG
 * ============================================================ */

/**
 * Nilai contoh yang masuk akal untuk sebuah field.
 * Dipakai agar baris "Perubahan" di Log Aktivitas menyerupai data sungguhan
 * ("status: UNPAID → PAID"), bukan angka acak tanpa arti.
 */
function sampleValue(rnd: Rnd, field: string): string | number {
  switch (field) {
    case "status":
      return pick(rnd, ["UNPAID", "PARTIAL", "PAID", "OVERDUE", "ACTIVE"]);
    case "paidAmount":
      return int(rnd, 0, 35) * 10_000;
    case "totalAmount":
      return pick(rnd, [250_000, 350_000, 650_000, 2_500_000]);
    case "amount":
      return pick(rnd, [250_000, 350_000, 650_000]);
    case "score":
      return int(rnd, 45, 100);
    case "capacity":
      return int(rnd, 28, 36);
    case "isActive":
      return pick(rnd, ["true", "false"]);
    case "role":
      return pick(rnd, ["TEACHER", "STAFF", "TREASURER", "SCHOOL_ADMIN"]);
    case "reference":
      return `TRF${int(rnd, 100000, 999999)}`;
    case "classId":
      return `cls_${int(rnd, 1000, 9999)}`;
    case "fullName":
    case "name":
      return pick(rnd, [...MALE_NAMES, ...FEMALE_NAMES]);
    case "note":
      return pick(rnd, ["Dibayar tunai di kantor", "Menunggu verifikasi", "Sudah dikonfirmasi bendahara"]);
    default:
      return int(rnd, 1, 100);
  }
}
