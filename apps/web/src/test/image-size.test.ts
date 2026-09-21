import { describe, expect, it } from "vitest";
import { readImageDimensions } from "@/lib/image-size";

/**
 * Uji pembaca dimensi gambar.
 *
 * KENAPA TEST INI ADA:
 * Pembaca ini mengurai byte header secara manual. Salah satu byte offset
 * berarti semua unggahan menampilkan dimensi salah — dan tidak ada gerbang
 * lain (tsc, build, test lain) yang bisa melihatnya, karena ini soal isi
 * berkas, bukan tipe.
 *
 * Berkas uji dibuat sebagai byte mentah, bukan gambar sungguhan: header
 * dimensi adalah bagian yang diuji, dan membuatnya langsung membuat test
 * cepat serta tidak bergantung pada berkas biner di repositori.
 */

/** PNG minimal: signature + IHDR dengan lebar & tinggi tertentu. */
function pngBuffer(width: number, height: number): Buffer {
  const buf = Buffer.alloc(24);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf, 0);
  buf.writeUInt32BE(13, 8); // panjang IHDR
  buf.write("IHDR", 12, "ascii");
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  return buf;
}

/** JPEG minimal: SOI, segmen APP0, lalu SOF0 dengan dimensi. */
function jpegBuffer(width: number, height: number): Buffer {
  const buf = Buffer.alloc(22);
  buf[0] = 0xff;
  buf[1] = 0xd8; // SOI
  // Segmen APP0 (panjang 4, isi 2 byte) — dilewati pembaca.
  buf[2] = 0xff;
  buf[3] = 0xe0;
  buf.writeUInt16BE(4, 4);
  // SOF0 di offset 8.
  buf[8] = 0xff;
  buf[9] = 0xc0;
  buf.writeUInt16BE(11, 10); // panjang segmen
  buf[12] = 8; // presisi
  buf.writeUInt16BE(height, 13);
  buf.writeUInt16BE(width, 15);
  return buf;
}

/** WEBP lossy (VP8) minimal. */
function webpBuffer(width: number, height: number): Buffer {
  const buf = Buffer.alloc(32);
  buf.write("RIFF", 0, "ascii");
  buf.writeUInt32LE(buf.length - 8, 4);
  buf.write("WEBP", 8, "ascii");
  buf.write("VP8 ", 12, "ascii");
  buf.writeUInt32LE(10, 16);
  buf[23] = 0x9d; // kode sinkronisasi
  buf[24] = 0x01;
  buf[25] = 0x2a;
  buf.writeUInt16LE(width & 0x3fff, 26);
  buf.writeUInt16LE(height & 0x3fff, 28);
  return buf;
}

/** WEBP extended (VP8X) minimal. */
function webpExtendedBuffer(width: number, height: number): Buffer {
  const buf = Buffer.alloc(32);
  buf.write("RIFF", 0, "ascii");
  buf.writeUInt32LE(buf.length - 8, 4);
  buf.write("WEBP", 8, "ascii");
  buf.write("VP8X", 12, "ascii");
  buf.writeUInt32LE(10, 16);
  const w = width - 1;
  const h = height - 1;
  buf[24] = w & 0xff;
  buf[25] = (w >> 8) & 0xff;
  buf[26] = (w >> 16) & 0xff;
  buf[27] = h & 0xff;
  buf[28] = (h >> 8) & 0xff;
  buf[29] = (h >> 16) & 0xff;
  return buf;
}

describe("readImageDimensions — PNG", () => {
  it("membaca dimensi PNG", () => {
    expect(readImageDimensions(pngBuffer(1600, 1200))).toEqual({
      width: 1600,
      height: 1200,
    });
  });

  it("membaca PNG persegi kecil", () => {
    expect(readImageDimensions(pngBuffer(1, 1))).toEqual({ width: 1, height: 1 });
  });

  it("menolak buffer yang terlalu pendek", () => {
    expect(readImageDimensions(Buffer.alloc(4))).toBeNull();
  });

  it("menolak PNG dengan penanda IHDR yang salah", () => {
    const buf = pngBuffer(100, 100);
    buf.write("XXXX", 12, "ascii");
    expect(readImageDimensions(buf)).toBeNull();
  });
});

describe("readImageDimensions — JPEG", () => {
  it("membaca dimensi JPEG", () => {
    expect(readImageDimensions(jpegBuffer(1920, 1080))).toEqual({
      width: 1920,
      height: 1080,
    });
  });

  it("menolak JPEG tanpa penanda SOF", () => {
    const buf = Buffer.alloc(22);
    buf[0] = 0xff;
    buf[1] = 0xd8;
    buf[2] = 0xff;
    buf[3] = 0xe0;
    buf.writeUInt16BE(4, 4);
    expect(readImageDimensions(buf)).toBeNull();
  });
});

describe("readImageDimensions — WEBP", () => {
  it("membaca dimensi WEBP lossy (VP8)", () => {
    expect(readImageDimensions(webpBuffer(800, 600))).toEqual({
      width: 800,
      height: 600,
    });
  });

  it("membaca dimensi WEBP extended (VP8X)", () => {
    expect(readImageDimensions(webpExtendedBuffer(1200, 630))).toEqual({
      width: 1200,
      height: 630,
    });
  });
});

describe("readImageDimensions — penolakan", () => {
  it("mengembalikan null untuk format tak dikenal", () => {
    const buf = Buffer.from("bukan gambar sama sekali, ini teks biasa");
    expect(readImageDimensions(buf)).toBeNull();
  });

  it("mengembalikan null untuk GIF (tidak diterima aplikasi)", () => {
    const buf = Buffer.alloc(32);
    buf.write("GIF89a", 0, "ascii");
    expect(readImageDimensions(buf)).toBeNull();
  });

  it("menolak dimensi nol (berkas rusak)", () => {
    expect(readImageDimensions(pngBuffer(0, 100))).toBeNull();
  });

  it("menolak dimensi tak masuk akal", () => {
    expect(readImageDimensions(pngBuffer(200_000, 10))).toBeNull();
  });
});
