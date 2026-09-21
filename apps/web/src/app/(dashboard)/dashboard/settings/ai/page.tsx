import Link from "next/link";
import { guard } from "@/lib/action-guard";
import { getAiSetting } from "@/lib/data/ai";
import { findProvider } from "@/lib/ai-providers";
import { AiSettingForm } from "./ai-setting-form";

export const metadata = { title: "Pengaturan AI" };
export const dynamic = "force-dynamic";

/**
 * Halaman pengaturan AI untuk bantuan tulis berita.
 *
 * Ditempatkan di menu Sistem, bukan di menu Konten: ini pengaturan
 * sekali-pasang yang menyangkut kredensial, bukan alat kerja harian.
 */
export default async function AiSettingsPage() {
  const g = await guard("content", "manage");
  if ("fail" in g) {
    return (
      <div className="mx-auto max-w-md border-2 border-[var(--chalk)] bg-white p-6 text-center">
        <p className="font-display text-lg font-semibold text-[var(--ink)]">
          Tidak dapat diakses
        </p>
        <p className="mt-2 text-sm text-[var(--slate)]">
          {g.fail.ok ? "Tidak diizinkan." : g.fail.error}
        </p>
      </div>
    );
  }

  const setting = await getAiSetting(g.ctx.schoolId);
  const provider = findProvider(setting?.provider ?? "groq");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="border-b-2 border-[var(--ink)] pb-4">
        <p className="text-sm text-[var(--slate)]">
          <Link href="/dashboard" className="underline">
            Dasbor
          </Link>{" "}
          / Pengaturan AI
        </p>
        <h1 className="font-display text-2xl font-semibold text-[var(--ink)]">
          Bantuan Tulis dengan AI
        </h1>
        <p className="mt-1 text-sm text-[var(--slate)]">
          Sambungkan penyedia AI gratis agar staf dapat menyusun draf berita
          dan pengumuman lebih cepat. Draf tetap harus dibaca dan disunting
          sebelum diterbitkan.
        </p>
      </header>

      <AiSettingForm
        current={{
          isActive: setting?.isActive ?? false,
          provider: setting?.provider ?? "groq",
          model: setting?.model ?? provider?.defaultModel ?? "",
          baseUrl: setting?.baseUrl ?? "",
          tone: setting?.tone ?? "formal",
          language: setting?.language ?? "id",
        }}
        keyLast4={setting?.apiKeyLast4 ?? null}
      />
    </div>
  );
}
