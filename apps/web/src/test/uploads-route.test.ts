import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { serveUpload } from "@/app/uploads/[...key]/route";

/**
 * Uji penyaji `/uploads/<key>`.
 *
 * KENAPA INI DIUJI: route inilah satu-satunya yang menyajikan logo sekolah.
 * Kalau ia hilang atau salah membaca UPLOAD_DIR, setiap logo di DB menjadi 404
 * walau berkasnya ada di disk — persis kegagalan yang pernah terjadi.
 */

let dir: string;
const png = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea735c9e40000000049454e44ae426082",
  "hex",
);

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "uploads-"));
  process.env.UPLOAD_DIR = dir;
  await mkdir(path.join(dir, "school1/logo"), { recursive: true });
  await writeFile(path.join(dir, "school1/logo/a.png"), png);
  await writeFile(path.join(dir, "school1/logo/evil.svg"), "<svg/>");
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
  delete process.env.UPLOAD_DIR;
});

describe("serveUpload", () => {
  it("menyajikan berkas yang ada sebagai image/png", async () => {
    const res = await serveUpload(["school1", "logo", "a.png"]);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(Buffer.from(await res.arrayBuffer()).byteLength).toBe(png.byteLength);
  });

  it("404 untuk berkas yang tidak ada", async () => {
    expect((await serveUpload(["school1", "logo", "hilang.png"])).status).toBe(404);
  });

  it("404 untuk ekstensi di luar daftar putih (SVG ditolak)", async () => {
    expect((await serveUpload(["school1", "logo", "evil.svg"])).status).toBe(404);
  });

  it("menolak path traversal", async () => {
    expect((await serveUpload(["..", "apps", "web", "x.png"])).status).toBe(404);
  });
});
