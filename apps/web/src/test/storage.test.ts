import { describe, expect, it } from "vitest";
import { sniffImageType, MAX_IMAGE_BYTES } from "@/lib/storage";

/**
 * Uji pengenalan jenis gambar unggahan.
 *
 * KENAPA INI DIUJI: jenis berkas ditentukan dari ISINYA, bukan dari `file.type`
 * kiriman klien. Kalau logika ini salah, berkas yang bukan gambar bisa lolos
 * disimpan dan disajikan dari origin aplikasi.
 */

/** Susun buffer dengan byte awal tertentu. */
function bytes(...head: number[]): Buffer {
  return Buffer.from([...head, ...new Array(32).fill(0)]);
}

describe("sniffImageType — jenis yang diterima", () => {
  it("mengenali PNG dari magic bytes", () => {
    expect(sniffImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toEqual({
      ext: "png",
      contentType: "image/png",
    });
  });

  it("mengenali JPEG dari magic bytes", () => {
    expect(sniffImageType(bytes(0xff, 0xd8, 0xff, 0xe0))).toEqual({
      ext: "jpg",
      contentType: "image/jpeg",
    });
  });

  it("mengenali WEBP dari penanda RIFF…WEBP", () => {
    const buf = Buffer.concat([
      Buffer.from("RIFF", "ascii"),
      Buffer.from([0, 0, 0, 0]),
      Buffer.from("WEBP", "ascii"),
      Buffer.alloc(16),
    ]);
    expect(sniffImageType(buf)).toEqual({ ext: "webp", contentType: "image/webp" });
  });
});

describe("sniffImageType — jenis yang DITOLAK", () => {
  it("menolak SVG walau isinya XML yang sah", () => {
    // SVG boleh memuat <script>; disajikan dari origin yang sama, skrip itu
    // berjalan dengan sesi admin sekolah. Karena itu jenisnya harus ditolak.
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
      "utf8",
    );
    expect(sniffImageType(svg)).toBeNull();
  });

  it("menolak HTML", () => {
    expect(sniffImageType(Buffer.from("<html><body>halo</body></html>"))).toBeNull();
  });

  it("menolak GIF (di luar daftar yang didukung)", () => {
    expect(sniffImageType(Buffer.from("GIF89a", "ascii"))).toBeNull();
  });

  it("menolak buffer kosong", () => {
    expect(sniffImageType(Buffer.alloc(0))).toBeNull();
  });

  it("menolak buffer yang terlalu pendek untuk diperiksa", () => {
    expect(sniffImageType(Buffer.from([0x89, 0x50]))).toBeNull();
  });

  it("tidak tertipu oleh ekstensi — hanya isi berkas yang dipercaya", () => {
    // Berkas berisi skrip yang mengaku PNG lewat namanya tetap ditolak.
    expect(sniffImageType(Buffer.from("<?php system($_GET['c']); ?>"))).toBeNull();
  });

  it("menolak PNG yang byte pertamanya diubah", () => {
    expect(sniffImageType(bytes(0x88, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBeNull();
  });

  it("menolak JPEG yang byte ketiganya diubah", () => {
    expect(sniffImageType(bytes(0xff, 0xd8, 0x00, 0xe0))).toBeNull();
  });

  it("menolak RIFF yang bukan WEBP", () => {
    const buf = Buffer.concat([
      Buffer.from("RIFF", "ascii"),
      Buffer.from([0, 0, 0, 0]),
      Buffer.from("WAVE", "ascii"),
      Buffer.alloc(16),
    ]);
    expect(sniffImageType(buf)).toBeNull();
  });
});

describe("batas ukuran", () => {
  it("2 MB — cukup untuk logo, tidak berlebihan", () => {
    expect(MAX_IMAGE_BYTES).toBe(2 * 1024 * 1024);
  });
});
