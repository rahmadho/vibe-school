/**
 * Worker antrean notifikasi.
 *
 * AMAN DIJALANKAN LEBIH DARI SATU PROSES: pesan diklaim dengan
 * `updateMany({ where: { id, status: "QUEUED" } })` — operasi atomik. Kalau dua
 * worker mencoba pesan yang sama, hanya satu yang berhasil mengubah status dan
 * worker lain mendapat count 0 lalu melewatinya. Ini mencegah pesan terkirim
 * dua kali ke orang tua.
 */

import { prisma } from "./db.js";
import { sendText, humanDelay } from "./wa.js";
import { createLogger } from "./log.js";
import {
  MAX_ATTEMPTS,
  backoffMinutes,
  isPermanentFailure,
  failureOutcome,
} from "./worker-core.js";

const log = createLogger("worker");

/** Worker dianggap mati bila kunci lebih tua dari ini (dipulihkan otomatis). */
const LOCK_TIMEOUT_MS = 5 * 60 * 1000;

// Logika murni dipakai dari worker-core.js agar bisa diuji tanpa Baileys.
export { MAX_ATTEMPTS, backoffMinutes, isPermanentFailure };

/**
 * Lepaskan kunci milik worker yang tampaknya sudah mati.
 * Kalau proses worker dimatikan paksa saat sedang mengirim, pesan akan
 * tersangkut berstatus PROCESSING selamanya tanpa pemulihan ini.
 */
export async function releaseStaleLocks(now = new Date()) {
  const cutoff = new Date(now.getTime() - LOCK_TIMEOUT_MS);
  const res = await prisma.notificationQueue.updateMany({
    where: {
      status: "PROCESSING",
      lockedAt: { lt: cutoff },
    },
    data: {
      status: "QUEUED",
      lockedAt: null,
      lockedBy: null,
      lastError: "Dikembalikan ke antrean (worker berhenti mendadak)",
    },
  });
  if (res.count > 0) {
    log.warn({ count: res.count }, "kunci usang dilepaskan");
  }
  return res.count;
}

/**
 * Ambil & klaim satu pesan yang siap dikirim.
 * @returns baris antrean atau null bila tidak ada.
 */
export async function claimNext(workerId, now = new Date()) {
  const candidates = await prisma.notificationQueue.findMany({
    where: {
      status: "QUEUED",
      channel: "WHATSAPP",
      scheduledAt: { lte: now },
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
    },
    orderBy: [{ priority: "asc" }, { scheduledAt: "asc" }, { createdAt: "asc" }],
    take: 5,
  });

  for (const row of candidates) {
    // Klaim atomik: hanya berhasil bila status masih QUEUED.
    const claimed = await prisma.notificationQueue.updateMany({
      where: { id: row.id, status: "QUEUED" },
      data: {
        status: "PROCESSING",
        lockedAt: now,
        lockedBy: workerId,
        attempts: { increment: 1 },
      },
    });
    if (claimed.count === 1) {
      const fresh = await prisma.notificationQueue.findUnique({
        where: { id: row.id },
      });
      return fresh;
    }
    // Worker lain sudah mengambilnya — coba kandidat berikutnya.
  }
  return null;
}

/** Tandai pesan berhasil terkirim. */
export async function markSent(id, waMessageId) {
  await prisma.notificationQueue.update({
    where: { id },
    data: {
      status: "SENT",
      sentAt: new Date(),
      waMessageId: waMessageId ?? null,
      lastError: null,
      lockedAt: null,
      lockedBy: null,
      nextAttemptAt: null,
    },
  });
}

/** Tandai gagal; tentukan apakah masih layak dicoba ulang. */
export async function markFailed(id, error, attempts, now = new Date()) {
  const outcome = failureOutcome(error, attempts);

  if (!outcome.retry) {
    await prisma.notificationQueue.update({
      where: { id },
      data: {
        status: "FAILED",
        lastError: outcome.error,
        lockedAt: null,
        lockedBy: null,
        nextAttemptAt: null,
      },
    });
    return outcome;
  }

  await prisma.notificationQueue.update({
    where: { id },
    data: {
      status: "QUEUED",
      lastError: error,
      lockedAt: null,
      lockedBy: null,
      nextAttemptAt: new Date(now.getTime() + outcome.waitMinutes * 60_000),
    },
  });
  return outcome;
}

/**
 * Proses satu pesan. Mengembalikan hasil untuk keperluan log.
 */
export async function processOne(row, workerId) {
  if (!row) return { processed: false };

  // Sesi WA yang dipakai sesi = waGatewayId sekolah (fallback ke slug sekolah).
  const school = await prisma.school.findUnique({
    where: { id: row.schoolId },
    select: { id: true, name: true, slug: true, waGatewayId: true },
  });
  const sessionName = school?.waGatewayId || school?.slug || row.schoolId;

  // Hormati pembatalan yang terjadi setelah pesan diklaim.
  const current = await prisma.notificationQueue.findUnique({
    where: { id: row.id },
    select: { status: true },
  });
  if (!current || current.status === "CANCELLED") {
    log.info({ id: row.id }, "pesan dibatalkan, dilewati");
    return { processed: false };
  }

  const res = await sendText(sessionName, row.to, row.body);

  if (res.ok) {
    await markSent(row.id, res.waMessageId);
    log.info(
      { id: row.id, to: row.to.slice(0, 6) + "…", school: school?.name },
      "pesan terkirim",
    );
    return { processed: true, ok: true };
  }

  const outcome = await markFailed(row.id, res.error, row.attempts);
  log.warn(
    {
      id: row.id,
      error: res.error,
      attempts: row.attempts,
      retry: outcome.retry,
      permanent: outcome.permanent,
    },
    "pengiriman gagal",
  );
  return { processed: true, ok: false, outcome };
}

/**
 * Jalankan loop worker.
 * @param {string} workerId
 * @param {{ intervalMs?: number, maxPerTick?: number, signal?: AbortSignal }} opts
 */
export async function runWorker(workerId, opts = {}) {
  const intervalMs = opts.intervalMs ?? 5_000;
  const maxPerTick = opts.maxPerTick ?? 10;
  let running = true;

  if (opts.signal) {
    opts.signal.addEventListener("abort", () => {
      running = false;
    });
  }

  log.info({ workerId, intervalMs, maxPerTick }, "worker dimulai");
  let idleTicks = 0;

  while (running) {
    let didWork = 0;
    try {
      await releaseStaleLocks();

      for (let i = 0; i < maxPerTick && running; i++) {
        const row = await claimNext(workerId);
        if (!row) break;
        await processOne(row, workerId);
        didWork += 1;

        // Jeda "seperti manusia" antar pesan agar nomor sekolah tidak
        // dicurigai sebagai bot oleh WhatsApp.
        if (i < maxPerTick - 1) {
          await sleep(humanDelay());
        }
      }
    } catch (e) {
      log.error({ err: e?.message ?? e }, "galat pada loop worker");
      await sleep(3_000);
    }

    if (didWork === 0) {
      idleTicks += 1;
      // Mundur perlahan saat sepi: 5s → maksimum 30s.
      const wait = Math.min(intervalMs * Math.min(idleTicks, 6), 30_000);
      await sleep(wait);
    } else {
      idleTicks = 0;
    }
  }

  log.info({ workerId }, "worker berhenti");
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
