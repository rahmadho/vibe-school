import PDFDocument from "pdfkit";
import {
  belumTuntas,
  formatTanggalIndonesia,
  judulRapor,
  ringkasKehadiran,
  type BarisNilaiRapor,
  type DataRapor,
} from "./rapor-bentuk";

/**
 * ============================================================
 * PEMBUAT PDF RAPOR  (tanpa `server-only`)
 * ============================================================
 *
 * SENGAJA bebas `server-only` supaya bisa dipakai di luar runtime Next.js —
 * pencetakan rapor satu kelas (30 berkas) sebaiknya dikerjakan worker, bukan
 * di dalam request HTTP yang bisa timeout.
 *
 * Isi mengikuti PRD bagian 4.5: kop sekolah, logo, daftar nilai per mapel,
 * catatan wali kelas, tanda tangan kepala sekolah.
 *
 * Format sengaja "nilai angka + rekap", BUKAN replika resmi K13/Kurikulum
 * Merdeka (PRD keputusan #1). Yang dicetak: KKM per mapel, nilai akhir,
 * predikat, dan catatan.
 */

const TINTA = "#111827";
const ABU = "#6b7280";
const GARIS = "#d1d5db";
const MERAH = "#b91c1c";

type OpsiRapor = {
  data: DataRapor;
  dicetakPada: Date;
  /** Sembunyikan kolom KKM untuk sekolah yang tidak memakainya. */
  tampilkanKkm?: boolean;
};

/** Gambar logo dari URL; gagal → rapor tetap dicetak tanpa logo. */
async function ambilLogo(url: string | null): Promise<Buffer | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const tipe = res.headers.get("content-type") ?? "";
    if (!tipe.startsWith("image/")) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    // Logo bukan alasan menggagalkan rapor. Sekolah lebih baik dapat rapor
    // tanpa logo daripada tidak dapat rapor sama sekali.
    return null;
  }
}

function lebarIsi(doc: PDFKit.PDFDocument): number {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right;
}

function kopSekolah(
  doc: PDFKit.PDFDocument,
  sekolah: DataRapor["sekolah"],
  logo: Buffer | null,
) {
  const margin = doc.page.margins.left;
  const lebar = lebarIsi(doc);
  const atas = doc.y;

  if (logo) {
    try {
      doc.image(logo, margin, atas, { fit: [54, 54] });
    } catch {
      // Berkas bukan gambar yang didukung pdfkit — lewati saja.
    }
  }

  const geser = logo ? 64 : 0;

  doc
    .font("Helvetica-Bold")
    .fontSize(15)
    .fillColor(TINTA)
    .text(sekolah.name.toUpperCase(), margin + geser, atas, {
      width: lebar - geser,
      align: "center",
    });

  const baris: string[] = [];
  if (sekolah.address) baris.push(sekolah.address);
  const kontak = [sekolah.phone, sekolah.email].filter(Boolean);
  if (kontak.length) baris.push(kontak.join(" · "));
  if (sekolah.npsn) baris.push(`NPSN: ${sekolah.npsn}`);

  if (baris.length) {
    doc
      .font("Helvetica")
      .fontSize(8.5)
      .fillColor(ABU)
      .text(baris.join("\n"), margin + geser, doc.y + 2, {
        width: lebar - geser,
        align: "center",
        lineGap: 1,
      });
  }

  // Garis ganda khas dokumen resmi sekolah.
  const y = Math.max(doc.y + 8, atas + 58);
  doc
    .moveTo(margin, y)
    .lineTo(margin + lebar, y)
    .lineWidth(1.6)
    .strokeColor(TINTA)
    .stroke();
  doc
    .moveTo(margin, y + 2.5)
    .lineTo(margin + lebar, y + 2.5)
    .lineWidth(0.6)
    .strokeColor(TINTA)
    .stroke();

  doc.y = y + 12;
  doc.x = margin;
}

/** Kop ringkas untuk halaman lanjutan. */
function kopLanjutan(doc: PDFKit.PDFDocument, namaSiswa: string) {
  const margin = doc.page.margins.left;
  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor(TINTA)
    .text(
      `LAPORAN HASIL BELAJAR — ${namaSiswa} (lanjutan)`,
      margin,
      doc.page.margins.top,
      { width: lebarIsi(doc), align: "center" },
    );
  doc.y = doc.page.margins.top + 22;
  doc.x = margin;
}

