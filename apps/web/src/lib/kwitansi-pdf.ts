import "server-only";
import PDFDocument from "pdfkit";
import {
  kapitalkanAwal,
  keteranganPembayaran,
  nominalKeKata,
  tanggalIndonesia,
} from "@/lib/kwitansi-murni";

/**
 * ============================================================
 * PEMBUAT PDF KWITANSI & NOTA
 * ============================================================
 *
 * MENGAPA `pdfkit`, BUKAN Puppeteer/Chromium:
 *   - Image produksi (apps/web/Dockerfile) memakai `node:24-slim` TANPA
 *     Chromium. Menambahkannya berarti +300–400 MB per container plus
 *     belasan pustaka sistem — dan bila satu saja gagal terpasang, SELURUH
 *     build ikut rusak.
 *   - Kwitansi hanya butuh teks, garis, dan tabel. Chromium berlebihan.
 *   - `pdfkit` menghasilkan PDF TEKS ASLI (bisa dicari & disalin), bukan
 *     gambar hasil tangkapan layar.
 *
 * Format berkas: A5 lanskap untuk kwitansi (ukuran lazim kwitansi sekolah,
 * hemat kertas) dan A5 tegak untuk nota.
 */

const RUPIAH = (n: number) =>
  "Rp " + new Intl.NumberFormat("id-ID").format(Math.round(n));

/** Data yang dibutuhkan untuk menggambar kop surat. */
export type KopSekolah = {
  name: string;
  npsn?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  logoUrl?: string | null;
};

export type DataKwitansi = {
  sekolah: KopSekolah;
  receiptNo: string;
  tanggal: Date;
  // Pihak yang menerima uang
  namaSiswa: string;
  nisSiswa: string;
  kelasSiswa?: string | null;
  // Isi
  jumlah: number;
  // Pihak yang menyerahkan uang (orang tua/wali)
  dariNama?: string | null;
  keterangan: string;
  metode?: string | null;
  referensi?: string | null;
  // Tanda tangan
  penandatangan?: { nama: string; jabatan: string; nip?: string | null } | null;
  // Pembatalan
  cancelledAt?: Date | null;
  cancelReason?: string | null;
};

export type DataNota = {
  sekolah: KopSekolah;
  notaNo: string;
  tanggal: Date;
  namaSiswa: string;
  nisSiswa: string;
  kelasSiswa?: string | null;
  baris: { deskripsi: string; jumlah: number }[];
  total: number;
  dibayar: number;
  sisa: number;
  metode?: string | null;
  penandatangan?: { nama: string; jabatan: string; nip?: string | null } | null;
  cancelledAt?: Date | null;
  cancelReason?: string | null;
};

/* ============================================================
 * KOP SURAT
 * ============================================================ */

function gambarKop(
  doc: PDFKit.PDFDocument,
  sekolah: KopSekolah,
  lebar: number,
  margin: number,
) {
  const atas = margin;
  let x = margin;

  // Logo (bila ada). URL gambar lokal (/uploads/...) tidak bisa langsung
  // dibaca PDFKit di runtime server, jadi hanya digambar bila berupa data URL
  // atau berkas yang memang bisa diakses proses Node. Kekurangan logo TIDAK
  // boleh menggagalkan pencetakan kwitansi — kop tanpa logo tetap sah.
  if (sekolah.logoUrl && sekolah.logoUrl.startsWith("data:image/")) {
    try {
      const base64 = sekolah.logoUrl.split(",")[1];
      if (base64) {
        doc.image(Buffer.from(base64, "base64"), x, atas, { fit: [56, 56] });
      }
    } catch {
      /* lewati logo yang tidak bisa dibaca */
    }
  }

  // Nama sekolah — bagian terpenting kop.
  doc
    .font("Helvetica-Bold")
    .fontSize(15)
    .fillColor("#111827")
    .text(sekolah.name.toUpperCase(), x, atas, {
      align: "center",
      width: lebar - 2 * margin,
    });

  doc.moveDown(0.15);
  doc.font("Helvetica").fontSize(8).fillColor("#374151");

  const barisAlamat: string[] = [];
  if (sekolah.address) barisAlamat.push(sekolah.address);
  const kontak: string[] = [];
  if (sekolah.phone) kontak.push(`Telp. ${sekolah.phone}`);
  if (sekolah.email) kontak.push(sekolah.email);
  if (kontak.length) barisAlamat.push(kontak.join(" · "));
  if (sekolah.npsn) barisAlamat.push(`NPSN: ${sekolah.npsn}`);

  if (barisAlamat.length) {
    doc.text(barisAlamat.join("\n"), x, doc.y, {
      align: "center",
      width: lebar - 2 * margin,
      lineGap: 1,
    });
  }

  // Garis pemisah kop.
  const y = doc.y + 6;
  doc
    .moveTo(margin, y)
    .lineTo(lebar - margin, y)
    .lineWidth(1.2)
    .strokeColor("#111827")
    .stroke();
  doc.y = y + 10;
}

