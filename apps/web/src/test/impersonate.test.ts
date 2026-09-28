import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
  createImpersonateToken,
  createRestoreToken,
  verifyImpersonateToken,
  IMPERSONATE_TTL_SECONDS,
} from "@/lib/impersonate";

/**
 * Uji tiket impersonasi. Inti keamanannya ada pada tanda tangan HMAC: tanpa
 * NEXTAUTH_SECRET yang benar, tiket tidak bisa dipalsukan.
 *
 * Modul menandai "server-only", jadi stub dipakai lewat alias vitest.config.
 */

const SECRET = "uji-coba-rahasia-impersonate-minimal-32-karakter";

beforeEach(() => {
  process.env.NEXTAUTH_SECRET = SECRET;
});

afterEach(() => {
  delete process.env.NEXTAUTH_SECRET;
  vi.useRealTimers();
});

describe("createImpersonateToken / verifyImpersonateToken", () => {
  it("tiket yang sah bisa diverifikasi dan memuat aktor + target", () => {
    const token = createImpersonateToken({
      actorId: "admin-1",
      actorName: "Super Admin",
      targetUserId: "user-9",
    });
    const payload = verifyImpersonateToken(token);
    expect(payload).not.toBeNull();
    expect(payload?.actorId).toBe("admin-1");
    expect(payload?.actorName).toBe("Super Admin");
    expect(payload?.targetUserId).toBe("user-9");
  });

  it("menolak tanda tangan yang diubah", () => {
    const token = createImpersonateToken({
      actorId: "a",
      actorName: "A",
      targetUserId: "t",
    });
    const [payloadB64] = token.split(".");
    // Ganti tanda tangan dengan teks lain yang valid secara bentuk.
    const forged = `${payloadB64}.${Buffer.from("palsu").toString("base64url")}`;
    expect(verifyImpersonateToken(forged)).toBeNull();
  });

  it("menolak bila payload diubah (target diganti tanpa tanda tangan baru)", () => {
    const token = createImpersonateToken({
      actorId: "a",
      actorName: "A",
      targetUserId: "target-asli",
    });
    const [, sig] = token.split(".");
    // Rakit ulang payload dengan target berbeda — tanda tangan tetap yang lama.
    const tampered = Buffer.from(
      JSON.stringify({
        actorId: "a",
        actorName: "A",
        targetUserId: "target-lain",
        exp: Math.floor(Date.now() / 1000) + 60,
      }),
    ).toString("base64url");
    expect(verifyImpersonateToken(`${tampered}.${sig}`)).toBeNull();
  });

  it("menolak tiket yang sudah kedaluwarsa", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-01T00:00:00Z"));
    const token = createImpersonateToken({
      actorId: "a",
      actorName: "A",
      targetUserId: "t",
    });
    // Maju melewati masa berlaku.
    vi.setSystemTime(
      new Date(Date.now() + (IMPERSONATE_TTL_SECONDS + 5) * 1000),
    );
    expect(verifyImpersonateToken(token)).toBeNull();
  });

  it("menolak bentuk token yang rusak", () => {
    expect(verifyImpersonateToken("")).toBeNull();
    expect(verifyImpersonateToken("tanpa.titik.dua")).toBeNull();
    expect(verifyImpersonateToken("hanya-satu-bagian")).toBeNull();
  });

  it("menolak tiket yang ditandatangani dengan rahasia berbeda", () => {
    const token = createImpersonateToken({
      actorId: "a",
      actorName: "A",
      targetUserId: "t",
    });
    process.env.NEXTAUTH_SECRET = "rahasia-lain-yang-juga-panjang-sekali-ya";
    expect(verifyImpersonateToken(token)).toBeNull();
  });

  it("gagal keras bila NEXTAUTH_SECRET tidak diset", () => {
    delete process.env.NEXTAUTH_SECRET;
    expect(() =>
      createImpersonateToken({ actorId: "a", actorName: "A", targetUserId: "t" }),
    ).toThrow(/NEXTAUTH_SECRET/);
  });
});

describe("arah token (impersonate vs restore)", () => {
  it("tiket masuk ditandai to=impersonate", () => {
    const token = createImpersonateToken({
      actorId: "a",
      actorName: "A",
      targetUserId: "t",
    });
    expect(verifyImpersonateToken(token)?.to).toBe("impersonate");
  });

  it("tiket kembali ditandai to=restore", () => {
    const token = createRestoreToken({
      actorId: "a",
      actorName: "A",
      targetUserId: "t",
    });
    expect(verifyImpersonateToken(token)?.to).toBe("restore");
  });

  it("provider masuk menolak tiket restore (dan sebaliknya) — diuji via to", () => {
    // Provider memeriksa `to`, bukan bentuk lain. Pastikan nilai pembeda benar.
    const masuk = verifyImpersonateToken(
      createImpersonateToken({ actorId: "a", actorName: "A", targetUserId: "t" }),
    );
    const kembali = verifyImpersonateToken(
      createRestoreToken({ actorId: "a", actorName: "A", targetUserId: "t" }),
    );
    expect(masuk?.to).not.toBe(kembali?.to);
  });
});
