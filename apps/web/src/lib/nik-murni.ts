/**
 * ============================================================
 * VALIDASI NIK & KODE WILAYAH — MURNI (tanpa DB)
 * ============================================================
 *
 * MENGAPA NIK DIVALIDASI LEBIH DARI "16 DIGIT":
 *
 * NIK Indonesia BUKAN angka acak — ia menyandikan data:
 *
 *   1-6   : kode wilayah kecamatan (6 digit, sesuai kode BPS)
 *   7-12  : tanggal lahir DDMMYY
 *           → perempuan: tanggal + 40 (mis. lahir tgl 7 → "47")
 *   13-16 : nomor urut penerbitan
 *
 * Artinya NIK yang salah ketik bisa DIDETEKSI. Kalau kita hanya memeriksa
 * "16 digit", NIK seperti 0000000000000000 atau 9999999999999999 lolos —
 * lalu baru ketahuan berbulan-bulan kemudian saat sinkronisasi Dapodik
 * ditolak, ketika operator sudah tidak ingat NIK mana yang salah.
 *
 * Validasi di sini murah dan menangkap kesalahan ketik saat operator masih
 * ingat. Ia TIDAK memverifikasi NIK benar-benar terdaftar di Dukcapil —
 * itu butuh koneksi ke layanan Dukcapil yang tidak kita miliki.
 */

export type HasilNIK =
  | {
      valid: true;
      /** Tanggal lahir yang tersandi di NIK — bisa dipakai mengecek tgl lahir siswa. */
      tanggalLahir: { day: number; month: number; year: number };
      jenisKelamin: "MALE" | "FEMALE";
      kodeWilayah: string;
    }
  | { valid: false; alasan: string };

/** Buang spasi, titik, dan tanda hubung — operator sering menyalin dari KK. */
export function bersihkanAngka(nilai: string): string {
  return nilai.replace(/[\s.\-]/g, "");
}

/**
 * Periksa NIK.
 *
 * Mengembalikan `valid: false` + ALASAN yang bisa ditampilkan ke operator.
 * Alasannya sengaja spesifik ("tanggal lahir tidak sah"), bukan "NIK tidak
 * valid" — operator perlu tahu bagian mana yang salah.
 */
export function periksaNIK(nilai: string | null | undefined): HasilNIK {
  if (!nilai) return { valid: false, alasan: "NIK belum diisi." };

  const angka = bersihkanAngka(nilai);

  if (!/^\d+$/.test(angka)) {
    return { valid: false, alasan: "NIK hanya boleh berisi angka." };
  }
  if (angka.length !== 16) {
    return {
      valid: false,
      alasan: `NIK harus 16 digit, saat ini ${angka.length} digit.`,
    };
  }

  const kodeWilayah = angka.slice(0, 6);
  // Kode wilayah 000000 tidak ada di Indonesia — ini penanda NIK karangan.
  if (kodeWilayah === "000000") {
    return { valid: false, alasan: "Kode wilayah NIK tidak sah (000000)." };
  }

  const dd = Number(angka.slice(6, 8));
  const mm = Number(angka.slice(8, 10));
  const yy = Number(angka.slice(10, 12));

  // Perempuan: tanggal lahir = dd - 40.
  const perempuan = dd > 40;
  const hari = perempuan ? dd - 40 : dd;

  if (hari < 1 || hari > 31) {
    return { valid: false, alasan: "Tanggal lahir di NIK tidak sah." };
  }
  if (mm < 1 || mm > 12) {
    return { valid: false, alasan: "Bulan lahir di NIK tidak sah." };
  }

  // Tahun 2 digit: 00-99. Ambang 30 dipakai agar NIK siswa (dan orang tua di
  // sekolah) masuk akal. TIDAK diasumsikan semua 19xx/20xx.
  const tahun = yy <= 30 ? 2000 + yy : 1900 + yy;

  // Jumlah hari per bulan (termasuk kabisat) — menangkap 31 Februari.
  const hariPerBulan = [
    31,
    (tahun % 4 === 0 && tahun % 100 !== 0) || tahun % 400 === 0 ? 29 : 28,
    31, 30, 31, 30, 31, 31, 30, 31, 30, 31,
  ];
  if (hari > hariPerBulan[mm - 1]) {
    return {
      valid: false,
      alasan: `Tanggal ${hari} bulan ${mm} tidak ada di tahun ${tahun}.`,
    };
  }

  return {
    valid: true,
    tanggalLahir: { day: hari, month: mm, year: tahun },
    jenisKelamin: perempuan ? "FEMALE" : "MALE",
    kodeWilayah,
  };
}

/**
 * Bandingkan NIK dengan tanggal lahir & jenis kelamin siswa.
 *
 * Ini pemeriksaan yang paling berguna: menangkap NIK yang tertukar antar
 * siswa atau salah ketik tanggal. Mengembalikan `null` bila tidak ada
 * ketidakcocokan (atau datanya belum lengkap).
 */
export function nikTidakCocokDenganSiswa(
  nik: string | null | undefined,
  tanggalLahir: Date | null | undefined,
  jenisKelamin: string | null | undefined,
): string | null {
  if (!nik || !tanggalLahir) return null;

  const hasil = periksaNIK(nik);
  if (!hasil.valid) return null; // Masalah NIK sudah dilaporkan periksaNIK.

  const { day, month, year } = hasil.tanggalLahir;
  if (
    tanggalLahir.getDate() !== day ||
    tanggalLahir.getMonth() + 1 !== month ||
    tanggalLahir.getFullYear() !== year
  ) {
    return (
      "Tanggal lahir di NIK tidak sama dengan tanggal lahir siswa " +
      `(${day}/${month}/${year} vs ${tanggalLahir.getDate()}/${
        tanggalLahir.getMonth() + 1
      }/${tanggalLahir.getFullYear()}).`
    );
  }

  if (jenisKelamin && hasil.jenisKelamin !== jenisKelamin) {
    return (
      "Jenis kelamin di NIK tidak sama dengan jenis kelamin siswa " +
      `(${hasil.jenisKelamin === "FEMALE" ? "perempuan" : "laki-laki"}).`
    );
  }

  return null;
}

/** Periksa nomor Kartu Keluarga: 16 digit angka, tidak disandikan. */
export function periksaKartuKeluarga(
  nilai: string | null | undefined,
): { valid: boolean; alasan?: string } {
  if (!nilai) return { valid: true }; // opsional
  const angka = bersihkanAngka(nilai);
  if (!/^\d{16}$/.test(angka)) {
    return {
      valid: false,
      alasan: `Nomor KK harus 16 digit, saat ini ${angka.length} digit.`,
    };
  }
  return { valid: true };
}

/**
 * Periksa kode wilayah desa (10 digit BPS/Kemendagri).
 *
 * Dipakai sekolah yang punya daftar kode wilayah. Tidak diwajibkan — banyak
 * operator belum hafal kodenya.
 */
export function periksaKodeWilayah(
  nilai: string | null | undefined,
): { valid: boolean; alasan?: string } {
  if (!nilai) return { valid: true };
  const angka = bersihkanAngka(nilai);
  if (!/^\d{10}$/.test(angka)) {
    return {
      valid: false,
      alasan: `Kode wilayah harus 10 digit, saat ini ${angka.length} digit.`,
    };
  }
  return { valid: true };
}
