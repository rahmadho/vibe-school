"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import type { ActionResult } from "@/lib/action-result";
import {
  ALL_ACTIONS,
  ALL_MODULES,
  MODULE_LABEL,
  ROLE_DESCRIPTION,
  type Action,
  type Module,
} from "@/lib/rbac";
import { saveRolePermissions, resetRolePermissions } from "./actions";

/**
 * Matriks izin: role × modul × aksi.
 *
 * ============================================================
 * KENAPA MATRIKS, BUKAN SATU FORM PER ROLE
 * ============================================================
 * Pertanyaan yang sebenarnya ingin dijawab operator bukan "apa saja izin
 * bendahara?", melainkan "siapa saja yang boleh mengubah tagihan?". Keduanya
 * bentuknya berbeda: yang pertama daftar, yang kedua TABEL. Dengan matriks,
 * jawabannya terbaca dengan menyusuri satu kolom ke bawah — tanpa membuka
 * apa pun.
 *
 * ============================================================
 * KENAPA AKSI DITAMPILKAN SEBAGAI HURUF, BUKAN CENTANG
 * ============================================================
 * Satu sel berisi LIMA aksi (lihat, tambah, ubah, hapus, kelola). Lima kotak
 * centang di dalam satu sel berarti 135 kotak di satu layar — dan mata manusia
 * tidak bisa menyusuri itu. Hurufnya ringkas (`L T U H K`), bisa dipindai
 * cepat, dan keterangannya muncul saat disorot.
 *
 * ============================================================
 * KENAPA PERLU TOMBOL "KEMBALIKAN KE BAWAAN"
 * ============================================================
 * Penimpaan bisa mencabut izin. Tanpa jalan pulang, operator yang salah
 * mencentang harus menebak nilai bawaan satu per satu. Tombol ini menghapus
 * seluruh penimpaan role itu, sehingga benar-benar kembali mengikuti kode.
 */

const ACTION_LETTER: Record<Action, string> = {
  read: "L",
  create: "T",
  update: "U",
  delete: "H",
  manage: "K",
};

const ACTION_LABEL: Record<Action, string> = {
  read: "Lihat",
  create: "Tambah",
  update: "Ubah",
  delete: "Hapus",
  manage: "Kelola (semua aksi)",
};

type Matrix = Record<string, Record<string, Action[]>>;

