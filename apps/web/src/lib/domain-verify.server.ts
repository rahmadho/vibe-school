import "server-only";
import { randomBytes } from "node:crypto";
import { resolveTxt } from "node:dns/promises";
import type { DomainVerifyStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  evaluasiDns,
  hostAdaDiZonaTerpercaya,
  normalisasiHost,
  zonaTerpercayaFromEnv,
  type HasilDns,
} from "@/lib/domain-verify";

/**
 * Sisi SERVER verifikasi domain: DNS + DB. Logika murni ada di
 * lib/domain-verify.ts; berkas ini menyentuh jaringan dan database.
 * (Dipisah karena `server-only` melempar di luar React Server — modul murni
 * harus tetap bisa diimpor vitest.)
 */

export { normalisasiHost } from "@/lib/domain-verify";

/** Setelah N kegagalan, host dikunci — mencegah layanan ini dipakai sebagai
 *  alat pemindaian DNS bebas (tiap percobaan = satu query ke resolver publik). */
export const MAX_PERCOBAAN = 10;

/** Batas waktu resolver. Tanpa ini, request HTTP bisa menggantung lama. */
const DNS_TIMEOUT_MS = 5000;

/** Token 32 hex. */
export function buatToken(): string {
  return randomBytes(16).toString("hex");
}

/** Apakah host ini di zona milik penyedia layanan (demo)? */
export function diZonaTerpercaya(host: string): boolean {
  return hostAdaDiZonaTerpercaya(host, zonaTerpercayaFromEnv());
}

/**
 * Resolve TXT record dengan batas waktu. Kegagalan DNS bukan galat fatal —
 * dikembalikan sebagai {ok:false, reason} agar bisa disimpan sebagai lastError.
 */
export async function cekDnsTxt(host: string, token: string): Promise<HasilDns> {
  const name = `_sekolah-verify.${host}`;
  try {
    const records = await Promise.race([
      resolveTxt(name),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("timeout")),
          DNS_TIMEOUT_MS,
        ).unref?.(),
      ),
    ]);
    return evaluasiDns(records, token);
  } catch (err) {
    const code = err instanceof Error ? err.message : "";
    return {
      ok: false,
      reason:
        code === "timeout"
          ? "Server DNS tidak menjawab dalam 5 detik. Coba lagi beberapa saat lagi."
          : `Record TXT belum bisa dibaca (${code || "galat DNS"}). Pastikan record ${name} sudah dibuat dan DNS sudah menyebar.`,
    };
  }
}

export type HasilVerifikasi = {
  ok: boolean;
  status: DomainVerifyStatus;
  reason?: string;
  /** Percobaan gagal tersisa sebelum host dikunci. */
  sisaPercobaan?: number;
};

/**
 * Verifikasi domain UTAMA sekolah (`School.customDomain`).
 *
 * Zona terpercaya (DOMAIN_TRUSTED_ZONES) → langsung VERIFIED tanpa DNS.
 * Selain itu → TXT dibaca, status & jejak kegagalan disimpan.
 */
export async function verifikasiDomain(
  schoolId: string,
  host: string,
): Promise<HasilVerifikasi> {
  const bersih = normalisasiHost(host);
  if (!bersih) {
    return { ok: false, status: "UNVERIFIED", reason: "Nama domain tidak sah." };
  }

  const school = await prisma.school.findFirst({
    where: { id: schoolId, deletedAt: null },
    select: {
      id: true,
      customDomain: true,
      domainVerifyToken: true,
      domainVerifyAttempts: true,
    },
  });
  if (!school) return { ok: false, status: "UNVERIFIED", reason: "Sekolah tidak ditemukan." };
  if (school.customDomain !== bersih) {
    return {
      ok: false,
      status: "UNVERIFIED",
      reason: "Domain ini bukan domain utama sekolah tersebut.",
    };
  }

  const token = school.domainVerifyToken ?? buatToken();
  const sekarang = new Date();

  // ---- Zona terpercaya: tidak ada DNS yang perlu dibaca ----
  if (diZonaTerpercaya(bersih)) {
    await prisma.school.update({
      where: { id: schoolId },
      data: {
        domainVerifyToken: token,
        domainVerifyStatus: "VERIFIED",
        domainVerifiedAt: sekarang,
        domainVerifyCheckedAt: sekarang,
        domainVerifyLastError: null,
      },
    });
    return {
      ok: true,
      status: "VERIFIED",
      reason: "Domain ada di zona layanan — terverifikasi otomatis tanpa DNS.",
    };
  }

  if (school.domainVerifyAttempts >= MAX_PERCOBAAN) {
    await prisma.school.update({
      where: { id: schoolId },
      data: { domainVerifyStatus: "FAILED", domainVerifyCheckedAt: sekarang },
    });
    return {
      ok: false,
      status: "FAILED",
      reason:
        `Percobaan verifikasi sudah ${MAX_PERCOBAAN} kali dan semuanya gagal. ` +
        `Periksa record TXT sekali lagi, lalu hubungi admin layanan untuk membuka kunci.`,
    };
  }

  const hasil = await cekDnsTxt(bersih, token);

  if (hasil.ok) {
    await prisma.school.update({
      where: { id: schoolId },
      data: {
        domainVerifyToken: token,
        domainVerifyStatus: "VERIFIED",
        domainVerifiedAt: sekarang,
        domainVerifyCheckedAt: sekarang,
        domainVerifyLastError: null,
      },
    });
    return { ok: true, status: "VERIFIED", reason: "Domain terverifikasi." };
  }

  const attempts = school.domainVerifyAttempts + 1;
  const terkunci = attempts >= MAX_PERCOBAAN;
  await prisma.school.update({
    where: { id: schoolId },
    data: {
      domainVerifyToken: token,
      domainVerifyStatus: terkunci ? "FAILED" : "PENDING",
      domainVerifyCheckedAt: sekarang,
      domainVerifyAttempts: attempts,
      domainVerifyLastError: hasil.reason ?? null,
    },
  });

  return {
    ok: false,
    status: terkunci ? "FAILED" : "PENDING",
    reason: terkunci
      ? `${hasil.reason ?? "Record TXT tidak cocok."} Batas ${MAX_PERCOBAAN} percobaan tercapai — hubungi admin layanan.`
      : hasil.reason,
    sisaPercobaan: Math.max(0, MAX_PERCOBAAN - attempts),
  };
}

