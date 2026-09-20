/**
 * Manajer sesi WhatsApp berbasis Baileys.
 *
 * Tanggung jawab:
 *  - Membuat & menjaga koneksi per sesi (satu sekolah = satu sesi).
 *  - Menyimpan kredensial agar tidak perlu memindai QR setiap restart.
 *  - Memulihkan koneksi otomatis saat terputus.
 *  - Menyerahkan QR ke HTTP API agar bisa dipindai lewat dasbor web.
 */

import { existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";

import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  isJidBroadcast,
  jidNormalizedUser,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";

const logger = pino({ level: process.env.LOG_LEVEL ?? "info" });

/** Status yang mungkin dari sebuah sesi. */
export const STATUS = {
  CONNECTED: "Connected",
  PAIRING: "Pairing",
  DISCONNECTED: "Disconnected",
  LOGGED_OUT: "LoggedOut",
};

const sessions = new Map();

/** Path folder kredensial untuk sebuah sesi. */
function sessionDir(sessionName) {
  const base = process.env.WA_SESSION_DIR ?? "/data/sessions";
  // Cegah path traversal dari nama sesi (nama datang dari input admin).
  const safe = String(sessionName).replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(base, safe);
}

export function getSession(sessionName) {
  const s = sessions.get(sessionName);
  return s ? s.snapshot : undefined;
}

export function listSessions() {
  return Array.from(sessions.values()).map((s) => s.snapshot);
}

/**
 * Mulai (atau mulai ulang) sebuah sesi WhatsApp.
 * @param {string} sessionName
 * @param {(state: object) => void} [onUpdate] dipanggil tiap perubahan status
 */
export async function startSession(sessionName, onUpdate) {
  // Tutup sesi lama bila ada, agar tidak ada dua koneksi untuk nomor sama.
  const existing = sessions.get(sessionName);
  if (existing) {
    try {
      existing.sock?.end?.(undefined);
    } catch {
      /* diabaikan */
    }
  }

  const dir = sessionDir(sessionName);
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(dir);
  const { version } = await fetchLatestBaileysVersion();

  const entry = {
    sessionName,
    sock: null,
    qr: null,
    status: STATUS.DISCONNECTED,
    phoneNumber: null,
    lastError: null,
    lastSeenAt: null,
    reconnectAttempts: 0,
    stopped: false,
    // Snapshot publik (dibaca HTTP API & worker). Selalu diganti utuh.
    snapshot: null,
  };
  sessions.set(sessionName, entry);

  const emit = (extra = {}) => {
    entry.lastSeenAt = new Date();
    const snapshot = {
      sessionName,
      status: entry.status,
      phoneNumber: entry.phoneNumber,
      qr: entry.status === STATUS.PAIRING ? entry.qr : null,
      lastError: entry.lastError,
      lastSeenAt: entry.lastSeenAt?.toISOString() ?? null,
      ...extra,
    };
    entry.snapshot = snapshot;
    if (onUpdate) {
      try {
        onUpdate(snapshot);
      } catch (e) {
        logger.warn({ err: e }, "onUpdate gagal");
      }
    }
    return snapshot;
  };

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: process.env.BAILEYS_LOG_LEVEL ?? "silent" }),
    printQRInTerminal: false,
    // Jangan proses pesan siaran (menghemat memori; kita hanya pengirim).
    shouldIgnoreJid: (jid) => isJidBroadcast(jid),
    browser: ["School App", "Chrome", "1.0.0"],
    syncFullHistory: false,
    markOnlineOnConnect: false,
  });
  entry.sock = sock;

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      entry.qr = qr;
      entry.status = STATUS.PAIRING;
      emit({ qr });
    }

    if (connection === "open") {
      entry.status = STATUS.CONNECTED;
      entry.qr = null;
      entry.reconnectAttempts = 0;
      entry.lastError = null;
      const me = sock.user;
      entry.phoneNumber = me?.id ? jidNormalizedUser(me.id).split("@")[0] : null;
      logger.info({ sessionName, phone: entry.phoneNumber }, "WhatsApp tersambung");
      emit();
    }

    if (connection === "close") {
      const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;

      entry.status = loggedOut ? STATUS.LOGGED_OUT : STATUS.DISCONNECTED;
      entry.lastError = lastDisconnect?.error?.message ?? String(statusCode ?? "");
      entry.qr = null;
      emit();

      if (loggedOut) {
        // Perangkat dihapus dari HP → kredensial tidak berguna lagi.
        // Hapus agar tidak memakai sesi mati; admin harus memindai QR lagi.
        logger.warn({ sessionName }, "Sesi logout — kredensial dihapus");
        try {
          await rm(dir, { recursive: true, force: true });
        } catch (e) {
          logger.warn({ err: e }, "gagal menghapus kredensial");
        }
        entry.stopped = true;
        return;
      }

      if (entry.stopped) return;

      // Sambung ulang dengan backoff eksponensial (maks 60 detik) supaya tidak
      // membanjiri server WhatsApp saat internet sekolah sedang mati.
      entry.reconnectAttempts += 1;
      const delay = Math.min(60_000, 2_000 * 2 ** (entry.reconnectAttempts - 1));
      logger.info(
        { sessionName, attempt: entry.reconnectAttempts, delayMs: delay },
        "Menyambung ulang…",
      );
      setTimeout(() => {
        if (!entry.stopped) {
          void startSession(sessionName, onUpdate).catch((e) =>
            logger.error({ err: e, sessionName }, "gagal menyambung ulang"),
          );
        }
      }, delay);
    }
  });

  emit();
  return entry;
}

