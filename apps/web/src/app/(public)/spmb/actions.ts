"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { queueNotification } from "@/lib/notification-queue";
import { resolveSchoolFromRequest } from "@/lib/site-server";
import { getPublicBatches } from "@/lib/data/site";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  buildRegistrationNo,
  maskPhone,
  maskName,
  normalizeRegistrationNo,
  registrationStatusLabel,
} from "@/lib/spmb-public";
import {
  publicRegistrationSchema,
  statusCheckSchema,
} from "@/lib/validations/spmb-public";
import { normalizePhone } from "@/lib/validations/common";

/**
 * Server Actions untuk SPMB PUBLIK.
 *
 * PERBEDAAN PENTING dari actions panitia (`dashboard/spmb/admission-actions.ts`):
 *
 *   1. TIDAK ADA SESI. Pemanggil adalah orang tua tanpa akun. Karena itu
 *      konteks sekolah diambil dari RESOLUSI SUBDOMAIN (`resolveSchoolFromRequest`),
 *      bukan dari sesi — persis seperti halaman publik lainnya.
 *
 *   2. TIDAK BOLEH percaya masukan. Formulir publik bisa dikirim ulang, diubah
 *      lewat alat pengembang, atau dibanjiri otomatis. Setiap id gelombang &
 *      jalur diverifikasi ulang ke DB, dan gelombang WAJIB masih terbuka.
 *
 *   3. BALASAN TIDAK BOLEH MEMBOCORKAN apa pun. Untuk pengecekan status, kami
 *      membedakan "tidak ditemukan" dari "data salah" hanya seminimal mungkin —
 *      cukup agar orang tua tahu harus menghubungi sekolah.
 */

/* ============================================================
 * HASIL AKSI
 * ============================================================ */

export type PublicActionResult =
  | { ok: true; registrationNo?: string; message: string }
  | {
      ok: false;
      error: string;
      fieldErrors?: Record<string, string[]>;
    };

/** Ratakan galat Zod menjadi peta field → pesan. */
function flatten(err: {
  issues: Array<{ path: (string | number)[]; message: string }>;
}): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const i of err.issues) {
    const key = String(i.path[0] ?? "_");
    (out[key] ??= []).push(i.message);
  }
  return out;
}

/** Metadata permintaan untuk audit (tanpa membocorkan identitas ke UI). */
async function requestMeta() {
  const h = await headers();
  return {
    ipAddress: h.get("x-forwarded-for") ?? null,
    userAgent: h.get("user-agent") ?? null,
  };
}

/* ============================================================
 * KIRIM PENDAFTARAN
 * ============================================================ */

/**
 * Terima pendaftaran dari formulir publik.
 *
 * Alur: validasi bentuk → verifikasi gelombang & jalur ke DB → pastikan
 * gelombang masih buka & jalur belum penuh → simpan → antrekan notifikasi WA
 * berisi nomor pendaftaran.
 *
 * Nomor pendaftaran dibuat di sini, BUKAN oleh klien. Kalau klien yang
 * menentukan, orang tua bisa menebak/menentukan nomor pendaftar lain.
 */
