"use client";

import { useState, useTransition } from "react";
import {
  THEME_PRESETS,
  CORNER_STYLES,
  HEADING_FONTS,
  BODY_FONTS,
  contrastRatio,
  type ThemePreset,
} from "@/lib/site-themes";
import { saveTheme } from "@/app/(dashboard)/dashboard/website/actions";
import type { ActionResult } from "@/lib/action-result";

/**
 * Pemilih tema web sekolah.
 *
 * KENAPA PRESET, BUKAN PEMILIH WARNA BEBAS:
 * Kalau sekolah bebas memilih dua warna, sebagian akan menghasilkan teks abu
 * di atas latar abu — dan nama produk ini yang terlihat buruk di internet.
 * Preset sudah diuji kontrasnya. Warna khusus tetap boleh, tetapi peringatan
 * kontras ditampilkan lebih dulu.
 *
 * Pratinjau diperbarui saat operator memilih, tanpa menyimpan — supaya bisa
 * mencoba-coba tanpa mengubah web yang sedang dilihat orang tua.
 */

export function ThemePicker({
  current,
}: {
  current: {
    preset: string;
    primaryColor: string | null;
    accentColor: string | null;
    headingFont: string;
    bodyFont: string;
    cornerStyle: string;
  };
}) {
  const [preset, setPreset] = useState(current.preset);
  const [primary, setPrimary] = useState(current.primaryColor ?? "");
  const [accent, setAccent] = useState(current.accentColor ?? "");
  const [headingFont, setHeadingFont] = useState(current.headingFont);
  const [bodyFont, setBodyFont] = useState(current.bodyFont);
  const [cornerStyle, setCornerStyle] = useState(current.cornerStyle);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  const activePreset: ThemePreset =
    THEME_PRESETS.find((p) => p.key === preset) ?? THEME_PRESETS[0];

  // Warna efektif = yang diketik sekolah bila ada, kalau tidak preset.
  const effPrimary = normalizeHex(primary) ?? activePreset.primary;
  const effAccent = normalizeHex(accent) ?? activePreset.accent;

  function save() {
    const fd = new FormData();
    fd.set("preset", preset);
    fd.set("primaryColor", primary);
    fd.set("accentColor", accent);
    fd.set("headingFont", headingFont);
    fd.set("bodyFont", bodyFont);
    fd.set("cornerStyle", cornerStyle);
    startTransition(async () => setResult(await saveTheme(fd)));
  }

  return (
    <div className="space-y-6">
      <header className="border-b-2 border-[var(--ink)] pb-3">
        <h2 className="font-display text-lg font-semibold text-[var(--ink)]">
          Tema & warna
        </h2>
        <p className="mt-0.5 text-sm text-[var(--ink-soft)]">
          Pilih suasana yang paling mewakili sekolah. Semua preset sudah diperiksa
          agar teksnya mudah dibaca.
        </p>
      </header>

      {result && !result.ok && (
        <p className="border-l-4 border-red-700 bg-red-50 px-3 py-2 text-sm text-red-900">
          {result.error}
        </p>
      )}
      {result?.ok && (
        <p className="border-l-4 border-emerald-700 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          Tema tersimpan{result.message ? ` — ${result.message}` : "."}
        </p>
      )}

      {/* Pemilih preset */}
      <section>
        <h3 className="text-sm font-semibold text-[var(--ink)]">Preset suasana</h3>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {THEME_PRESETS.map((p) => {
            const selected = p.key === preset;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => setPreset(p.key)}
                aria-pressed={selected}
                className="border-2 bg-white p-3 text-left"
                style={{
                  borderColor: selected ? "var(--ink)" : "var(--rule)",
                  boxShadow: selected ? "3px 3px 0 var(--marker)" : "none",
                }}
              >
                <div className="flex items-center gap-1.5">
                  {p.swatch.map((c) => (
                    <span
                      key={c}
                      className="inline-block h-5 w-5 border border-[var(--ink)]"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                  <span className="ml-1 text-sm font-medium text-[var(--ink)]">{p.name}</span>
                </div>
                <p className="mt-1 text-[11px] leading-snug text-[var(--ink-soft)]">
                  {p.description}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Warna khusus */}
      <section className="border-2 border-[var(--rule)] bg-white p-4">
        <h3 className="text-sm font-semibold text-[var(--ink)]">
          Warna khusus <span className="font-normal text-[var(--ink-soft)]">(opsional)</span>
        </h3>
        <p className="mt-0.5 text-xs text-[var(--ink-soft)]">
          Kosongkan untuk memakai warna preset. Isi hanya bila sekolah punya warna
          resmi sendiri.
        </p>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <HexField
            label="Warna utama"
            value={primary}
            onChange={setPrimary}
            placeholder={activePreset.primary}
          />
          <HexField
            label="Warna penegas"
            value={accent}
            onChange={setAccent}
            placeholder={activePreset.accent}
          />
        </div>

        {/* Peringatan kontras — ditampilkan SEBELUM menyimpan. */}
        <ContrastWarning
          primary={effPrimary}
          text={activePreset.text}
          label="Warna utama terhadap teks"
        />
      </section>

      {/* Huruf & sudut */}
      <section className="grid gap-4 sm:grid-cols-3">
        <SelectField
          label="Huruf judul"
          value={headingFont}
          onChange={setHeadingFont}
          options={HEADING_FONTS.map((f) => ({ value: f.key, label: f.name }))}
        />
        <SelectField
          label="Huruf isi"
          value={bodyFont}
          onChange={setBodyFont}
          options={BODY_FONTS.map((f) => ({ value: f.key, label: f.name }))}
        />
        <SelectField
          label="Bentuk sudut"
          value={cornerStyle}
          onChange={setCornerStyle}
          options={CORNER_STYLES.map((c) => ({ value: c.key, label: c.name }))}
        />
      </section>

      {/* Pratinjau */}
      <section>
        <h3 className="text-sm font-semibold text-[var(--ink)]">Pratinjau</h3>
        <div
          className="mt-2 border-2 border-[var(--ink)] p-4"
          style={{ backgroundColor: activePreset.background, color: activePreset.text }}
        >
          <p
            className="text-lg font-semibold"
            style={{
              fontFamily:
                headingFont === "fraunces" ? "var(--font-fraunces), serif" : "var(--font-public-sans), sans-serif",
            }}
          >
            Selamat datang di sekolah kami
          </p>
          <p className="mt-1 text-sm" style={{ opacity: 0.75 }}>
            Ini contoh tampilan teks di web sekolah. Judul memakai huruf pilihan
            sekolah, isi memakai huruf yang lebih mudah dibaca.
          </p>
          <div className="mt-3 flex gap-2">
            <span
              className="px-3 py-1.5 text-sm font-semibold"
              style={{
                backgroundColor: effPrimary,
                color: activePreset.text,
                borderRadius: cornerStyle === "tegas" ? 0 : cornerStyle === "lembut" ? 6 : 14,
              }}
            >
              Daftar Sekarang
            </span>
            <span
              className="px-3 py-1.5 text-sm"
              style={{
                border: `2px solid ${effAccent}`,
                color: activePreset.text,
                borderRadius: cornerStyle === "tegas" ? 0 : cornerStyle === "lembut" ? 6 : 14,
              }}
            >
              Hubungi Kami
            </span>
          </div>
        </div>
      </section>

      <div className="border-t-2 border-[var(--rule)] pt-4">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="border-2 border-[var(--ink)] bg-[var(--marker)] px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          {pending ? "Menyimpan…" : "Simpan tema"}
        </button>
      </div>
    </div>
  );
}

function HexField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const isValid = value === "" || normalizeHex(value) !== null;
  return (
    <label className="block text-xs">
      <span className="font-medium text-[var(--ink)]">{label}</span>
      <div className="mt-1 flex items-center gap-2">
        <span
          className="inline-block h-8 w-8 shrink-0 border-2 border-[var(--ink)]"
          style={{ backgroundColor: normalizeHex(value) ?? placeholder }}
          aria-hidden
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full border border-[var(--rule)] bg-white px-2 py-1.5 font-mono text-sm"
          style={{ borderColor: isValid ? undefined : "#b91c1c" }}
          aria-invalid={!isValid}
        />
      </div>
      {!isValid && (
        <span className="mt-0.5 block text-[11px] text-red-800">
          Format warna tidak dikenal. Contoh: #1E40AF
        </span>
      )}
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block text-xs">
      <span className="font-medium text-[var(--ink)]">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full border border-[var(--rule)] bg-white px-2 py-1.5 text-sm"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Peringatan kontras WCAG untuk warna pilihan sekolah. */
function ContrastWarning({
  primary,
  text,
  label,
}: {
  primary: string;
  text: string;
  label: string;
}) {
  const ratio = contrastRatio(primary, text);
  // Ambang 3.0 cukup untuk elemen besar (tombol), 4.5 untuk teks biasa.
  if (ratio >= 3) return null;

  return (
    <p className="mt-3 border-l-4 border-amber-600 bg-amber-50 px-3 py-2 text-xs text-amber-900">
      <strong>Kontras rendah.</strong> {label} hanya mencapai rasio {ratio.toFixed(1)}
      :1 — teks di atas warna ini sulit dibaca, terutama di layar HP di bawah sinar
      matahari. Tetap bisa disimpan, tetapi pertimbangkan memilih warna yang lebih
      gelap atau lebih terang.
    </p>
  );
}

/** "#1e40af" atau "1e40af" atau "#fff" → "#1E40AF"; null bila tidak sah. */
function normalizeHex(input: string): string | null {
  const raw = input.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{6}$/.test(raw)) return `#${raw.toUpperCase()}`;
  // Bentuk pendek #abc → #aabbcc
  if (/^[0-9a-fA-F]{3}$/.test(raw)) {
    const [r, g, b] = raw.split("");
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return null;
}