/** Hentikan sesi tanpa menghapus kredensial (bisa dinyalakan lagi). */
export function stopSession(sessionName) {
  const entry = sessions.get(sessionName);
  if (!entry) return false;
  entry.stopped = true;
  try {
    entry.sock?.end?.(undefined);
  } catch {
    /* diabaikan */
  }
  sessions.delete(sessionName);
  return true;
}

/** Logout & hapus kredensial (harus pindai QR lagi). */
export async function logoutSession(sessionName) {
  const entry = sessions.get(sessionName);

  // Tandai berhenti SEBELUM memutus: `sock.logout()` memicu event
  // `connection.update` → "close", dan tanpa flag ini handler menyambung
  // ulang memakai kredensial yang justru sedang kita hapus.
  if (entry) entry.stopped = true;

  try {
    if (entry?.sock) await entry.sock.logout();
  } catch {
    /* diabaikan */
  }

  try {
    await rm(sessionDir(sessionName), { recursive: true, force: true });
  } catch {
    /* diabaikan */
  }
  sessions.delete(sessionName);
  return true;
}

/**
 * Kirim pesan teks. Mengembalikan { ok, waMessageId } atau { ok:false, error, permanent }.
 * `permanent: true` berarti nomor tidak ada — tidak perlu dicoba ulang.
 */
export async function sendText(sessionName, to, body) {
  const entry = sessions.get(sessionName);
  if (!entry || entry.status !== STATUS.CONNECTED || !entry.sock) {
    return { ok: false, error: "WhatsApp belum tersambung", permanent: false };
  }

  const jid = `${to}@s.whatsapp.net`;

  try {
    // Pastikan nomor benar-benar terdaftar di WhatsApp — mengecek dulu mencegah
    // pesan "hilang" tanpa jejak dan menghemat kuota.
    const [onWa] = await entry.sock.onWhatsApp(jid);
    if (!onWa?.exists) {
      return {
        ok: false,
        error: "Nomor tidak terdaftar di WhatsApp",
        permanent: true,
      };
    }

    const res = await entry.sock.sendMessage(onWa.jid ?? jid, { text: body });
    return { ok: true, waMessageId: res?.key?.id ?? null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gagal mengirim pesan";
    return { ok: false, error: msg, permanent: false };
  }
}

/** Waktu tunggu acak antar pesan (ms) agar tidak terdeteksi sebagai spam bot. */
export function humanDelay(minMs = 1_500, maxMs = 4_000) {
  return minMs + Math.floor(Math.random() * (maxMs - minMs));
}
