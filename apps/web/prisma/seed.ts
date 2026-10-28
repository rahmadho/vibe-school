import { PrismaClient, type SchoolLevel, type UserRole } from "@prisma/client";
import { hashPassword } from "../src/lib/password-hash";
import { TEMPLATE_SEEDS } from "../src/lib/templates-seed";
import { seedActivityForSchool } from "./seed-activity";

/**
 * Seed Fase 1:
 *  - 3 paket langganan (Basic/Pro/Enterprise)
 *  - 2 sekolah contoh (bukti multi-tenant)
 *  - super-admin (lintas sekolah)
 *  - admin sekolah + guru untuk masing-masing sekolah
 *  - beberapa kelas & mapel + 1 siswa per sekolah
 *
 * Jalankan: npm run db:seed  (atau npx prisma db seed)
 */
const prisma = new PrismaClient();

async function seedPlans() {
  const plans = [
    {
      code: "basic",
      name: "Basic",
      pricePerMonth: 250_000,
      maxStudents: 200,
      features: { wa: false, spmb: false, reportPdf: false, paymentGateway: false },
    },
    {
      code: "pro",
      name: "Pro",
      pricePerMonth: 500_000,
      maxStudents: 800,
      features: { wa: true, spmb: true, reportPdf: true, paymentGateway: true },
    },
    {
      code: "enterprise",
      name: "Enterprise",
      pricePerMonth: 1_200_000,
      maxStudents: 5000,
      features: {
        wa: true,
        spmb: true,
        reportPdf: true,
        paymentGateway: true,
        whiteLabel: true,
        multiUnit: true,
      },
    },
  ];

  for (const p of plans) {
    await prisma.plan.upsert({
      where: { code: p.code },
      update: { ...p },
      create: { ...p },
    });
  }
  console.log(`  ✓ ${plans.length} paket langganan`);
}

