import "server-only";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";

/**
 * ============================================================
 * PENYIMPANAN BERKAS UNGGAHAN — abstraksi driver
 * ============================================================
 *
 * Dipakai untuk gambar yang DIUNGGAH operator (logo sekolah, dan nanti sampul
 * berita). Berbeda dari `coverUrl` yang masih berupa tautan tempel, berkas di
 * sini benar-benar melewati server.
 *
 * DUA DRIVER:
 *   1. `local` (BAWAAN) — tulis ke `public/uploads/`, disajikan Next.js
 *      langsung tanpa route handler. Cocok untuk VPS sekolah: tidak ada
 *      layanan tambahan yang harus hidup.
 *   2. `minio` — BELUM DIIMPLEMENTASI. Disiapkan sebagai sambungan agar
 *      pemanggil tidak perlu diubah saat nanti dipasang. Lihat
 *      `createMinioDriver()`.
 *
 * Kenapa abstraksi ini ada padahal baru satu driver yang jalan: mengganti
 * penyimpanan nanti berarti menyentuh SETIAP tempat yang menulis berkas. Satu
 * antarmuka di sini membuat penggantian itu cukup di satu tempat.
 *
 * CATATAN OPERASIONAL: driver `local` menulis ke dalam folder aplikasi. Kalau
 * nanti dijalankan di beberapa kontainer sekaligus, tiap kontainer punya
 * berkasnya sendiri — saat itulah MinIO/S3 menjadi wajib, bukan pilihan.
 */

/* ============================================================
 * JENIS BERKAS YANG DITERIMA
 * ============================================================ */

/** Batas ukuran gambar unggahan. Logo & sampul tidak perlu lebih besar. */
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB

/**
 * Batas ukuran dokumen (PDF) unggahan.
 *
 * Lebih besar dari gambar karena berkasnya bisa berisi banyak halaman hasil
 * pindai — akta kelahiran, kartu keluarga, dan ijazah sering dipindai dalam
 * satu berkas.
 */
export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024; // 5 MB

export type ImageType = { ext: string; contentType: string };

/**
 * Kenali apakah berkas ini PDF, dari byte awalnya.
 *
 * Sama seperti gambar: `File.type` tidak dipercaya. PDF dipilih karena dokumen
 * sekolah hampir selalu berformat ini (hasil pindai akta, KK, ijazah), dan
 * karena formatnya TIDAK bisa memuat skrip yang berjalan di peramban —
 * berbeda dari SVG atau HTML yang sengaja ditolak.
 */
export function sniffPdf(buf: Buffer): ImageType | null {
  // "%PDF-" = 25 50 44 46 2D
  if (
    buf.length >= 5 &&
    buf[0] === 0x25 &&
    buf[1] === 0x50 &&
    buf[2] === 0x44 &&
    buf[3] === 0x46 &&
    buf[4] === 0x2d
  ) {
    return { ext: "pdf", contentType: "application/pdf" };
  }
  return null;
}

/**
 * Kenali berkas dokumen pendaftaran: PDF atau gambar.
 *
 * Mengembalikan null bila bukan keduanya. Sekolah sering meminta "fotokopi"
 * dokumen — dan yang datang bisa berupa hasil pindai PDF atau foto dari
 * ponsel, jadi keduanya diterima.
 */
export function sniffDocumentType(buf: Buffer): ImageType | null {
  return sniffPdf(buf) ?? sniffImageType(buf);
}

/**
 * Kenali jenis gambar dari BYTE AWAL berkas.
 *
 * KENAPA TIDAK MEMAKAI `File.type`: nilai itu dikirim klien dan bisa ditulis apa
 * saja. Berkas berisi skrip bisa mengaku `image/png`; yang dipercaya hanya isi
 * berkasnya sendiri.
 *
 * SVG SENGAJA TIDAK DITERIMA — bukan kelalaian.
 * SVG adalah XML yang boleh memuat `<script>`. Karena berkas disajikan dari
 * ORIGIN YANG SAMA dengan aplikasi, skrip di dalamnya berjalan dengan sesi
 * admin sekolah dan bisa mencuri cookie atau mengubah data. Tidak ada cara aman
 * memvalidasi SVG untuk keperluan unggahan ini, jadi jenisnya ditolak.
 */