function judul(doc: PDFKit.PDFDocument) {
  const margin = doc.page.margins.left;
  doc
    .font("Helvetica-Bold")
    .fontSize(12)
    .fillColor(TINTA)
    .text("LAPORAN HASIL BELAJAR SISWA", margin, doc.y, {
      width: lebarIsi(doc),
      align: "center",
    });
  doc.moveDown(0.9);
  doc.x = margin;
}

function barisIdentitas(
  doc: PDFKit.PDFDocument,
  kiri: Array<[string, string]>,
  kanan: Array<[string, string]>,
) {
  const margin = doc.page.margins.left;
  const lebar = lebarIsi(doc);
  const kolom = lebar / 2;
  let y = doc.y;

  for (let i = 0; i < Math.max(kiri.length, kanan.length); i += 1) {
    const k = kiri[i];
    const r = kanan[i];

    if (k) {
      doc.font("Helvetica").fontSize(9).fillColor(ABU);
      doc.text(k[0], margin, y, { width: 76, lineBreak: false });
      doc.font("Helvetica-Bold").fillColor(TINTA);
      doc.text(`: ${k[1]}`, margin + 78, y, { width: kolom - 86 });
    }
    if (r) {
      doc.font("Helvetica").fontSize(9).fillColor(ABU);
      doc.text(r[0], margin + kolom, y, { width: 88, lineBreak: false });
      doc.font("Helvetica-Bold").fillColor(TINTA);
      doc.text(`: ${r[1]}`, margin + kolom + 90, y, { width: kolom - 96 });
    }
    y += 14;
  }

  doc.y = y + 6;
  doc.x = margin;
}

/* ------------------------------------------------------------------ */
/* Tabel nilai                                                         */
/* ------------------------------------------------------------------ */

type Kolom = {
  x: number;
  lebar: number;
  judul: string;
  align: "left" | "center";
};

function hitungKolom(doc: PDFKit.PDFDocument, tampilkanKkm: boolean): Kolom[] {
  const margin = doc.page.margins.left;
  const lebar = lebarIsi(doc);

  const wNo = 26;
  const wKkm = 36;
  const wNilai = 48;
  const wPredikat = 52;
  const wCatatan = Math.max(lebar - wNo - wKkm - wNilai - wPredikat - 90, 80);
  const wNama = lebar - wNo - wNilai - wPredikat - wCatatan - (tampilkanKkm ? wKkm : 0);

  const kolom: Kolom[] = [
    { x: margin, lebar: wNo, judul: "No", align: "center" },
    { x: margin + wNo, lebar: wNama, judul: "Mata Pelajaran", align: "left" },
  ];
  let x = margin + wNo + wNama;
  if (tampilkanKkm) {
    kolom.push({ x, lebar: wKkm, judul: "KKM", align: "center" });
    x += wKkm;
  }
  kolom.push({ x, lebar: wNilai, judul: "Nilai", align: "center" });
  x += wNilai;
  kolom.push({ x, lebar: wPredikat, judul: "Predikat", align: "center" });
  x += wPredikat;
  kolom.push({ x, lebar: wCatatan, judul: "Catatan", align: "left" });

  return kolom;
}

function gambarKepalaTabel(
  doc: PDFKit.PDFDocument,
  kolom: Kolom[],
  y: number,
  lebar: number,
) {
  const margin = doc.page.margins.left;
  const tinggi = 16;

  doc.rect(margin, y, lebar, tinggi).fill("#f3f4f6");
  doc.font("Helvetica-Bold").fontSize(8.5).fillColor(TINTA).fillColor(TINTA);
  for (const k of kolom) {
    doc.text(k.judul, k.x + 4, y + 4.5, {
      width: k.lebar - 8,
      align: k.align,
    });
  }
  doc
    .moveTo(margin, y + tinggi)
    .lineTo(margin + lebar, y + tinggi)
    .lineWidth(0.7)
    .strokeColor(GARIS)
    .stroke();

  return y + tinggi;
}

