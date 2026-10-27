# Format Pesan WhatsApp

Panduan bentuk pesan otomatis sekolah. Sumber: `apps/web/src/lib/templates-seed.ts`.
Helper format: `apps/web/src/lib/notification-format.ts`.

## Aturan bentuk

Semua template memakai bentuk baku yang sama:

```
Assalamualaikum, Bapak/Ibu {{nama_wali}}.

*{{judul_kejadian}}*
{{nama_siswa}} · {{kelas}} · {{tanggal}}

{{isi_rinci}}

{{satu_langkah_tindakan}}

— {{nama_sekolah}}
```

- Sapaan satu baris, lalu **satu baris kosong**.
- Judul kejadian `*bold*` satu baris, diikuti baris meta ringkas dipisah ` · `.
- Nama siswa/kelas **tidak diulang** di paragraf isi.
- Isi rinci maks 3 baris. Daftar panjang memakai placeholder `{{daftar_*}}`.
- Tepat **satu** langkah tindakan yang jelas.
- Penutup `— {{nama_sekolah}}` didahului satu baris kosong.
- Nada tenang, tanpa tanda seru berlebihan. Pesan penolakan SPMB tidak memakai
  kata "gagal" terhadap anak dan tetap menyebut langkah berikutnya.
- WhatsApp hanya punya teks: `*bold*`, `_italic_`, `~coret~`. Tabel tidak ada.

## Daftar placeholder

| Template key | Variabel wajib | Contoh isi |
|---|---|---|
| `attendance.absent` | `nama_wali`, `nama_siswa`, `kelas`, `tanggal`, `nama_sekolah` | `Senin, 3 November 2025` |
| `attendance.late` | + `jam` | `07:15` |
| `attendance.summary` | + `periode`, `persentase`, `rekap_kehadiran` | `• Hadir — 18 hari` (baris per status) |
| `grade.below_kkm` | `nama_wali`, `nama_siswa`, `kelas`, `tanggal`, `daftar_nilai` | isi `formatDaftarNilai(items, {kkm})` |
| `grade.report_ready` | `nama_wali`, `nama_siswa`, `kelas`, `semester`, `tanggal_pengambilan` | `Semester Ganjil 2025/2026` |
| `finance.invoice` | `nama_wali`, `nama_siswa`, `kelas`, `tanggal`, `daftar_tagihan`, `jatuh_tempo`, `tautan_bayar` | isi `formatDaftarTagihan(items)` |
| `finance.reminder` | `nama_wali`, `nama_siswa`, `kelas`, `tanggal`, `daftar_tagihan`, `tautan_bayar` | isi `formatDaftarTagihan(items)` |
| `finance.payment_received` | `nama_wali`, `nama_siswa`, `kelas`, `tanggal_bayar`, `jumlah`, `status`, `sisa` | `Rp250.000`, `LUNAS`, `Rp0` |
| `admission.received` | `nama_pendaftar`, `nama_calon`, `nomor_pendaftaran`, `tanggal` | `SPMB-2026-00123` |
| `admission.accepted` | `nama_pendaftar`, `nama_calon`, `nomor_pendaftaran`, `tanggal`, `langkah_selanjutnya` | `Daftar ulang sebelum 30 Juni 2026` |
| `admission.rejected` | sama dengan `accepted` | catatan → `langkah_selanjutnya` |
| `general.announcement` | `judul`, `tanggal`, `isi`, `nama_sekolah` | `Libur Semester` |

`nama_sekolah` diisi otomatis saat pengiriman (`queueNotification`).

## Helper format

`apps/web/src/lib/notification-format.ts`:

| Fungsi | Hasil |
|---|---|
| `formatRupiah(1500000)` | `Rp1.500.000` |
| `formatTanggal("2025-11-03")` | `Senin, 3 November 2025` |
| `formatJam("7:5")` | `07:05` |
| `formatDaftarNilai(items, {kkm})` | baris `• Matematika — 65 *`, maks 8 mapel + `• dan N mapel lain` |
| `formatDaftarTagihan(items, {maks})` | baris `• SPP November — Rp350.000 (tempo 10 Nov)`, maks 5 + `• dan N tagihan lain` |

Kosong → renderer mengganti `{{x}}` dengan `-` (lihat `renderTemplate`).
Modul ini tanpa `server-only`, jadi aman dipakai seed, worker, dan UI.

## Batas karakter

- Batas WhatsApp: **4096 karakter** (`clampMessage` memotong sisanya — info
  penting di bawah bisa hilang, jadi daftar wajib dipotong di sumbernya).
- Validasi form template memakai batas yang sama (`.max(4096)`).
- `cleanMessage()` merapikan `\n` berlebih.

## Menambah template baru

1. Tambah entri ke `TEMPLATE_SEEDS` di `apps/web/src/lib/templates-seed.ts`
   (`key` unik, `category` valid, body ikut bentuk baku).
2. Tambah contoh nilai setiap variabel baru ke `SAMPLE_VARS` — test
   `notification-validation.test.ts` gagal bila ada variabel tanpa contoh.
3. Jalankan `npx vitest run src/lib/notification-format.test.ts src/test/notification-validation.test.ts`.
4. Sekolah yang **sudah ada** menyimpan template di tabel `MessageTemplate`
   (per sekolah), jadi perubahan seed tidak otomatis berlaku. Perlu seed ulang
   atau migrasi data (`notifications/actions.ts` → seed template). Sekolah baru
   otomatis mendapat versi terbaru.