export function PermissionMatrix({
  roles,
  modules,
  defaults,
  overrides,
}: {
  /** Role yang boleh diatur sekolah (tanpa SUPER_ADMIN). */
  roles: { role: string; label: string }[];
  /** Modul yang ditampilkan; `schools`/`billing` disembunyikan dari sekolah. */
  modules: Module[];
  /** Izin bawaan dari kode: `{ role: { module: actions[] } }`. */
  defaults: Matrix;
  /** Penimpaan tersimpan: `{ role: { module: actions[] } }`. */
  overrides: Matrix;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [activeRole, setActiveRole] = useState(roles[0]?.role ?? "SCHOOL_ADMIN");
  const [draft, setDraft] = useState<Matrix>(() => buildInitial(roles, modules, defaults, overrides));
  const [result, setResult] = useState<ActionResult | null>(null);

  /** Apakah sel ini berbeda dari bawaan? Dipakai untuk menandai "diubah". */
  const isChanged = useMemo(() => {
    const out: Record<string, Set<string>> = {};
    for (const { role } of roles) {
      const set = new Set<string>();
      for (const m of modules) {
        const now = draft[role]?.[m] ?? [];
        const base = defaults[role]?.[m] ?? [];
        if (!same(now, base)) set.add(m);
      }
      out[role] = set;
    }
    return out;
  }, [draft, roles, modules, defaults]);

  function toggle(role: string, module: Module, action: Action) {
    setResult(null);
    setDraft((prev) => {
      const current = prev[role]?.[module] ?? [];
      let next: Action[];

      if (action === "manage") {
        // "Kelola" mencakup semuanya. Menyalakannya berarti seluruh aksi lain
        // ikut menyala; mematikannya mengosongkan sel.
        next = current.includes("manage") ? [] : ["manage"];
      } else {
        const withoutManage = current.filter((a) => a !== "manage");
        next = withoutManage.includes(action)
          ? withoutManage.filter((a) => a !== action)
          : [...withoutManage, action];
      }

      return {
        ...prev,
        [role]: { ...(prev[role] ?? {}), [module]: next },
      };
    });
  }

  function save() {
    const entries = modules.map((m) => ({
      module: m,
      actions: draft[activeRole]?.[m] ?? [],
    }));

    startTransition(async () => {
      const r = await saveRolePermissions(activeRole, entries);
      setResult(r);
      if (r.ok) router.refresh();
    });
  }

  function reset() {
    startTransition(async () => {
      const r = await resetRolePermissions(activeRole);
      setResult(r);
      if (r.ok) {
        // Muat ulang dari server supaya draft benar-benar kembali ke bawaan,
        // bukan sekadar menampilkan nilai yang kita tebak.
        setDraft((prev) => {
          const next = { ...prev };
          const copy: Record<string, Action[]> = {};
          for (const m of modules) copy[m] = [...(defaults[activeRole]?.[m] ?? [])];
          next[activeRole] = copy;
          return next;
        });
        router.refresh();
      }
    });
  }

  const changedCount = isChanged[activeRole]?.size ?? 0;
  const roleInfo = roles.find((r) => r.role === activeRole);

  /**
   * Apakah perubahan yang belum disimpan akan mengunci semua role dari
   * mengelola pengguna?
   *
   * Dihitung di sini juga — bukan hanya di server — supaya operator tahu
   * SEBELUM menekan simpan, bukan sesudah ditolak. Server tetap memeriksa
   * ulang: pemeriksaan di peramban bisa dilewati, dan gerbang sebenarnya ada
   * di sana.
   */
  const willLockOut = useMemo(() => {
    let anyCanManage = false;
    for (const { role } of roles) {
      const actions = draft[role]?.users ?? [];
      const manages = actions.includes("manage");
      if (manages) anyCanManage = true;
    }
    return !anyCanManage;
  }, [draft, roles]);

  return (
    <div className="space-y-4">
      {/* ---- Pemilih role ---- */}
      <div className="flex flex-wrap gap-1.5">
        {roles.map((r) => {
          const changed = (isChanged[r.role]?.size ?? 0) > 0;
          const active = r.role === activeRole;
          return (
            <button
              key={r.role}
              type="button"
              onClick={() => {
                setActiveRole(r.role);
                setResult(null);
              }}
              aria-pressed={active}
              className={[
                "border px-3 py-1.5 text-sm transition-colors",
                active
                  ? "border-[var(--ink)] bg-[var(--ink)] text-white"
                  : "border-[var(--chalk)] bg-white text-[var(--ink)] hover:border-[var(--slate)]",
              ].join(" ")}
            >
              {r.label}
              {changed ? (
                <span
                  aria-label="diubah dari bawaan"
                  title="Diubah dari bawaan"
                  className={[
                    "ml-2 inline-block h-1.5 w-1.5 rounded-full",
                    active ? "bg-[var(--marker)]" : "bg-[var(--marker)]",
                  ].join(" ")}
                />
              ) : null}
            </button>
          );
        })}
      </div>

      {/* ---- Keterangan role ---- */}
      {roleInfo ? (
        <p className="border-l-4 border-[var(--chalk)] bg-[var(--paper)] px-3 py-2 text-sm text-[var(--slate)]">
          {ROLE_DESCRIPTION[activeRole as keyof typeof ROLE_DESCRIPTION]}
        </p>
      ) : null}

      {/* ---- Matriks ---- */}
      <div className="overflow-x-auto border-2 border-[var(--chalk)] bg-white">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-[var(--ink)]">
              <th className="sticky left-0 z-10 bg-white px-3 py-2 text-left font-semibold text-[var(--ink)]">
                Modul
              </th>
              {ALL_ACTIONS.map((a) => (
                <th
                  key={a}
                  className="w-12 px-1 py-2 text-center text-xs font-medium text-[var(--slate)]"
                  title={ACTION_LABEL[a]}
                >
                  {ACTION_LETTER[a]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {modules.map((m) => {
              const actions = draft[activeRole]?.[m] ?? [];
              const changed = isChanged[activeRole]?.has(m);
              const base = defaults[activeRole]?.[m] ?? [];

              return (
                <tr
                  key={m}
                  className={[
                    // Garis pemisah antar baris: tanpa ini, mata mudah
                    // bergeser satu baris dan izin terpasang ke modul yang
                    // salah — kesalahannya tidak terlihat sampai ada yang
                    // mencoba mengakses modul itu.
                    "border-b border-[var(--chalk)]",
                    // Baris terakhir tidak perlu garis ganda dengan bingkai.
                    "last:border-b-0",
                    changed ? "bg-[var(--marker)]/5" : "",
                  ].join(" ")}
                >
                  <td className="sticky left-0 z-10 bg-inherit px-3 py-1.5">
                    <span className="text-[var(--ink)]">{MODULE_LABEL[m]}</span>
                    {changed ? (
                      <span className="mt-0.5 block text-[11px] text-[var(--slate)]">
                        bawaan:{" "}
                        {base.length === 0
                          ? "tidak ada akses"
                          : base.map((a) => ACTION_LABEL[a]).join(", ")}
                      </span>
                    ) : null}
                  </td>

                  {ALL_ACTIONS.map((a) => {
                    // Bila "Kelola" menyala, aksi lain dianggap ikut menyala —
                    // ditampilkan redup agar operator tahu mengapa.
                    const on = actions.includes(a);
                    const coveredByManage = actions.includes("manage") && a !== "manage";
                    const disabled = coveredByManage;

                    return (
                      <td key={a} className="px-1 py-1.5 text-center">
                        <input
                          type="checkbox"
                          checked={on || coveredByManage}
                          disabled={disabled || pending}
                          onChange={() => toggle(activeRole, m, a)}
                          aria-label={`${MODULE_LABEL[m]} — ${ACTION_LABEL[a]}`}
                          title={`${ACTION_LABEL[a]}${coveredByManage ? " (tercakup oleh Kelola)" : ""}`}
                          className={[
                            "h-4 w-4 accent-[var(--board)]",
                            coveredByManage ? "opacity-40" : "",
                          ].join(" ")}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ---- Keterangan huruf ---- */}
      <p className="text-xs text-[var(--slate)]">
        {ALL_ACTIONS.map((a) => `${ACTION_LETTER[a]} = ${ACTION_LABEL[a]}`).join(" · ")}
      </p>

      {/* ---- Peringatan penguncian diri ---- */}
      {willLockOut ? (
        <div
          role="alert"
          className="border-l-4 border-[var(--marker)] bg-red-50 px-4 py-3"
        >
          <p className="text-sm font-medium text-red-900">
            Tidak ada satu pun peran yang bisa mengelola pengguna
          </p>
          <p className="mt-1 text-xs text-red-900">
            Halaman Hak Akses dibuka dengan izin <strong>Kelola Pengguna</strong>.
            Bila disimpan dalam keadaan ini, tidak ada seorang pun di sekolah
            yang bisa membukanya lagi — pemulihannya harus lewat Super Admin.
            Sisakan minimal satu peran dengan kotak{" "}
            <strong>K</strong> pada baris <strong>Pengguna</strong>.
          </p>
        </div>
      ) : null}

      {/* ---- Aksi ---- */}
      <div className="flex flex-wrap items-center gap-3 border-t border-[var(--chalk)] pt-4">
        <Button type="button" onClick={save} disabled={pending || willLockOut}>
          {pending ? "Menyimpan…" : `Simpan izin ${roleInfo?.label ?? ""}`}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={reset}
          disabled={pending || changedCount === 0}
        >
          Kembalikan ke bawaan
        </Button>

        {changedCount > 0 ? (
          <span className="text-xs text-[var(--slate)]">
            {changedCount} modul diubah
          </span>
        ) : (
          <span className="text-xs text-[var(--slate)]">Masih memakai bawaan</span>
        )}

        {result && !result.ok ? (
          <span role="alert" className="text-sm text-[var(--marker)]">
            {result.error}
          </span>
        ) : null}
        {result?.ok ? (
          <span role="status" className="text-sm text-[var(--board)]">
            {result.message}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/* ============================================================
 * PEMBANTU
 * ============================================================ */

/** Susun draft awal: penimpaan bila ada, bawaan bila tidak. */
function buildInitial(
  roles: { role: string }[],
  modules: Module[],
  defaults: Matrix,
  overrides: Matrix,
): Matrix {
  const out: Matrix = {};
  for (const { role } of roles) {
    const perModule: Record<string, Action[]> = {};
    for (const m of modules) {
      perModule[m] = Object.hasOwn(overrides[role] ?? {}, m)
        ? [...(overrides[role][m] ?? [])]
        : [...(defaults[role]?.[m] ?? [])];
    }
    out[role] = perModule;
  }
  return out;
}

/** Bandingkan dua daftar aksi tanpa memedulikan urutan. */
function same(a: Action[], b: Action[]): boolean {
  if (a.length !== b.length) return false;
  const sb = new Set(b);
  return a.every((x) => sb.has(x));
}
