# Skema Database

Sumber kebenaran: `prisma/schema.prisma`. Dokumen ini menjelaskan kelompok tabel & relasinya.

## Konvensi

- **Model** PascalCase (`Student`), **tabel** snake_case plural (`students`) via `@@map`.
- **Uang** = `Int` (Rupiah utuh). Tidak pakai float.
- **WA number** = string E.164 tanpa `+` (`628123456789`).
- **Soft delete** = kolom `deletedAt` (null = aktif).
- **Semua tabel data sekolah** punya `schoolId` + index.

## Peta Tabel per Kelompok

### A. Tenant & Identitas
| Tabel | Fungsi |
|-------|--------|
| `schools` | Satu baris = satu sekolah (tenant). Simpan `slug`, `npsn`, config WA. |

### B. User & Auth
| Tabel | Fungsi |
|-------|--------|
| `users` | Akun login. `schoolId` null = super-admin. Terhubung ke `student`/`teacher`/`staff`. |
| `sessions` | Sesi login aktif. |

`UserRole`: SUPER_ADMIN, SCHOOL_ADMIN, PRINCIPAL, TREASURER, TEACHER, STUDENT, PARENT, STAFF.

### C. Akademik
| Tabel | Fungsi |
|-------|--------|
| `academic_years` | Tahun ajaran ("2025/2026"). |
| `semesters` | Ganjil/Genap dalam tahun ajaran. |
| `classes` | Kelas (7A, 7B...) + wali kelas + kapasitas. |
| `subjects` | Mata pelajaran + KKM. |
| `schedules` | Jadwal: kelas + mapel + guru + hari + jam. |
| `teacher_subjects` | Relasi guru ↔ mapel yang diampu. |

### D. Guru & Staf
| Tabel | Fungsi |
|-------|--------|
| `teachers` | Data guru (+NIP, kontak). |
| `staffs` | Data staf non-guru. |

### E. Siswa & Wali
| Tabel | Fungsi |
|-------|--------|
| `students` | Data siswa (NIS, NISN, kelas, status). |
| `parents` | Wali murid + nomor WA (sumber notifikasi). |

`StudentStatus`: ACTIVE, GRADUATED, TRANSFERRED, DROPPED_OUT, SUSPENDED.

### F. SPMB
| Tabel | Fungsi |
|-------|--------|
| `admission_batches` | Gelombang pendaftaran (kuota, tanggal buka/tutup). |
| `registrations` | Pendaftaran calon siswa, dokumen, skor, status seleksi. |

`RegistrationStatus`: DRAFT → PENDING → VERIFIED → TESTED → ACCEPTED/REJECTED/WAITLIST/WITHDRAWN.

### G. Absensi
| Tabel | Fungsi |
|-------|--------|
| `attendances` | Absen siswa **atau** guru per tanggal. Ada `markedById` (siapa menandai). |

`AttendanceStatus`: PRESENT, LATE, SICK, EXCUSED, ABSENT.

### H. Penilaian
| Tabel | Fungsi |
|-------|--------|
| `grade_items` | Komponen nilai (UTS, Tugas...) + bobot + max skor. |
| `grades` | Nilai per siswa per komponen. |
| `report_cards` | Nilai akhir rapor per siswa/semester/mapel. |

`GradeType`: ASSIGNMENT, QUIZ, MIDTERM, FINAL, PRACTICUM, PROJECT.

### I. Keuangan
| Tabel | Fungsi |
|-------|--------|
| `fee_types` | Master biaya (SPP, uang pangkal) + nominal default. |
| `invoices` | Tagihan per siswa (status, jatuh tempo, total, dibayar). |
| `invoice_items` | Rincian tagihan. |
| `payment_methods` | Cara bayar (Tunai, Transfer, QRIS). |
| `payments` | Pembayaran yang dicatat (+ siapa mencatat). |
| `payment_gateway_transactions` | Transaksi via Midtrans/Xendit (VA, link, status webhook). |

`InvoiceStatus`: UNPAID, PARTIAL, PAID, OVERDUE, CANCELLED, REFUNDED.
`GatewayProvider`: MIDTRANS, XENDIT, MANUAL.
`GatewayStatus`: PENDING, SETTLEMENT, EXPIRE, REFUND, FAILED.

### J. Konten Web
| Tabel | Fungsi |
|-------|--------|
| `posts` | Berita/pengumuman/agenda/galeri (web publik). |
| `announcements` | Pengumuman internal + opsi kirim WA. |
| `announcement_reads` | Pelacakan sudah dibaca siapa. |

### K. Notifikasi WA
| Tabel | Fungsi |
|-------|--------|
| `notification_templates` | Template pesan per sekolah per jenis. |
| `notification_queue` | Antrian kirim WA. Worker mengambil dari sini. |

`NotificationStatus`: QUEUED, PROCESSING, SENT, FAILED, CANCELLED.

### L. Audit
| Tabel | Fungsi |
|-------|--------|
| `audit_logs` | Jejak aksi penting (create/update/delete/login) + payload before/after. |

### M. Jam Pelajaran (Jam ke-N)
| Tabel | Fungsi |
|-------|--------|
| `time_slots` | Master jam ke-1..N per sekolah (07:00-07:45, dst). Direferensi `schedules`. |

### N. Riwayat Kelas (Kenaikan / Mutasi)
| Tabel | Fungsi |
|-------|--------|
| `student_class_histories` | Riwayat kelas siswa per tahun ajaran + hasil akhir. |

`ClassProgression`: NAIK, TINGGAL, LULUS, MUTASI.

### O. Komersial (SaaS)
| Tabel | Fungsi |
|-------|--------|
| `plans` | Paket langganan (Basic/Pro/Enterprise) + limit & fitur. |
| `subscriptions` | Langganan per sekolah (status, mulai, berakhir). |

`SubscriptionStatus`: TRIAL, ACTIVE, SUSPENDED, EXPIRED, CANCELLED.

## Relasi Kunci

```
School 1─N User 1─1 Student/Teacher/Staff
School 1─N Student N─1 Class N─1 AcademicYear
Student 1─N Parent
Student 1─N Invoice 1─N Payment
Student 1─N Attendance
Class N─N Subject (via Schedule)
GradeItem 1─N Grade N─1 Student
School 1─N NotificationQueue
```

## Index Penting

- `users(schoolId)`, `users(role)`
- `students(schoolId, nis)`, `students(classId)`
- `attendances(schoolId, date)`, `attendances(studentId, date)`
- `invoices(schoolId, studentId)`, `invoices(status)`
- `notification_queue(status, scheduledAt)` ← kunci performa worker WA
- `audit_logs(schoolId, entity)`

## Migrasi

```bash
npx prisma migrate dev --name init     # buat migrasi awal (dev)
npx prisma migrate deploy              # terapkan di produksi (JANGAN pakai db push)
npx prisma generate                    # regenerate client
```

## Catatan Desain

- **Nominal uang** tidak pernah float → hindari error pembulatan pada keuangan.
- **`paidAmount`** didenormalisasi di `invoices` untuk query cepat; dihitung ulang dari `payments` saat transaksi.
- **`attendance`** menampung siswa *dan* guru (field salah satu null) agar satu tabel cukup.
- **`notification_queue`** inilah jembatan async antara web app dan WA gateway.
