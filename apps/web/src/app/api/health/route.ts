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

export async function GET() {
  return NextResponse.json(
    { status: "ok", uptime: Math.round(process.uptime()) },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
