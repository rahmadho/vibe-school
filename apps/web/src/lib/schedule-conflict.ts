/**
 * Deteksi bentrok jadwal — logika MURNI (tanpa DB) agar mudah diuji.
 *
 * Dua jenis bentrok:
 *  1. BENTROK GURU   — guru yang sama mengajar 2 kelas di hari+jam yang sama.
 *  2. BENTROK KELAS  — satu kelas punya 2 mapel di hari+jam yang sama.
 *
 * Keduanya tidak boleh terjadi. Ini yang membedakan jadwal yang bisa dipakai
 * sekolah dari tabel tempelan.
 */

export type ScheduleEntry = {
  id: string;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  teacherId: string;
  teacherName: string;
  dayOfWeek: number;
  timeSlotId: string;
};

export type ConflictType = "TEACHER" | "CLASS";

export type Conflict = {
  type: ConflictType;
  message: string;
  existing: ScheduleEntry;
};

/**
 * Cari bentrok untuk jadwal yang akan dibuat/diubah.
 *
 * @param candidate  jadwal baru (id kosong bila create)
 * @param existing   seluruh jadwal yang sudah ada di sekolah
 */
export function findConflicts(
  candidate: {
    id?: string;
    classId: string;
    teacherId: string;
    dayOfWeek: number;
    timeSlotId: string;
  },
  existing: ScheduleEntry[],
): Conflict[] {
  const conflicts: Conflict[] = [];

  for (const e of existing) {
    // Abaikan entri yang sedang diedit (diri sendiri).
    if (candidate.id && e.id === candidate.id) continue;
    // Hanya bandingkan pada hari & jam yang sama.
    if (e.dayOfWeek !== candidate.dayOfWeek) continue;
    if (e.timeSlotId !== candidate.timeSlotId) continue;

    if (e.teacherId === candidate.teacherId) {
      conflicts.push({
        type: "TEACHER",
        message: `${e.teacherName} sudah mengajar ${e.subjectName} di kelas ${e.className} pada jam ini.`,
        existing: e,
      });
    }

    if (e.classId === candidate.classId) {
      conflicts.push({
        type: "CLASS",
        message: `Kelas ${e.className} sudah punya pelajaran ${e.subjectName} pada jam ini.`,
        existing: e,
      });
    }
  }

  return conflicts;
}

/** Susun grid jadwal: peta `slotId → day → entry`. */
export function buildScheduleGrid<T extends ScheduleEntry>(
  entries: T[],
): Map<string, Map<number, T>> {
  const grid = new Map<string, Map<number, T>>();
  for (const e of entries) {
    let byDay = grid.get(e.timeSlotId);
    if (!byDay) {
      byDay = new Map();
      grid.set(e.timeSlotId, byDay);
    }
    byDay.set(e.dayOfWeek, e);
  }
  return grid;
}