async function seedSchool(input: {
  name: string;
  slug: string;
  npsn: string;
  level: SchoolLevel;
  themeColor: string;
  planCode: string;
  adminEmail: string;
  adminName: string;
  teacherEmail: string;
  teacherName: string;
}) {
  const plan = await prisma.plan.findUnique({
    where: { code: input.planCode },
  });

  const school = await prisma.school.upsert({
    where: { slug: input.slug },
    update: { name: input.name },
    create: {
      name: input.name,
      slug: input.slug,
      npsn: input.npsn,
      level: input.level,
      themeColor: input.themeColor,
      timezone: "Asia/Jakarta",
      address: `Jl. Pendidikan No. 1, ${input.name}`,
      phone: "021-1234567",
      email: input.adminEmail,
    },
  });

  // Template pesan bawaan — agar sekolah baru langsung punya pesan siap pakai.
  for (const t of TEMPLATE_SEEDS) {
    await prisma.messageTemplate.upsert({
      where: { schoolId_key: { schoolId: school.id, key: t.key } },
      update: {},
      create: {
        schoolId: school.id,
        key: t.key,
        name: t.name,
        category: t.category,
        description: t.description,
        body: t.body,
        isActive: true,
      },
    });
  }

  // Langganan
  if (plan) {
    const expires = new Date();
    expires.setFullYear(expires.getFullYear() + 1);
    await prisma.subscription.upsert({
      where: { schoolId: school.id },
      update: {},
      create: {
        schoolId: school.id,
        planId: plan.id,
        status: "TRIAL",
        expiresAt: expires,
      },
    });
  }

  const password = "password12345"; // untuk demo; WAJIB ganti di produksi

  // Tahun ajaran aktif
  const year = await prisma.academicYear.upsert({
    where: { schoolId_name: { schoolId: school.id, name: "2025/2026" } },
    update: {},
    create: {
      schoolId: school.id,
      name: "2025/2026",
      startDate: new Date("2025-07-01"),
      endDate: new Date("2026-06-30"),
      isActive: true,
    },
  });

  // Semester Ganjil & Genap — WAJIB ada, bukan pelengkap.
  //
  // Penilaian, komponen nilai, dan rapor semuanya terikat semester; tanpa
  // baris ini halaman Penilaian dan Rapor tampil kosong walaupun sekolah,
  // kelas, dan mapelnya sudah lengkap.
  // `createMany + skipDuplicates` TIDAK cukup: Semester hanya punya unique
  // (academicYearId, name), jadi "Ganjil" (isActive mode uji) dan "Ganjil"
  // (dari seed-activity, isActive=false) dianggap beda baris → dobel.
  // Cek dulu per nama, buat hanya bila belum ada.
  // ponytail: cek-lalu-buat, bukan constraint unik; ganti ke upsert kalau
  // Semester kelak punya unique (academicYearId, name).
  const semesterDefs = [
    {
      name: "Ganjil",
      type: "GANJIL" as const,
      startDate: new Date("2025-07-01"),
      endDate: new Date("2025-12-31"),
      isActive: true,
    },
    {
      name: "Genap",
      type: "GENAP" as const,
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-06-30"),
      isActive: false,
    },
  ];
  for (const sd of semesterDefs) {
    const existing = await prisma.semester.findFirst({
      where: { academicYearId: year.id, name: sd.name },
      select: { id: true },
    });
    if (!existing) {
      await prisma.semester.create({ data: { academicYearId: year.id, ...sd } });
    }
  }

  // Admin sekolah
  await prisma.user.upsert({
    where: { email: input.adminEmail },
    update: {},
    create: {
      email: input.adminEmail,
      name: input.adminName,
      passwordHash: await hashPassword(password),
      role: "SCHOOL_ADMIN" as UserRole,
      schoolId: school.id,
    },
  });

  // Guru + akun
  const teacher = await prisma.teacher.upsert({
    where: { schoolId_nip: { schoolId: school.id, nip: `G-${school.slug}` } },
    update: {},
    create: {
      schoolId: school.id,
      nip: `G-${school.slug}`,
      fullName: input.teacherName,
      gender: "FEMALE",
      email: input.teacherEmail,
    },
  });

  await prisma.user.upsert({
    where: { email: input.teacherEmail },
    update: {},
    create: {
      email: input.teacherEmail,
      name: input.teacherName,
      passwordHash: await hashPassword(password),
      role: "TEACHER" as UserRole,
      schoolId: school.id,
      teacherId: teacher.id,
    },
  });

  // Kelas + mapel + jam + siswa contoh
  const cls = await prisma.class.upsert({
    where: { schoolId_academicYearId_name: { schoolId: school.id, academicYearId: year.id, name: "7A" } },
    update: {},
    create: {
      schoolId: school.id,
      academicYearId: year.id,
      name: "7A",
      level: 7,
      homeroomTeacherId: teacher.id,
    },
  });

  await prisma.subject.upsert({
    where: { schoolId_code: { schoolId: school.id, code: "MAT" } },
    update: {},
    create: { schoolId: school.id, code: "MAT", name: "Matematika", kkm: 70 },
  });

  for (let i = 1; i <= 4; i++) {
    await prisma.timeSlot.upsert({
      where: { schoolId_slotNumber: { schoolId: school.id, slotNumber: i } },
      update: {},
      create: {
        schoolId: school.id,
        slotNumber: i,
        startTime: `${String(6 + i).padStart(2, "0")}:00`,
        endTime: `${String(6 + i).padStart(2, "0")}:45`,
      },
    });
  }

  await prisma.student.upsert({
    where: { schoolId_nis: { schoolId: school.id, nis: `S-${school.slug}-01` } },
    update: {},
    create: {
      schoolId: school.id,
      nis: `S-${school.slug}-01`,
      nisn: `00${school.slug.length}1234567`,
      fullName: "Budi Santoso",
      gender: "MALE",
      entryYear: 2025,
      classId: cls.id,
      status: "ACTIVE",
      parents: {
        create: {
          fullName: "Siti Santoso",
          relation: "MOTHER",
          phone: "628123456789",
          isPrimary: true,
        },
      },
    },
  });

  return school;
}

/**
 * Data contoh khusus SMK: jurusan, mapel produktif, kelas per jurusan, dan
 * satu contoh PKL + UKK.
 *
 * Dipisah dari `seedSchool` karena hanya berlaku untuk jenjang kejuruan —
 * menaruhnya di jalur umum berarti SD/SMP ikut mendapat tabel jurusan kosong
 * yang tidak pernah dipakai.
 */
