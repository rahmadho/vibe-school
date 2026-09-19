# AGENTS.md

> Instruksi kerja untuk AI agent (dan developer) yang bekerja di repo **School App**.
> File ini dibaca otomatis oleh agent. Fokus: **cara kerja di project ini**.

---

## 1. Apa itu Aplikasi Ini

Sistem Informasi Sekolah (SIS) multi-tenant yang mencakup:

| Modul | Deskripsi |
|-------|-----------|
| **Web Sekolah** | Website publik: profil, berita, pengumuman, galeri, kontak |
| **SPMB** | Sistem Penerimaan Murid Baru: pendaftaran online, seleksi, pengumuman |
| **Akademik** | Kelas, mata pelajaran, jadwal, tahun ajaran, semester |
| **Absensi** | Absen siswa & guru (harian, per-mapel), rekap otomatis |
| **Penilaian** | Nilai tugas/UTS/UAS, rapor, KKM, peringkat |
| **Keuangan** | Tagihan, pembayaran (SPP/uang pangkal), kwitansi, tunggakan |
| **Notifikasi WA** | Gateway sendiri pakai Baileys → absen, tagihan, pengumuman, nilai |
| **Administrasi** | Data siswa/guru/staf, user & role, log aktivitas |
| **Multi-tenant** | Satu instalasi melayani banyak sekolah (yayasan/unit) |

---

## 2. Stack & Arsitektur

- **Frontend + Backend:** Next.js (App Router, TypeScript)
- **ORM:** Prisma
- **Database:** PostgreSQL
- **Auth:** NextAuth (credentials + role-based)
- **WA Gateway:** Node.js microservice terpisah + Baileys
- **Validasi:** Zod
- **UI:** Tailwind CSS + shadcn/ui

### Struktur Folder

```
school-app/
├─ AGENTS.md            # file ini
├─ SOUL.md              # kepribadian/nilai agent
├─ docker-compose.yml   # postgres + wa-gateway
├─ prisma/
│  └─ schema.prisma     # skema database (single source of truth)
├─ docs/                # dokumentasi arsitektur & modul
├─ apps/
│  ├─ web/              # Next.js app utama
│  └─ wa-gateway/       # service WhatsApp (Baileys)
```

---

## 3. Aturan Main (WAJIB)

1. **Multi-tenant disiplin.** Setiap tabel data milik sekolah HARUS punya `schoolId`.
   Setiap query data sekolah WAJIB difilter `schoolId` dari sesi user. Dilarang query lintas-tenant tanpa cek role super-admin.
2. **Prisma = sumber kebenaran skema.** Jangan ubah DB manual. Semua perubahan skema lewat `prisma migrate`.
3. **Jangan commit rahasia.** Kredensial hanya di `.env` (lihat `.env.example`).
4. **Soft delete.** Gunakan `deletedAt` untuk data penting (siswa, tagihan). Jangan hard delete.
5. **Audit log.** Aksi yang mengubah data (create/update/delete) penting harus dicatat ke `AuditLog`.
6. **Uang = integer.** Simpan nominal sebagai integer rupiah (bukan float). Field nama `*Amount` satuan Rupiah.
7. **Tanggal uang ≠ tanggal input.** `dueDate` (jatuh tempo) dan `paidAt` (dibayar) terpisah.
8. **Nomor WA = format E.164 tanpa `+`** (contoh: `628123456789`). Normalisasi di satu util.
9. **Notifikasi lewat queue.** Jangan kirim WA langsung di request handler; masukkan ke tabel `NotificationQueue`, worker yang proses.
10. **TypeScript strict.** Tidak ada `any` tanpa alasan jelas disertai komentar.

---

## 4. Perintah Penting

```bash
npm install                 # install deps
npx prisma generate         # generate client
npx prisma migrate dev      # buat & jalankan migrasi (dev)
npx prisma studio           # GUI database
npm run dev                 # jalankan dev server
npm run build               # build produksi
npm run lint                # lint
npm run test                # test
docker compose up -d        # postgres + wa-gateway
```

---

## 5. Konvensi Penamaan

- **Tabel/model Prisma:** PascalCase singular → `Student`, `Invoice` (`@@map` ke snake_case plural `students`, `invoices`).
- **Field:** camelCase → `schoolId`, `dueDate`, `paidAmount`.
- **Enum:** SCREAMING_SNAKE → `PAID`, `UNPAID`, `PRESENT`, `ABSENT`.
- **File komponen:** kebab-case → `student-form.tsx`.
- **Route API:** `/api/<modul>/<aksi>` → `/api/students/create`.

---

## 6. Definition of Done

Sebuah fitur dianggap selesai jika:
- [ ] Kode lolos `lint` + `build` + `test`.
- [ ] Query sudah difilter `schoolId`.
- [ ] Ada validasi input (Zod).
- [ ] Aksi penting tercatat di `AuditLog`.
- [ ] Kalau memicu WA → masuk `NotificationQueue` (bukan kirim langsung).
- [ ] Dokumentasi modul di `docs/` diperbarui bila perlu.

---

## 7. Yang HARUS Dihindari

- ❌ Query tanpa filter `schoolId` (kebocoran data antar-sekolah).
- ❌ Simpan uang sebagai `Float`/`Decimal` tanpa alasan.
- ❌ Kirim WA sinkron di dalam transaksi DB panjang.
- ❌ `prisma db push` di produksi (pakai `migrate deploy`).
- ❌ Hard delete data siswa/tagihan/keuangan.
