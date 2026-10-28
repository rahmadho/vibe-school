import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Penyaji berkas unggahan — `/uploads/<key>`.
 *
 * KENAPA ROUTE INI ADA: berkas sengaja disimpan DI LUAR `public/`
 * (`UPLOAD_DIR`, bawaan `var/uploads`) karena Next.js hanya menyajikan isi
 * `public/` yang sudah ada saat build. Tanpa route ini, setiap URL
 * `/uploads/...` yang tersimpan di DB menjadi 404.
 *
 * Tanpa import apa pun dari `next/*`: cukup `Request`/`Response` standar, jadi
 * tidak ada dependensi request-scope yang perlu di-stub saat diuji.
 *
 * Keamanan:
 *  - kunci yang keluar dari folder unggahan (`../`) ditolak,
 *  - hanya ekstensi di daftar putih (`png|jpg|jpeg|webp`) yang disajikan,
 *  - `X-Content-Type-Options: nosniff`.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

/** Folder akar unggahan — samakan dengan `localRoot()` di `lib/storage.ts`. */
function uploadRoot(): string {
  const dir = process.env.UPLOAD_DIR?.trim();
  if (dir) return path.resolve(dir);
  return path.join(process.cwd(), "var", "uploads");
}

export async function serveUpload(keyParts: string[]): Promise<Response> {
  const key = keyParts.join("/");
  // Segmen kosong atau berisi `.`/`..` tidak pernah sah.
  if (!key || keyParts.some((p) => !p || p === "." || p === ".." || p.includes("\\"))) {
    return new Response("Not found", { status: 404 });
  }

  const ext = path.extname(key).slice(1).toLowerCase();
  const contentType = CONTENT_TYPES[ext];
  if (!contentType) return new Response("Not found", { status: 404 });

  const root = uploadRoot();
  const target = path.resolve(root, key);
  if (!target.startsWith(root + path.sep)) {
    return new Response("Not found", { status: 404 });
  }

  let body: Buffer;
  try {
    body = await readFile(target);
  } catch {
    return new Response("Not found", { status: 404 });
  }

  return new Response(new Uint8Array(body), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(body.byteLength),
      "X-Content-Type-Options": "nosniff",
      // Nama berkas sudah acak (timestamp + random), isinya tidak pernah
      // ditimpa — aman di-cache lama.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ key: string[] }> },
) {
  const { key } = await ctx.params;
  return serveUpload(key);
}