/**
 * Daftarkan domain UTAMA. Token dibuat bila belum ada; status kembali
 * UNVERIFIED (domain baru = bukti lama tidak berlaku).
 */
export async function daftarkanDomainUtama(schoolId: string, host: string) {
  const bersih = normalisasiHost(host);
  if (!bersih) return null;

  const token = buatToken();
  await prisma.school.update({
    where: { id: schoolId },
    data: {
      customDomain: bersih,
      domainVerifyToken: token,
      domainVerifyStatus: "UNVERIFIED",
      domainVerifiedAt: null,
      domainVerifyAttempts: 0,
      domainVerifyLastError: null,
      domainVerifyCheckedAt: null,
    },
  });
  return { host: bersih, token };
}

/**
 * Buat/ambil domain TAMBAHAN sekolah. Mengembalikan token yang harus dipasang
 * sebagai TXT. Bila alias sudah ada dan milik sekolah ini, token lama dipakai
 * ulang (supaya record TXT yang sudah dipasang tidak batal).
 */
export async function pastikanDomainTerdaftar(schoolId: string, host: string) {
  const bersih = normalisasiHost(host);
  if (!bersih) return null;

  const ada = await prisma.schoolHostAlias.findUnique({ where: { host: bersih } });
  if (ada && ada.schoolId !== schoolId) return "KONFLIK" as const;

  if (ada) {
    // Didaftarkan ulang: anggap belum terbukti sampai diverifikasi lagi.
    const alias = await prisma.schoolHostAlias.update({
      where: { id: ada.id },
      data: { lastError: null },
    });
    return alias;
  }

  return prisma.schoolHostAlias.create({
    data: { schoolId, host: bersih, verifyToken: buatToken() },
  });
}

/** Verifikasi satu domain TAMBAHAN. */
export async function verifikasiAlias(
  schoolId: string,
  host: string,
): Promise<HasilVerifikasi> {
  const bersih = normalisasiHost(host);
  if (!bersih) return { ok: false, status: "UNVERIFIED", reason: "Nama domain tidak sah." };

  const alias = await prisma.schoolHostAlias.findFirst({
    where: { schoolId, host: bersih },
  });
  if (!alias) {
    return { ok: false, status: "UNVERIFIED", reason: "Domain belum terdaftar." };
  }

  const sekarang = new Date();

  if (diZonaTerpercaya(bersih)) {
    await prisma.schoolHostAlias.update({
      where: { id: alias.id },
      data: {
        verifyStatus: "VERIFIED",
        verifiedAt: sekarang,
        checkedAt: sekarang,
        lastError: null,
      },
    });
    return {
      ok: true,
      status: "VERIFIED",
      reason: "Domain ada di zona layanan — terverifikasi otomatis tanpa DNS.",
    };
  }

  if (alias.verifyStatus === "VERIFIED") {
    return { ok: true, status: "VERIFIED", reason: "Domain sudah terverifikasi." };
  }

  const gagalSebelumnya = alias.attempts;
  if (gagalSebelumnya >= MAX_PERCOBAAN) {
    await prisma.schoolHostAlias.update({
      where: { id: alias.id },
      data: { verifyStatus: "FAILED", checkedAt: sekarang },
    });
    return {
      ok: false,
      status: "FAILED",
      reason:
        `Percobaan verifikasi sudah ${MAX_PERCOBAAN} kali. ` +
        `Periksa record TXT sekali lagi, lalu hubungi admin layanan untuk membuka kunci.`,
    };
  }

  const hasil = await cekDnsTxt(bersih, alias.verifyToken);
  if (hasil.ok) {
    await prisma.schoolHostAlias.update({
      where: { id: alias.id },
      data: {
        verifyStatus: "VERIFIED",
        verifiedAt: sekarang,
        checkedAt: sekarang,
        lastError: null,
      },
    });
    return { ok: true, status: "VERIFIED", reason: "Domain terverifikasi." };
  }

  const gagal = gagalSebelumnya + 1;
  const terkunci = gagal >= MAX_PERCOBAAN;
  const alasan = hasil.reason ?? "Record TXT tidak cocok.";
  await prisma.schoolHostAlias.update({
    where: { id: alias.id },
    data: {
      verifyStatus: terkunci ? "FAILED" : "PENDING",
      checkedAt: sekarang,
      attempts: gagal,
      lastError: alasan,
    },
  });
  return {
    ok: false,
    status: terkunci ? "FAILED" : "PENDING",
    reason: terkunci
      ? `${alasan} Batas ${MAX_PERCOBAAN} percobaan tercapai — hubungi admin layanan.`
      : alasan,
    sisaPercobaan: MAX_PERCOBAAN - gagal,
  };
}
