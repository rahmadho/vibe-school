import "server-only";
import { cache } from "react";
import type { SubscriptionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * ============================================================
 * ENTITLEMENT — LAPIS KEDUA SETELAH RBAC
 * ============================================================
 *
 * RBAC menjawab: "peran ini boleh membuka modul ini?"
 * Entitlement menjawab: "paket sekolah ini MEMBAYAR fitur ini?"
 *
 * Dua pertanyaan itu tidak saling menggantikan:
 *  - Bendahara punya izin `finance:manage`, tetapi sekolah berpaket Basic
 *    tidak membayar gateway → tetap ditolak.
 *  - Sekolah berpaket Enterprise tetap tidak boleh membuka keuangan bila
 *    perannya bukan bendahara.
 *
 * Karena itu setiap mutasi yang menyentuh fitur berbayar WAJIB melewati
 * `wajibFitur()` — menyembunyikan menu saja tidak menegakkan apa pun, dan
 * Server Action bisa dipanggil langsung tanpa melewati UI.
 *
 * REACT `cache()`: satu request dapat memanggil `bolehFitur()` beberapa kali
 * (beberapa tombol, beberapa pemeriksaan), tetapi hanya SATU query ke database.
 */

export type FiturKey =
  | "wa"
  | "spmb"
  | "reportPdf"
  | "paymentGateway"
  | "whiteLabel"
  | "multiUnit";

/** Nama fitur untuk pesan yang dibaca pengguna. */
export const FITUR_LABEL: Record<FiturKey, string> = {
  wa: "Notifikasi WhatsApp",
  spmb: "SPMB (pendaftaran murid baru)",
  reportPdf: "Rapor PDF",
  paymentGateway: "Pembayaran via gateway",
  whiteLabel: "White-label",
  multiUnit: "Multi-unit (yayasan)",
};

/** Status hasil penilaian entitlement — bukan selalu sama dengan status DB. */
export type StatusEntitlement =
  | SubscriptionStatus
  | "KEDALUWARSA"
  | "TANPA_PAKET";

export type Entitlement = {
  planCode: string | null;
  planName: string | null;
  status: StatusEntitlement;
  expiresAt: Date | null;
  fitur: Record<FiturKey, boolean>;
  maxStudents: number;
  terpakai: { students: number; teachers: number };
  graceDays: number;
};

/** Masa tenggang: langganan lewat tetap jalan beberapa hari. */
export const GRACE_DAYS = 7;

const SEMUA_MATI: Record<FiturKey, boolean> = {
  wa: false,
  spmb: false,
  reportPdf: false,
  paymentGateway: false,
  whiteLabel: false,
  multiUnit: false,
};

/**
 * Baca `Plan.features` (Json) menjadi peta boolean.
 * Fitur yang TIDAK disebut dianggap false — aman secara default: fitur baru
 * yang ditambahkan kelak tidak otomatis terbuka untuk semua paket.
 */
function bacaFitur(features: unknown): Record<FiturKey, boolean> {
  if (!features || typeof features !== "object") return { ...SEMUA_MATI };
  const src = features as Record<string, unknown>;
  const hasil = { ...SEMUA_MATI };
  for (const key of Object.keys(SEMUA_MATI) as FiturKey[]) {
    hasil[key] = src[key] === true;
  }
  return hasil;
}

/** Penilaian MURNI (tanpa DB) — mudah diuji. */
export function nilaiEntitlement(input: {
  status: SubscriptionStatus;
  expiresAt: Date;
  features: unknown;
  maxStudents: number;
  planCode: string;
  planName: string;
  terpakai: { students: number; teachers: number };
  sekarang?: Date;
}): Omit<Entitlement, "graceDays"> {
  const sekarang = input.sekarang ?? new Date();
  const batas = new Date(input.expiresAt);
  batas.setDate(batas.getDate() + GRACE_DAYS);

  const dasar = {
    planCode: input.planCode,
    planName: input.planName,
    expiresAt: input.expiresAt,
    terpakai: input.terpakai,
  };

  // Ditangguhkan & dibatalkan: fitur mati total, tetapi data tetap terbaca.
  if (input.status === "SUSPENDED") {
    return { ...dasar, status: "SUSPENDED", fitur: { ...SEMUA_MATI }, maxStudents: 0 };
  }
  if (input.status === "CANCELLED") {
    return { ...dasar, status: "CANCELLED", fitur: { ...SEMUA_MATI }, maxStudents: 0 };
  }

  const lewatTenggang = input.status === "EXPIRED" || sekarang.getTime() > batas.getTime();
  if (lewatTenggang) {
    return {
      ...dasar,
      status: "KEDALUWARSA",
      fitur: { ...SEMUA_MATI },
      // Kuota 0 = tidak bisa menambah siswa, tetapi data lama tetap ada
      // (soft delete & baca tetap jalan; langganan bukan alat penghapus data).
      maxStudents: 0,
    };
  }

  // TRIAL / ACTIVE / EXPIRED-masih-dalam-tenggang.
  return {
    ...dasar,
    status: input.status === "EXPIRED" ? "KEDALUWARSA" : input.status,
    fitur: bacaFitur(input.features),
    maxStudents: input.maxStudents,
  };
}

/** Ambil entitlement satu sekolah. Satu request = satu query. */
export const getEntitlement = cache(async (schoolId: string): Promise<Entitlement> => {
  const [sub, students, teachers] = await Promise.all([
    prisma.subscription.findUnique({
      where: { schoolId },
      include: { plan: true },
    }),
    prisma.student.count({ where: { schoolId, deletedAt: null } }),
    prisma.teacher.count({ where: { schoolId, deletedAt: null } }),
  ]);

  // Tanpa langganan sama sekali: tidak ada yang dibayar, jadi tidak ada
  // fitur. Modul akademik/absensi tetap terbuka karena memang bukan fitur
  // berbayar — dan tanpa data siswa sekolah tidak bisa beroperasi.
  if (!sub) {
    return {
      planCode: null,
      planName: null,
      status: "TANPA_PAKET",
      expiresAt: null,
      fitur: { ...SEMUA_MATI },
      maxStudents: 0,
      terpakai: { students, teachers },
      graceDays: GRACE_DAYS,
    };
  }

  return {
    ...nilaiEntitlement({
      status: sub.status,
      expiresAt: sub.expiresAt,
      features: sub.plan.features,
      maxStudents: sub.plan.maxStudents,
      planCode: sub.plan.code,
      planName: sub.plan.name,
      terpakai: { students, teachers },
    }),
    graceDays: GRACE_DAYS,
  };
});

/** Apakah paket sekolah ini mencakup fitur tersebut? (versi non-melempar) */
export async function bolehFitur(schoolId: string, fitur: FiturKey): Promise<boolean> {
  const e = await getEntitlement(schoolId);
  return e.fitur[fitur] === true;
}

/**
 * Pastikan paket sekolah mencakup fitur; MELEMPAR bila tidak.
 *
 * Pesannya sengaja menyebut nama fitur & langkah berikutnya — admin sekolah
 * yang menekan tombol lalu mendapat "Forbidden" tidak tahu harus berbuat apa.
 */
export async function wajibFitur(schoolId: string, fitur: FiturKey): Promise<void> {
  const e = await getEntitlement(schoolId);
  if (e.fitur[fitur] === true) return;

  const label = FITUR_LABEL[fitur];
  if (e.status === "TANPA_PAKET") {
    throw new Error(
      `Sekolah ini belum punya paket langganan, sehingga fitur ${label} belum aktif. ` +
        `Hubungi admin layanan untuk mengaktifkan paket.`,
    );
  }
  if (e.status === "KEDALUWARSA") {
    throw new Error(
      `Paket langganan sekolah ini sudah kedaluwarsa, sehingga fitur ${label} dinonaktifkan. ` +
        `Perpanjang paket dari halaman Langganan untuk memakainya lagi.`,
    );
  }
  if (e.status === "SUSPENDED" || e.status === "CANCELLED") {
    throw new Error(
      `Paket langganan sekolah ini sedang tidak aktif, sehingga fitur ${label} dinonaktifkan. ` +
        `Hubungi admin layanan.`,
    );
  }
  throw new Error(
    `Paket langganan sekolah ini tidak mencakup fitur ${label}. ` +
      `Hubungi admin layanan untuk upgrade paket.`,
  );
}

export type HasilKuota = {
  boleh: boolean;
  terpakai: number;
  batas: number;
  pesan?: string;
};

/**
 * Cek kuota siswa sebelum menambah data.
 *
 * @param tambahan - jumlah siswa yang akan ditambahkan (impor massal mengirim
 *   jumlah baris, bukan 1 — kalau tidak, impor 500 siswa lolos kuota 200).
 *
 * Tanpa paket / kedaluwarsa: batas 0, sehingga penambahan ditolak. Ini
 * disengaja — kuota adalah bagian dari yang dibayar. Sekolah yang sudah
 * kedaluwarsa masih bisa MELIHAT dan mengelola data lamanya.
 */
export async function cekKuotaSiswa(
  schoolId: string,
  tambahan = 1,
): Promise<HasilKuota> {
  const e = await getEntitlement(schoolId);
  const terpakai = e.terpakai.students;
  const batas = e.maxStudents;
  const n = Math.max(1, Math.trunc(tambahan));

  if (batas <= 0) {
    return {
      boleh: false,
      terpakai,
      batas,
      pesan:
        e.status === "TANPA_PAKET"
          ? "Sekolah ini belum punya paket langganan aktif, sehingga siswa baru tidak bisa ditambahkan. Hubungi admin layanan."
          : "Paket langganan sekolah ini sudah tidak aktif, sehingga siswa baru tidak bisa ditambahkan. Perpanjang paket terlebih dahulu.",
    };
  }

  if (terpakai + n > batas) {
    const sisa = Math.max(0, batas - terpakai);
    return {
      boleh: false,
      terpakai,
      batas,
      pesan:
        `Kuota siswa paket ${e.planName ?? "sekarang"} tidak cukup: ` +
        `terpakai ${terpakai} dari ${batas}, sisa ${sisa}. ` +
        `Penambahan ${n} siswa akan melewati batas. ` +
        `Naikkan paket dari halaman Langganan.`,
    };
  }

  return { boleh: true, terpakai, batas };
}
