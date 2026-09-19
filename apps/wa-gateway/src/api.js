/**
 * HTTP API wa-gateway.
 *
 * Dipakai oleh aplikasi web (Next.js) untuk:
 *  - menyambungkan/memutus sesi WhatsApp
 *  - mengambil status + QR (agar admin memindai dari dasbor, tanpa akses SSH)
 *
 * KEAMANAN: semua endpoint (kecuali /health) memerlukan header
 * `x-gateway-token` yang cocok dengan WA_GATEWAY_TOKEN. Endpoint ini bisa
 * mengirim WhatsApp atas nama sekolah — tidak boleh terbuka.
 */

import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import QRCode from "qrcode";

import { prisma } from "./db.js";
import { createLogger } from "./log.js";
import {
  startSession,
  stopSession,
  logoutSession,
  getSession,
  listSessions,
  STATUS,
} from "./wa.js";

const log = createLogger("api");

const PORT = Number(process.env.PORT ?? 3001);
const TOKEN = process.env.WA_GATEWAY_TOKEN ?? "";

/** Perbandingan token waktu-konstan (cegah timing attack). */
function tokenOk(headerValue) {
  const given = String(headerValue ?? "");
  if (!TOKEN || given.length !== TOKEN.length) return false;
  try {
    return timingSafeEqual(Buffer.from(given), Buffer.from(TOKEN));
  } catch {
    return false;
  }
}

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > 1_000_000) throw new Error("Payload terlalu besar");
    chunks.push(c);
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

/** Simpan status sesi ke DB agar bisa ditampilkan di dasbor web. */
async function persistStatus(schoolId, snapshot) {
  try {
    await prisma.waSession.upsert({
      where: { sessionName: snapshot.sessionName },
      create: {
        schoolId,
        sessionName: snapshot.sessionName,
        status: snapshot.status,
        phoneNumber: snapshot.phoneNumber,
        lastQr: null, // QR tidak disimpan permanen (berisi kredensial sementara)
        lastSeenAt: snapshot.lastSeenAt ? new Date(snapshot.lastSeenAt) : null,
        lastError: snapshot.lastError,
      },
      update: {
        status: snapshot.status,
        phoneNumber: snapshot.phoneNumber,
        lastQr: null,
        lastSeenAt: snapshot.lastSeenAt ? new Date(snapshot.lastSeenAt) : null,
        lastError: snapshot.lastError,
      },
    });
  } catch (e) {
    log.warn({ err: e?.message ?? e }, "gagal menyimpan status sesi");
  }
}

/** Cari sekolah dari nama sesi (waGatewayId atau slug). */
async function resolveSchool(sessionName) {
  return prisma.school.findFirst({
    where: {
      OR: [{ waGatewayId: sessionName }, { slug: sessionName }],
      deletedAt: null,
    },
    select: { id: true, name: true, slug: true },
  });
}

