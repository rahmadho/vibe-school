"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button, Input } from "@/components/ui";
import { Select } from "@/components/form-fields";
import {
  STUDENT_STATUSES,
  STUDENT_STATUS_LABEL,
  CLASS_FILTER_NONE,
} from "@/lib/validations/student";

/**
 * Filter daftar siswa. Submit lewat URL query agar bisa di-bookmark &
 * di-render ulang oleh server component.
 *
 * ============================================================
 * KENAPA KELAS DISARING PER TAHUN AJARAN
 * ============================================================
 * Nama kelas berulang setiap tahun: "7A" ada di 2024/2025 DAN di 2025/2026.
 * Tanpa penyaringan, sekolah yang sudah berjalan dua tahun melihat dua entri
 * "7A" yang tampak identik di dropdown — dan memilih yang salah menghasilkan
 * daftar kosong, sehingga operator mengira data siswanya hilang.
 *
 * Karena itu:
 *   - kelas difilter ke tahun ajaran aktif secara bawaan;
 *   - saat tahun dipilih "Semua tahun", label kelas DIBERI TAHUNNYA supaya
 *     perbedaannya terlihat.
 *
 * ============================================================
 * KENAPA ADA OPSI "BELUM ADA KELAS"
 * ============================================================
 * Siswa hasil konversi SPMB sering belum ditempatkan. Tanpa opsi ini mereka
 * tidak bisa ditemukan sama sekali — tidak punya `classId` yang bisa dipilih.
 */

type ClassOption = {
  id: string;
  name: string;
  level: number;
  capacity: number | null;
  academicYearId: string;
  majorId: string | null;
  academicYear: { name: string; isActive: boolean };
  _count: { students: number };
};

