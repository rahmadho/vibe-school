# Penyimpanan Berkas Unggahan

> Cara berkas yang diunggah operator (logo sekolah, dan nanti sampul berita)
> disimpan dan disajikan.

---

## 1. Ringkasan

Satu antarmuka, dua driver:

| Driver | Status | Penyimpanan | Kapan dipakai |
|---|---|---|---|
| `local` | **BAWAAN, sudah jalan** | `apps/web/var/uploads/` | VPS sekolah tunggal |
| `minio` | **BELUM**, sambungan disiapkan | bucket MinIO/S3 | Beberapa kontainer / banyak sekolah |

Pemilihan lewat variabel lingkungan:

```bash
STORAGE_DRIVER="local"   # atau "minio"
```

Nama driver yang tidak dikenal **melempar galat**, tidak diam-diam kembali ke
lokal. Salah tulis nama lalu berkasnya tetap masuk ke disk adalah kegagalan yang
baru ketahuan setelah deploy.

---

## 2. Kenapa disimpan di `var/uploads/`, bukan `public/`

Next.js hanya menyajikan berkas yang sudah ada di `public/` **saat build**.
Berkas yang ditulis saat aplikasi berjalan tidak dijamin tersaji — logo yang baru
diunggah akan tampak hilang di produksi walau berkasnya ada di disk.

Karena itu berkas disimpan di `apps/web/var/uploads/` dan disajikan oleh route
handler:

```
apps/web/src/app/uploads/[...key]/route.ts
```

Route handler bekerja sama di dev maupun produksi. Ia juga:

- menolak kunci yang keluar dari folder unggahan (`../`) — mencegah path traversal
- hanya menyajikan ekstensi di daftar putih (`png`, `jpg`, `jpeg`, `webp`)
- mengirim `X-Content-Type-Options: nosniff`
- memakai `Cache-Control: immutable` (nama berkas sudah mengandung hash acak)

---

## 3. Jenis berkas yang diterima

Jenis ditentukan dari **byte awal berkas** (`sniffImageType`), bukan dari
`File.type` kiriman klien — nilai itu bisa ditulis apa saja.

| Jenis | Diterima |
|---|---|
| PNG | ✅ |
| JPEG | ✅ |
| WEBP | ✅ |
| **SVG** | ❌ **sengaja ditolak** |
| GIF, HTML, berkas lain | ❌ |

### Kenapa SVG ditolak

SVG adalah XML yang boleh memuat `<script>`. Karena berkas disajikan dari
**origin yang sama** dengan aplikasi, skrip di dalamnya berjalan dengan sesi
admin sekolah — bisa mencuri cookie atau mengubah data. Tidak ada cara aman
memvalidasi SVG untuk keperluan unggahan ini, jadi jenisnya ditolak.

Batas ukuran: **2 MB** (`MAX_IMAGE_BYTES`).

---

## 4. Cara menambah pemakaian baru

Semua operasi lewat `lib/storage.ts`:

```ts
import { saveImage, removeStoredUrl, sniffImageType } from "@/lib/storage";

const type = sniffImageType(buf);           // null = tolak
if (!type) return { ok: false, error: "..." };

const stored = await saveImage({
  data: buf,
  prefix: `${schoolId}/logo`,               // nama berkas dibuat acak
  type,
});
// stored.url  → simpan ke database
// stored.key  → untuk menghapus

await removeStoredUrl(urlLama);             // diam bila URL bukan milik kita
```

**Urutan yang benar saat mengganti berkas:**
simpan berkas baru → perbarui database → **baru** hapus berkas lama.

Kalau urutannya terbalik, unggahan yang gagal bisa meninggalkan sekolah tanpa
logo sama sekali. Bila database gagal diperbarui, berkas baru yang sudah ditulis
harus dibuang — kalau tidak, berkas tak terpakai menumpuk.

Contoh lengkap: `uploadSchoolLogo()` di
`src/app/(dashboard)/dashboard/website/actions.ts`.

---

## 5. Memasang MinIO (nanti)

1. `npm i minio --workspace=web`
2. Isi `createMinioDriver()` di `src/lib/storage.ts`:
   - `put` → `minioClient.putObject(bucket, key, body, body.length, { "Content-Type": contentType })`
   - `remove` → `minioClient.removeObject(bucket, key)`
   - `url` → `${MINIO_PUBLIC_URL}/${bucket}/${key}`
3. Set `STORAGE_DRIVER=minio` beserta kredensialnya.

Pemanggil (`saveImage`, `removeStoredUrl`, actions, komponen) **tidak perlu
diubah** — itulah gunanya abstraksi ini. Satu-satunya hal yang perlu ditinjau:
`keyFromStoredUrl()` mengenali URL lokal lewat awalan `/uploads/`; driver MinIO
perlu mengembalikan kunci dengan cara sendiri.

### Kapan MinIO menjadi wajib

Driver `local` menulis ke dalam folder aplikasi. Bila aplikasi dijalankan di
**beberapa kontainer sekaligus**, tiap kontainer punya berkasnya sendiri —
operator bisa mengunggah logo lalu tidak melihatnya karena permintaan
berikutnya dilayani kontainer lain. Saat itulah MinIO/S3 menjadi wajib, bukan
pilihan.

---

## 6. Backup

`var/uploads/` **tidak** ikut ter-commit (lihat `.gitignore`) dan **tidak** ikut
`pg_dump`. Backup database saja tidak cukup — tanpa folder ini, semua logo
sekolah hilang walau datanya masih menunjuk ke URL yang benar.

Sertakan folder ini dalam rutin backup VPS.
