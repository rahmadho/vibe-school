import { describe, expect, it } from "vitest";
import { manualRegistrationSchema } from "@/lib/validations/spmb-manual";
import {
  REGISTRATION_DOC_KINDS,
  isRegistrationDocKind,
} from "@/lib/validations/spmb-docs";
import { sniffPdf, sniffDocumentType } from "@/lib/storage";
import { buildInvoiceNumber } from "@/lib/finance-calc";
import { buildRegistrationNo } from "@/lib/spmb-public";

/**
 * Uji perbaikan modul SPMB.
 *
 * KENAPA TEST INI ADA:
 * Beberapa kesalahan di modul ini tidak menghasilkan galat apa pun — hanya
 * fitur yang diam-diam tidak bekerja. Notifikasi WA yang memanggil nama
 * template yang tidak ada akan gagal tanpa jejak; biaya daftar ulang yang
 * tidak disimpan akan hilang tanpa peringatan. Test adalah satu-satunya cara
 * menangkapnya.
 */

describe("manualRegistrationSchema — pendaftaran datang langsung", () => {
  const base = {
    batchId: "b1",
    pathId: "p1",
    source: "WALK_IN",
    fullName: "Andi Pratama",
    gender: "MALE",
    parentName: "Budi Pratama",
    parentPhone: "081234567890",
    parentRelation: "FATHER",
  };

  it("menerima data minimal — kolom yang tidak penting boleh kosong", () => {
    // Panitia sering hanya mencatat yang penting dulu dan melengkapi sisanya
    // setelah orang tua pulang.
    const r = manualRegistrationSchema.safeParse(base);
    expect(r.success).toBe(true);
  });

  it("mengubah nomor HP menjadi format E.164 tanpa tanda plus", () => {
    const r = manualRegistrationSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.parentPhone).toBe("6281234567890");
  });

  it("mewajibkan nomor WA orang tua", () => {
    // Nomor ini kunci untuk mengecek status dan menerima pengumuman.
    const r = manualRegistrationSchema.safeParse({ ...base, parentPhone: "" });
    expect(r.success).toBe(false);
  });

  it("menolak nomor HP yang tidak valid", () => {
    const r = manualRegistrationSchema.safeParse({ ...base, parentPhone: "123" });
    expect(r.success).toBe(false);
  });

  it("mengosongkan tanggal lahir menjadi undefined, bukan Invalid Date", () => {
    // Bug yang sama pernah terjadi di modul lain: "" diubah menjadi Date yang
    // tidak valid, lalu gagal saat disimpan ke database.
    const r = manualRegistrationSchema.safeParse({ ...base, birthDate: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.birthDate).toBeUndefined();
  });

  it("mengubah tanggal lahir menjadi Date saat diisi", () => {
    const r = manualRegistrationSchema.safeParse({ ...base, birthDate: "2013-05-17" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.birthDate).toBeInstanceOf(Date);
  });

  it("menolak sumber pendaftaran yang tidak dikenal", () => {
    const r = manualRegistrationSchema.safeParse({ ...base, source: "PUBLIC" });
    // PUBLIC bukan pilihan di form manual — pendaftaran publik punya jalurnya
    // sendiri. Kalau diterima, panitia bisa menandai pendaftar walk-in sebagai
    // pendaftar online dan laporan jadi salah.
    expect(r.success).toBe(false);
  });

  it("menerima pendaftaran lewat telepon", () => {
    const r = manualRegistrationSchema.safeParse({ ...base, source: "PHONE" });
    expect(r.success).toBe(true);
  });

  it("menafsirkan checkbox 'on' sebagai true", () => {
    const r = manualRegistrationSchema.safeParse({
      ...base,
      markVerified: "on",
      notify: "on",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.markVerified).toBe(true);
      expect(r.data.notify).toBe(true);
    }
  });

  it("default: tidak menandai verified dan tidak mengirim notifikasi", () => {
    const r = manualRegistrationSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.markVerified).toBe(false);
      expect(r.data.notify).toBe(false);
    }
  });

  it("mengizinkan nomor pendaftaran diisi panitia", () => {
    const r = manualRegistrationSchema.safeParse({ ...base, registrationNo: "SPMB-2026-REGULER-AAAAAA" });
    expect(r.success).toBe(true);
  });
});

describe("jenis dokumen pendaftaran", () => {
  it("mengenali keempat jenis dokumen", () => {
    for (const k of REGISTRATION_DOC_KINDS) {
      expect(isRegistrationDocKind(k)).toBe(true);
    }
  });

  it("menolak nama kolom yang tidak dikenal", () => {
    expect(isRegistrationDocKind("docKtp")).toBe(false);
    expect(isRegistrationDocKind("")).toBe(false);
    expect(isRegistrationDocKind("__proto__")).toBe(false);
  });
});

describe("sniffPdf", () => {
  it("mengenali berkas PDF dari byte awalnya", () => {
    const buf = Buffer.from("%PDF-1.7\n...", "ascii");
    expect(sniffPdf(buf)).toEqual({ ext: "pdf", contentType: "application/pdf" });
  });

  it("menolak berkas yang bukan PDF", () => {
    expect(sniffPdf(Buffer.from("bukan pdf", "ascii"))).toBeNull();
    expect(sniffPdf(Buffer.alloc(3))).toBeNull();
  });
});

describe("sniffDocumentType", () => {
  it("menerima PDF", () => {
    expect(sniffDocumentType(Buffer.from("%PDF-1.4", "ascii"))?.ext).toBe("pdf");
  });

  it("menerima PNG", () => {
    const png = Buffer.alloc(24);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(png, 0);
    expect(sniffDocumentType(png)?.ext).toBe("png");
  });

  it("menolak berkas yang bukan PDF maupun gambar", () => {
    // Dokumen pendaftaran tidak boleh menerima jenis berkas sembarang — isinya
    // ditampilkan kembali ke panitia lewat tautan.
    expect(sniffDocumentType(Buffer.from("<html><script>alert(1)</script>", "ascii"))).toBeNull();
    expect(sniffDocumentType(Buffer.from("PK\x03\x04", "ascii"))).toBeNull();
  });
});

describe("buildInvoiceNumber", () => {
  it("menyusun nomor tagihan dari tahun, bulan, dan urutan", () => {
    const no = buildInvoiceNumber("INV", new Date("2026-07-15"), 7);
    expect(no).toBe("INV/202607/0007");
  });

  it("memberi urutan berbeda untuk tagihan berbeda", () => {
    const a = buildInvoiceNumber("INV", new Date("2026-07-15"), 1);
    const b = buildInvoiceNumber("INV", new Date("2026-07-15"), 2);
    expect(a).not.toBe(b);
  });
});

describe("buildRegistrationNo", () => {
  it("memuat tahun, kode jalur, dan akhiran acak", () => {
    const no = buildRegistrationNo({
      year: 2026,
      pathCode: "REGULER",
      // Fungsi acak disuntik agar hasilnya dapat diprediksi dalam test.
      randomFn: () => 0,
    });
    expect(no).toMatch(/^SPMB-2026-REGULER-[A-Z0-9]{6}$/);
  });

  it("tidak memakai huruf yang mudah tertukar saat didikte lewat telepon", () => {
    // Nomor ini sering disebut lewat telepon; 0/O dan 1/I/L membingungkan.
    for (let i = 0; i < 50; i += 1) {
      const no = buildRegistrationNo({ year: 2026, pathCode: "X" });
      const suffix = no.split("-").pop() ?? "";
      expect(suffix).not.toMatch(/[01OIL]/);
    }
  });
});
