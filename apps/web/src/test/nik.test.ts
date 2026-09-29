import { describe, expect, it } from "vitest";
import {
  bersihkanAngka,
  nikTidakCocokDenganSiswa,
  periksaKartuKeluarga,
  periksaKodeWilayah,
  periksaNIK,
} from "@/lib/nik-murni";

/**
 * ============================================================
 * VALIDASI NIK
 * ============================================================
 *
 * NIK menyandikan wilayah + tanggal lahir + jenis kelamin. Test ini mengunci
 * pembacaannya supaya NIK yang salah ketik tertangkap saat operator masih
 * ingat — bukan berbulan-bulan kemudian saat Dapodik menolaknya.
 */

/**
 * Bangun NIK dari komponennya, supaya maksud test jelas.
 * @param wilayah 6 digit kode kecamatan
 * @param hari  tanggal (1-31)
 * @param bulan 1-12
 * @param yy    2 digit tahun
 * @param urut  4 digit nomor urut
 * @param perempuan true → tanggal + 40
 */
function nik(
  wilayah: string,
  hari: number,
  bulan: number,
  yy: number,
  urut: string,
  perempuan = false,
): string {
  const dd = perempuan ? hari + 40 : hari;
  return `${wilayah}${String(dd).padStart(2, "0")}${String(bulan).padStart(2, "0")}${String(yy).padStart(2, "0")}${urut}`;
}

describe("bersihkanAngka", () => {
  it("membuang spasi, titik, dan tanda hubung", () => {
    // Operator sering menyalin dari KK dengan format berpemisah.
    expect(bersihkanAngka("1371 0201 1234 5678")).toBe("1371020112345678");
    expect(bersihkanAngka("1371.0201.1234.5678")).toBe("1371020112345678");
    expect(bersihkanAngka("1371-0201-1234-5678")).toBe("1371020112345678");
  });
});

describe("periksaNIK — menolak", () => {
  it("menolak NIK kosong", () => {
    expect(periksaNIK(null).valid).toBe(false);
    expect(periksaNIK("").valid).toBe(false);
  });

  it("menolak yang memuat huruf", () => {
    const h = periksaNIK("137102011234ABCD");
    expect(h.valid).toBe(false);
    if (!h.valid) expect(h.alasan).toMatch(/angka/i);
  });

  it("menolak panjang selain 16 digit dan MENYEBUT panjang aslinya", () => {
    // Operator perlu tahu berapa digit yang ia masukkan, bukan hanya "salah".
    const h = periksaNIK("137102011234");
    expect(h.valid).toBe(false);
    if (!h.valid) expect(h.alasan).toContain("12");
  });

  it("menolak kode wilayah 000000 (NIK karangan)", () => {
    const h = periksaNIK("000000" + "010190" + "0001");
    expect(h.valid).toBe(false);
    if (!h.valid) expect(h.alasan).toMatch(/wilayah/i);
  });

  it("menolak bulan di luar 1-12", () => {
    // bulan 13 → tidak ada
    expect(periksaNIK(nik("137102", 1, 13, 90, "0001")).valid).toBe(false);
    expect(periksaNIK(nik("137102", 1, 0, 90, "0001")).valid).toBe(false);
  });

  it("menolak tanggal di luar jumlah hari bulan itu", () => {
    // 31 Februari tidak ada — kesalahan ketik yang paling sering.
    const h = periksaNIK(nik("137102", 31, 2, 90, "0001"));
    expect(h.valid).toBe(false);
    if (!h.valid) expect(h.alasan).toMatch(/tidak ada|tidak sah/i);
  });

  it("menolak 30 Februari dan 31 April (bulan berhari 30)", () => {
    expect(periksaNIK(nik("137102", 30, 2, 90, "0001")).valid).toBe(false);
    expect(periksaNIK(nik("137102", 31, 4, 90, "0001")).valid).toBe(false);
  });

  it("menolak tanggal 00", () => {
    expect(periksaNIK(nik("137102", 0, 1, 90, "0001")).valid).toBe(false);
  });

  it("menolak semua angka 9 (isi asal-asalan)", () => {
    // 99-99-99 → kode wilayah 999999, bulan 99, dst.
    expect(periksaNIK("9999999999999999").valid).toBe(false);
  });
});