export function StudentFilters({
  classes,
  majors,
  years,
  terminology,
  unassignedCount,
  current,
}: {
  classes: ClassOption[];
  /** Opsi jurusan. Kosong = sekolah belum memakai jurusan → filter disembunyikan. */
  majors: Array<{ id: string; code: string; name: string }>;
  years: Array<{ id: string; name: string; isActive: boolean }>;
  terminology: string;
  /** Berapa siswa yang belum ditempatkan — ditampilkan di opsi filternya. */
  unassignedCount: number;
  current: {
    q: string;
    classId: string;
    majorId: string;
    academicYearId: string;
    status: string;
  };
}) {
  const router = useRouter();

  const [q, setQ] = useState(current.q);
  const [classId, setClassId] = useState(current.classId);
  const [majorId, setMajorId] = useState(current.majorId);
  const [academicYearId, setAcademicYearId] = useState(current.academicYearId);
  const [status, setStatus] = useState(current.status);

  /**
   * Kelas yang ditampilkan di dropdown.
   *
   * Dua penyaringan, keduanya untuk mencegah pilihan yang mustahil:
   *   1. Tahun ajaran — supaya "7A" tidak muncul dua kali.
   *   2. Jurusan — memilih jurusan TKJ lalu kelas "X RPL 1" selalu
   *      menghasilkan nol hasil tanpa penjelasan apa pun.
   */
  const visibleClasses = useMemo(() => {
    let list = classes;
    // "all" berarti sengaja menampilkan seluruh tahun — jadi jangan disaring.
    // Dibandingkan lewat ID, bukan nama tahun: nama tahun bisa berubah dan
    // perbandingan nama akan diam-diam berhenti cocok tanpa ada yang sadar.
    if (academicYearId && academicYearId !== "all") {
      list = list.filter((c) => c.academicYearId === academicYearId);
    }
    // Kelas yang jurusannya berbeda dari yang dipilih tidak mungkin berisi
    // siswa yang dicari — menyembunyikannya mencegah kombinasi tanpa hasil.
    if (majorId) {
      list = list.filter((c) => c.majorId === majorId || c.majorId === null);
    }
    return list;
  }, [classes, academicYearId, majorId]);

  // Tahun ditampilkan di label hanya saat kelas dari beberapa tahun bercampur.
  const showYearInLabel = !academicYearId || academicYearId === "all";

  function apply(e: React.FormEvent) {
    e.preventDefault();
    const sp = new URLSearchParams();
    if (q.trim()) sp.set("q", q.trim());
    if (classId) sp.set("classId", classId);
    if (majorId) sp.set("majorId", majorId);
    if (academicYearId) sp.set("academicYearId", academicYearId);
    if (status) sp.set("status", status);
    sp.set("page", "1");
    router.push(`/dashboard/students?${sp.toString()}`);
  }

  function reset() {
    setQ("");
    setClassId("");
    setMajorId("");
    setAcademicYearId("");
    setStatus("");
    router.push("/dashboard/students");
  }

  /** Ganti tahun → kelas yang tidak ada di tahun itu harus dilepas. */
  function onYearChange(next: string) {
    setAcademicYearId(next);
    if (classId === CLASS_FILTER_NONE) return;
    // "Semua tahun" mencakup semua kelas, jadi pilihan kelas tetap sah.
    if (!next || next === "all") return;
    const stillValid = classes.some(
      (c) => c.id === classId && c.academicYearId === next,
    );
    if (!stillValid) setClassId("");
  }

  const hasFilter = Boolean(
    current.q || current.classId || current.majorId || current.academicYearId || current.status,
  );

  return (
    <form
      onSubmit={apply}
      className="flex flex-wrap items-end gap-3 rounded-lg border border-chalk bg-white p-4"
    >
      <div className="min-w-[200px] flex-1">
        <label htmlFor="q" className="mb-1 block text-xs font-medium text-slate">
          Cari
        </label>
        <Input
          id="q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Nama, NIS, atau NISN"
        />
      </div>

      {/* Tahun ajaran diletakkan SEBELUM kelas: operator memilih tahun lebih
          dulu, dan pilihan kelas mengikutinya. Urutan ini juga mencerminkan
          sebab-akibatnya. */}
      {years.length > 1 ? (
        <div className="w-44">
          <label
            htmlFor="academicYearId"
            className="mb-1 block text-xs font-medium text-slate"
          >
            Tahun ajaran
          </label>
          <Select
            id="academicYearId"
            value={academicYearId}
            onChange={(e) => onYearChange(e.target.value)}
          >
            <option value="">Tahun aktif</option>
            <option value="all">Semua tahun</option>
            {years.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name}
                {y.isActive ? " (aktif)" : ""}
              </option>
            ))}
          </Select>
        </div>
      ) : null}

      <div className="w-48">
        <label
          htmlFor="classId"
          className="mb-1 block text-xs font-medium text-slate"
        >
          Kelas
        </label>
        <Select
          id="classId"
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
        >
          <option value="">Semua kelas</option>

          {/* Siswa tanpa kelas — hanya muncul bila memang ada. */}
          {unassignedCount > 0 ? (
            <option value={CLASS_FILTER_NONE}>
              Belum ada kelas ({unassignedCount})
            </option>
          ) : null}

          {visibleClasses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {showYearInLabel ? ` · ${c.academicYear.name}` : ""}
              {` (${c._count.students}${c.capacity ? `/${c.capacity}` : ""})`}
            </option>
          ))}
        </Select>

        {/* Penjelasan saat kelas yang tersedia menyusut karena penyaringan. */}
        {visibleClasses.length === 0 && classes.length > 0 ? (
          <span className="mt-1 block text-[11px] text-slate">
            Tidak ada kelas di tahun ajaran ini.
          </span>
        ) : null}
      </div>

      {majors.length > 0 ? (
        <div className="w-44">
          <label
            htmlFor="majorId"
            className="mb-1 block text-xs font-medium text-slate"
          >
            {terminology}
          </label>
          <Select
            id="majorId"
            value={majorId}
            onChange={(e) => setMajorId(e.target.value)}
          >
            <option value="">Semua</option>
            {majors.map((m) => (
              <option key={m.id} value={m.id}>
                {m.code} — {m.name}
              </option>
            ))}
          </Select>
        </div>
      ) : null}

      <div className="w-40">
        <label
          htmlFor="status"
          className="mb-1 block text-xs font-medium text-slate"
        >
          Status
        </label>
        <Select
          id="status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">Semua status</option>
          {STUDENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STUDENT_STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex gap-2">
        <Button type="submit">Terapkan</Button>
        {hasFilter ? (
          <Button type="button" variant="ghost" onClick={reset}>
            Reset
          </Button>
        ) : null}
      </div>
    </form>
  );
}
