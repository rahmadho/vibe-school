"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { guard, requestMeta } from "@/lib/action-guard";
import type { ActionResult } from "@/lib/action-result";
import { getEntitlement } from "@/lib/entitlement";
import { normalisasiHost } from "@/lib/domain-verify";
import {
  daftarkanDomainUtama,
  diZonaTerpercaya,
  pastikanDomainTerdaftar,
  verifikasiAlias,
  verifikasiDomain,
} from "@/lib/domain-verify.server";
import { domainExists } from "@/lib/data/schools";

/**
 * Server Actions DOMAIN — bagian dari white-label (add-on berbayar).
 *
 * DUA GERBANG yang tidak boleh digabung:
 *  1. RBAC `schools:manage` — hanya super-admin yang mengelola sekolah.
 *  2. Entitlement `whiteLabel` — sekolah harus MEMBELI add-on domain.
 *     Tombol UI bisa disembunyikan, tetapi Server Action tetap bisa dipanggil
 *     langsung; karena itu gerbangnya ada di sini, bukan di tampilan.
 *
 * Error entitlement dikembalikan sebagai ActionResult, BUKAN dilempar —
 * melempar dari Server Action menghasilkan 500 dan admin hanya melihat
 * "terjadi kesalahan" tanpa tahu harus membeli apa.
 */

/** Cek add-on domain. Mengembalikan pesan siap-tampil bila belum dibayar. */
async function pastikanAddOnDomain(schoolId: string): Promise<string | null> {
  const e = await getEntitlement(schoolId);
  if (e.fitur.whiteLabel === true) return null;
  if (e.status === "TANPA_PAKET") {
    return (
      "Domain sendiri adalah add-on berbayar (White-label). Sekolah ini belum punya " +
      "paket aktif, sehingga domain belum bisa didaftarkan. Hubungi admin layanan untuk mengaktifkannya."
    );
  }
  return (
    "Domain sendiri adalah add-on berbayar (White-label) dan tidak termasuk paket " +
    `${e.planName ?? "sekolah ini"}. Tambahkan sebagai add-on lewat halaman Langganan, ` +
    "lalu hubungi admin layanan untuk mengaktifkannya."
  );
}

function bacaHost(formData: FormData): string | null {
  const raw = String(formData.get("host") ?? "").trim();
  return normalisasiHost(raw);
}

/** Daftarkan / ganti domain UTAMA sekolah (School.customDomain). */
export async function daftarkanDomain(formData: FormData): Promise<ActionResult> {
  const g = await guard("schools", "manage");
  if ("fail" in g) return g.fail;

  const schoolId = String(formData.get("schoolId") ?? "");
  if (!schoolId) return { ok: false, error: "Sekolah tidak dikenali." };

  const host = bacaHost(formData);
  if (!host) {
    return {
      ok: false,
      error:
        "Nama domain tidak sah. Tulis tanpa https:// dan tanpa garis miring, mis. sman1-padang.sch.id",
      fieldErrors: { host: ["Nama domain tidak sah"] },
    };
  }

  const blocked = await pastikanAddOnDomain(schoolId);
  if (blocked) return { ok: false, error: blocked };

  if (await domainExists(host, schoolId)) {
    return { ok: false, error: "Domain sudah dipakai sekolah lain.", fieldErrors: { host: ["Domain sudah dipakai"] } };
  }
  const aliasMilikOrang = await prisma.schoolHostAlias.findUnique({
    where: { host },
    select: { schoolId: true },
  });
  if (aliasMilikOrang && aliasMilikOrang.schoolId !== schoolId) {
    return { ok: false, error: "Domain sudah dipakai sekolah lain.", fieldErrors: { host: ["Domain sudah dipakai"] } };
  }

  const sebelum = await prisma.school.findFirst({
    where: { id: schoolId, deletedAt: null },
    select: { customDomain: true },
  });
  if (!sebelum) return { ok: false, error: "Sekolah tidak ditemukan." };

  const hasil = await daftarkanDomainUtama(schoolId, host);
  if (!hasil) return { ok: false, error: "Nama domain tidak sah." };

  // Domain utama lama dipindah ke daftar domain tambahan agar tidak hilang
  // diam-diam dari resolusi host.
  if (sebelum.customDomain && sebelum.customDomain !== host) {
    await pastikanDomainTerdaftar(schoolId, sebelum.customDomain);
  }

  const zona = diZonaTerpercaya(host);
  // Zona layanan: verifikasi langsung, tidak ada DNS yang perlu dibaca.
  if (zona) await verifikasiDomain(schoolId, host);

  await recordAudit({
    schoolId,
    userId: g.ctx.userId,
    action: "CREATE",
    entity: "SchoolDomain",
    entityId: schoolId,
    before: { customDomain: sebelum.customDomain },
    after: { host, zonaTerpercaya: zona },
    ...(await requestMeta()),
  });

  revalidatePath(`/dashboard/schools/${schoolId}`);
  revalidatePath(`/dashboard/schools/${schoolId}/edit`);
  return {
    ok: true,
    id: schoolId,
    message: zona
      ? `${host} didaftarkan. Domain ada di zona layanan — terverifikasi otomatis.`
      : `${host} didaftarkan. Pasang record TXT lalu tekan "Verifikasi sekarang".`,
  };
}