function tabelNilai(
  doc: PDFKit.PDFDocument,
  nilai: BarisNilaiRapor[],
  tampilkanKkm: boolean,
  namaSiswa: string,
) {
  const margin = doc.page.margins.left;
  const lebar = lebarIsi(doc);
  const kolom = hitungKolom(doc, tampilkanKkm);
  const kKolomCatatan = kolom[kolom.length - 1];
  const kKolomNilai = kolom.find((k) => k.judul === "Nilai")!;

  let y = gambarKepalaTabel(doc, kolom, doc.y, lebar);

  nilai.forEach((n, i) => {
    doc.font("Helvetica").fontSize(8.5).fillColor(TINTA);
    const tinggiCatatan = doc.heightOfString(n.note ?? "—", {
      width: kKolomCatatan.lebar - 8,
    });
    const tinggiBaris = Math.max(16, tinggiCatatan + 6);

    // Halaman baru bila baris ini tidak muat.
    if (y + tinggiBaris > doc.page.height - doc.page.margins.bottom - 110) {
      doc.addPage();
      kopLanjutan(doc, namaSiswa);
      y = gambarKepalaTabel(doc, kolom, doc.y, lebar);
    }

    doc.font("Helvetica").fontSize(8.5).fillColor(TINTA);
    doc.text(String(i + 1), kolom[0].x + 4, y + 4, {
      width: kolom[0].lebar - 8,
      align: "center",
    });
    doc.text(n.namaMapel, kolom[1].x + 4, y + 4, { width: kolom[1].lebar - 8 });

    if (tampilkanKkm) {
      const kKkm = kolom.find((k) => k.judul === "KKM")!;
      doc.text(String(n.kkm), kKkm.x + 4, y + 4, {
        width: kKkm.lebar - 8,
        align: "center",
      });
    }

    // Nilai di bawah KKM diberi warna berbeda — guru & orang tua perlu
    // langsung melihat mapel yang belum tuntas, bukan membandingkan angka.
    const tuntas = !belumTuntas(n.finalScore, n.kkm);
    doc
      .font("Helvetica-Bold")
      .fillColor(tuntas ? TINTA : MERAH)
      .text(String(n.finalScore), kKolomNilai.x + 4, y + 4, {
        width: kKolomNilai.lebar - 8,
        align: "center",
      });

    const kPredikat = kolom.find((k) => k.judul === "Predikat")!;
    doc.font("Helvetica").fillColor(TINTA);
    doc.text(n.predicate ?? "—", kPredikat.x + 4, y + 4, {
      width: kPredikat.lebar - 8,
      align: "center",
    });
    doc.text(n.note ?? "—", kKolomCatatan.x + 4, y + 4, {
      width: kKolomCatatan.lebar - 8,
    });

    y += tinggiBaris;
    doc
      .moveTo(margin, y)
      .lineTo(margin + lebar, y)
      .lineWidth(0.4)
      .strokeColor(GARIS)
      .stroke();
  });

  doc.y = y + 12;
  doc.x = margin;
}

/* ------------------------------------------------------------------ */
/* Tanda tangan                                                        */
/* ------------------------------------------------------------------ */

function blokTandaTangan(
  doc: PDFKit.PDFDocument,
  data: DataRapor,
  dicetakPada: Date,
) {
  const margin = doc.page.margins.left;
  const lebar = lebarIsi(doc);

  if (doc.y > doc.page.height - doc.page.margins.bottom - 130) {
    doc.addPage();
    kopLanjutan(doc, data.siswa.fullName);
  }

  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor(ABU)
    .text(`Dicetak: ${formatTanggalIndonesia(dicetakPada)}`, margin, doc.y, {
      width: lebar,
    });

  doc.moveDown(1);

  const kolom = lebar / 2;
  const yAwal = doc.y;

  const sisi = (
    xa: number,
    jabatan: string,
    pejabat: { nama: string; nip: string | null } | null,
  ) => {
    doc.font("Helvetica").fontSize(9).fillColor(TINTA);
    doc.text(jabatan, xa, yAwal, { width: kolom, align: "center" });

    // Ruang tanda tangan basah & cap.
    doc.text("", xa, yAwal + 16, { width: kolom });
    doc.text("", xa, yAwal + 60, { width: kolom });

    // Nama KOSONG → garis titik-titik, bukan nama kosong. Rapor tanpa nama
    // penandatangan terlihat seperti dokumen cacat.
    doc
      .font("Helvetica-Bold")
      .text(pejabat?.nama ?? "…………………………………", xa, yAwal + 62, {
        width: kolom,
        align: "center",
      });

    if (pejabat?.nip) {
      doc
        .font("Helvetica")
        .fillColor(ABU)
        .text(`NIP. ${pejabat.nip}`, xa, yAwal + 75, {
          width: kolom,
          align: "center",
        });
    }
  };

  // Wali kelas di kiri, kepala sekolah di kanan — tata letak lazim rapor.
  sisi(margin, "Wali Kelas", data.waliKelasTtd);
  sisi(margin + kolom, "Kepala Sekolah", data.kepalaSekolah);

  doc.y = yAwal + 96;
  doc.x = margin;
}

