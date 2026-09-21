import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

/** Menggabungkan className tanpa dependensi (pengganti clsx). */
export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/* ============================================================
 * Button — radius & warna mengikuti hierarki, bukan seragam.
 * Hijau papan tulis (board) HANYA untuk aksi utama.
 * ============================================================ */
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 font-medium transition-colors " +
    "disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap";
  const sizes = {
    sm: "h-8 px-3 text-sm rounded",
    md: "h-10 px-4 text-sm rounded",
  };
  const variants = {
    primary: "bg-board text-white hover:bg-board-dark",
    secondary: "bg-white text-ink border border-chalk hover:bg-chalk/40",
    ghost: "text-slate hover:text-ink hover:bg-chalk/40",
    danger: "bg-marker text-white hover:opacity-90",
  };
  return (
    <button
      className={cx(base, sizes[size], variants[variant], className)}
      {...props}
    />
  );
}

/* ============================================================
 * Input + Field
 * ============================================================ */
type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cx(
        "h-10 w-full rounded border border-chalk bg-white px-3 text-sm",
        "placeholder:text-slate-light",
        "focus:border-board focus:outline-none focus:ring-1 focus:ring-board",
        className,
      )}
      {...props}
    />
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  /** Penjelasan singkat di bawah kolom — disembunyikan bila ada galat. */
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {hint && !error ? (
        <p className="text-xs leading-snug text-slate">{hint}</p>
      ) : null}
      {error ? (
        <p className="text-sm text-marker" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/* ============================================================
 * Card + statistik
 * ============================================================ */
export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cx("card", className)}>{children}</div>;
}

/**
 * Angka penting pakai Fraunces (display) — ciri khas sistem ini.
 */
export function Stat({
  value,
  label,
  hint,
}: {
  value: string | number;
  label: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-chalk bg-white p-5">
      <p className="tabular-display text-3xl text-ink">{value}</p>
      <p className="mt-1 text-sm text-slate">{label}</p>
      {hint ? <p className="mt-0.5 text-xs text-slate-light">{hint}</p> : null}
    </div>
  );
}
