import { describe, expect, it } from "vitest";
import {
  sanitizeRichText,
  htmlToPlainText,
  isRichTextEmpty,
} from "@/lib/rich-text";

/**
 * Uji pembersih HTML isi tulisan.
 *
 * KENAPA TEST INI ADA:
 * Isi berita disimpan sebagai HTML lalu ditampilkan di web publik sekolah —
 * halaman yang dibuka semua orang tua. Kalau pembersih ini gagal, satu akun
 * editor yang disalahgunakan cukup untuk menyisipkan skrip ke halaman itu.
 * Tidak ada gerbang lain (tsc, build) yang bisa melihat kesalahan di sini,
 * karena ini soal isi string, bukan tipe.
 */
describe("sanitizeRichText", () => {
  it("mempertahankan tag yang dihasilkan toolbar", () => {
    const html =
      "<h2>Judul</h2><p>Isi <strong>tebal</strong> dan <em>miring</em>.</p>" +
      "<ul><li>satu</li></ul><blockquote>kutipan</blockquote><hr>";
    const out = sanitizeRichText(html);
    expect(out).toContain("<h2>Judul</h2>");
    expect(out).toContain("<strong>tebal</strong>");
    expect(out).toContain("<em>miring</em>");
    expect(out).toContain("<ul>");
    expect(out).toContain("<blockquote>");
    expect(out).toContain("<hr");
  });

  it("membuang tag script beserta isinya", () => {
    const out = sanitizeRichText(
      '<p>Aman</p><script>alert("bocor")</script>',
    );
    expect(out).not.toContain("script");
    expect(out).not.toContain("alert");
    expect(out).toContain("Aman");
  });

  it("membuang atribut penanganan kejadian (on*)", () => {
    const out = sanitizeRichText('<p onclick="alert(1)">Klik</p>');
    expect(out).not.toContain("onclick");
    expect(out).toContain("Klik");
  });

  it("menolak tautan javascript:", () => {
    const out = sanitizeRichText('<a href="javascript:alert(1)">x</a>');
    expect(out).not.toContain("javascript:");
  });

  it("menolak iframe dan form", () => {
    const out = sanitizeRichText(
      '<iframe src="https://jahat.example"></iframe><form action="/x"><input></form>',
    );
    expect(out).not.toContain("iframe");
    expect(out).not.toContain("<form");
    expect(out).not.toContain("<input");
  });

  it("mempertahankan tautan http(s) yang sah", () => {
    const out = sanitizeRichText('<a href="https://sekolah.id">Situs</a>');
    expect(out).toContain('href="https://sekolah.id"');
  });

  it("mempertahankan tautan internal (diawali /)", () => {
    const out = sanitizeRichText('<a href="/berita">Berita</a>');
    expect(out).toContain('href="/berita"');
  });

  it("membuang atribut style", () => {
    const out = sanitizeRichText('<p style="color:red">x</p>');
    expect(out).not.toContain("style=");
  });
});

describe("htmlToPlainText", () => {
  it("mengubah paragraf & judul menjadi baris terpisah", () => {
    const text = htmlToPlainText("<h2>Judul</h2><p>Satu</p><p>Dua</p>");
    expect(text).toBe("Judul\nSatu\nDua");
  });

  it("mengubah <br> menjadi baris baru", () => {
    expect(htmlToPlainText("<p>A<br>B</p>")).toBe("A\nB");
  });

  it("membuang tag tanpa menyisakan tanda kurung", () => {
    expect(htmlToPlainText("<p><strong>Tebal</strong></p>")).toBe("Tebal");
  });

  it("mengurai entitas HTML dasar", () => {
    expect(htmlToPlainText("<p>A &amp; B</p>")).toBe("A & B");
  });

  it("tidak membocorkan isi script", () => {
    expect(htmlToPlainText('<p>x</p><script>alert(1)</script>')).toBe("x");
  });
});

describe("isRichTextEmpty", () => {
  it("menganggap dokumen kosong sebagai kosong", () => {
    expect(isRichTextEmpty("<p></p>")).toBe(true);
    expect(isRichTextEmpty("")).toBe(true);
  });

  it("menganggap dokumen berisi teks sebagai tidak kosong", () => {
    expect(isRichTextEmpty("<p>Ada isi</p>")).toBe(false);
  });
});