/* ------------------------------------------------------------------ */

export async function buatRaporPdf(opsi: OpsiRapor): Promise<PDFKit.PDFDocument> {
  const { data, dicetakPada, tampilkanKkm = true } = opsi;

  const doc = new PDFDocument({
    size: "A4",
    margin: 40,
    info: {
      Title: judulRapor(data),
      Author: data.sekolah.name,
      Subject: "Laporan Hasil Belajar Siswa",
    },
  });

  const logo = await ambilLogo(data.sekolah.logoUrl);

  kopSekolah(doc, data.sekolah, logo);
  judul(doc);

  barisIdentitas(
    doc,
    [
      ["Nama Siswa", data.siswa.fullName],
      ["NIS / NISN", `${data.siswa.nis} / ${data.siswa.nisn ?? "—"}`],
      ["Kelas", data.kelas ?? "—"],
    ],
    [
      ["Semester", `${data.semester.nama} (${data.semester.jenis})`],
      ["Tahun Ajaran", data.semester.tahunAjaran],
      [
        "Tempat/Tgl Lahir",
        `${data.siswa.birthPlace ?? "—"}, ${formatTanggalIndonesia(data.siswa.birthDate)}`,
      ],
    ],
  );

  if (data.nilai.length === 0) {
    // Rapor tanpa nilai tetap dicetak — sekolah mungkin butuh bukti bahwa
    // siswa terdaftar, atau nilainya memang belum dimasukkan.
    doc
      .font("Helvetica-Oblique")
      .fontSize(9)
      .fillColor(ABU)
      .text(
        "Belum ada nilai yang dimasukkan untuk semester ini.",
        doc.page.margins.left,
        doc.y,
        { width: lebarIsi(doc), align: "center" },
      );
    doc.moveDown(1.2);
  } else {
    tabelNilai(doc, data.nilai, tampilkanKkm, data.siswa.fullName);
  }

  /* ---------- Kehadiran ---------- */
  const margin = doc.page.margins.left;
  doc.font("Helvetica-Bold").fontSize(9).fillColor(TINTA);
  doc.text("Rekap Kehadiran", margin, doc.y, { width: lebarIsi(doc) });
  doc.moveDown(0.3);
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(TINTA)
    .text(ringkasKehadiran(data.kehadiran), margin, doc.y, {
      width: lebarIsi(doc),
    });

  doc.moveDown(0.9);

  /* ---------- Catatan wali kelas ---------- */
  doc.font("Helvetica-Bold").fontSize(9).fillColor(TINTA);
  doc.text("Catatan Wali Kelas", margin, doc.y, { width: lebarIsi(doc) });
  doc.moveDown(0.3);
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(TINTA)
    .text(data.catatanWali ?? "—", margin, doc.y, { width: lebarIsi(doc) });

  doc.moveDown(1.6);
  blokTandaTangan(doc, data, dicetakPada);

  doc.end();
  return doc;
}

/**
 * Ubah dokumen pdfkit jadi Buffer.
 *
 * Dipakai bersama oleh route unduhan dan (nanti) pembuatan massal di worker.
 */
export function pdfKeBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const potongan: Buffer[] = [];
    doc.on("data", (c: Buffer) => potongan.push(c));
    doc.on("end", () => resolve(Buffer.concat(potongan)));
    doc.on("error", reject);
  });
}
