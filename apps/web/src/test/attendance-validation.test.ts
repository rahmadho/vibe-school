import { describe, expect, it } from "vitest";
import {
  attendanceBulkSchema,
  attendanceEntrySchema,
  ATTENDANCE_LABEL,
  ATTENDANCE_CODE,
  NOT_PRESENT,
  NEEDS_NOTIFICATION,
  ATTENDANCE_STATUSES,
} from "@/lib/validations/attendance";

describe("attendanceEntrySchema", () => {
  it("menerima entri valid", () => {
    const r = attendanceEntrySchema.safeParse({ studentId: "s1", status: "PRESENT" });
    expect(r.success).toBe(true);
  });

  it("menolak status tak dikenal", () => {
    const r = attendanceEntrySchema.safeParse({ studentId: "s1", status: "HADIR" });
    expect(r.success).toBe(false);
  });

  it("menolak studentId kosong", () => {
    const r = attendanceEntrySchema.safeParse({ studentId: "", status: "PRESENT" });
    expect(r.success).toBe(false);
  });

  it("keterangan kosong menjadi undefined", () => {
    const r = attendanceEntrySchema.safeParse({
      studentId: "s1",
      status: "SICK",
      note: "",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.note).toBeUndefined();
  });

  it("menerima keterangan wajar", () => {
    const r = attendanceEntrySchema.safeParse({
      studentId: "s1",
      status: "SICK",
      note: "Demam tinggi",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.note).toBe("Demam tinggi");
  });
});

describe("attendanceBulkSchema", () => {
  const entry = { studentId: "s1", status: "PRESENT" as const };

  it("menerima payload valid", () => {
    const r = attendanceBulkSchema.safeParse({
      classId: "c1",
      date: "2025-07-15",
      entries: [entry],
    });
    expect(r.success).toBe(true);
  });

  it("menolak tanpa kelas", () => {
    const r = attendanceBulkSchema.safeParse({
      classId: "",
      date: "2025-07-15",
      entries: [entry],
    });
    expect(r.success).toBe(false);
  });

  it("menolak format tanggal salah", () => {
    for (const date of ["15-07-2025", "2025/07/15", "kemarin"]) {
      expect(
        attendanceBulkSchema.safeParse({ classId: "c1", date, entries: [entry] })
          .success,
        date,
      ).toBe(false);
    }
  });

  it("menolak daftar siswa kosong", () => {
    const r = attendanceBulkSchema.safeParse({
      classId: "c1",
      date: "2025-07-15",
      entries: [],
    });
    expect(r.success).toBe(false);
  });

  it("scheduleId kosong menjadi undefined (absen harian)", () => {
    const r = attendanceBulkSchema.safeParse({
      classId: "c1",
      date: "2025-07-15",
      scheduleId: "",
      entries: [entry],
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.scheduleId).toBeUndefined();
  });
});

describe("peta label & kode", () => {
  it("setiap status punya label & kode", () => {
    for (const s of ATTENDANCE_STATUSES) {
      expect(ATTENDANCE_LABEL[s]).toBeTruthy();
      expect(ATTENDANCE_CODE[s]).toHaveLength(1);
    }
  });

  it("kode tidak bertabrakan", () => {
    const codes = ATTENDANCE_STATUSES.map((s) => ATTENDANCE_CODE[s]);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("NOT_PRESENT tidak memuat hadir/terlambat", () => {
    expect(NOT_PRESENT).not.toContain("PRESENT");
    expect(NOT_PRESENT).not.toContain("LATE");
    expect(NOT_PRESENT).toContain("ABSENT");
  });

  it("NEEDS_NOTIFICATION memuat alpa & terlambat", () => {
    expect(NEEDS_NOTIFICATION).toContain("ABSENT");
    expect(NEEDS_NOTIFICATION).toContain("LATE");
    expect(NEEDS_NOTIFICATION).not.toContain("PRESENT");
  });
});
