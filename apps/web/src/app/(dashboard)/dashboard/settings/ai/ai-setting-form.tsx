"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input } from "@/components/ui";
import { Select, FormError, PasswordInput } from "@/components/form-fields";
import {
  AI_PROVIDERS,
  AI_TONES,
  AI_LANGUAGES,
  findProvider,
} from "@/lib/ai-providers";
import type { ActionResult } from "@/lib/action-result";
import { saveAiSetting } from "./actions";

/**
 * Form pengaturan AI.
 *
 * ============================================================
 * KENAPA PILIHAN PENYEDIA, BUKAN SATU KOLOM ALAMAT
 * ============================================================
 * Operator sekolah bukan pengembang. Meminta mereka mengisi "base URL" dan
 * "nama model" dari nol akan membuat fitur ini tidak pernah dinyalakan.
 * Memilih penyedia dari daftar mengisi kedua hal itu otomatis, dan hanya
 * menyisakan SATU hal yang benar-benar perlu dicari: kunci API.
 *
 * Penyedia "Lainnya" tetap ada untuk sekolah yang punya server sendiri.
 *
 * ============================================================
 * KENAPA KUNCI TIDAK PERNAH DITAMPILKAN UTUH
 * ============================================================
 * Kunci yang dikirim ke browser ikut tercatat di riwayat jaringan dan riwayat
 * peramban operator. Yang ditampilkan hanya 4 karakter terakhir, dan kolom
 * isian selalu kosong — mengosongkannya berarti "jangan ubah kunci lama".
 */