async function seedVocational(schoolId: string) {
  const majors = [
    { code: "RPL", name: "Rekayasa Perangkat Lunak" },
    { code: "TKJ", name: "Teknik Komputer dan Jaringan" },
    { code: "AKL", name: "Akuntansi dan Keuangan Lembaga" },
  ];

  const created: { id: string; code: string }[] = [];
  for (const m of majors) {
    const row = await prisma.major.upsert({
      where: { schoolId_code: { schoolId, code: m.code } },
      update: {},
      create: { schoolId, code: m.code, name: m.name, isActive: true },
      select: { id: true, code: true },
    });
    created.push(row);
  }

  // Mapel produktif per jurusan — inilah yang membedakan SMK dari SMA.
  const productive: Record<string, { code: string; name: string }[]> = {
    RPL: [
      { code: "PWEB", name: "Pemrograman Web" },
      { code: "PBO", name: "Pemrograman Berorientasi Objek" },
      { code: "BASDAT", name: "Basis Data" },
    ],
    TKJ: [
      { code: "JARDAS", name: "Jaringan Dasar" },
      { code: "ADMJAR", name: "Administrasi Jaringan" },
      { code: "KOMJAR", name: "Komunikasi Jaringan" },
    ],
    AKL: [
      { code: "AKDAS", name: "Akuntansi Dasar" },
      { code: "AKKEU", name: "Akuntansi Keuangan" },
      { code: "PERPAJAKAN", name: "Perpajakan" },
    ],
  };

  for (const major of created) {
    for (const s of productive[major.code] ?? []) {
      await prisma.subject.upsert({
        where: { schoolId_code: { schoolId, code: s.code } },
        update: {},
        create: {
          schoolId,
          code: s.code,
          name: s.name,
          kkm: 75,
          group: "KEJURUAN",
          majorId: major.id,
        },
      });
    }
  }

  // Kelas tingkat X per jurusan, plus satu kelas umum tanpa jurusan sebagai
  // contoh bahwa jurusan bersifat opsional.
  const year = await prisma.academicYear.findFirst({
    where: { schoolId, isActive: true },
    select: { id: true, startDate: true },
  });
  if (!year) return;

  for (const major of created) {
    await prisma.class.upsert({
      where: {
        schoolId_academicYearId_name: {
          schoolId,
          academicYearId: year.id,
          name: `X ${major.code} 1`,
        },
      },
      update: {},
      create: {
        schoolId,
        academicYearId: year.id,
        name: `X ${major.code} 1`,
        level: 10,
        capacity: 32,
        majorId: major.id,
      },
    });
  }

  // Siswa contoh + komponen nilai + nilai.
  //
  // Tanpa ini, halaman Rapor per siswa tampil kosong dan pengelompokan mapel
  // (Umum vs Kejuruan) tidak bisa dinilai sama sekali. Satu siswa cukup untuk
  // memperlihatkan bentuk rapornya.
  const teacher = await prisma.teacher.findFirst({
    where: { schoolId, deletedAt: null },
    select: { id: true },
  });
  const rplClass = await prisma.class.findFirst({
    where: { schoolId, academicYearId: year.id, name: "X RPL 1" },
    select: { id: true },
  });
  const rplMajor = created.find((m) => m.code === "RPL");

  if (teacher && rplClass) {
    const student = await prisma.student.upsert({
      where: { schoolId_nis: { schoolId, nis: "RPL-001" } },
      update: {},
      create: {
        schoolId,
        nis: "RPL-001",
        fullName: "Siti Rahmawati",
        gender: "FEMALE",
        entryYear: year.startDate.getFullYear(),
        classId: rplClass.id,
        majorId: rplMajor?.id ?? null,
        status: "ACTIVE",
      },
      select: { id: true },
    });

    // Satu mapel umum + dua mapel produktif → dua kelompok terlihat di rapor.
    const subjects = await prisma.subject.findMany({
      where: { schoolId, code: { in: ["MAT", "PWEB", "BASDAT"] } },
      select: { id: true, code: true },
    });

    const componentDefs = [
      { name: "Tugas", type: "ASSIGNMENT" as const, weight: 20 },
      { name: "UTS", type: "MIDTERM" as const, weight: 30 },
      { name: "UAS", type: "FINAL" as const, weight: 50 },
    ];

    for (const subject of subjects) {
      for (const def of componentDefs) {
        const item = await prisma.gradeItem.create({
          data: {
            schoolId,
            subjectId: subject.id,
            academicYearId: year.id,
            teacherId: teacher.id,
            name: `${def.name} — ${subject.code}`,
            type: def.type,
            weight: def.weight,
            maxScore: 100,
          },
          select: { id: true },
        });
        await prisma.grade.create({
          data: {
            schoolId,
            gradeItemId: item.id,
            studentId: student.id,
            subjectId: subject.id,
            classId: rplClass.id,
            score: 80 + Math.floor(Math.random() * 15),
          },
        });
      }
    }
  }

  console.log(
    `  ✓ ${created.length} jurusan SMK + mapel produktif + kelas X + contoh nilai`,
  );
}

