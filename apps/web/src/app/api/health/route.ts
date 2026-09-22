import { NextResponse } from "next/server";

/**
 * Health check untuk Docker HEALTHCHECK / load balancer.
 *
 * Sengaja TIDAK memeriksa koneksi database: endpoint ini mengukur apakah proses
 * web hidup dan siap melayani, bukan kesehatan DB (DB ada di stack terpisah).
 * Bila DB ikut dicek di sini, DB yang sedang maintenance akan membuat container
 * web dianggap tidak sehat dan restart berulang tanpa alasan.
 *
 * `runtime = "nodejs"` agar tidak ikut ter-bundle sebagai edge route.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cek konfigurasi kritis TANPA mengungkap nilai rahasia.
 *
 * Ini menjawab pertanyaan diagnosa yang paling sering muncul saat deploy
 * ("kenapa login gagal dengan 'server configuration error'?"): ternyata
 * NEXTAUTH_SECRET tidak ter-inject ke container. Alih-alih menebak lewat log,
 * endpoint ini melaporkan ada/tidaknya & panjang minimum — cukup untuk
 * memastikan, tetapi tidak membocorkan rahasianya sendiri.
 */
function configChecks() {
  const secret = process.env.NEXTAUTH_SECRET ?? "";
  return {
    NEXTAUTH_SECRET: secret.length >= 32 ? "ok" : "MISSING_ATAU_TERLALU_PENDEK",
    DATABASE_URL: process.env.DATABASE_URL ? "ok" : "MISSING",
    ROOT_DOMAIN: process.env.ROOT_DOMAIN ? "ok" : "MISSING",
    NEXTAUTH_URL: process.env.NEXTAUTH_URL ? "ok" : "MISSING",
  } as const;
}

export async function GET() {
  const config = configChecks();
  // "degraded" bila ada miskonfigurasi kritis, tetapi TETAP status 200 agar
  // HEALTHCHECK hanya menilai hidup/tidaknya proses (lihat catatan di atas).
  const degraded = Object.values(config).some((v) => v !== "ok");

  return NextResponse.json(
    {
      status: degraded ? "degraded" : "ok",
      uptime: Math.round(process.uptime()),
      config,
    },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