describe("periksaNIK — menerima & membaca isinya", () => {
  it("menerima NIK laki-laki & membaca tanggal lahirnya", () => {
    // Wilayah 1371 (Padang), lahir 7 Maret 2012, urut 0001.
    const h = periksaNIK(nik("137102", 7, 3, 12, "0001"));
    expect(h.valid).toBe(true);
    if (h.valid) {
      expect(h.tanggalLahir).toEqual({ day: 7, month: 3, year: 2012 });
      expect(h.jenisKelamin).toBe("MALE");
      expect(h.kodeWilayah).toBe("137102");
    }
  });

  it("membaca NIK PEREMPUAN (tanggal + 40)", () => {
    // Lahir tgl 7 → NIK memakai "47".
    const h = periksaNIK(nik("137102", 7, 3, 12, "0001", true));
    expect(h.valid).toBe(true);
    if (h.valid) {
      expect(h.tanggalLahir).toEqual({ day: 7, month: 3, year: 2012 });
      expect(h.jenisKelamin).toBe("FEMALE");
    }
  });

  it("tahun 00-30 dibaca sebagai 2000-an, 31-99 sebagai 1900-an", () => {
    const muda = periksaNIK(nik("137102", 1, 1, 30, "0001"));
    expect(muda.valid && muda.tanggalLahir.year).toBe(2030);

    const tua = periksaNIK(nik("137102", 1, 1, 31, "0001"));
    expect(tua.valid && tua.tanggalLahir.year).toBe(1931);

    const ortu = periksaNIK(nik("137102", 1, 1, 85, "0001"));
    expect(ortu.valid && ortu.tanggalLahir.year).toBe(1985);
  });

  it("menerima 29 Februari pada tahun kabisat, menolak pada tahun biasa", () => {
    // 2012 kabisat, 2013 bukan.
    expect(periksaNIK(nik("137102", 29, 2, 12, "0001")).valid).toBe(true);
    expect(periksaNIK(nik("137102", 29, 2, 13, "0001")).valid).toBe(false);
  });

  it("menerima NIK dengan format berpemisah", () => {
    expect(periksaNIK("1371 0207 0312 0001").valid).toBe(true);
  });
});

describe("nikTidakCocokDenganSiswa", () => {
  const nikFauzi = nik("137102", 7, 3, 12, "0001"); // laki-laki, 7 Mar 2012

  it("tidak melaporkan masalah bila cocok", () => {
    expect(
      nikTidakCocokDenganSiswa(nikFauzi, new Date(2012, 2, 7), "MALE"),
    ).toBeNull();
  });

  it("menangkap NIK yang tertukar (tanggal lahir berbeda)", () => {
    // Ini kesalahan paling berbahaya: NIK milik siswa lain.
    const pesan = nikTidakCocokDenganSiswa(
      nikFauzi,
      new Date(2012, 2, 20),
      "MALE",
    );
    expect(pesan).toBeTruthy();
    expect(pesan).toMatch(/tanggal lahir/i);
  });

  it("menangkap jenis kelamin yang tidak cocok", () => {
    const pesan = nikTidakCocokDenganSiswa(
      nikFauzi,
      new Date(2012, 2, 7),
      "FEMALE",
    );
    expect(pesan).toBeTruthy();
    expect(pesan).toMatch(/jenis kelamin/i);
  });

  it("diam saja bila data belum lengkap (jangan menghalangi input)", () => {
    expect(nikTidakCocokDenganSiswa(null, new Date(), "MALE")).toBeNull();
    expect(nikTidakCocokDenganSiswa(nikFauzi, null, "MALE")).toBeNull();
    expect(nikTidakCocokDenganSiswa(nikFauzi, new Date(2012, 2, 7), null)).toBeNull();
  });

  it("tidak mengulang keluhan NIK yang sudah ditolak periksaNIK", () => {
    // NIK cacat cukup dilaporkan sekali, jangan dua kali.
    expect(nikTidakCocokDenganSiswa("123", new Date(), "MALE")).toBeNull();
  });
});

describe("periksaKartuKeluarga", () => {
  it("opsional — kosong dianggap sah", () => {
    expect(periksaKartuKeluarga(null).valid).toBe(true);
    expect(periksaKartuKeluarga("").valid).toBe(true);
  });

  it("menuntut 16 digit", () => {
    expect(periksaKartuKeluarga("1371020112345678").valid).toBe(true);
    expect(periksaKartuKeluarga("137102011234").valid).toBe(false);
  });
});

describe("periksaKodeWilayah", () => {
  it("opsional — kosong dianggap sah", () => {
    expect(periksaKodeWilayah(null).valid).toBe(true);
  });

  it("menuntut 10 digit (kode desa BPS)", () => {
    expect(periksaKodeWilayah("1371020001").valid).toBe(true);
    expect(periksaKodeWilayah("137102").valid).toBe(false);
  });
});
