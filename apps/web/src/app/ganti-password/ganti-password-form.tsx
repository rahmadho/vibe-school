"use client";

import { useState, useTransition } from "react";
import { Button, Field } from "@/components/ui";
import { PasswordInput } from "@/components/form-fields";
import { gantiPasswordWajib } from "./actions";

/**
 * Form ganti password wajib.
 *
 * Ditampilkan sebagai gerbang — pengguna tidak bisa menuju bagian lain
 * aplikasi sebelum menyelesaikannya.
 */
export function GantiPasswordForm() {
  const [passwordLama, setPasswordLama] = useState("");
  const [passwordBaru, setPasswordBaru] = useState("");
  const [ulangi, setUlangi] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const fd = new FormData();
    fd.set("passwordLama", passwordLama);
    fd.set("passwordBaru", passwordBaru);
    fd.set("ulangi", ulangi);

    startTransition(async () => {
      // Aksi ini melempar redirect saat berhasil; hanya kegagalan yang kembali.
      const hasil = await gantiPasswordWajib(fd);
      if (hasil && !hasil.ok) setError(hasil.error);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Field label="Password saat ini" htmlFor="passwordLama">
        <PasswordInput
          id="passwordLama"
          name="passwordLama"
          autoComplete="current-password"
          required
          value={passwordLama}
          onChange={(e) => setPasswordLama(e.target.value)}
        />
      </Field>

      <Field label="Password baru" htmlFor="passwordBaru">
        <PasswordInput
          id="passwordBaru"
          name="passwordBaru"
          autoComplete="new-password"
          required
          value={passwordBaru}
          onChange={(e) => setPasswordBaru(e.target.value)}
        />
      </Field>

      <Field label="Ulangi password baru" htmlFor="ulangi" error={error ?? undefined}>
        <PasswordInput
          id="ulangi"
          name="ulangi"
          autoComplete="new-password"
          required
          value={ulangi}
          onChange={(e) => setUlangi(e.target.value)}
        />
      </Field>

      <p className="text-xs text-slate">
        Minimal 8 karakter, memuat huruf dan angka. Jangan memakai tanggal lahir.
      </p>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Menyimpan…" : "Simpan & masuk ulang"}
      </Button>
    </form>
  );
}