export function sniffImageType(buf: Buffer): ImageType | null {
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return { ext: "png", contentType: "image/png" };
  }

  // JPEG: FF D8 FF
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { ext: "jpg", contentType: "image/jpeg" };
  }

  // WEBP: "RIFF" .... "WEBP"
  if (
    buf.length >= 12 &&
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  ) {
    return { ext: "webp", contentType: "image/webp" };
  }

  return null;
}

/* ============================================================
 * ANTARMUKA DRIVER
 * ============================================================ */

export type StoredFile = {
  /** Kunci internal (path relatif). Dipakai untuk menghapus berkas. */
  key: string;
  /** URL publik yang boleh disimpan ke database dan dipasang di <img src>. */
  url: string;
  bytes: number;
  contentType: string;
};

export interface StorageDriver {
  /** Nama driver — untuk log & pesan galat. */
  readonly name: string;
  put(key: string, body: Buffer, contentType: string): Promise<StoredFile>;
  remove(key: string): Promise<void>;
}

/* ============================================================
 * DRIVER: SISTEM BERKAS LOKAL (BAWAAN)
 * ============================================================ */

/** URL publik tempat berkas lokal disajikan. */
export const LOCAL_URL_PREFIX = "/uploads";

/**
 * Folder unggahan — SENGAJA DI LUAR `public/`.
 *
 * Next.js hanya menyajikan berkas yang sudah ada di `public/` saat BUILD.
 * Berkas yang ditulis saat aplikasi berjalan tidak dijamin tersaji, sehingga
 * logo yang baru diunggah akan tampak hilang di produksi walau berkasnya ada.
 * Karena itu berkas disimpan di `var/uploads/` dan disajikan oleh route handler
 * `app/uploads/[...key]/route.ts`, yang bekerja sama di dev maupun produksi.
 */
function localRoot(): string {
  // UPLOAD_DIR memungkinkan compose/produksi menunjuk folder volume terpisah
  // (mis. /data/uploads) yang bertahan saat container di-redeploy. Bila tak
  // diset, jatuh ke var/uploads relatif cwd (perilaku dev).
  const dir = process.env.UPLOAD_DIR?.trim();
  if (dir) return path.resolve(dir);
  return path.join(process.cwd(), "var", "uploads");
}

/**
 * Ubah kunci menjadi path absolut, sambil MENOLAK kunci yang keluar dari
 * folder unggahan. Tanpa pemeriksaan ini, kunci berisi `../` bisa menulis atau
 * menghapus berkas mana pun di server.
 */
function resolveLocalPath(key: string): string {
  const root = localRoot();
  const target = path.resolve(root, key);
  if (target !== root && !target.startsWith(root + path.sep)) {
    throw new Error(`[storage] Kunci berkas di luar folder unggahan: ${key}`);
  }
  return target;
}

const localDriver: StorageDriver = {
  name: "local",

  async put(key, body, contentType) {
    const target = resolveLocalPath(key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, body);
    return {
      key,
      url: `${LOCAL_URL_PREFIX}/${key}`,
      bytes: body.byteLength,
      contentType,
    };
  },

  async remove(key) {
    // `force: true` → menghapus berkas yang sudah tidak ada bukan galat.
    await rm(resolveLocalPath(key), { force: true });
  },
};

/* ============================================================
 * DRIVER: MinIO (BELUM DIIMPLEMENTASI)
 * ============================================================ */

/**
 * SAMBUNGAN MinIO — sengaja belum berisi implementasi.
 *
 * Cara memasang nanti:
 *   1. `npm i minio --workspace=web`
 *   2. Isi fungsi di bawah: `put` = `minioClient.putObject(bucket, key, body,
 *      body.length, { "Content-Type": contentType })`; `remove` =
 *      `minioClient.removeObject(bucket, key)`; `url` =
 *      `${MINIO_PUBLIC_URL}/${bucket}/${key}`.
 *   3. Set `STORAGE_DRIVER=minio` beserta kredensialnya.
 *
 * Tidak diimplementasikan sekarang karena menambah dependensi untuk fitur yang
 * belum dipakai. Yang penting: pemanggil (`saveImage`, `removeStoredUrl`) sudah
 * tidak tahu-menahu soal driver, jadi penggantian ini tidak menyentuh mereka.
 */
