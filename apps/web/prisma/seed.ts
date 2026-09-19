import { PrismaClient, type SchoolLevel, type UserRole } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

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
  console.log("  ℹ password semua akun demo: password12345");
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
