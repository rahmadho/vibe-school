import { describe, expect, it } from "vitest";
import {
  timeSlotCreateSchema,
  scheduleCreateSchema,
  DAY_LABEL,
} from "@/lib/validations/schedule";

describe("timeSlotCreateSchema", () => {
  const base = { slotNumber: "1", startTime: "07:00", endTime: "07:45" };

  it("menerima jam valid", () => {
    const r = timeSlotCreateSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.slotNumber).toBe(1);
  });

  it("menolak jam selesai sebelum jam mulai", () => {
    const r = timeSlotCreateSchema.safeParse({
      ...base,
      startTime: "08:00",
      endTime: "07:00",
    });
    expect(r.success).toBe(false);
  });

  it("menolak format jam salah", () => {
    expect(
      timeSlotCreateSchema.safeParse({ ...base, startTime: "7:00" }).success,
    ).toBe(false);
    expect(
      timeSlotCreateSchema.safeParse({ ...base, startTime: "25:00" }).success,
    ).toBe(false);
    expect(
      timeSlotCreateSchema.safeParse({ ...base, endTime: "07:60" }).success,
    ).toBe(false);
  });

  it("menolak nomor jam di luar 1–20", () => {
    expect(
      timeSlotCreateSchema.safeParse({ ...base, slotNumber: "0" }).success,
    ).toBe(false);
    expect(
      timeSlotCreateSchema.safeParse({ ...base, slotNumber: "21" }).success,
    ).toBe(false);
  });

  it("menerima keterangan istirahat", () => {
    const r = timeSlotCreateSchema.safeParse({ ...base, label: "Istirahat" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.label).toBe("Istirahat");
  });

  it("keterangan kosong menjadi undefined", () => {
    const r = timeSlotCreateSchema.safeParse({ ...base, label: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.label).toBeUndefined();
  });
});

describe("scheduleCreateSchema", () => {
  const base = {
    classId: "c1",
    subjectId: "m1",
    teacherId: "t1",
    dayOfWeek: "1",
    timeSlotId: "slot1",
  };

  it("menerima jadwal valid", () => {
    const r = scheduleCreateSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.dayOfWeek).toBe(1);
  });

  it("mewajibkan kelas, mapel, guru, dan jam", () => {
    for (const k of ["classId", "subjectId", "teacherId", "timeSlotId"]) {
      expect(
        scheduleCreateSchema.safeParse({ ...base, [k]: "" }).success,
        `${k} seharusnya wajib`,
      ).toBe(false);
    }
  });

  it("menolak hari di luar 1–7", () => {
    expect(
      scheduleCreateSchema.safeParse({ ...base, dayOfWeek: "0" }).success,
    ).toBe(false);
    expect(
      scheduleCreateSchema.safeParse({ ...base, dayOfWeek: "8" }).success,
    ).toBe(false);
  });

  it("menerima ruang opsional", () => {
    const r = scheduleCreateSchema.safeParse({ ...base, room: "Lab IPA" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.room).toBe("Lab IPA");
  });
});

describe("DAY_LABEL", () => {
  it("memberi nama hari Indonesia yang benar", () => {
    expect(DAY_LABEL[1]).toBe("Senin");
    expect(DAY_LABEL[6]).toBe("Sabtu");
    expect(DAY_LABEL[7]).toBe("Minggu");
  });
});
