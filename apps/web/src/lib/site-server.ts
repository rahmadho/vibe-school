import "server-only";
import { headers } from "next/headers";
import { findSchoolByHost } from "@/lib/data/site";
import {
  allowDevFallback,
  resolveDevFallback,
  resolveHost,
  rootDomainConfigFromEnv,
  type HostResolution,
} from "@/lib/site-host";

/**
 * Resolusi sekolah untuk halaman publik — sisi server (menyentuh DB).
 *
 * Logika penentuan host ada di lib/site-host.ts (murni & teruji). File ini
 * hanya menjembatani ke database dan Next.js `headers()`.
 */

export type ResolvedSchool = {
  id: string;
  name: string;
  slug: string;
  level: string;
  logoUrl: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
};

export type PublicContext =
  | { status: "ok"; school: ResolvedSchool }
  | { status: "portal"; reason: string }
  | { status: "notfound"; reason: string };

/**
 * Tentukan sekolah dari permintaan yang sedang berjalan.
 *
 * `searchParams.school` HANYA dipakai di luar produksi (lihat
 * `allowDevFallback`) — di produksi subdomain wajib, supaya tidak ada cara
 * menampilkan data sekolah lain dengan menebak slug.
 */
export async function resolveSchoolFromRequest(
  searchParams?: { school?: string | string[] },
): Promise<PublicContext> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const config = rootDomainConfigFromEnv();

  let resolution: HostResolution = resolveHost(host, config);

  // Cadangan pengembangan: hanya bila subdomain belum bisa diatur (mis. preview
  // Vercel) DAN kita tidak di produksi.
  if (resolution.kind === "portal" || resolution.kind === "unknown") {
    const raw = searchParams?.school;
    const param = Array.isArray(raw) ? raw[0] : raw;

    const devHost = h.get("x-dev-school");
    const fallback =
      resolveDevFallback(param ?? devHost ?? null, allowDevFallback(process.env.NODE_ENV)) ??
      null;

    if (fallback) resolution = fallback;
  }

  if (resolution.kind === "portal") {
    return {
      status: "portal",
      reason: "Alamat ini adalah halaman utama. Buka alamat sekolah untuk melihat webnya.",
    };
  }

  if (resolution.kind === "unknown") {
    return { status: "notfound", reason: resolution.reason };
  }

  const school = await findSchoolByHost(resolution.identifier);

  if (!school) {
    // Pesan sengaja tidak menyebut apakah sekolah ada tapi nonaktif — cukup
    // "tidak ditemukan" agar tidak membocorkan daftar sekolah.
    return {
      status: "notfound",
      reason: `Tidak ada web sekolah pada alamat "${resolution.identifier}".`,
    };
  }

  return {
    status: "ok",
    school: {
      id: school.id,
      name: school.name,
      slug: school.slug,
      level: school.level,
      logoUrl: school.logoUrl,
      address: school.address,
      phone: school.phone,
      email: school.email,
    },
  };
}

/**
 * Bentuk galat untuk halaman publik.
 * Mengembalikan objek siap-pakai alih-alih melempar, karena halaman publik
 * tidak boleh menampilkan jejak galat ke pengunjung.
 */
export function publicErrorPage(ctx: Extract<PublicContext, { status: "portal" | "notfound" }>) {
  const isPortal = ctx.status === "portal";
  return {
    title: isPortal ? "Pilih Sekolah" : "Web Sekolah Tidak Ditemukan",
    message: isPortal
      ? "Buka alamat web sekolah yang ingin Anda lihat, misalnya smpn1.sekolah.id."
      : ctx.reason,
    hint: isPortal
      ? "Setiap sekolah memiliki alamatnya sendiri."
      : "Periksa kembali alamat yang Anda ketik, atau hubungi sekolah langsung.",
  };
}
