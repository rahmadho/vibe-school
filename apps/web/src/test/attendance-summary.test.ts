import { describe, expect, it } from "vitest";
import {
  summarize,
  summarizeAll,
  summarizeDay,
  needsAttention,
  defaultRange,
} from "@/lib/attendance-summary";
import type { AttendanceStatusValue } from "@/lib/validations/attendance";

const rec = (studentId: string, status: AttendanceStatusValue) => ({
  studentId,
  status,
});

describe("summarize", () => {
  it("menghitung tiap status", () => {
    const s = summarize([
      rec("a", "PRESENT"),
      rec("a", "PRESENT"),
      rec("a", "SICK"),
      rec("a", "ABSENT"),
      rec("a", "LATE"),
    ]);
    expect(s.counts.PRESENT).toBe(2);
    expect(s.counts.SICK).toBe(1);
    expect(s.counts.ABSENT).toBe(1);
    expect(s.counts.LATE).toBe(1);
    expect(s.total).toBe(5);
  });

  it("menghitung terlambat sebagai hadir untuk persentase", () => {
    // 3 hadir + 1 terlambat dari 5 catatan = 4/5 = 80%
    const s = summarize([
      rec("a", "PRESENT"),
      rec("a", "PRESENT"),
      rec("a", "PRESENT"),
      rec("a", "LATE"),
      rec("a", "ABSENT"),
    ]);
    expect(s.presentEquivalent).toBe(4);
    expect(s.attendanceRate).toBe(80);
  });

  it("persentase 100 bila semua hadir", () => {
    const s = summarize([rec("a", "PRESENT"), rec("a", "PRESENT")]);
    expect(s.attendanceRate).toBe(100);
  });

  it("persentase 0 bila semua alpa", () => {
    const s = summarize([rec("a", "ABSENT"), rec("a", "ABSENT")]);
    expect(s.attendanceRate).toBe(0);
  });

  it("aman untuk daftar kosong (tidak bagi nol)", () => {
    const s = summarize([]);
    expect(s.total).toBe(0);
    expect(s.attendanceRate).toBe(0);
    expect(Number.isNaN(s.attendanceRate)).toBe(false);
  });

  it("membulatkan ke 1 desimal", () => {
    // 1 dari 3 = 33.333…% → 33.3
    const s = summarize([
      rec("a", "PRESENT"),
      rec("a", "ABSENT"),
      rec("a", "ABSENT"),
    ]);
    expect(s.attendanceRate).toBe(33.3);
  });
});

describe("summarizeAll", () => {
  it("memisahkan rekap per siswa", () => {
    const m = summarizeAll([
      rec("a", "PRESENT"),
      rec("b", "ABSENT"),
      rec("a", "ABSENT"),
    ]);
    expect(m.get("a")?.total).toBe(2);
    expect(m.get("a")?.attendanceRate).toBe(50);
    expect(m.get("b")?.total).toBe(1);
    expect(m.get("b")?.attendanceRate).toBe(0);
  });

  it("mengembalikan peta kosong untuk input kosong", () => {
    expect(summarizeAll([]).size).toBe(0);
  });
});

describe("summarizeDay", () => {
  it("menandai belum ada catatan", () => {
    const s = summarizeDay([]);
    expect(s.recorded).toBe(false);
    expect(s.total).toBe(0);
  });

  it("menghitung ringkasan hari", () => {
    const s = summarizeDay([
      rec("a", "PRESENT"),
      rec("b", "PRESENT"),
      rec("c", "SICK"),
      rec("d", "ABSENT"),
    ]);
    expect(s.recorded).toBe(true);
    expect(s.counts.PRESENT).toBe(2);
    expect(s.rate).toBe(50);
  });
});

describe("needsAttention", () => {
  it("menandai siswa dengan kehadiran rendah & cukup data", () => {
    const s = summarize([
      rec("a", "PRESENT"),
      rec("a", "ABSENT"),
      rec("a", "ABSENT"),
      rec("a", "ABSENT"),
      rec("a", "ABSENT"),
    ]);
    expect(s.attendanceRate).toBe(20);
    expect(needsAttention(s)).toBe(true);
  });

  it("tidak menandai bila data terlalu sedikit", () => {
    const s = summarize([rec("a", "ABSENT"), rec("a", "ABSENT")]);
    expect(needsAttention(s)).toBe(false);
  });

  it("tidak menandai bila kehadiran sudah baik", () => {
    const s = summarize(Array.from({ length: 10 }, () => rec("a", "PRESENT")));
    expect(needsAttention(s)).toBe(false);
  });
});

describe("defaultRange", () => {
  it("memberi awal bulan sampai hari ini", () => {
    const r = defaultRange(new Date(2025, 6, 15)); // 15 Juli 2025
    expect(r.from).toBe("2025-07-01");
    expect(r.to).toBe("2025-07-15");
  });
});
