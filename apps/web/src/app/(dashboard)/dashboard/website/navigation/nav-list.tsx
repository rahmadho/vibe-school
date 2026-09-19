"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createNavItem,
  deleteNavItem,
  moveNavItem,
  updateNavItem,
} from "@/app/(dashboard)/dashboard/website/actions";
import type { ActionResult } from "@/lib/action-result";

/**
 * Editor menu navigasi.
 *
 * Header dan footer DIPISAH karena pengunjung mencarinya di tempat berbeda:
 * menu utama memandu ke isi penting, menu footer biasanya berisi tautan
 * sekunder (kebijakan, kontak). Urutan diatur tombol naik/turun.
 */

type Area = "header" | "footer";

export type NavRow = {
  id: string;
  label: string;
  href: string;
  area: Area;
  order: number;
  isExternal: boolean;
  onlyIfSpmb: boolean;
};

export function NavList({
  header,
  footer,
}: {
  header: NavRow[];
  footer: NavRow[];
}) {
  const [addingArea, setAddingArea] = useState<Area | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="space-y-8">
      <header className="border-b-2 border-[var(--ink)] pb-3">
        <h2 className="font-display text-lg font-semibold text-[var(--ink)]">
          Menu navigasi
        </h2>
        <p className="mt-0.5 text-sm text-[var(--slate)]">
          Susun tautan yang tampil di bagian atas (header) dan bawah (footer)
          halaman web. Urutan di sini menentukan urutan di web.
        </p>
      </header>

      <AreaSection
        area="header"
        title="Menu atas (header)"
        description="Tautan utama yang paling sering diklik pengunjung."
        items={header}
        adding={addingArea === "header"}
        editingId={editingId}
        onToggleAdd={() => setAddingArea((a) => (a === "header" ? null : "header"))}
        onEdit={setEditingId}
        onAddDone={() => setAddingArea(null)}
      />

      <AreaSection
        area="footer"
        title="Menu bawah (footer)"
        description="Tautan sekunder — mis. kebijakan, kontak, peta situs."
        items={footer}
        adding={addingArea === "footer"}
        editingId={editingId}
        onToggleAdd={() => setAddingArea((a) => (a === "footer" ? null : "footer"))}
        onEdit={setEditingId}
        onAddDone={() => setAddingArea(null)}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function AreaSection({
  area,
  title,
  description,
  items,
  adding,
  editingId,
  onToggleAdd,
  onEdit,
  onAddDone,
}: {
  area: Area;
  title: string;
  description: string;
  items: NavRow[];
  adding: boolean;
  editingId: string | null;
  onToggleAdd: () => void;
  onEdit: (id: string | null) => void;
  onAddDone: () => void;
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-[var(--ink)]">{title}</h3>
          <p className="mt-0.5 text-xs text-[var(--slate)]">{description}</p>
        </div>
        <button
          type="button"
          onClick={onToggleAdd}
          className="border-2 border-[var(--ink)] bg-[var(--marker)] px-3 py-1.5 text-sm font-semibold text-[var(--ink)]"
        >
          {adding ? "Tutup" : "Tambah menu"}
        </button>
      </div>

      {adding && <NavForm mode="create" area={area} onDone={onAddDone} onCancel={onAddDone} />}

      {items.length === 0 && !adding && (
        <div className="border-2 border-dashed border-[var(--chalk)] px-4 py-6 text-center">
          <p className="text-sm text-[var(--slate)]">
            Belum ada menu di bagian ini.
          </p>
        </div>
      )}

      <ol className="space-y-2">
        {items.map((item, index) => {
          const isEditing = editingId === item.id;
          return (
            <li key={item.id} className="border-2 border-[var(--chalk)] bg-white">
              <div className="flex items-center gap-2 p-3">
                <NavControls id={item.id} index={index} total={items.length} />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-[var(--ink)]">
                      {item.label}
                    </span>
                    {item.onlyIfSpmb && (
                      <span className="border border-[var(--chalk)] bg-[var(--paper)] px-1.5 py-0.5 text-[11px] text-[var(--slate)]">
                        hanya saat SPMB buka
                      </span>
                    )}
                    {item.isExternal && (
                      <span className="border border-[var(--chalk)] bg-[var(--paper)] px-1.5 py-0.5 text-[11px] text-[var(--slate)]">
                        tautan luar
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate font-mono text-xs text-[var(--slate)]">
                    {item.href}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onEdit(isEditing ? null : item.id)}
                    className="border border-[var(--chalk)] px-2 py-0.5 text-xs hover:border-[var(--ink)]"
                  >
                    {isEditing ? "Tutup" : "Ubah"}
                  </button>
                  <DeleteNavButton id={item.id} label={item.label} />
                </div>
              </div>

              {isEditing && (
                <div className="border-t border-dashed border-[var(--chalk)] bg-[var(--paper)] p-3">
                  <NavForm
                    mode="edit"
                    area={area}
                    initial={item}
                    onDone={() => onEdit(null)}
                    onCancel={() => onEdit(null)}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** Tombol naik/turun — pergerakan ditangani server agar urutan selalu rapat. */
function NavControls({
  id,
  index,
  total,
}: {
  id: string;
  index: number;
  total: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function move(direction: "up" | "down") {
    const fd = new FormData();
    fd.set("id", id);
    fd.set("direction", direction);
    startTransition(async () => {
      await moveNavItem(fd);
      router.refresh();
    });
  }

  return (
    <div className="flex shrink-0 flex-col gap-1">
      <button
        type="button"
        onClick={() => move("up")}
        disabled={pending || index === 0}
        aria-label="Naikkan menu"
        className="border border-[var(--chalk)] px-2 py-0.5 text-xs disabled:opacity-30"
      >
        ↑
      </button>
      <button
        type="button"
        onClick={() => move("down")}
        disabled={pending || index === total - 1}
        aria-label="Turunkan menu"
        className="border border-[var(--chalk)] px-2 py-0.5 text-xs disabled:opacity-30"
      >
        ↓
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function NavForm({
  mode,
  area,
  initial,
  onDone,
  onCancel,
}: {
  mode: "create" | "edit";
  area: Area;
  initial?: NavRow;
  onDone: () => void;
  onCancel: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  const [label, setLabel] = useState(initial?.label ?? "");
  const [href, setHref] = useState(initial?.href ?? "");
  const [isExternal, setIsExternal] = useState(initial?.isExternal ?? false);
  const [onlyIfSpmb, setOnlyIfSpmb] = useState(initial?.onlyIfSpmb ?? false);

  const fe = (n: string) => (!result || result.ok ? undefined : result.fieldErrors?.[n]?.[0]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData();
    if (mode === "edit" && initial) fd.set("id", initial.id);
    fd.set("label", label);
    fd.set("href", href.trim());
    fd.set("area", area);
    fd.set("order", String(initial?.order ?? 0));
    fd.set("isExternal", isExternal ? "on" : "");
    fd.set("onlyIfSpmb", onlyIfSpmb ? "on" : "");

    startTransition(async () => {
      const r = mode === "create" ? await createNavItem(fd) : await updateNavItem(fd);
      setResult(r);
      if (r.ok) {
        router.refresh();
        onDone();
      }
    });
  }

  const looksExternal = /^https?:\/\//i.test(href.trim());

  return (
    <form
      onSubmit={onSubmit}
      className={
        mode === "create"
          ? "border-2 border-[var(--ink)] bg-white p-4"
          : "space-y-3"
      }
      noValidate
    >
      <h4 className="text-sm font-semibold text-[var(--ink)]">
        {mode === "create" ? "Menu baru" : "Ubah menu"}
        <span className="ml-2 font-normal text-[var(--slate)]">
          {area === "header" ? "header" : "footer"}
        </span>
      </h4>

      {result && !result.ok && (
        <p className="mt-2 border-l-4 border-red-700 bg-red-50 px-3 py-2 text-sm text-red-900">
          {result.error}
        </p>
      )}

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Nama menu" error={fe("label")}>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Profil"
            maxLength={40}
            className="w-full border border-[var(--chalk)] bg-white px-2 py-1.5 text-sm"
          />
        </Field>

        <Field
          label="Tujuan"
          hint="Halaman internal diawali “/” (mis. /profil) atau alamat lengkap https://… untuk tautan luar."
          error={fe("href")}
        >
          <input
            type="text"
            value={href}
            onChange={(e) => setHref(e.target.value)}
            placeholder="/profil"
            className="w-full border border-[var(--chalk)] bg-white px-2 py-1.5 font-mono text-sm"
          />
        </Field>
      </div>

      <fieldset className="mt-3 flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm text-[var(--ink)]">
          <input
            type="checkbox"
            checked={isExternal}
            onChange={(e) => setIsExternal(e.target.checked)}
          />
          Buka di tab baru
        </label>
        <label className="flex items-center gap-2 text-sm text-[var(--ink)]">
          <input
            type="checkbox"
            checked={onlyIfSpmb}
            onChange={(e) => setOnlyIfSpmb(e.target.checked)}
          />
          Tampilkan hanya saat SPMB dibuka
        </label>
      </fieldset>

      {looksExternal && !isExternal && (
        <p className="mt-2 border-l-4 border-amber-600 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Tautan ini menuju web luar. Pertimbangkan menyalakan “Buka di tab baru”
          agar pengunjung tidak meninggalkan web sekolah.
        </p>
      )}

      <div className="mt-4 flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="border-2 border-[var(--ink)] bg-[var(--marker)] px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
        >
          {pending
            ? "Menyimpan…"
            : mode === "create"
              ? "Tambah menu"
              : "Simpan perubahan"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="border-2 border-[var(--chalk)] bg-white px-3 py-1.5 text-sm disabled:opacity-50"
        >
          Batal
        </button>
      </div>
    </form>
  );
}

function DeleteNavButton({ id, label }: { id: string; label: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  function remove() {
    const fd = new FormData();
    fd.set("id", id);
    startTransition(async () => {
      await deleteNavItem(fd);
      setConfirming(false);
      router.refresh();
    });
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-xs text-red-800 underline"
      >
        Hapus
      </button>
    );
  }

  return (
    <span className="flex items-center gap-1 text-xs">
      <span className="text-[var(--slate)]">Hapus “{label}”?</span>
      <button
        type="button"
        onClick={remove}
        disabled={pending}
        className="border border-red-700 px-1.5 py-0.5 text-red-800 disabled:opacity-50"
      >
        {pending ? "…" : "Ya"}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        disabled={pending}
        className="border border-[var(--chalk)] px-1.5 py-0.5"
      >
        Batal
      </button>
    </span>
  );
}

/* ------------------------------------------------------------------ */

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-xs">
      <span className="font-medium text-[var(--ink)]">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && !error && (
        <span className="mt-1 block text-[11px] leading-snug text-[var(--slate)]">
          {hint}
        </span>
      )}
      {error && <span className="mt-1 block text-[11px] text-red-800">{error}</span>}
    </label>
  );
}
