import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Klien HTTP ke wa-gateway.
 *
 * Semua panggilan punya batas waktu (timeout). Tanpa batas waktu, permintaan
 * ke gateway yang sedang sibuk akan menggantung dan menahan permintaan web —
 * halaman admin jadi ikut macet hanya karena WhatsApp bermasalah.
 */

const TIMEOUT_MS = 8_000;

export type GatewaySession = {
  sessionName: string;
  status: string;
  phoneNumber: string | null;
  lastError: string | null;
  lastSeenAt: string | null;
  qrDataUrl: string | null;
};

export type GatewayResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

async function call<T>(
  path: string,
  init: RequestInit = {},
): Promise<GatewayResult<T>> {
  const base = process.env.WA_GATEWAY_URL ?? "http://127.0.0.1:3001";
  const token = process.env.WA_GATEWAY_TOKEN ?? "";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "x-gateway-token": token,
        ...(init.headers ?? {}),
      },
      signal: controller.signal,
      cache: "no-store",
    });

    const text = await res.text();
    let payload: unknown = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      return { ok: false, error: "Balasan gateway tidak dapat dibaca." };
    }

    if (!res.ok) {
      const msg =
        payload && typeof payload === "object" && "error" in payload
          ? String((payload as { error: unknown }).error)
          : `Gateway merespons ${res.status}`;
      return { ok: false, error: msg };
    }

    return { ok: true, data: payload as T };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Galat tidak diketahui";
    if (msg.includes("abort")) {
      return {
        ok: false,
        error: "Gateway tidak merespons. Pastikan service wa-gateway berjalan.",
      };
    }
    return {
      ok: false,
      error:
        "Tidak dapat menghubungi wa-gateway. Pastikan service berjalan di " +
        base,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Nama sesi gateway untuk sebuah sekolah. */
export async function sessionNameFor(schoolId: string): Promise<string | null> {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { slug: true, waGatewayId: true },
  });
  if (!school) return null;
  return school.waGatewayId || school.slug;
}

export async function startGatewaySession(sessionName: string) {
  return call<{ ok: true; message: string }>("/sessions/start", {
    method: "POST",
    body: JSON.stringify({ session: sessionName }),
  });
}

export async function stopGatewaySession(sessionName: string) {
  return call<{ ok: true; message: string }>("/sessions/stop", {
    method: "POST",
    body: JSON.stringify({ session: sessionName }),
  });
}

export async function logoutGatewaySession(sessionName: string) {
  return call<{ ok: true; message: string }>("/sessions/logout", {
    method: "POST",
    body: JSON.stringify({ session: sessionName }),
  });
}

export async function getGatewayQr(
  sessionName: string,
): Promise<GatewayResult<GatewaySession>> {
  return call<GatewaySession>(
    `/sessions/qr?session=${encodeURIComponent(sessionName)}`,
  );
}

/** Status kesehatan gateway (dipakai dasbor untuk memberi tahu bila service mati). */
export async function gatewayHealth(): Promise<GatewayResult<{ ok: boolean }>> {
  return call<{ ok: boolean }>("/health");
}

/**
 * Pastikan WA_GATEWAY_TOKEN sudah diatur; kalau belum, kirim pesan tidak akan
 * pernah berhasil dan admin harus tahu alasannya.
 */
export function gatewayConfigured(): boolean {
  return Boolean(process.env.WA_GATEWAY_TOKEN);
}