async function main() {
  console.log("Seeding database…");

  await seedPlans();

  const smp = await seedSchool({
    name: "SMP Negeri 1 Nusantara",
    slug: "smpn1-nusantara",
    npsn: "12345678",
    level: "SMP",
    themeColor: "#1F4B43",
    planCode: "pro",
    adminEmail: "admin@smpn1.sch.id",
    adminName: "Rina Admin",
    teacherEmail: "guru@smpn1.sch.id",
    teacherName: "Dewi Guru",
  });

  const sd = await seedSchool({
    name: "SD Tunas Harapan",
    slug: "sd-tunas-harapan",
    npsn: "87654321",
    level: "SD",
    themeColor: "#1E40AF",
    planCode: "basic",
    adminEmail: "admin@tunasharapan.sch.id",
    adminName: "Andi Admin",
    teacherEmail: "guru@tunasharapan.sch.id",
    teacherName: "Sari Guru",
  });

  // SMK contoh: satu-satunya sekolah di seed yang memakai jurusan, PKL, dan
  // UKK. Tanpa contoh ini, fitur kejuruan tidak bisa dicoba sama sekali.
  const smk = await seedSchool({
    name: "SMK Negeri 2 Nusantara",
    slug: "smkn2-nusantara",
    npsn: "11223344",
    level: "SMK",
    themeColor: "#7C2D12",
    planCode: "pro",
    adminEmail: "admin@smkn2.sch.id",
    adminName: "Bayu Admin",
    teacherEmail: "guru@smkn2.sch.id",
    teacherName: "Joko Guru",
  });

  await seedVocational(smk.id);

  // Super-admin (lintas sekolah)
  const superEmail =
    process.env.SEED_SUPERADMIN_EMAIL ?? "admin@schoolapp.local";
  const superPassword =
    process.env.SEED_SUPERADMIN_PASSWORD ?? "changeme12345";

  await prisma.user.upsert({
    where: { email: superEmail },
    update: {},
    create: {
      email: superEmail,
      name: "Super Admin",
      passwordHash: await hashPassword(superPassword),
      role: "SUPER_ADMIN" as UserRole,
      schoolId: null,
    },
  });

  console.log("  ✓ 2 sekolah contoh (multi-tenant)");
  console.log(`  ✓ super-admin: ${superEmail}`);
  console.log(`  ✓ admin SMP   : admin@smpn1.sch.id (${smp.slug})`);
  console.log(`  ✓ admin SD    : admin@tunasharapan.sch.id (${sd.slug})`);
  console.log(`  ✓ admin SMK   : admin@smkn2.sch.id (${smk.slug})`);

  // ------------------------------------------------------------------
  // AKTIVITAS DEMO — hanya untuk SATU sekolah.
  // ------------------------------------------------------------------
  //
  // Mengisi riwayat 2 tahun (absensi, nilai, tagihan, notifikasi, log
  // aktivitas, SPMB) supaya tampilan bisa dinilai dengan data yang padat.
  //
  // HANYA SMP: mengisi dua sekolah berarti menggandakan waktu seed tanpa
  // menambah hal baru untuk dilihat — sekolah kedua tetap berguna sebagai
  // bukti isolasi tenant (angkanya harus berbeda).
  //
  // Bisa dimatikan: SEED_DEMO_ACTIVITY=0
  // Aman dijalankan ulang: fungsi ini berhenti sendiri bila absensi sudah ada.
  if (process.env.SEED_DEMO_ACTIVITY !== "0") {
    console.log("\nMengisi aktivitas demo 2 tahun (SMP Negeri 1 Nusantara)…");
    await seedActivityForSchool(prisma, smp.id);
  } else {
    console.log("\nℹ SEED_DEMO_ACTIVITY=0 — aktivitas demo dilewati");
  }

  console.log("\n  ℹ password semua akun demo: password12345");
  console.log("Seeding selesai.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
