/**
 * Uji logika murni worker dengan Node test runner bawaan.
 * Jalankan: node --test apps/wa-gateway/src/worker-core.test.js
 *
 * File ini TIDAK mengimpor Baileys/Prisma, jadi bisa dijalankan tanpa
 * dependensi terpasang.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  backoffMinutes,
  nextAttemptAt,
  isPermanentFailure,
  failureOutcome,
  MAX_ATTEMPTS,
} from "./worker-core.js";

test("backoff bertambah sesuai jadwal", () => {
  assert.equal(backoffMinutes(1), 1);
  assert.equal(backoffMinutes(2), 5);
  assert.equal(backoffMinutes(3), 15);
  assert.equal(backoffMinutes(4), 60);
  assert.equal(backoffMinutes(50), 60);
});

test("nextAttemptAt null setelah jatah habis", () => {
  const now = new Date("2025-10-15T03:00:00Z");
  assert.equal(nextAttemptAt(MAX_ATTEMPTS, now), null);
  const next = nextAttemptAt(1, now);
  assert.notEqual(next, null);
  // Percobaan ke-2 menunggu 5 menit
  assert.equal(next.getTime() - now.getTime(), 5 * 60_000);
});

test("kegagalan permanen dalam bahasa Indonesia dikenali", () => {
  // Ini galat yang dikirim wa.js — wajib dikenali, kalau tidak nomor mati
  // akan dicoba 4 kali dan membuang kuota sekolah.
  assert.equal(isPermanentFailure("Nomor tidak terdaftar di WhatsApp"), true);
});

test("kegagalan permanen dalam bahasa Inggris dikenali", () => {
  assert.equal(isPermanentFailure("Phone number does not exist"), true);
  assert.equal(isPermanentFailure("not on WhatsApp"), true);
});

test("masalah sementara tidak dianggap permanen", () => {
  assert.equal(isPermanentFailure("ETIMEDOUT"), false);
  assert.equal(isPermanentFailure("WhatsApp belum tersambung"), false);
  assert.equal(isPermanentFailure(""), false);
});

test("failureOutcome: nomor mati tidak diulang walau percobaan baru 1", () => {
  const o = failureOutcome("Nomor tidak terdaftar di WhatsApp", 1);
  assert.equal(o.retry, false);
  assert.equal(o.permanent, true);
  assert.equal(o.status, "FAILED");
});

test("failureOutcome: galat jaringan diulang dengan jeda", () => {
  // attempts=1: satu percobaan sudah gagal, jadi percobaan ke-2 dijadwalkan
  // setelah backoffMinutes(2) = 5 menit.
  const o = failureOutcome("ETIMEDOUT", 1);
  assert.equal(o.retry, true);
  assert.equal(o.waitMinutes, 5);
  assert.equal(o.status, "QUEUED");
});

test("failureOutcome: jeda pertama hanya 1 menit", () => {
  // attempts=0 tidak realistis (pesan baru diklaim lalu gagal → attempts=1),
  // tetapi rumusnya harus tetap konsisten.
  const o = failureOutcome("ETIMEDOUT", 0);
  assert.equal(o.waitMinutes, 1);
});

test("failureOutcome: menyerah setelah jatah habis", () => {
  const o = failureOutcome("ETIMEDOUT", MAX_ATTEMPTS);
  assert.equal(o.retry, false);
  assert.equal(o.exhausted, true);
});
