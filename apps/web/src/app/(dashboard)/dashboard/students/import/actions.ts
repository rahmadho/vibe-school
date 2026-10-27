"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { can } from "@/lib/rbac";
import {
  parseStudentWorkbook,
  type ParseResult,
} from "@/lib/import/students";
import { buatAkunSiswa } from "@/lib/akun-siswa";
import { cekKuotaSiswa } from "@/lib/entitlement";
import { ambilSlugSekolah } from "@/lib/sekolah-helper";

/**
 * Import siswa tahap 2: setelah PREVIEW (parse di client/server), admin
 * menekan "Import" dan baris valid disimpan.
 *
 * Baris tidak valid dilewati (tidak menggagalkan seluruh batch) dan
 * dilaporkan kembali.
 */

export type ImportCommitResult = {
  ok: boolean;
  imported: number;
  skipped: number;
  errors: string[];
  message?: string;
};

export async function previewImport(
  fileBuffer: ArrayBuffer,
): Promise<ParseResult> {
  return parseStudentWorkbook(fileBuffer);
}

export async function commitImport(
  fileBuffer: ArrayBuffer,
): Promise<ImportCommitResult> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, imported: 0, skipped: 0, errors: [], message: "Sesi berakhir." };
  }
  if (!session.user.schoolId) {
    return { ok: false, imported: 0, skipped: 0, errors: [], message: "Akun tidak terhubung ke sekolah." };
  }
  if (!can(session.user.role, "students", "create", session.user.permissions)) {
    return { ok: false, imported: 0, skipped: 0, errors: [], message: "Tidak punya izin." };
  }

  const schoolId = session.user.schoolId;
  // Slug dipakai membentuk email akun siswa; diambil sekali di luar loop.
  const slugSekolah = await ambilSlugSekolah(schoolId);
  const parsed = parseStudentWorkbook(fileBuffer);

  if (parsed.headerErrors.length) {
    return {
      ok: false,
      imported: 0,
      skipped: 0,
      errors: parsed.headerErrors,
      message: "Header file tidak sesuai template.",
    };
  }

  const h = await headers();
  const meta = {
    ipAddress: h.get("x-forwarded-for") ?? null,
    userAgent: h.get("user-agent") ?? null,
  };

  // KUOTA dihitung untuk SELURUH baris valid sekaligus, bukan per baris.
  // Kalau diperiksa satu per satu, impor 500 siswa akan lolos di kuota 200:
  // pemeriksaan per baris melihat "masih ada 1 tempat kosong" sampai baris
  // terakhir, lalu sisanya tetap masuk. Baris yang NIS-nya sudah ada tidak
  // dihitung karena akan dilewati.
  const calonBaru = parsed.rows.filter(
    (r) => r.ok && r.data && !existingNis.has(r.data.nis),
  );
  if (calonBaru.length > 0) {
    const kuota = await cekKuotaSiswa(schoolId, calonBaru.length);
    if (!kuota.boleh) {
      return {
        ok: false,
        imported: 0,
        skipped: parsed.invalidCount,
        errors: [],
        message: kuota.pesan ?? "Kuota siswa tidak mencukupi untuk impor ini.",
      };
    }
  }

  let imported = 0;
  let skipped = parsed.invalidCount;
  const errors: string[] = parsed.rows
    .filter((r) => !r.ok)
    .map((r) => `Baris ${r.rowNumber}: ${r.errors?.join("; ")}`);

  // NIS yang sudah ada di sekolah ini → dilewati.
  const existing = await prisma.student.findMany({
    where: { schoolId },
    select: { nis: true },
  });
  const existingNis = new Set(existing.map((s) => s.nis));

  for (const row of parsed.rows) {
    if (!row.ok || !row.data) continue;
    const d = row.data;

    if (existingNis.has(d.nis)) {
      skipped += 1;
      errors.push(`Baris ${row.rowNumber}: NIS ${d.nis} sudah ada, dilewati.`);
      continue;
    }

    try {
      // Siswa + akun login dibuat dalam satu transaksi — supaya tidak ada
      // akun yatim bila pembuatan siswa gagal di tengah impor.
      const hasil = await prisma.$transaction(async (tx) => {
        const siswa = await tx.student.create({
          data: {
            schoolId,
            nis: d.nis,
            nisn: d.nisn ?? null,
            fullName: d.fullName,
            gender: d.gender,
            birthPlace: d.birthPlace ?? null,
            birthDate: d.birthDate ?? null,
            religion: d.religion ?? null,
            address: d.address ?? null,
            phone: d.phone ?? null,
            entryYear: d.entryYear,
            classId: d.classId ?? null,
            status: d.status,
            ...(d.parentName
              ? {
                  parents: {
                    create: {
                      fullName: d.parentName,
                      relation: d.parentRelation ?? "GUARDIAN",
                      phone: d.parentPhone ?? "",
                      isPrimary: true,
                    },
                  },
                }
              : {}),
          },
          select: { id: true, nis: true, fullName: true, birthDate: true },
        });

        // Akun login: username = NIS, password awal = tanggal lahir,
        // wajib ganti saat pertama masuk.
        const akun = await buatAkunSiswa(tx, {
          studentId: siswa.id,
          schoolId,
          nis: siswa.nis,
          nama: siswa.fullName,
          tanggalLahir: siswa.birthDate,
          slugSekolah,
        });

        return { siswa, akun };
      });

      existingNis.add(d.nis);
      imported += 1;

      // Akun yang gagal dibuat TIDAK membatalkan impor, tetapi dicatat supaya
      // operator bisa menindaklanjuti (mis. NIS ganda di berkas Excel).
      if (hasil.akun.status === "gagal") {
        errors.push(
          `Baris ${row.rowNumber}: siswa masuk, akun login gagal — ${hasil.akun.alasan}`,
        );
      }
    } catch {
      skipped += 1;
      errors.push(`Baris ${row.rowNumber}: gagal disimpan.`);
    }
  }

  await recordAudit({
    schoolId,
    userId: session.user.id,
    action: "IMPORT",
    entity: "Student",
    after: { imported, skipped },
    ...meta,
  });

  revalidatePath("/dashboard/students");

  return {
    ok: true,
    imported,
    skipped,
    errors: errors.slice(0, 50), // batasi payload pesan
    message: `${imported} siswa diimpor, ${skipped} dilewati.`,
  };
}
