import { describe, expect, it } from "vitest";
import { findConflicts, buildScheduleGrid, type ScheduleEntry } from "@/lib/schedule-conflict";

/** Bantu membuat entri jadwal uji. */
function entry(over: Partial<ScheduleEntry> = {}): ScheduleEntry {
  return {
    id: over.id ?? "s1",
    classId: over.classId ?? "c1",
    className: over.className ?? "7A",
    subjectId: over.subjectId ?? "m1",
    subjectName: over.subjectName ?? "Matematika",
    teacherId: over.teacherId ?? "t1",
    teacherName: over.teacherName ?? "Budi",
    dayOfWeek: over.dayOfWeek ?? 1,
    timeSlotId: over.timeSlotId ?? "slot1",
  };
}

describe("findConflicts — bentrok guru", () => {
  it("menolak guru yang sama di dua kelas pada hari & jam sama", () => {
    const existing = [entry({ teacherId: "t1", classId: "c1", className: "7A" })];
    const c = findConflicts(
      { classId: "c2", teacherId: "t1", dayOfWeek: 1, timeSlotId: "slot1" },
      existing,
    );
    expect(c).toHaveLength(1);
    expect(c[0].type).toBe("TEACHER");
    expect(c[0].message).toContain("Budi");
    expect(c[0].message).toContain("7A");
  });

  it("guru berbeda di jam sama tidak bentrok", () => {
    const existing = [entry({ teacherId: "t1", classId: "c1" })];
    const c = findConflicts(
      { classId: "c2", teacherId: "t2", dayOfWeek: 1, timeSlotId: "slot1" },
      existing,
    );
    expect(c).toHaveLength(0);
  });

  it("guru sama tapi hari berbeda tidak bentrok", () => {
    const existing = [entry({ teacherId: "t1", dayOfWeek: 1 })];
    const c = findConflicts(
      { classId: "c2", teacherId: "t1", dayOfWeek: 2, timeSlotId: "slot1" },
      existing,
    );
    expect(c).toHaveLength(0);
  });

  it("guru sama tapi jam berbeda tidak bentrok", () => {
    const existing = [entry({ teacherId: "t1", timeSlotId: "slot1" })];
    const c = findConflicts(
      { classId: "c2", teacherId: "t1", dayOfWeek: 1, timeSlotId: "slot2" },
      existing,
    );
    expect(c).toHaveLength(0);
  });
});

describe("findConflicts — bentrok kelas", () => {
  it("menolak satu kelas punya dua mapel di jam sama", () => {
    const existing = [entry({ classId: "c1", className: "7A", subjectName: "Matematika" })];
    const c = findConflicts(
      { classId: "c1", teacherId: "t9", dayOfWeek: 1, timeSlotId: "slot1" },
      existing,
    );
    expect(c).toHaveLength(1);
    expect(c[0].type).toBe("CLASS");
    expect(c[0].message).toContain("7A");
  });

  it("dapat melaporkan dua jenis bentrok sekaligus", () => {
    const existing = [entry({ id: "x", classId: "c1", teacherId: "t1" })];
    const c = findConflicts(
      { classId: "c1", teacherId: "t1", dayOfWeek: 1, timeSlotId: "slot1" },
      existing,
    );
    expect(c.map((x) => x.type).sort()).toEqual(["CLASS", "TEACHER"]);
  });

  it("mengabaikan entri itu sendiri saat mengubah (edit)", () => {
    const existing = [entry({ id: "me", classId: "c1", teacherId: "t1" })];
    const c = findConflicts(
      {
        id: "me",
        classId: "c1",
        teacherId: "t1",
        dayOfWeek: 1,
        timeSlotId: "slot1",
      },
      existing,
    );
    expect(c).toHaveLength(0);
  });
});

describe("buildScheduleGrid", () => {
  it("menyusun peta slotId → hari → entri", () => {
    const grid = buildScheduleGrid([
      entry({ id: "a", timeSlotId: "s1", dayOfWeek: 1 }),
      entry({ id: "b", timeSlotId: "s1", dayOfWeek: 2 }),
      entry({ id: "c", timeSlotId: "s2", dayOfWeek: 1 }),
    ]);
    expect(grid.get("s1")?.get(1)?.id).toBe("a");
    expect(grid.get("s1")?.get(2)?.id).toBe("b");
    expect(grid.get("s2")?.get(1)?.id).toBe("c");
    expect(grid.get("s2")?.get(2)).toBeUndefined();
  });

  it("aman untuk daftar kosong", () => {
    expect(buildScheduleGrid([]).size).toBe(0);
  });
});
