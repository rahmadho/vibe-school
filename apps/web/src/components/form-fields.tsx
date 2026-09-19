"use client";

import type { ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cx } from "./ui";

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
