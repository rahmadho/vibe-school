"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

export function YearFilterSelect({
  years,
  currentValue,
}: {
  years: Array<{ id: string; name: string; isActive: boolean }>;
  currentValue: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    const params = new URLSearchParams(searchParams.toString());
    if (val === "all") {
      params.set("academicYearId", "all");
    } else if (val) {
      params.set("academicYearId", val);
    } else {
      params.delete("academicYearId");
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <select
      value={currentValue}
      onChange={onChange}
      aria-label="Pilih tahun ajaran"
      className="h-9 rounded border border-chalk bg-white px-2.5 text-xs text-ink focus:border-board focus:outline-none"
    >
      <option value="all">Semua tahun</option>
      {years.map((y) => (
        <option key={y.id} value={y.id}>
          {y.name} {y.isActive ? "(aktif)" : ""}
        </option>
      ))}
    </select>
  );
}