function createMinioDriver(): StorageDriver {
  throw new Error(
    "[storage] STORAGE_DRIVER=minio dipilih tetapi driver MinIO belum " +
      "diimplementasikan. Lihat createMinioDriver() di src/lib/storage.ts.",
  );
}

/* ============================================================
 * PEMILIHAN DRIVER
 * ============================================================ */

/**
 * Driver aktif. Dipilih dari `STORAGE_DRIVER` (bawaan `local`).
 *
 * Sengaja MELEMPAR untuk nilai yang tidak dikenal, bukan diam-diam kembali ke
 * lokal: salah tulis nama driver lalu berkasnya tetap masuk ke disk adalah
 * kegagalan yang baru ketahuan setelah deploy.
 */
export function getStorage(): StorageDriver {
  const name = process.env.STORAGE_DRIVER?.trim().toLowerCase() || "local";
  if (name === "local") return localDriver;
  if (name === "minio") return createMinioDriver();
  throw new Error(
    `[storage] STORAGE_DRIVER="${name}" tidak dikenal. Pilihan: local, minio.`,
  );
}

/* ============================================================
 * OPERASI TINGKAT TINGGI
 * ============================================================ */

/**
 * Simpan gambar dan kembalikan URL publiknya.
 *
 * Jenis berkas sudah dipastikan pemanggil lewat `sniffImageType`; parameter
 * `type` di sini supaya fungsi ini tidak menebak ulang.
 */
export async function saveImage(input: {
  data: Buffer;
  /** Awalan kunci, mis. `<schoolId>/logo`. Nama berkas dibuat acak. */
  prefix: string;
  type: ImageType;
}): Promise<StoredFile> {
  // Nama acak: mencegah dua unggahan saling menimpa, dan membuat URL lama tidak
  // bisa ditebak (berkas sekolah lain tidak bisa ditebak dari polanya).
  const name = `${Date.now().toString(36)}-${randomBytes(4).toString("hex")}`;
  const key = `${input.prefix}/${name}.${input.type.ext}`;
  return getStorage().put(key, input.data, input.type.contentType);
}

/**
 * Simpan dokumen (PDF/gambar) dan kembalikan URL publiknya.
 *
 * Dipisah dari `saveImage` bukan karena kode berbeda, tetapi karena batas
 * ukurannya berbeda — dokumen hasil pindai wajar lebih besar dari logo.
 * Memakai `saveImage` untuk dokumen akan menolak berkas yang sebenarnya sah.
 */
export async function saveDocument(input: {
  data: Buffer;
  /** Awalan kunci, mis. `<schoolId>/registrations/<id>`. */
  prefix: string;
  type: ImageType;
}): Promise<StoredFile> {
  const name = `${Date.now().toString(36)}-${randomBytes(4).toString("hex")}`;
  const key = `${input.prefix}/${name}.${input.type.ext}`;
  return getStorage().put(key, input.data, input.type.contentType);
}

/**
 * Ambil kunci internal dari URL yang kita simpan sendiri.
 * Mengembalikan null untuk URL luar (mis. tautan yang ditempel operator) —
 * berkas seperti itu bukan milik kita dan tidak boleh ikut dihapus.
 */
export function keyFromStoredUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const prefix = `${LOCAL_URL_PREFIX}/`;
  if (!url.startsWith(prefix)) return null;
  const key = url.slice(prefix.length);
  return key.length > 0 ? key : null;
}

/**
 * Hapus berkas bila URL-nya menunjuk ke penyimpanan kita.
 * Diam saja untuk URL luar dan untuk kegagalan — pembersihan berkas tidak
 * boleh menggagalkan aksi utama yang sudah berhasil.
 */
export async function removeStoredUrl(url: string | null | undefined): Promise<void> {
  const key = keyFromStoredUrl(url);
  if (!key) return;
  try {
    await getStorage().remove(key);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[storage] gagal menghapus berkas lama:", key, err);
  }
}
