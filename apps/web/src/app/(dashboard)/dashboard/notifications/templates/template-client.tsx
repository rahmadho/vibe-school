"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input } from "@/components/ui";
import { Select, FormError, FormSuccess } from "@/components/form-fields";
import {
  TEMPLATE_CATEGORIES,
  TEMPLATE_CATEGORY_LABEL,
  type TemplateCategoryValue,
} from "@/lib/validations/notification";
import { renderTemplate, extractVariables } from "@/lib/notification";
import { SAMPLE_VARS } from "@/lib/templates-seed";
import { createTemplate, updateTemplate, deleteTemplate, importSeedTemplates } from "../actions";

export type TemplateData = {
  id: string;
  key: string;
  name: string;
  category: string;
  body: string;
  description: string | null;
  isActive: boolean;
};

export function TemplateForm({
  initial,
  onDone,
}: {
  initial?: TemplateData;
  onDone?: () => void;
}) {
  const [body, setBody] = useState(initial?.body ?? "");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const vars = useMemo(() => extractVariables(body), [body]);
  const preview = useMemo(() => renderTemplate(body, SAMPLE_VARS), [body]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    setSuccess(null);
    start(async () => {
      const res = initial
        ? await updateTemplate(fd)
        : await createTemplate(fd);
      if (res.ok) {
        setSuccess(res.message ?? "Tersimpan.");
        router.refresh();
        if (!initial) {
          setBody("");
          onDone?.();
        }
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {initial && <input type="hidden" name="id" value={initial.id} />}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nama template" htmlFor="t-name">
          <Input
            id="t-name"
            name="name"
            defaultValue={initial?.name}
            placeholder="Pemberitahuan alpa"
            required
          />
        </Field>

        <Field label="Kunci teknis" htmlFor="t-key">
          <Input
            id="t-key"
            name="key"
            defaultValue={initial?.key}
            placeholder="attendance.absent"
            pattern="[a-z0-9_.]+"
            title="Huruf kecil, angka, titik, dan garis bawah"
            required
          />
        </Field>

        <Field label="Kategori" htmlFor="t-cat">
          <Select
            id="t-cat"
            name="category"
            defaultValue={initial?.category ?? "GENERAL"}
          >
            {TEMPLATE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {TEMPLATE_CATEGORY_LABEL[c as TemplateCategoryValue]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Keterangan (opsional)" htmlFor="t-desc">
          <Input
            id="t-desc"
            name="description"
            defaultValue={initial?.description ?? ""}
            placeholder="Kapan pesan ini dikirim"
          />
        </Field>
      </div>

      <Field label="Isi pesan" htmlFor="t-body">
        <textarea
          id="t-body"
          name="body"
          rows={8}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="w-full rounded-md border border-chalk bg-paper px-3 py-2 font-mono text-sm text-ink"
          required
        />
      </Field>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={initial?.isActive ?? true}
            className="h-4 w-4 rounded border-chalk"
          />
          Aktifkan template ini
        </label>
      </div>

      {vars.length > 0 && (
        <div className="rounded-md border border-chalk bg-board/40 p-3">
          <p className="text-xs font-medium text-ink">Variabel terpakai</p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {vars.map((v) => (
              <code
                key={v}
                className="rounded bg-paper px-1.5 py-0.5 text-[11px] text-slate"
              >
                {`{{${v}}}`}
                {SAMPLE_VARS[v] ? "" : " ⚠ belum ada contoh"}
              </code>
            ))}
          </div>
        </div>
      )}

      {body.trim() && (
        <div className="rounded-md border border-chalk bg-paper p-3">
          <p className="text-xs font-medium text-ink">Pratinjau</p>
          <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-slate">
            {preview || "…"}
          </pre>
        </div>
      )}

      <FormError message={error} />
      <FormSuccess message={success} />

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Menyimpan…" : initial ? "Simpan perubahan" : "Buat template"}
        </Button>
        {onDone && (
          <Button type="button" variant="secondary" onClick={onDone}>
            Tutup
          </Button>
        )}
      </div>
    </form>
  );
}

/** Baris tabel template dengan aksi edit/hapus. */
export function TemplateRow({ t }: { t: TemplateData }) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  if (editing) {
    return (
      <div className="border-t border-chalk bg-board/20 p-4">
        <TemplateForm initial={t} onDone={() => setEditing(false)} />
      </div>
    );
  }

  return (
    <div className="border-t border-chalk px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-ink">{t.name}</span>
            {!t.isActive && (
              <span className="rounded bg-board px-1.5 py-0.5 text-[10px] uppercase text-slate">
                nonaktif
              </span>
            )}
          </div>
          <code className="mt-0.5 block text-[11px] text-slate">{t.key}</code>
          {t.description && (
            <p className="mt-1 text-xs text-slate">{t.description}</p>
          )}
          <p className="mt-1.5 line-clamp-2 whitespace-pre-wrap text-xs text-slate/80">
            {t.body}
          </p>
        </div>

        <div className="flex flex-shrink-0 gap-1.5">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setEditing(true)}
          >
            Ubah
          </Button>
          {confirming ? (
            <>
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={() => {
                  start(async () => {
                    const res = await deleteTemplate(t.id);
                    if (!res.ok) setError(res.error);
                    else router.refresh();
                  });
                }}
              >
                Yakin hapus
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setConfirming(false)}
              >
                Batal
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="secondary"
              onClick={() => setConfirming(true)}
            >
              Hapus
            </Button>
          )}
        </div>
      </div>
      {error && <p className="mt-1 text-xs text-marker">{error}</p>}
    </div>
  );
}

/** Tombol impor template bawaan. */
export function ImportSeedButton({ missing }: { missing: number }) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <div className="space-y-2">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          setError(null);
          setSuccess(null);
          start(async () => {
            const res = await importSeedTemplates(fd);
            if (res.ok) {
              setSuccess(res.message ?? "Impor selesai.");
              router.refresh();
            } else setError(res.error);
          });
        }}
      >
        <Button type="submit" disabled={pending}>
          {pending
            ? "Mengimpor…"
            : `Impor template bawaan${missing > 0 ? ` (${missing})` : ""}`}
        </Button>
      </form>
      <FormError message={error} />
      <FormSuccess message={success} />
    </div>
  );
}
