"use server";

import { guard } from "@/lib/action-guard";
import type { ActionResult } from "@/lib/action-result";
import { prisma } from "@/lib/prisma";
import { isAiReady, getAiSetting } from "@/lib/data/ai";
import { generateArticle } from "@/lib/ai";
import { aiGenerateSchema } from "@/lib/validations/ai";
import { sanitizeRichText } from "@/lib/rich-text";

/**
 * Hasilkan draf tulisan dengan AI.
 *
 * ============================================================
 * KENAPA HASILNYA DISANITASI, WALAUPUN DARI AI
 * ============================================================
 * Model bahasa bisa menghasilkan HTML apa pun, termasuk `<script>` — entah
 * karena instruksi yang menyimpang atau permintaan yang dirancang untuk itu.
 * Isi ini nantinya tampil di halaman publik sekolah, jadi ia melewati
 * pembersih yang sama dengan tulisan buatan manusia.
 *
 * ============================================================
 * KENAPA TIDAK LANGSUNG DISIMPAN
 * ============================================================
 * Aksi ini hanya MENGEMBALIKAN draf ke form. Menyimpannya otomatis berarti
 * tulisan yang belum dibaca siapa pun bisa tayang di web sekolah. Operator
 * tetap harus menekan "Simpan".
 */
export async function generateArticleDraft(
  formData: FormData,
): Promise<
  | { ok: true; title: string; excerpt: string; content: string }
  | { ok: false; error: string }
> {
  const g = await guard("content", "manage");
  if ("fail" in g) {
    return { ok: false, error: g.fail.ok ? "Tidak diizinkan." : g.fail.error };
  }
  const { schoolId } = g.ctx;

  const ready = await isAiReady(schoolId);
  if (!ready) {
    return {
      ok: false,
      error:
        "Bantuan AI belum dinyalakan. Atur penyedia dan kunci API di Pengaturan AI.",
    };
  }

  const parsed = aiGenerateSchema.safeParse({
    brief: formData.get("brief") ?? "",
    title: formData.get("title") ?? "",
    kind: formData.get("kind") ?? "NEWS",
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Arahan tidak valid.",
    };
  }

  const [setting, school] = await Promise.all([
    getAiSetting(schoolId),
    prisma.school.findUnique({
      where: { id: schoolId },
      select: { name: true },
    }),
  ]);

  if (!setting) {
    return { ok: false, error: "Pengaturan AI tidak ditemukan." };
  }

  const result = await generateArticle(
    {
      provider: setting.provider,
      model: setting.model,
      baseUrl: setting.baseUrl,
      apiKeyEnc: setting.apiKeyEnc,
      language: setting.language,
      tone: setting.tone,
    },
    {
      brief: parsed.data.brief,
      title: parsed.data.title,
      kind: parsed.data.kind,
      schoolName: school?.name ?? "sekolah",
    },
  );

  if (!result.ok) return result;

  // Pembersih yang sama dengan tulisan buatan manusia — AI tetap tidak
  // dipercaya begitu saja untuk isi yang tampil di halaman publik.
  return {
    ok: true,
    title: result.title,
    excerpt: result.excerpt,
    content: sanitizeRichText(result.content),
  };
}

/** Bentuk `ActionResult` — untuk pemanggil yang hanya butuh sukses/gagal. */
export async function generateArticleAsAction(
  formData: FormData,
): Promise<ActionResult> {
  const res = await generateArticleDraft(formData);
  return res.ok ? { ok: true } : { ok: false, error: res.error };
}