/** Tentukan sekolah dari header/body; wajib ada. */
async function requireSchool(req, body) {
  const sessionName =
    body?.session ??
    req.headers["x-session"] ??
    null;
  if (!sessionName) return { error: "Parameter 'session' wajib diisi." };
  const school = await resolveSchool(String(sessionName));
  if (!school) {
    return { error: `Sekolah dengan sesi "${sessionName}" tidak ditemukan.` };
  }
  return { school, sessionName: String(sessionName) };
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const route = `${req.method} ${url.pathname}`;

  try {
    /* ---------- HEALTH (tanpa token) ---------- */
    if (route === "GET /health") {
      return json(res, 200, {
        ok: true,
        service: "wa-gateway",
        sessions: listSessions().length,
        time: new Date().toISOString(),
      });
    }

    /* ---------- AUTH ---------- */
    if (!tokenOk(req.headers["x-gateway-token"])) {
      log.warn({ route, ip: req.socket.remoteAddress }, "token tidak valid");
      return json(res, 401, { ok: false, error: "Token gateway tidak valid." });
    }

    /* ---------- DAFTAR SESI ---------- */
    if (route === "GET /sessions") {
      return json(res, 200, { ok: true, sessions: listSessions() });
    }

    /* ---------- MULAI / SAMBUNGKAN SESI ---------- */
    if (route === "POST /sessions/start") {
      const body = await readJson(req);
      const found = await requireSchool(req, body);
      if (found.error) return json(res, 400, { ok: false, error: found.error });

      const { school, sessionName } = found;
      // Mulai tanpa menunggu QR/connected — kembalikan status awal, lalu
      // biarkan klien melakukan polling ke GET /sessions/qr.
      await startSession(sessionName, (snap) => {
        void persistStatus(school.id, snap);
      });
      const snap = getSession(sessionName);
      return json(res, 200, {
        ok: true,
        message: `Sesi "${sessionName}" dimulai. Pindai QR pada dasbor.`,
        session: snap,
      });
    }

    /* ---------- STATUS / QR ---------- */
    if (route === "GET /sessions/qr") {
      const sessionName = url.searchParams.get("session");
      if (!sessionName) {
        return json(res, 400, { ok: false, error: "Parameter 'session' wajib diisi." });
      }
      const snap = getSession(sessionName);
      if (!snap) {
        return json(res, 404, {
          ok: false,
          error: "Sesi belum berjalan. Klik 'Sambungkan' terlebih dahulu.",
        });
      }

      // QR mentah dari Baileys berupa string panjang; dasbor butuh gambar.
      let qrDataUrl = null;
      if (snap.status === STATUS.PAIRING && snap.qr) {
        try {
          qrDataUrl = await QRCode.toDataURL(snap.qr, { margin: 1, width: 320 });
        } catch (e) {
          log.warn({ err: e?.message ?? e }, "gagal membuat gambar QR");
        }
      }

      return json(res, 200, {
        ok: true,
        sessionName,
        status: snap.status,
        phoneNumber: snap.phoneNumber,
        lastError: snap.lastError,
        lastSeenAt: snap.lastSeenAt,
        qrDataUrl,
      });
    }

    /* ---------- PUTUSKAN (tetap simpan kredensial) ---------- */
    if (route === "POST /sessions/stop") {
      const body = await readJson(req);
      const sessionName = body.session ?? url.searchParams.get("session");
      if (!sessionName) {
        return json(res, 400, { ok: false, error: "Parameter 'session' wajib diisi." });
      }
      const ok = stopSession(String(sessionName));
      return json(res, ok ? 200 : 404, {
        ok,
        message: ok ? "Sesi dihentikan. Kredensial tetap tersimpan." : "Sesi tidak ditemukan.",
      });
    }

    /* ---------- LOGOUT (hapus kredensial) ---------- */
    if (route === "POST /sessions/logout") {
      const body = await readJson(req);
      const sessionName = body.session ?? url.searchParams.get("session");
      if (!sessionName) {
        return json(res, 400, { ok: false, error: "Parameter 'session' wajib diisi." });
      }
      await logoutSession(String(sessionName));
      const school = await resolveSchool(String(sessionName));
      if (school) {
        await prisma.waSession
          .update({
            where: { sessionName: String(sessionName) },
            data: { status: "LoggedOut", lastQr: null, phoneNumber: null },
          })
          .catch(() => {});
      }
      return json(res, 200, {
        ok: true,
        message: "Sesi keluar. Pindai QR lagi untuk menyambungkan ulang.",
      });
    }

    return json(res, 404, { ok: false, error: `Rute tidak dikenal: ${route}` });
  } catch (e) {
    log.error({ err: e?.message ?? e, route }, "galat pada HTTP API");
    return json(res, 500, { ok: false, error: "Kesalahan internal gateway." });
  }
});

export function startApi() {
  if (!TOKEN) {
    log.error(
      "WA_GATEWAY_TOKEN belum diatur — gateway menolak semua permintaan ber-token.",
    );
  }
  server.listen(PORT, () => {
    log.info({ port: PORT }, "HTTP API siap");
  });
  return server;
}

export { server };
