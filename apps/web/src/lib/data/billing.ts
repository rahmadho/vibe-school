import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Query layer Langganan — dibaca dari sudut pandang SATU sekolah.
 *
 * KEBALIKAN dari modul `schools`: di sini bukan super-admin yang mengelola
 * semua sekolah, melainkan admin sekolah melihat paketnya sendiri. Karenanya
 * SELALU menerima `schoolId` dan tidak pernah lintas-tenant — walau tabel
 * `Plan` bersifat global (katalog produk), yang ditampilkan hanya paket milik
 * sekolah ini.
 */

export type BillingView = {
  subscription: {
    id: string;
    status: string;
    startedAt: Date;
    expiresAt: Date;
    autoRenew: boolean;
  } | null;
  plan: {
    id: string;
    name: string;
    code: string;
    pricePerMonth: number;
    maxStudents: number;
    features: unknown;
  } | null;
  /** Paket lain yang bisa dipilih, untuk perbandingan. */
  otherPlans: {
    id: string;
    name: string;
    code: string;
    pricePerMonth: number;
    maxStudents: number;
    features: unknown;
  }[];
  /** Pemakaian saat ini, dibandingkan batas paket. */
  usage: { students: number; teachers: number };
  school: { name: string; level: string; isActive: boolean } | null;
};

export async function getBilling(schoolId: string): Promise<BillingView> {
  const [subscription, school, students, teachers] = await Promise.all([
    prisma.subscription.findUnique({
      where: { schoolId },
      include: { plan: true },
    }),
    prisma.school.findUnique({
      where: { id: schoolId },
      select: { name: true, level: true, isActive: true },
    }),
    prisma.student.count({ where: { schoolId, deletedAt: null } }),
    prisma.teacher.count({ where: { schoolId, deletedAt: null } }),
  ]);

  const plan = subscription?.plan ?? null;

  // Katalog paket lain — untuk menjawab "apa yang saya dapat kalau naik?"
  const otherPlans = await prisma.plan.findMany({
    where: { isActive: true, ...(plan ? { id: { not: plan.id } } : {}) },
    orderBy: { pricePerMonth: "asc" },
    select: {
      id: true,
      name: true,
      code: true,
      pricePerMonth: true,
      maxStudents: true,
      features: true,
    },
  });

  return {
    subscription: subscription
      ? {
          id: subscription.id,
          status: subscription.status,
          startedAt: subscription.startedAt,
          expiresAt: subscription.expiresAt,
          autoRenew: subscription.autoRenew,
        }
      : null,
    plan: plan
      ? {
          id: plan.id,
          name: plan.name,
          code: plan.code,
          pricePerMonth: plan.pricePerMonth,
          maxStudents: plan.maxStudents,
          features: plan.features,
        }
      : null,
    otherPlans,
    usage: { students, teachers },
    school,
  };
}

/** Label status langganan. */
export const SUBSCRIPTION_STATUS_LABEL: Record<string, string> = {
  TRIAL: "Masa coba",
  ACTIVE: "Aktif",
  SUSPENDED: "Ditangguhkan",
  EXPIRED: "Kedaluwarsa",
  CANCELLED: "Dibatalkan",
};

/**
 * Warna status — dipakai hemat, hanya untuk makna.
 * Sesuai arah desain: hijau papan tulis untuk keadaan baik, merah spidol
 * untuk yang perlu perhatian, abu-abu untuk yang sudah lewat.
 */
export const SUBSCRIPTION_STATUS_TONE: Record<string, "ok" | "warn" | "muted"> = {
  ACTIVE: "ok",
  TRIAL: "ok",
  SUSPENDED: "warn",
  EXPIRED: "warn",
  CANCELLED: "muted",
};

/** Fitur yang bisa ditampilkan sebagai daftar centang. */
export const PLAN_FEATURE_LABEL: Record<string, string> = {
  wa: "Notifikasi WhatsApp",
  spmb: "SPMB (pendaftaran murid baru)",
  reportPdf: "Rapor PDF",
  paymentGateway: "Pembayaran via gateway",
  whiteLabel: "White-label penuh",
  multiUnit: "Multi-unit (yayasan)",
};

/**
 * Ambil fitur dari kolom Json.
 * Bentuknya `{ wa: true, spmb: false }` — disaring agar nilai non-boolean
 * (dari data lama yang salah bentuk) tidak merusak tampilan.
 */
export function planFeatures(features: unknown): { key: string; enabled: boolean }[] {
  if (!features || typeof features !== "object") return [];
  return Object.entries(features as Record<string, unknown>)
    .filter(([, v]) => typeof v === "boolean")
    .map(([key, enabled]) => ({ key, enabled: enabled as boolean }));
}