/** Verifikasi domain utama `formData.host` (atau semua domain tambahan). */
export async function verifikasiDomainAction(formData: FormData): Promise<ActionResult> {
  const g = await guard("schools", "manage");
  if ("fail" in g) return g.fail;

  const schoolId = String(formData.get("schoolId") ?? "");
  const hostForm = bacaHost(formData);
  const aliasId = String(formData.get("aliasId") ?? "");
  if (!schoolId) return { ok: false, error: "Sekolah tidak dikenali." };

  const blocked = await pastikanAddOnDomain(schoolId);
  if (blocked) return { ok: false, error: blocked };

  let label = hostForm ?? "";
  let hasil: { ok: boolean; status: string; reason?: string };

  if (aliasId) {
    const alias = await prisma.schoolHostAlias.findFirst({
      where: { id: aliasId, schoolId },
      select: { host: true },
    });
    if (!alias) return { ok: false, error: "Domain tambahan tidak ditemukan." };
    label = alias.host;
    hasil = await verifikasiAlias(schoolId, alias.host);
  } else {
    if (!hostForm) return { ok: false, error: "Nama domain tidak sah." };
    hasil = await verifikasiDomain(schoolId, hostForm);
  }

  // Verifikasi adalah tindakan keamanan — selalu tercatat, berhasil atau tidak.
  await recordAudit({
    schoolId,
    userId: g.ctx.userId,
    action: "UPDATE",
    entity: "SchoolDomain",
    entityId: aliasId || schoolId,
    after: { host: label, status: hasil.status, ok: hasil.ok, reason: hasil.reason ?? null },
    ...(await requestMeta()),
  });

  revalidatePath(`/dashboard/schools/${schoolId}`);
  revalidatePath(`/dashboard/schools/${schoolId}/edit`);
  return hasil.ok
    ? { ok: true, message: `${label}: domain terverifikasi.` }
    : { ok: false, error: hasil.reason ?? "Verifikasi belum berhasil." };
}

/** Hapus domain utama (param `target=customDomain`) atau satu domain tambahan. */
export async function hapusDomain(formData: FormData): Promise<ActionResult> {
  const g = await guard("schools", "manage");
  if ("fail" in g) return g.fail;

  const schoolId = String(formData.get("schoolId") ?? "");
  const aliasId = String(formData.get("aliasId") ?? "");
  const target = String(formData.get("target") ?? "");
  if (!schoolId) return { ok: false, error: "Sekolah tidak dikenali." };

  const blocked = await pastikanAddOnDomain(schoolId);
  if (blocked) return { ok: false, error: blocked };

  let host: string | null = null;

  if (aliasId) {
    const alias = await prisma.schoolHostAlias.findFirst({
      where: { id: aliasId, schoolId },
      select: { id: true, host: true },
    });
    if (!alias) return { ok: false, error: "Domain tambahan tidak ditemukan." };
    host = alias.host;
    await prisma.schoolHostAlias.delete({ where: { id: alias.id } });
  } else if (target === "customDomain") {
    const school = await prisma.school.findFirst({
      where: { id: schoolId, deletedAt: null },
      select: { customDomain: true },
    });
    if (!school?.customDomain) return { ok: false, error: "Sekolah ini belum punya domain utama." };
    host = school.customDomain;
    await prisma.school.update({
      where: { id: schoolId },
      data: {
        customDomain: null,
        domainVerifyToken: null,
        domainVerifyStatus: "UNVERIFIED",
        domainVerifiedAt: null,
        domainVerifyAttempts: 0,
        domainVerifyLastError: null,
        domainVerifyCheckedAt: null,
      },
    });
  } else {
    return { ok: false, error: "Domain yang akan dihapus tidak dikenali." };
  }

  await recordAudit({
    schoolId,
    userId: g.ctx.userId,
    action: "DELETE",
    entity: "SchoolDomain",
    entityId: aliasId || schoolId,
    before: { host },
    ...(await requestMeta()),
  });

  revalidatePath(`/dashboard/schools/${schoolId}`);
  revalidatePath(`/dashboard/schools/${schoolId}/edit`);
  return { ok: true, message: `${host} dihapus.` };
}
