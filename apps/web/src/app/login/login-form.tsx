"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button, Field, Input } from "@/components/ui";
import { PasswordInput } from "@/components/form-fields";

/**
 * Form masuk.
 *
 * Satu kolom untuk dua jenis identitas:
 *   - staf/guru  → email (mis. nama@sekolah.sch.id)
 *   - siswa/wali → NIS anak
 *
 * Untuk NIS, `schoolSlug` WAJIB ikut terkirim: NIS tidak unik antar sekolah,
 * jadi server harus tahu sekolah mana yang dimaksud. Slug dibaca dari query
 * string `?school=` (dipakai juga oleh preview web sekolah) dan dari cookie
 * pilihan sekolah, supaya pemilihan sekolah bertahan saat berpindah halaman.
 *
 * KEAMANAN — `method="post"` WAJIB
 * Form ini tidak punya `action`, jadi tanpa `method` browser memakai GET
 * bawaan. Begitu ada satu saja jalur yang tidak melewati `onSubmit` (Enter di
 * tengah proses, JS belum siap, tombol diklik dua kali), browser mengirim
 * seluruh isian sebagai query string:
 *
 *     /login?identifier=admin@...&password=password12345
 *
 * Password lalu tersimpan di access log server, riwayat browser, dan header
 * `Referer` ke situs pihak ketiga. `method="post"` menutup jalur itu: bila
 * submit native tetap terjadi, isian dikirim di body, bukan URL.
 */
export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/dashboard";
  const schoolSlug = params.get("school") ?? bacaCookieSekolah() ?? undefined;

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const res = await signIn("credentials", {
      identifier,
      password,
      schoolSlug,
      redirect: false,
    });

    if (res?.error) {
      // Pesan sengaja sama untuk identitas/password salah (hindari user
      // enumeration — jangan beri tahu mana yang keliru).
      setError("NIS/email atau password salah.");
      return;
    }

    startTransition(() => {
      router.push(callbackUrl);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} method="post" className="mt-8 space-y-4" noValidate>
      <Field label="NIS atau Email" htmlFor="identifier">
        <Input
          id="identifier"
          name="identifier"
          type="text"
          autoComplete="username"
          required
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="2024001 atau nama@sekolah.sch.id"
        />
      </Field>

      <Field label="Password" htmlFor="password" error={error ?? undefined}>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />
      </Field>

      {schoolSlug ? (
        <p className="text-xs text-slate-light">
          Masuk ke sekolah: <span className="font-medium">{schoolSlug}</span>
        </p>
      ) : (
        <p className="text-xs text-slate-light">
          Siswa/wali: buka alamat sekolah Anda dulu agar NIS dapat dikenali.
        </p>
      )}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Memproses…" : "Masuk"}
      </Button>
    </form>
  );
}

/**
 * Baca pilihan sekolah dari cookie (dipakai preview web sekolah).
 * Dibungkus try/catch: cookie bisa diblokir, dan itu tidak boleh mematikan
 * halaman login.
 */
function bacaCookieSekolah(): string | null {
  try {
    const m = document.cookie.match(/(?:^|;\s*)school=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  } catch {
    return null;
  }
}