/* ============================================================
 * TANDA TANGAN
 * ============================================================ */

function gambarTtd(
  doc: PDFKit.PDFDocument,
  kanan: { nama: string; jabatan: string; nip?: string | null } | null,
  tanggal: Date,
  lebar: number,
  margin: number,
  opsi?: { kolomKiri?: { nama: string; jabatan: string } | null },
) {
  const yAwal = doc.y;
  const lebarKolom = (lebar - 2 * margin) / 2 - 10;

  // Kolom kanan = pihak sekolah (bendahara/kepala)
  doc.font("Helvetica").fontSize(8).fillColor("#374151");
  doc.text(`Diterbitkan: ${tanggalIndonesia(tanggal)}`, margin, yAwal, {
    width: lebarKolom,
  });

  const yTanda = yAwal + 34;

  if (kanan) {
    const xKanan = margin + lebarKolom + 20;
    doc.text(kanan.jabatan, xKanan, yAwal, { width: lebarKolom, align: "right" });
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#111827");
    doc.text(kanan.nama, xKanan, yTanda, { width: lebarKolom, align: "right" });
    doc.font("Helvetica").fontSize(7.5).fillColor("#374151");
    if (kanan.nip) {
      doc.text(`NIP ${kanan.nip}`, xKanan, doc.y, {
        width: lebarKolom,
        align: "right",
      });
    }
  }

  if (opsi?.kolomKiri) {
    doc.font("Helvetica").fontSize(8).fillColor("#374151");
    doc.text(opsi.kolomKiri.jabatan, margin, yAwal, { width: lebarKolom });
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#111827");
    doc.text(opsi.kolomKiri.nama, margin, yTanda + 34, {
      width: lebarKolom,
      align: "center",
    });
  }

  doc.y = yTanda + 46;
}

/** Tanda air "DIBATALKAN" — menghalangi pemakaian ulang kwitansi batal. */
function gambarBatal(doc: PDFKit.PDFDocument, alasan: string | null | undefined) {
  const { width, height } = doc.page;
  doc.save();
  doc.rotate(-20, { origin: [width / 2, height / 2] });
  doc
    .font("Helvetica-Bold")
    .fontSize(46)
    .fillColor("#dc2626")
    .opacity(0.22)
    .text("DIBATALKAN", 0, height / 2 - 30, { align: "center", width });
  doc.restore();

  if (alasan) {
    doc
      .font("Helvetica")
      .fontSize(7.5)
      .fillColor("#dc2626")
      .opacity(1)
      .text(`Alasan: ${alasan}`, 0, height - 26, { align: "center", width });
  }
}

/* ============================================================
 * KWITANSI
 * ============================================================ */

export function buatKwitansiPdf(data: DataKwitansi): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: "A5", layout: "landscape", margin: 32 });
  const lebar = doc.page.width;
  const margin = 32;

  gambarKop(doc, data.sekolah, lebar, margin);

  doc.font("Helvetica-Bold").fontSize(12).fillColor("#111827");
  doc.text("KWITANSI PEMBAYARAN", { align: "center", width: lebar - 2 * margin });
  doc.moveDown(0.3);
  doc.font("Helvetica").fontSize(9);
  doc.text(`No. ${data.receiptNo}`, { align: "center", width: lebar - 2 * margin });
  doc.moveDown(0.8);

  const baris = (label: string, nilai: string, lebarLabel = 110) => {
    const y = doc.y;
    doc.font("Helvetica").fontSize(9).fillColor("#374151");
    doc.text(label, margin, y, { width: lebarLabel });
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#111827");
    doc.text(nilai, margin + lebarLabel, y, {
      width: lebar - 2 * margin - lebarLabel,
    });
    doc.moveDown(0.35);
  };

  baris("Telah diterima dari", data.dariNama || data.namaSiswa);
  baris("Uang sejumlah", RUPIAH(data.jumlah));
  // Jumlah dalam huruf — pengaman terhadap perubahan angka.
  baris("", kapitalkanAwal(nominalKeKata(data.jumlah)));
  baris(
    "Untuk pembayaran",
    data.keterangan ||
      keteranganPembayaran({
        invoiceTitle: "Pembayaran sekolah",
        invoiceNo: "-",
        studentName: data.namaSiswa,
        className: data.kelasSiswa,
      }),
  );
  baris(
    "Siswa",
    `${data.namaSiswa}${data.kelasSiswa ? ` — ${data.kelasSiswa}` : ""} (NIS ${data.nisSiswa})`,
  );
  if (data.metode) {
    baris("Metode", data.metode + (data.referensi ? ` — ${data.referensi}` : ""));
  }

  gambarTtd(doc, data.penandatangan ?? null, data.tanggal, lebar, margin, {
    kolomKiri: data.dariNama ? { nama: data.dariNama, jabatan: "Penyetor" } : null,
  });

  if (data.cancelledAt) gambarBatal(doc, data.cancelReason);

  doc
    .font("Helvetica")
    .fontSize(6.5)
    .fillColor("#6b7280")
    .text(
      "Dokumen ini dicetak dari sistem informasi sekolah dan sah tanpa tanda tangan basah.",
      margin,
      doc.page.height - 22,
      { width: lebar - 2 * margin, align: "center" },
    );

  doc.end();
  return doc;
}