export function AiSettingForm({
  current,
  keyLast4,
}: {
  current: {
    isActive: boolean;
    provider: string;
    model: string;
    baseUrl: string;
    tone: string;
    language: string;
  };
  keyLast4: string | null;
}) {
  const router = useRouter();
  const [provider, setProvider] = useState(current.provider);
  const [model, setModel] = useState(current.model);
  const [baseUrl, setBaseUrl] = useState(current.baseUrl);
  const [isActive, setIsActive] = useState(current.isActive);
  const [clearKey, setClearKey] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [done, setDone] = useState(false);

  const fe = (n: string) => fieldErrors[n]?.[0];
  const info = findProvider(provider);

  /** Ganti penyedia → isi ulang model & alamat dengan bawaannya. */
  function onProviderChange(id: string) {
    setProvider(id);
    const p = findProvider(id);
    setModel(p?.defaultModel ?? "");
    setBaseUrl("");
    setDone(false);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setFieldErrors({});
    setDone(false);

    const fd = new FormData(e.currentTarget);
    fd.set("provider", provider);
    fd.set("model", model);
    fd.set("baseUrl", baseUrl);
    // Checkbox yang TIDAK dicentang harus DIHAPUS dari FormData, bukan
    // dikirim sebagai "". Skema hanya menerima "on" / "true" / "false" /
    // boolean — dan "" tidak cocok dengan yang mana pun, sehingga validasi
    // selalu gagal walaupun tidak ada isian yang salah.
    fd.delete("isActive");
    fd.delete("clearApiKey");
    if (isActive) fd.set("isActive", "on");
    if (clearKey) fd.set("clearApiKey", "on");

    const res: ActionResult = await saveAiSetting(fd);
    setPending(false);

    if (res.ok) {
      setDone(true);
      setClearKey(false);
      // Kolom kunci dikosongkan setelah simpan: nilainya sudah tersimpan
      // terenkripsi, dan membiarkannya di layar hanya menambah risiko.
      const input = e.currentTarget.querySelector<HTMLInputElement>('input[name="apiKey"]');
      if (input) input.value = "";
      router.refresh();
    } else {
      setError(res.error);
      setFieldErrors(res.fieldErrors ?? {});
    }
  }

  const hasStoredKey = Boolean(keyLast4) && !clearKey;

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <FormError message={error} />
      {done ? (
        <p
          role="status"
          className="border-l-4 border-[var(--board)] bg-[var(--board)]/5 px-3 py-2 text-sm text-[var(--ink)]"
        >
          Pengaturan AI disimpan.
        </p>
      ) : null}

      {/* ---- Penyedia ---- */}
      <section className="card space-y-4">
        <h2 className="card-title">Penyedia AI</h2>
        <p className="text-sm text-slate">
          Semua penyedia di daftar ini punya kuota gratis. Mulai dari{" "}
          <strong className="text-ink">Groq</strong> bila baru mencoba.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Penyedia" htmlFor="provider" error={fe("provider")}>
            <Select
              id="provider"
              value={provider}
              onChange={(e) => onProviderChange(e.target.value)}
            >
              {AI_PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Nama model" htmlFor="model" error={fe("model")}>
            <Input
              id="model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder={info?.defaultModel || "nama-model"}
              className="font-mono"
              list="model-suggestions"
            />
          </Field>
        </div>

        {info && info.models.length > 0 ? (
          <>
            <datalist id="model-suggestions">
              {info.models.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
            <p className="text-xs text-slate">
              Saran model: {info.models.join(", ")}
            </p>
          </>
        ) : null}

        {info ? (
          <p className="border-l-4 border-[var(--chalk)] bg-paper px-3 py-2 text-xs text-slate">
            {info.note}
          </p>
        ) : null}

        <Field
          label="Alamat dasar (opsional)"
          htmlFor="baseUrl"
          error={fe("baseUrl")}
          hint={
            info?.baseUrl
              ? `Kosongkan untuk memakai bawaan: ${info.baseUrl}`
              : "Wajib diisi untuk penyedia ini."
          }
        >
          <Input
            id="baseUrl"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder={info?.baseUrl || "https://…"}
            className="font-mono"
          />
        </Field>
      </section>

      {/* ---- Kunci API ---- */}
      <section className="card space-y-4">
        <h2 className="card-title">Kunci API</h2>

        {info?.needsKey === false ? (
          <p className="text-sm text-slate">
            Penyedia ini tidak memerlukan kunci API.
          </p>
        ) : (
          <>
            {hasStoredKey ? (
              <p className="text-sm text-ink">
                Kunci tersimpan:{" "}
                <span className="font-mono text-slate">••••{keyLast4}</span>
              </p>
            ) : (
              <p className="text-sm text-slate">
                Belum ada kunci tersimpan.
              </p>
            )}

            <Field
              label={hasStoredKey ? "Ganti kunci (opsional)" : "Kunci API"}
              htmlFor="apiKey"
              error={fe("apiKey")}
              hint="Kosongkan bila tidak ingin mengubah kunci yang tersimpan."
            >
              <PasswordInput
                id="apiKey"
                name="apiKey"
                autoComplete="off"
                placeholder="tempel kunci API di sini"
                className="font-mono"
              />
            </Field>

            {hasStoredKey ? (
              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={clearKey}
                  onChange={(e) => setClearKey(e.target.checked)}
                  className="h-4 w-4 accent-board"
                />
                Hapus kunci yang tersimpan
              </label>
            ) : null}

            {info?.keyUrl ? (
              <p className="text-xs text-slate">
                Ambil kunci di{" "}
                <a
                  href={info.keyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-board underline"
                >
                  {info.keyUrl}
                </a>
              </p>
            ) : null}

            <p className="border-l-4 border-[var(--chalk)] bg-paper px-3 py-2 text-xs text-slate">
              Kunci disimpan terenkripsi dan tidak pernah dikirim kembali ke
              peramban. Yang ditampilkan hanya 4 karakter terakhir.
            </p>
          </>
        )}
      </section>

      {/* ---- Gaya tulisan ---- */}
      <section className="card space-y-4">
        <h2 className="card-title">Gaya tulisan</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nada" htmlFor="tone" error={fe("tone")}>
            <Select id="tone" name="tone" defaultValue={current.tone}>
              {AI_TONES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label} — {t.hint}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Bahasa" htmlFor="language" error={fe("language")}>
            <Select id="language" name="language" defaultValue={current.language}>
              {AI_LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </section>

      {/* ---- Status ---- */}
      <section className="card space-y-4">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-board"
          />
          <span>
            <span className="block text-sm font-medium text-ink">
              Nyalakan bantuan AI
            </span>
            <span className="mt-0.5 block text-xs text-slate">
              Bila menyala, tombol &ldquo;Tulis dengan AI&rdquo; muncul di halaman tulis berita.
            </span>
          </span>
        </label>
      </section>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Menyimpan…" : "Simpan pengaturan"}
        </Button>
      </div>
    </form>
  );
}
