"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { guard, requestMeta } from "@/lib/action-guard";
import type { ActionResult } from "@/lib/action-result";
import { encryptSecret, last4 } from "@/lib/crypto-secret";
import { findProvider } from "@/lib/ai-providers";
import { aiSettingSchema } from "@/lib/validations/ai";

/**
 * Server Actions pengaturan AI.
 *
 * Kunci API TIDAK PERNAH dikembalikan ke klien — hanya 4 karakter terakhirnya,
 * dan itu pun hanya untuk ditampilkan. Mengirim kunci utuh ke browser berarti
 * kunci itu ikut tercatat di riwayat jaringan dan riwayat peramban operator.
 */

export async function saveAiSetting(formData: FormData): Promise<ActionResult> {
  const g = await guard("content", "manage");
  if ("fail" in g) return g.fail;
  const { schoolId, userId } = g.ctx;

  const parsed = aiSettingSchema.safeParse({
    provider: formData.get("provider"),
    model: formData.get("model") ?? "",
    baseUrl: formData.get("baseUrl") ?? "",
    apiKey: formData.get("apiKey") ?? "",
    clearApiKey: formData.get("clearApiKey") ?? false,
    isActive: formData.get("isActive") ?? false,
    tone: formData.get("tone") ?? "formal",
    language: formData.get("language") ?? "id",
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "_");
      (fieldErrors[key] ??= []).push(issue.message);
    }
    return {
      ok: false,
      error: "Periksa kembali isian yang ditandai.",
      fieldErrors,
    };
  }

  const d = parsed.data;
  const provider = findProvider(d.provider);
  if (!provider) {
    return { ok: false, error: "Penyedia AI tidak dikenal." };
  }

  // Model: pakai isian operator, atau bawaan penyedia bila dikosongkan.
  const model = d.model || provider.defaultModel;
  if (!model) {
    return {
      ok: false,
      error: "Nama model wajib diisi untuk penyedia ini.",
      fieldErrors: { model: ["Nama model wajib diisi"] },
    };
  }

  // Base URL: kosong = pakai bawaan penyedia; wajib untuk penyedia `custom`.
  const baseUrl = d.baseUrl || provider.baseUrl;
  if (!baseUrl) {
    return {
      ok: false,
      error: "Alamat dasar wajib diisi untuk penyedia ini.",
      fieldErrors: { baseUrl: ["Alamat dasar wajib diisi"] },
    };
  }

  // Menyalakan fitur tanpa kunci yang dibutuhkan akan menghasilkan tombol yang
  // selalu gagal — lebih baik ditolak di sini dengan penjelasan.
  const existing = await prisma.aiSetting.findUnique({
    where: { schoolId },
    select: { apiKeyEnc: true },
  });

  const willClear = d.clearApiKey;
  const hasKeyAfter =
    !willClear && (Boolean(d.apiKey) || Boolean(existing?.apiKeyEnc));

  if (d.isActive && provider.needsKey && !hasKeyAfter) {
    return {
      ok: false,
      error:
        "Kunci API belum diisi. Isi kuncinya terlebih dahulu sebelum menyalakan fitur.",
      fieldErrors: { apiKey: ["Kunci API wajib diisi"] },
    };
  }

  // Kunci baru menggantikan yang lama; kosong berarti "jangan ubah".
  let apiKeyEnc = existing?.apiKeyEnc ?? null;
  // `undefined` = jangan ubah kolom ini; `null` = kosongkan; string = kunci baru.
  let apiKeyLast4: string | null | undefined = existing ? undefined : null;
  if (willClear) {
    apiKeyEnc = null;
    apiKeyLast4 = null;
  } else if (d.apiKey) {
    apiKeyEnc = encryptSecret(d.apiKey);
    apiKeyLast4 = last4(d.apiKey);
  }

  const meta = await requestMeta();
  const before = await prisma.aiSetting.findUnique({
    where: { schoolId },
    select: { provider: true, model: true, isActive: true },
  });

  try {
    await prisma.aiSetting.upsert({
      where: { schoolId },
      update: {
        provider: d.provider,
        model,
        baseUrl: d.baseUrl || null,
        apiKeyEnc,
        ...(apiKeyLast4 !== undefined ? { apiKeyLast4 } : {}),
        isActive: d.isActive,
        tone: d.tone,
        language: d.language,
      },
      create: {
        schoolId,
        provider: d.provider,
        model,
        baseUrl: d.baseUrl || null,
        apiKeyEnc,
        apiKeyLast4: apiKeyLast4 ?? null,
        isActive: d.isActive,
        tone: d.tone,
        language: d.language,
      },
    });
  } catch (error) {
    return {
      ok: false,
      error: `Gagal menyimpan pengaturan: ${
        error instanceof Error ? error.message : "tidak diketahui"
      }`,
    };
  }

  await recordAudit({
    schoolId,
    userId,
    action: "UPDATE",
    entity: "AiSetting",
    entityId: schoolId,
    before: before ?? undefined,
    // Kunci TIDAK ikut dicatat — hanya nama penyedia dan statusnya.
    after: { provider: d.provider, model, isActive: d.isActive, keyChanged: Boolean(d.apiKey) || willClear },
    ...meta,
  });

  revalidatePath("/dashboard/settings/ai");
  revalidatePath("/dashboard/content");
  return { ok: true, message: "Pengaturan AI disimpan." };
}
