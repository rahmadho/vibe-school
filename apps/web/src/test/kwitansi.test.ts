import { describe, expect, it } from "vitest";
import {
  periodeKwitansi,
  nomorKwitansi,
  nomorNota,
  nominalKeKata,
  tanggalIndonesia,
  keteranganPembayaran,
  kapitalkanAwal,
} from "@/lib/kwitansi-murni";

/**
 * ============================================================
 * KWITANSI — aturan penomoran & penyajian
 * ============================================================
 *
 * Kwitansi adalah dokumen resmi. Kesalahan di sini bukan sekadar tampilan
 * buruk: nomor yang bolong atau nominal dalam huruf yang tidak cocok dengan
 * angka membuat kwitansi tidak bisa dipakai sebagai bukti.
 */

describe("periodeKwitansi", () => {
  it("membentuk YYYYMM dengan bulan dua digit", () => {
    expect(periodeKwitansi(new Date(2026, 8, 20))).toBe("202609");
    expect(periodeKwitansi(new Date(2026, 0, 5))).toBe("202601");
    expect(periodeKwitansi(new Date(2026, 11, 31))).toBe("202612");
  });
});

describe("nomorKwitansi", () => {
  it("membentuk KWT/PERIODE/URUT dengan padding", () => {
    expect(nomorKwitansi("202609", 7)).toBe("KWT/202609/0007");
    expect(nomorKwitansi("202609", 1)).toBe("KWT/202609/0001");
  });

  it("nomor urut >9999 tidak terpotong", () => {
    // Sekolah besar bisa melewati 9999 kwitansi setahun. Nomor TIDAK boleh
    // terpotong — kwitansi bernomor sama dua kali adalah bencana pembukuan.
    expect(nomorKwitansi("202609", 12345)).toBe("KWT/202609/12345");
  });

  it("bulan berbeda menghasilkan deret nomor yang berbeda", () => {
    const sept = nomorKwitansi(periodeKwitansi(new Date(2026, 8, 1)), 1);
    const okt = nomorKwitansi(periodeKwitansi(new Date(2026, 9, 1)), 1);
    expect(sept).not.toBe(okt);
    // Keduanya mulai dari 1 lagi → urutan di-reset tiap bulan.
    expect(sept).toBe("KWT/202609/0001");
    expect(okt).toBe("KWT/202610/0001");
  });

  it("nomor nota memakai awalan berbeda agar tidak tertukar kwitansi", () => {
    expect(nomorNota("202609", 7)).toBe("NOTA/202609/0007");
    expect(nomorNota("202609", 7)).not.toBe(nomorKwitansi("202609", 7));
  });
});

describe("nominalKeKata", () => {
  it("menuliskan nominal sederhana", () => {
    expect(nominalKeKata(1000)).toBe("seribu rupiah");
    expect(nominalKeKata(100)).toBe("seratus rupiah");
    expect(nominalKeKata(0)).toBe("nol rupiah");
  });

  it("menangani belasan & puluhan dengan benar", () => {
    expect(nominalKeKata(11)).toBe("sebelas rupiah");
    expect(nominalKeKata(12)).toBe("dua belas rupiah");
    expect(nominalKeKata(20)).toBe("dua puluh rupiah");
    expect(nominalKeKata(21)).toBe("dua puluh satu rupiah");
    expect(nominalKeKata(99)).toBe("sembilan puluh sembilan rupiah");
  });

  it("menangani 'seratus' dan 'seribu' (bukan 'satu ratus')", () => {
    expect(nominalKeKata(150)).toBe("seratus lima puluh rupiah");
    expect(nominalKeKata(1500)).toBe("seribu lima ratus rupiah");
  });

  it("menuliskan nominal SPP yang realistis", () => {
    expect(nominalKeKata(1_500_000)).toBe("satu juta lima ratus ribu rupiah");
    expect(nominalKeKata(500_000)).toBe("lima ratus ribu rupiah");
    expect(nominalKeKata(250_000)).toBe("dua ratus lima puluh ribu rupiah");
    expect(nominalKeKata(75_000)).toBe("tujuh puluh lima ribu rupiah");
  });

  it("menangani miliar & triliun (uang pangkal sekolah besar)", () => {
    expect(nominalKeKata(1_000_000_000)).toBe("satu miliar rupiah");
    expect(nominalKeKata(2_500_000_000)).toBe(
      "dua miliar lima ratus juta rupiah",
    );
  });

  it("membulatkan pecahan rupiah (tidak ada sen di kwitansi sekolah)", () => {
    expect(nominalKeKata(1500.4)).toBe("seribu lima ratus rupiah");
    expect(nominalKeKata(1500.6)).toBe("seribu lima ratus satu rupiah");
  });

  it("menandai nominal negatif secara eksplisit", () => {
    // Nominal negatif menandakan salah input. Tidak boleh tampil seperti
    // nominal normal — bendahara harus langsung melihat ada yang salah.
    expect(nominalKeKata(-5000)).toBe("minus lima ribu rupiah");
  });

  it("tidak pernah mengembalikan spasi ganda", () => {
    const hasil = nominalKeKata(1_234_567);
    expect(hasil).not.toMatch(/\s{2,}/);
    expect(hasil).toBe(
      "satu juta dua ratus tiga puluh empat ribu lima ratus enam puluh tujuh rupiah",
    );
  });
});

describe("tanggalIndonesia", () => {
  it("menulis hari, bulan Indonesia, dan tahun", () => {
    expect(tanggalIndonesia(new Date(2026, 8, 20))).toBe("20 September 2026");
    expect(tanggalIndonesia(new Date(2026, 0, 1))).toBe("1 Januari 2026");
    expect(tanggalIndonesia(new Date(2026, 11, 31))).toBe("31 Desember 2026");
  });

  it("mengembalikan tanda pisah untuk tanggal kosong/tidak sah", () => {
    expect(tanggalIndonesia(null)).toBe("—");
    expect(tanggalIndonesia(undefined)).toBe("—");
    expect(tanggalIndonesia(new Date("bukan tanggal"))).toBe("—");
  });
});

describe("keteranganPembayaran", () => {
  it("membentuk keterangan yang bisa berdiri sendiri", () => {
    // Kwitansi sering dipakai di luar sekolah (klaim asuransi, penggantian
    // biaya perusahaan) → keterangannya harus bisa dipahami tanpa aplikasi.
    const k = keteranganPembayaran({
      invoiceTitle: "SPP November 2026",
      invoiceNo: "INV/202611/0012",
      studentName: "Ahmad Fauzi",
      className: "XII IPA 1",
    });
    expect(k).toContain("SPP November 2026");
    expect(k).toContain("INV/202611/0012");
    expect(k).toContain("Ahmad Fauzi");
    expect(k).toContain("XII IPA 1");
  });

  it("tetap benar tanpa kelas", () => {
    const k = keteranganPembayaran({
      invoiceTitle: "Uang pangkal",
      invoiceNo: "INV/1",
      studentName: "Siti",
      className: null,
    });
    expect(k).toContain("Siti");
    expect(k).not.toContain("()");
  });
});

describe("kapitalkanAwal", () => {
  it("hanya mengubah huruf pertama", () => {
    expect(kapitalkanAwal("seribu rupiah")).toBe("Seribu rupiah");
    expect(kapitalkanAwal("dua juta")).toBe("Dua juta");
    expect(kapitalkanAwal("")).toBe("");
  });
});