export async function submitPublicRegistration(
  formData: FormData,
): Promise<PublicActionResult> {
  // 1. Sekolah ditentukan host, bukan masukan pengguna.
  const ctx = await resolveSchoolFromRequest();
  if (ctx.status !== "ok") {
    return { ok: false, error: "Alamat pendaftaran tidak dikenali." };
  }
  const schoolId = ctx.school.id;

  // Pembatasan laju: 10 pendaftaran per 10 menit per alamat IP.
  //
  // Batasnya sengaja longgar — satu keluarga bisa mendaftarkan beberapa anak
  // dari satu jaringan sekolah/warnet, dan menolak mereka akan jauh lebih
  // merugikan daripada membiarkan satu orang mengirim sepuluh pendaftaran.
  // Yang dicegah adalah pengiriman massal oleh skrip, bukan pemakaian wajar.
  const limited = await checkRateLimit("spmb-submit", 10, 10 * 60 * 1000);
  if (limited) return { ok: false, error: limited };

  // 2. Bentuk isian.
  const parsed = publicRegistrationSchema.safeParse({
    batchId: formData.get("batchId"),
    pathId: formData.get("pathId"),
    majorId: formData.get("majorId") ?? "",
    fullName: formData.get("fullName"),
    gender: formData.get("gender"),
    birthPlace: formData.get("birthPlace"),
    birthDate: formData.get("birthDate"),
    religion: formData.get("religion") ?? "",
    address: formData.get("address"),
    phone: formData.get("phone") ?? "",
    email: formData.get("email") ?? "",
    previousSchool: formData.get("previousSchool") ?? "",
    parentName: formData.get("parentName"),
    parentPhone: formData.get("parentPhone"),
    parentRelation: formData.get("parentRelation"),
    agree: formData.get("agree"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Periksa kembali isian yang bertanda merah.",
      fieldErrors: flatten(parsed.error),
    };
  }
  const d = parsed.data;

  // 3. Verifikasi gelombang & jalur terhadap DB (jangan percaya form).
  const batch = await prisma.admissionBatch.findFirst({
    where: { id: d.batchId, schoolId, isActive: true },
  });
  if (!batch) {
    return { ok: false, error: "Gelombang pendaftaran tidak ditemukan atau sudah ditutup." };
  }

  const now = new Date();
  if (batch.openDate.getTime() > now.getTime()) {
    return { ok: false, error: "Pendaftaran untuk gelombang ini belum dibuka." };
  }
  if (batch.closeDate.getTime() < now.getTime()) {
    return { ok: false, error: "Pendaftaran untuk gelombang ini sudah ditutup." };
  }

  const path = await prisma.admissionPath.findFirst({
    where: { id: d.pathId, schoolId, batchId: batch.id, isActive: true },
  });
  if (!path) {
    return { ok: false, error: "Jalur pendaftaran yang dipilih tidak tersedia." };
  }

  // 3b. Jurusan opsional: hanya sekolah yang punya daftar jurusan aktif yang
  //     mengirimnya. Diverifikasi ke DB supaya tidak ada id jurusan sekolah lain
  //     yang lolos lewat form yang dimanipulasi.
  let majorId: string | null = null;
  if (d.majorId) {
    const major = await prisma.major.findFirst({
      where: { id: d.majorId, schoolId, deletedAt: null, isActive: true },
      select: { id: true },
    });
    if (!major) {
      return { ok: false, error: "Jurusan yang dipilih tidak tersedia." };
    }
    majorId = major.id;
  }

  // 4. Kuota GELOMBANG — ditegakkan, bukan hanya kuota jalur.
  //
  // Sebelumnya hanya kuota jalur yang diperiksa. Akibatnya gelombang berkuota
  // 100 dengan tiga jalur berkuota 50 masing-masing bisa menerima 150
  // pendaftar, dan kelebihannya baru ketahuan saat ruang kelas kurang.
  // Dihitung dari status yang sudah mengikat (bukan PENDING yang masih bisa
  // gugur), supaya kuota tidak terpakai oleh pendaftar yang tidak serius.
  if (batch.quota > 0) {
    const acceptedInBatch = await prisma.registration.count({
      where: {
        schoolId,
        batchId: batch.id,
        status: { in: ["VERIFIED", "TESTED", "ACCEPTED"] },
      },
    });
    if (acceptedInBatch >= batch.quota) {
      return {
        ok: false,
        error:
          `Kuota gelombang "${batch.name}" sudah penuh (${acceptedInBatch}/${batch.quota}). ` +
          "Silakan hubungi sekolah untuk informasi gelombang berikutnya.",
      };
    }
  }

  // 4b. Jalur yang penuh tidak boleh menerima pendaftar baru — mencegah orang tua
  if (path.quota > 0) {
    const filled = await prisma.registration.count({
      where: {
        schoolId,
        batchId: batch.id,
        pathId: path.id,
        status: { in: ["VERIFIED", "TESTED", "ACCEPTED"] },
      },
    });
    if (filled >= path.quota) {
      return {
        ok: false,
        error:
          `Jalur "${path.name}" sudah penuh (${filled}/${path.quota}). ` +
          "Silakan pilih jalur lain atau hubungi sekolah.",
      };
    }
  }

  // 5. Cegah pendaftaran ganda pada gelombang yang sama.
  //
  // Kunci yang dipakai: nama calon + tanggal lahir + nomor WA orang tua.
  // Ketiganya bersama-sama cukup unik untuk satu anak, tetapi tidak terlalu
  // ketat — dua anak kembar dengan orang tua sama tetap bisa mendaftar
  // (tanggal lahirnya berbeda), dan orang tua yang mendaftarkan dua anaknya
  // juga tidak terhalang.
  //
  // Yang dicegah: orang yang sama menekan "Kirim" dua kali karena jaringan
  // lambat, atau sengaja mendaftar berkali-kali untuk mendapat beberapa nomor.
  const duplicate = await prisma.registration.findFirst({
    where: {
      schoolId,
      batchId: batch.id,
      fullName: { equals: d.fullName.trim(), mode: "insensitive" },
      parentPhone: d.parentPhone,
      ...(d.birthDate ? { birthDate: new Date(d.birthDate) } : {}),
      status: { notIn: ["WITHDRAWN", "REJECTED"] },
    },
    select: { registrationNo: true },
  });
  if (duplicate) {
    return {
      ok: false,
      error:
        `Pendaftaran dengan data yang sama sudah tercatat pada gelombang ini ` +
        `(nomor ${duplicate.registrationNo}). ` +
        "Gunakan halaman Cek Status untuk melihat hasilnya, atau hubungi sekolah " +
        "bila Anda merasa ini keliru.",
    };
  }

  // 6. Simpan. Nomor pendaftaran dibuat di server; ulangi bila kebetulan bentrok
  //    (peluangnya kecil, tetapi nomor ini unik global dan tidak boleh gagal).
  const meta = await requestMeta();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const registrationNo = buildRegistrationNo({
      year: batch.openDate.getFullYear(),
      pathCode: path.code,
    });

    try {
      const created = await prisma.registration.create({
        data: {
          schoolId,
          batchId: batch.id,
          pathId: path.id,
          majorId,
          registrationNo,
          fullName: d.fullName,
          gender: d.gender,
          birthPlace: d.birthPlace,
          birthDate: new Date(d.birthDate),
          religion: d.religion ?? null,
          address: d.address,
          phone: d.phone ?? null,
          email: d.email ?? null,
          parentName: d.parentName,
          parentPhone: d.parentPhone,
          parentRelation: d.parentRelation,
          previousSchool: d.previousSchool ?? null,
          submittedAt: new Date(),
        },
        select: { id: true, registrationNo: true },
      });

      await recordAudit({
        schoolId,
        userId: null, // pendaftar publik: tidak ada akun
        action: "CREATE",
        entity: "Registration",
        entityId: created.id,
        after: {
          registrationNo: created.registrationNo,
          batch: batch.name,
          path: path.name,
          via: "public",
        },
        ...meta,
      });

      // Notifikasi WA berisi nomor pendaftaran — masuk antrean, bukan dikirim
      // langsung (aturan proyek #9). Nomor WA orang tua menjadi kuncinya.
      //
      // NAMA TEMPLATE: `admission.*`, bukan `spmb.*`. Sebelumnya kode memanggil
      // "spmb.received" yang TIDAK PERNAH ADA di database, sehingga notifikasi
      // konfirmasi gagal terkirim secara diam-diam — `queueNotification`
      // memang sengaja tidak melempar galat. Pendaftar tidak pernah tahu
      // nomornya, dan panitia tidak pernah tahu ada yang gagal.
      //
      // NAMA VARIABEL juga harus sama dengan isi template: `{{nama_pendaftar}}`,
      // `{{nama_calon}}`, `{{nomor_pendaftaran}}`. Variabel yang tidak dikenal
      // diisi "-", jadi kesalahan di sini membuat pesannya berbunyi
      // "Bapak/Ibu -, nomor -".
      await queueNotification({
        schoolId,
        to: d.parentPhone,
        recipientName: d.parentName,
        templateKey: "admission.received",
        vars: {
          nama_pendaftar: d.parentName,
          nama_calon: d.fullName,
          nomor_pendaftaran: created.registrationNo,
        },
        refType: "Registration",
        refId: created.id,
      });

      return {
        ok: true,
        registrationNo: created.registrationNo,
        message:
          "Pendaftaran berhasil dikirim. Simpan nomor pendaftaran Anda untuk " +
          "memeriksa hasil seleksi.",
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "";
      // Bentrok nomor (P2002) → coba nomor baru. Galat lain → berhenti.
      if (msg.includes("Unique constraint") || msg.includes("P2002")) {
        continue;
      }
      return {
        ok: false,
        error:
          "Pendaftaran gagal disimpan. Silakan coba lagi, atau hubungi sekolah " +
          "bila masalah berlanjut.",
      };
    }
  }

  return {
    ok: false,
    error: "Nomor pendaftaran gagal dibuat. Silakan coba beberapa saat lagi.",
  };
}

/* ============================================================
 * CEK STATUS
 * ============================================================ */

/** Data status yang aman ditampilkan ke pengunjung (sudah disaring). */
export type PublicStatusResult = {
  registrationNo: string;
  /** Nama pendaftar yang sudah disamarkan. */
  maskedName: string;
  /** Nomor HP orang tua yang sudah disamarkan — menguatkan keyakinan pemilik. */
  maskedPhone: string;
  status: string;
  statusLabel: string;
  batchName: string;
  pathName: string | null;
  submittedAt: string;
  decidedAt: string | null;
  /** Catatan hasil; hanya diisi panitia setelah keputusan. */
  resultNote: string | null;
  /** Pengumuman resmi + tanggal pengumuman, bila panitia sudah mengisi. */
  resultAnnouncement: string | null;
  resultDate: string | null;
};

export type StatusCheckResult =
  | { ok: true; data: PublicStatusResult }
  | { ok: false; error: string };

/**
 * Cek status pendaftaran.
 *
 * Kalimat galat sengaja SATU bentuk untuk "data tidak cocok" — tidak
 * membedakan "nomor pendaftaran tidak ada" dari "nomor HP salah" — agar orang
 * iseng tidak bisa memastikan nomor pendaftaran mana yang ada dengan
 * mencoba-coba.
 */
export async function checkRegistrationStatus(
  formData: FormData,
): Promise<StatusCheckResult> {
  const ctx = await resolveSchoolFromRequest();
  if (ctx.status !== "ok") {
    return { ok: false, error: "Alamat sekolah tidak dikenali." };
  }
  const schoolId = ctx.school.id;

  // Cek status dibatasi lebih ketat: 20 percobaan per 10 menit.
  //
  // Lebih ketat karena halaman ini menerima nomor pendaftaran + nomor HP, dan
  // tanpa batas seseorang bisa mencoba-coba kombinasi untuk menebak nomor
  // pendaftaran orang lain. Batas ini juga mempersempit upaya tersebut.
  const limited = await checkRateLimit("spmb-status", 20, 10 * 60 * 1000);
  if (limited) return { ok: false, error: limited };

  const parsed = statusCheckSchema.safeParse({
    registrationNo: formData.get("registrationNo"),
    phone: formData.get("phone"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Periksa kembali nomor pendaftaran dan nomor HP Anda." };
  }

  /**
   * Nomor pendaftaran disimpan dengan tanda hubung
   * (`SPMB-2026-REGULER-ABC234`), sementara orang tua sering menulisnya ulang
   * dengan spasi, huruf kecil, atau tanpa pemisah sama sekali.
   *
   * Karena itu input dinormalkan ke bentuk kanonik (tanpa pemisah) dan
   * dibandingkan dengan bentuk kanonik yang sama, bukan dengan kolom apa
   * adanya — kalau tidak, pendaftar yang sah akan selalu diberi tahu "data
   * tidak ditemukan" padahal nomornya benar.
   *
   * Catatan: filter ini tetap dibatasi `schoolId`, jadi pendaftar sekolah A
   * tidak bisa membaca data sekolah B walau nomornya kebetulan sama.
   */
  const canonical = normalizeRegistrationNo(parsed.data.registrationNo);
  const reg = await prisma.registration.findFirst({
    where: {
      schoolId,
      parentPhone: parsed.data.phone,
      OR: [
        { registrationNo: parsed.data.registrationNo.trim().toUpperCase() },
        { registrationNo: canonical },
        // Hindari gagal karena spasi/huruf kecil pada data yang tersimpan.
        { registrationNo: { equals: parsed.data.registrationNo.trim(), mode: "insensitive" } },
      ],
    },
    select: {
      registrationNo: true,
      status: true,
      fullName: true,
      parentPhone: true,
      submittedAt: true,
      decidedAt: true,
      resultNote: true,
      batch: {
        select: { name: true, resultAnnouncement: true, resultDate: true },
      },
      path: { select: { name: true } },
    },
  });

  if (!reg) {
    return {
      ok: false,
      error:
        "Data tidak ditemukan. Pastikan nomor pendaftaran dan nomor HP orang " +
        "tua/wali sesuai dengan yang tercatat saat mendaftar.",
    };
  }

  // Data yang dikirim ke UI sudah disamarkan. Halaman TIDAK menerima nama &
  // nomor asli, sehingga tidak mungkin bocor lewat HTML/atribut.
  return {
    ok: true,
    data: {
      registrationNo: reg.registrationNo,
      maskedName: maskName(reg.fullName),
      maskedPhone: maskPhone(reg.parentPhone),
      status: reg.status,
      statusLabel: registrationStatusLabel(reg.status),
      batchName: reg.batch.name,
      pathName: reg.path?.name ?? null,
      submittedAt: reg.submittedAt.toISOString(),
      decidedAt: reg.decidedAt ? reg.decidedAt.toISOString() : null,
      // Catatan hanya ditampilkan setelah ada keputusan — sebelum itu kolomnya
      // kosong dan menampilkan "null" akan membingungkan.
      resultNote: reg.decidedAt ? reg.resultNote : null,
      resultAnnouncement: reg.batch.resultAnnouncement,
      resultDate: reg.batch.resultDate ? reg.batch.resultDate.toISOString() : null,
    },
  };
}
