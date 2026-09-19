/**
 * Titik masuk wa-gateway.
 *
 * Menjalankan dua hal sekaligus dalam satu proses:
 *   1. Worker antrean  — mengirim notifikasi dari `notification_queue`.
 *   2. HTTP API        — menyambungkan sesi & menampilkan QR ke dasbor web.
 *
 * Sesi WhatsApp dipulihkan otomatis saat start, tetapi koneksi awal tetap
 * dipicu admin dari dasbor (karena butuh memindai QR sekali).
 */

import { hostname } from "node:os";
import { randomUUID } from "node:crypto";

import { prisma } from "./db.js";
import { createLogger } from "./log.js";
import { startApi } from "./api.js";
import { runWorker } from "./worker.js";
import { startSession, listSessions } from "./wa.js";

const log = createLogger("main");

const workerId = `${hostname()}-${process.pid}-${randomUUID().slice(0, 6)}`;
const controller = new AbortController();

async function restoreSessions() {
  // Sambungkan ulang sesi yang sebelumnya pernah login, supaya gateway tidak
  // "lupa" setelah VPS restart. Kalau kredensial sudah tidak valid, Baileys
  // akan meminta QR lagi — itu tugas admin.
  const schools = await prisma.school.findMany({
    where: { deletedAt: null, waGatewayId: { not: null } },
    select: { id: true, name: true, slug: true, waGatewayId: true },
  });

  for (const s of schools) {
    const sessionName = s.waGatewayId || s.slug;
    try {
      await startSession(sessionName);
      log.info({ school: s.name, sessionName }, "sesi dipulihkan");
    } catch (e) {
      log.warn(
        { school: s.name, err: e?.message ?? e },
        "gagal memulihkan sesi",
      );
    }
  }

  if (schools.length === 0) {
    log.info("belum ada sekolah dengan sesi WA terdaftar");
  }
}

async function main() {
  log.info({ workerId, node: process.version }, "wa-gateway dimulai");

  startApi();

  // Pulihkan sesi di latar belakang agar worker bisa segera mulai.
  restoreSessions().catch((e) =>
    log.warn({ err: e?.message ?? e }, "restoreSessions gagal"),
  );

  await runWorker(workerId, { signal: controller.signal });
}

/** Penutupan rapi: hentikan worker & tutup koneksi DB. */
async function shutdown(signal) {
  log.info({ signal }, "menutup gateway…");
  controller.abort();
  try {
    await prisma.$disconnect();
  } catch {
    /* diabaikan */
  }
  // Beri waktu loop worker melepas kunci agar tidak ada pesan tersangkut.
  setTimeout(() => process.exit(0), 500);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

process.on("unhandledRejection", (reason) => {
  log.error({ err: reason?.message ?? String(reason) }, "unhandledRejection");
});

main().catch((e) => {
  log.error({ err: e?.message ?? e }, "gagal menjalankan gateway");
  process.exit(1);
});

export { listSessions };
