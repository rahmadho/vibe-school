/**
 * Baca dimensi gambar dari header berkas — MURNI, tanpa dependensi.
 *
 * ============================================================
 * KENAPA TIDAK MEMAKAI PUSTAKA (mis. `sharp` / `image-size`)
 * ============================================================
 * Aplikasi ini hanya menerima TIGA format (PNG, JPEG, WEBP), dan ketiganya
 * menaruh dimensi di tempat yang tetap dan sederhana. Menambah pustaka berarti
 * menambah berkas biner native (sharp ~30 MB) hanya untuk membaca 8 byte —
 * dan pustaka itu harus ikut dibangun ulang di setiap mesin tempat aplikasi
 * dipasang (VPS sekolah). Beberapa lusin baris di sini jauh lebih murah, dan
 * bisa diuji tanpa berkas gambar nyata.
 *
 * ============================================================
 * KENAPA PENTING
 * ============================================================
 * Dimensi dipakai untuk dua hal nyata:
 *   1. Menampilkan ukuran asli di pustaka media, sehingga operator tahu
 *      gambar mana yang terlalu kecil untuk banner atau terlalu besar untuk
 *      halaman.
 *   2. Mencegah gambar raksasa dipasang di tempat yang salah.
 *
 * Mengembalikan `null` bila dimensi tidak terbaca — itu BUKAN kegagalan
 * unggah. Berkas yang tidak bisa dibaca tetap boleh dipakai; hanya angkanya
 * yang tidak ditampilkan.
 */

export type ImageDimensions = { width: number; height: number };

/**
 * Baca dimensi dari buffer gambar.
 * Mendukung PNG, JPEG, dan WEBP — persis format yang diterima aplikasi.
 */
export function readImageDimensions(buf: Buffer): ImageDimensions | null {
  if (buf.length < 16) return null;

  // PNG: signature 8 byte, lalu chunk IHDR dengan lebar & tinggi big-endian.
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return readPng(buf);
  }

  // JPEG: diawali FF D8.
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    return readJpeg(buf);
  }

  // WEBP: "RIFF" .... "WEBP".
  if (
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  ) {
    return readWebp(buf);
  }

  return null;
}

/** PNG — lebar & tinggi ada di IHDR, byte 16..24. */
function readPng(buf: Buffer): ImageDimensions | null {
  if (buf.toString("ascii", 12, 16) !== "IHDR") return null;
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return sane(width, height);
}

/**
 * JPEG — telusuri segmen sampai menemukan penanda SOF (Start Of Frame).
 *
 * Setiap segmen diawali FF <kode> lalu panjang 2 byte (termasuk panjangnya
 * sendiri). Yang perlu dilewati: APPn, COM, dan segmen lain. SOF memuat
 * tinggi & lebar.
 */
function readJpeg(buf: Buffer): ImageDimensions | null {
  let offset = 2;

  while (offset + 9 < buf.length) {
    // Penanda harus diawali 0xFF; kalau tidak, berkasnya rusak.
    if (buf[offset] !== 0xff) return null;

    const marker = buf[offset + 1];

    // Penanda tanpa muatan.
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }

    const length = buf.readUInt16BE(offset + 2);
    if (length < 2) return null;

    // SOF0..SOF3, SOF5..SOF7, SOF9..SOF11, SOF13..SOF15 (bukan DHT/DAC/RST).
    const isSof =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);

    if (isSof) {
      // Setelah panjang: presisi 1 byte, tinggi 2 byte, lebar 2 byte.
      const height = buf.readUInt16BE(offset + 5);
      const width = buf.readUInt16BE(offset + 7);
      return sane(width, height);
    }

    offset += 2 + length;
  }

  return null;
}

/** WEBP — tiga varian: VP8 (lossy), VP8L (lossless), VP8X (extended). */
function readWebp(buf: Buffer): ImageDimensions | null {
  const fourCC = buf.toString("ascii", 12, 16);

  if (fourCC === "VP8X") {
    // Dimensi disimpan minus satu, dalam 24 bit little-endian.
    const width = 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16));
    const height = 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16));
    return sane(width, height);
  }

  if (fourCC === "VP8 ") {
    // Lossy: lebar & tinggi 14 bit little-endian setelah kode sinkronisasi.
    if (buf[23] !== 0x9d || buf[24] !== 0x01 || buf[25] !== 0x2a) return null;
    const width = buf.readUInt16LE(26) & 0x3fff;
    const height = buf.readUInt16LE(28) & 0x3fff;
    return sane(width, height);
  }

  if (fourCC === "VP8L") {
    // Lossless: 14 bit masing-masing, dipaketkan dalam 4 byte.
    if (buf[20] !== 0x2f) return null;
    const bits = buf.readUInt32LE(21);
    const width = 1 + (bits & 0x3fff);
    const height = 1 + ((bits >> 14) & 0x3fff);
    return sane(width, height);
  }

  return null;
}

/** Tolak angka yang tidak masuk akal — penanda berkas rusak atau palsu. */
function sane(width: number, height: number): ImageDimensions | null {
  if (!Number.isInteger(width) || !Number.isInteger(height)) return null;
  if (width <= 0 || height <= 0) return null;
  if (width > 100_000 || height > 100_000) return null;
  return { width, height };
}