/* ============================================================
 * NOTA (RINCIAN BANYAK TAGIHAN)
 * ============================================================ */

export function buatNotaPdf(data: DataNota): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: "A5", margin: 32 });
  const lebar = doc.page.width;
  const margin = 32;

  gambarKop(doc, data.sekolah, lebar, margin);

  doc.font("Helvetica-Bold").fontSize(12).fillColor("#111827");
  doc.text("NOTA PEMBAYARAN", { align: "center", width: lebar - 2 * margin });
  doc.moveDown(0.3);
  doc.font("Helvetica").fontSize(9);
  doc.text(`No. ${data.notaNo}`, { align: "center", width: lebar - 2 * margin });
  doc.moveDown(0.8);

  doc.font("Helvetica").fontSize(9).fillColor("#374151");
  doc.text(`Siswa: ${data.namaSiswa} (NIS ${data.nisSiswa})`);
  if (data.kelasSiswa) doc.text(`Kelas: ${data.kelasSiswa}`);
  doc.text(`Tanggal: ${tanggalIndonesia(data.tanggal)}`);
  doc.moveDown(0.6);

  // Tabel rincian.
  const yTabel = doc.y;
  doc
    .moveTo(margin, yTabel)
    .lineTo(lebar - margin, yTabel)
    .lineWidth(0.8)
    .strokeColor("#9ca3af")
    .stroke();
  doc.y = yTabel + 5;

  for (const b of data.baris) {
    const y = doc.y;
    doc.font("Helvetica").fontSize(8.5).fillColor("#111827");
    doc.text(b.deskripsi, margin, y, { width: lebar - 2 * margin - 90 });
    doc.text(RUPIAH(b.jumlah), lebar - margin - 90, y, {
      width: 90,
      align: "right",
    });
    doc.y = y + 13;
  }

  const yGaris = doc.y + 2;
  doc
    .moveTo(margin, yGaris)
    .lineTo(lebar - margin, yGaris)
    .lineWidth(0.8)
    .strokeColor("#9ca3af")
    .stroke();
  doc.y = yGaris + 6;

  const totalBaris = (label: string, nilai: string, tebal = false) => {
    const y = doc.y;
    doc
      .font(tebal ? "Helvetica-Bold" : "Helvetica")
      .fontSize(9)
      .fillColor("#111827");
    doc.text(label, margin + 120, y, { width: lebar - 2 * margin - 210 });
    doc.text(nilai, lebar - margin - 90, y, { width: 90, align: "right" });
    doc.y = y + 13;
  };

  totalBaris("Total tagihan", RUPIAH(data.total));
  totalBaris("Dibayar", RUPIAH(data.dibayar));
  totalBaris("Sisa", RUPIAH(data.sisa), true);

  doc.font("Helvetica-Oblique").fontSize(7.5).fillColor("#6b7280");
  doc.moveDown(0.4);
  doc.text(kapitalkanAwal(nominalKeKata(data.dibayar)));

  gambarTtd(doc, data.penandatangan ?? null, data.tanggal, lebar, margin);

  if (data.cancelledAt) gambarBatal(doc, data.cancelReason);

  doc.end();
  return doc;
}

/** Ubah dokumen PDFKit menjadi Buffer — dipakai sebagai isi respons HTTP. */
export function pdfKeBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const potongan: Buffer[] = [];
    doc.on("data", (c: Buffer) => potongan.push(c));
    doc.on("end", () => resolve(Buffer.concat(potongan)));
    doc.on("error", reject);
  });
}
