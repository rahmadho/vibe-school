"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { requestMeta } from "@/lib/action-guard";
import { hashPassword } from "@/lib/password-hash";
import { verifyPassword } from "@/lib/password-hash";
import { periksaKekuatanPassword } from "@/lib/akun-siswa-murni";
import type { ActionResult } from "@/lib/action-result";

/**
 * ============================================================
 * GANTI PASSWORD WAJIB
 * ============================================================
 *
 * Akun siswa/wali dibuat massal dengan password awal = tanggal lahir. Nilai
 * itu bisa ditebak siapa pun yang tahu tanggal lahir anak — dan untuk anak
 * sekelas, tanggal lahir bukan rahasia.
 *
 * Karena itu akun ditandai `mustChangePassword` dan pengguna TIDAK bisa
 * memakai aplikasi sebelum menggantinya (dijaga di layout dashboard & portal).
 */

export async function gantiPasswordWajib(
  formData: FormData,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "Sesi tidak ditemukan. Silakan masuk lagi." };
  }

  const passwordLama = String(formData.get("passwordLama") ?? "");
  const passwordBaru = String(formData.get("passwordBaru") ?? "");
  const ulangi = String(formData.get("ulangi") ?? "");

  if (!passwordLama || !passwordBaru) {
    return { ok: false, error: "Semua kolom wajib diisi." };
  }
  if (passwordBaru !== ulangi) {
    return { ok: false, error: "Password baru dan ulangannya tidak sama." };
  }
  if (passwordBaru === passwordLama) {
    return { ok: false, error: "Password baru harus berbeda dari yang lama." };
  }

  const kekuatan = periksaKekuatanPassword(passwordBaru);
  if (!kekuatan.ok) {
    return { ok: false, error: kekuatan.alasan ?? "Password terlalu lemah." };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, passwordHash: true, schoolId: true, role: true },
  });
  if (!user) return { ok: false, error: "Akun tidak ditemukan." };

  // Verifikasi password lama: mencegah orang yang menemukan HP dalam keadaan
  // sudah login mengganti password lalu mengunci pemilik aslinya.
  const cocok = await verifyPassword(passwordLama, user.passwordHash);
  if (!cocok) return { ok: false, error: "Password saat ini salah." };

  const meta = await requestMeta();

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(passwordBaru),
      mustChangePassword: false,
    },
  });

  await recordAudit({
    schoolId: user.schoolId,
    userId: user.id,
    action: "UPDATE",
    entity: "User",
    entityId: user.id,
    after: { perubahan: "password", wajibGanti: false },
    ...meta,
  });

  // Sesi lama masih membawa mustChangePassword=true di token; paksa login
  // ulang supaya token baru dibuat. Tanpa ini pengguna akan terus dipantulkan
  // ke halaman ganti password walaupun sudah menggantinya.
  redirect("/login?pesan=password-diganti");
}
