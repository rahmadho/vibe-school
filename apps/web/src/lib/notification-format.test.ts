import { describe, expect, it } from "vitest";
import {
  formatRupiah,
  formatTanggal,
  formatJam,
  formatDaftarNilai,
  formatDaftarTagihan,
} from "@/lib/notification-format";

describe("formatRupiah", () => {
  it("tanpa desimal, pemisah titik", () => {
    expect(formatRupiah(1500000)).toBe("Rp1.500.000");
    expect(formatRupiah("350000")).toBe("Rp350.000");
    expect(formatRupiah(0)).toBe("Rp0");
  });
});

describe("formatTanggal & formatJam", () => {
  it("tanggal panjang bahasa Indonesia", () => {
    expect(formatTanggal("2025-11-03T00:00:00Z")).toMatch(/November 2025/);
    expect(formatTanggal("bukan tanggal")).toBe("-");
  });

  it("jam dua digit", () => {
    expect(formatJam("7:5")).toBe("07:05");
    expect(formatJam("07.15")).toBe("07:15");
  });
});

describe("formatDaftarNilai", () => {
  it("satu baris per mapel, tanda * di bawah KKM", () => {
    const out = formatDaftarNilai(
      [
        { mapel: "Matematika", nilai: 65 },
        { mapel: "IPA", nilai: 82 },
      ],
      { kkm: 70 },
    );
    expect(out).toBe("• Matematika — 65 *\n• IPA — 82\n* di bawah KKM 70");
  });

  it("memotong ke 8 mapel + suffix", () => {
    const items = Array.from({ length: 11 }, (_, i) => ({ mapel: `Mapel ${i + 1}`, nilai: 80 }));
    const baris = formatDaftarNilai(items).split("\n");
    expect(baris).toHaveLength(9);
    expect(baris[8]).toBe("• dan 3 mapel lain");
  });
});

describe("formatDaftarTagihan", () => {
  it("memotong ke 5 tagihan + suffix", () => {
    const items = Array.from({ length: 7 }, (_, i) => ({
      judul: `Tagihan ${i + 1}`,
      jumlah: 350000,
    }));
    const baris = formatDaftarTagihan(items).split("\n");
    expect(baris).toHaveLength(6);
    expect(baris[0]).toBe("• Tagihan 1 — Rp350.000");
    expect(baris[5]).toBe("• dan 2 tagihan lain");
  });

  it("menampilkan jatuh tempo ringkas", () => {
    const out = formatDaftarTagihan([
      { judul: "SPP November", jumlah: 350000, jatuhTempo: "2025-11-10T00:00:00Z" },
    ]);
    expect(out).toMatch(/^• SPP November — Rp350\.000 \(tempo 10 Nov\)$/);
  });
});
