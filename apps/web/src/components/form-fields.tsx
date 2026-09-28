"use client";

import { useState } from "react";
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cx, Input } from "./ui";

/* ============================================================
 * Form fields tambahan — melengkapi ui/index.tsx
 * ============================================================ */

export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <select
      className={cx(
        "h-10 w-full appearance-none rounded border border-chalk bg-white px-3 text-sm",
        "bg-[length:1rem] bg-[right_0.6rem_center] bg-no-repeat pr-9",
        "focus:border-board focus:outline-none focus:ring-1 focus:ring-board",
        className,
      )}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364748B' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
      }}
      {...props}
    >
      {children}
    </select>
  );
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cx(
        "min-h-[80px] w-full rounded border border-chalk bg-white px-3 py-2 text-sm",
        "placeholder:text-slate-light",
        "focus:border-board focus:outline-none focus:ring-1 focus:ring-board",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Input password dengan tombol "tampilkan/sembunyikan".
 * Perilaku tetap seperti <Input> biasa — hanya menambahkan toggle tipe
 * password <-> text dan ikon mata di sisi kanan. Nilai tetap dikirim ke
 * server lewat name/onChange yang sama, jadi tidak ada perubahan di form.
 */
export function PasswordInput({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        {...props}
        type={visible ? "text" : "password"}
        // pr-10 agar teks tidak tertutup tombol ikon di kanan.
        className={cx("pr-10", className)}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        // aria-label dipakai pembaca layar; aria-pressed menandai status aktif.
        aria-label={visible ? "Sembunyikan sandi" : "Tampilkan sandi"}
        aria-pressed={visible}
        title={visible ? "Sembunyikan sandi" : "Tampilkan sandi"}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate hover:text-ink focus:outline-none focus-visible:text-ink"
        tabIndex={-1}
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c6.5 0 10 8 10 8a17.6 17.6 0 0 1-3.16 4.19" />
      <path d="M6.61 6.61A17.6 17.6 0 0 0 2 12s3.5 8 10 8a9.12 9.12 0 0 0 4.24-.9" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <path d="m2 2 20 20" />
    </svg>
  );
}

/** Pesan galat tingkat-form (bukan per-field). */
export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="rounded border border-marker/30 bg-marker/5 px-3 py-2 text-sm text-marker"
    >
      {message}
    </div>
  );
}

/** Pesan sukses. */
export function FormSuccess({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div
      role="status"
      className="rounded border border-board/30 bg-board/5 px-3 py-2 text-sm text-board"
    >
      {message}
    </div>
  );
}
