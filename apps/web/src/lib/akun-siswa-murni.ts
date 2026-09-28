/**
 * ============================================================
 * PEMBUATAN AKUN SISWA — bagian MURNI (tanpa DB)
 * ============================================================
 *
 * Dipisahkan agar aturan password awal bisa diuji tanpa database.
 */

/**
 * Ubah tanggal lahir menjadi password awal: DDMMYYYY.
 *
 * Contoh: 2012-03-07 → "07032012"
 *
 * Mengembalikan null bila tanggal tidak ada / tidak masuk akal — pemanggil
 * yang memutuskan fallback-nya (di akun-siswa.ts jatuh ke NIS). Sengaja TIDAK
 * mengembalikan string kosong: password kosong = akun tanpa kunci.
 */
export function tanggalLahirKePassword(tanggal: Date | null | undefined): string | null {
  if (!tanggal) return null;
  if (!(tanggal instanceof Date) || Number.isNaN(tanggal.getTime())) return null;

  const tahun = tanggal.getFullYear();
  // Batas kewajaran: sekolah berisi manusia, bukan data uji.
  if (tahun < 1900 || tahun > 2100) return null;

  const dd = String(tanggal.getDate()).padStart(2, "0");
  const mm = String(tanggal.getMonth() + 1).padStart(2, "0");
  return `${dd}${mm}${tahun}`;
}

/**
 * Usulan email akun siswa.
 *
 * Harus unik GLOBAL karena `User.email` unik global (dipakai NextAuth).
 * NIS saja tidak cukup — NIS bisa sama di dua sekolah — jadi slug sekolah
 * ikut disertakan.
 */
export function usulanEmailSiswa(nis: string, slugSekolah: string): string {
  const bersih = (nis ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return `siswa.${bersih}@${slugSekolah}.sch.id`;
}

/**
 * Apakah password baru layak dipakai siswa/wali?
 *
 * Aturan minimum sengaja lebih ketat dari "8 karakter": akun ini dipakai
 * anak-anak dan orang tua yang mungkin memakai password yang sama di tempat
 * lain. Menolak yang terlalu lemah lebih berguna daripada membiarkannya.
 */
export function periksaKekuatanPassword(password: string): {
  ok: boolean;
  alasan?: string;
} {
  if (typeof password !== "string") return { ok: false, alasan: "Password tidak valid." };
  if (password.length < 8) return { ok: false, alasan: "Password minimal 8 karakter." };
  if (password.length > 128) return { ok: false, alasan: "Password terlalu panjang." };

  // Tolak 8 angka LEBIH DULU sebelum cek huruf/angka: password awal akun ini
  // memang berbentuk tanggal lahir (DDMMYYYY). Kalau cek "harus ada huruf"
  // berjalan lebih dulu, pengguna yang mengetik tanggal lahirnya akan diberi
  // tahu "tambahkan huruf" — pesan yang menyesatkan, karena masalah
  // sebenarnya adalah ia memakai password awal lagi.
  if (/^\d{8}$/.test(password)) {
    return {
      ok: false,
      alasan: "Password tidak boleh hanya berupa tanggal (8 angka).",
    };
  }

  const adaHuruf = /[A-Za-z]/.test(password);
  const adaAngka = /[0-9]/.test(password);
  if (!adaHuruf || !adaAngka) {
    return { ok: false, alasan: "Password harus memuat huruf dan angka." };
  }

  // Daftar pendek password yang sangat lazim ditebak.
  const lazim = ["password", "12345678", "qwertyui", "siswa123", "sekolah123"];
  if (lazim.includes(password.toLowerCase())) {
    return { ok: false, alasan: "Password terlalu umum. Pilih yang lain." };
  }

  return { ok: true };
}
