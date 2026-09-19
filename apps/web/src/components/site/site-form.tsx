"use client";

import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

/**
 * Komponen formulir untuk halaman PUBLIK.
 *
 * Dipisah dari `components/ui/index.tsx` (yang berwarna papan tulis untuk
 * dasbor) karena web sekolah memakai warna sekolah sendiri melalui CSS
 * variable `--site-*`. Kalau memakai komponen dasbor, formulir pendaftaran
 * akan berwarna hijau papan tulis di sekolah yang temanya biru — terlihat
 * seperti halaman asing.
 *
 * Ini satu-satunya berkas client untuk halaman publik; seluruhnya memakai
 * elemen HTML asli tanpa pustaka tambahan.
 */

/* ============================================================
 * PEMBUNGKUS FIELD
 * ============================================================ */

export function SiteField({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium text-[var(--site-text)]"
      >
        {label}
        {required ? <span className="ml-0.5 text-[var(--site-accent)]">*</span> : null}
      </label>
      {children}
      {hint && !error ? (
        <p className="text-xs text-[var(--site-muted)]">{hint}</p>
      ) : null}
      {error ? (
        <p className="text-xs font-medium text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/* ============================================================
 * KENDALI INPUT
 * ============================================================ */

const controlClass =
  "w-full border border-[var(--site-border)] bg-[var(--site-surface)] px-3 py-2 text-sm " +
  "text-[var(--site-text)] placeholder:text-[var(--site-muted)] " +
  "focus:outline focus:outline-2 focus:outline-offset-0 focus:outline-[var(--site-primary)]";

type CommonProps = {
  error?: boolean;
};

export function SiteInput({
  error,
  className,
  style,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & CommonProps) {
  return (
    <input
      className={`${controlClass} ${error ? "border-red-500" : ""} ${className ?? ""}`}
      style={{ borderRadius: "var(--site-radius-button)", ...style }}
      {...props}
    />
  );
}

export function SiteTextarea({
  error,
  className,
  style,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & CommonProps) {
  return (
    <textarea
      className={`${controlClass} ${error ? "border-red-500" : ""} ${className ?? ""}`}
      style={{ borderRadius: "var(--site-radius-button)", ...style }}
      rows={3}
      {...props}
    />
  );
}

export function SiteSelect({
  error,
  className,
  style,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & CommonProps) {
  return (
    <select
      className={`${controlClass} ${error ? "border-red-500" : ""} ${className ?? ""}`}
      style={{ borderRadius: "var(--site-radius-button)", ...style }}
      {...props}
    >
      {children}
    </select>
  );
}

/* ============================================================
 * TOMBOL
 * ============================================================ */

export function SiteSubmitButton({
  children,
  pending,
  variant = "primary",
}: {
  children: ReactNode;
  pending?: boolean;
  variant?: "primary" | "accent";
}) {
  const look =
    variant === "accent"
      ? "bg-[var(--site-accent)] text-[var(--site-accent-text)]"
      : "bg-[var(--site-primary)] text-[var(--site-primary-text)]";

  return (
    <button
      type="submit"
      disabled={pending}
      className={`inline-flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 ${look}`}
      style={{ borderRadius: "var(--site-radius-button)" }}
    >
      {pending ? "Mengirim…" : children}
    </button>
  );
}

/* ============================================================
 * PESAN KESALAHAN / SUKSES
 * ============================================================ */

export function SiteErrorBanner({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"
      style={{ borderRadius: "var(--site-radius-card)" }}
    >
      {message}
    </div>
  );
}

export function SiteSuccessBanner({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div
      className="border border-green-300 bg-green-50 px-4 py-4 text-sm text-green-900"
      style={{ borderRadius: "var(--site-radius-card)" }}
    >
      <p className="font-semibold">{title}</p>
      {children ? <div className="mt-1.5 leading-relaxed">{children}</div> : null}
    </div>
  );
}

/* ============================================================
 * JUDUL BAGIAN DALAM FORMULIR
 * ============================================================ */

export function FormSectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="font-[family-name:var(--site-heading-font)] text-lg font-bold text-[var(--site-text)]">
      {children}
    </h2>
  );
}
