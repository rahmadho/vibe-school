import "server-only";
import { prisma } from "@/lib/prisma";
import { findProvider } from "@/lib/ai-providers";

/**
 * Query layer pengaturan AI.
 * Isolasi tenant: selalu menerima schoolId dari sesi.
 */

export async function getAiSetting(schoolId: string) {
  return prisma.aiSetting.findUnique({ where: { schoolId } });
}

/**
 * Apakah AI siap dipakai?
 *
 * Sengaja memeriksa kelengkapan, bukan hanya `isActive`: sekolah yang menyalakan
 * fitur tetapi belum mengisi kunci API akan melihat tombol yang selalu gagal.
 * Lebih baik tombolnya tidak muncul.
 */
export async function isAiReady(schoolId: string): Promise<boolean> {
  const setting = await prisma.aiSetting.findUnique({
    where: { schoolId },
    select: { isActive: true, provider: true, apiKeyEnc: true, baseUrl: true, model: true },
  });
  if (!setting?.isActive) return false;

  const provider = findProvider(setting.provider);
  if (!provider) return false;

  const baseUrl = setting.baseUrl?.trim() || provider.baseUrl;
  if (!baseUrl) return false;
  if (!setting.model.trim() && !provider.defaultModel) return false;
  if (provider.needsKey && !setting.apiKeyEnc) return false;

  return true;
}
