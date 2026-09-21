import "server-only";
import { decryptSecret } from "./crypto-secret";
import { findProvider, type AiLanguage, type AiTone } from "./ai-providers";

/**
 * Pemanggil API penyedia AI.
 *
 * ============================================================
 * KENAPA DUA ADAPTER, BUKAN SATU PER PENYEDIA
 * ============================================================
 * Groq, OpenRouter, Cerebras, dan Ollama memakai bentuk "chat completions"
 * ala OpenAI — hanya alamat dasarnya yang berbeda. Gemini memakai bentuknya
 * sendiri. Jadi cukup dua jalur kode; menambah penyedia kompatibel-OpenAI
 * baru tidak menambah kode sama sekali.
 *
 * ============================================================
 * KENAPA PROMPTNYA DITULIS PANJANG
 * ============================================================
 * Tanpa batasan yang jelas, model bahasa cenderung menambahkan hal yang tidak
 * diminta: mengarang tanggal, mengarang nama pejabat, memakai tanda seru
 * berlebihan, atau menulis pembukaan klise ("Di era globalisasi yang semakin
 * maju..."). Untuk berita sekolah, karangan seperti itu berbahaya — orang tua
 * membacanya sebagai fakta. Karena itu prompt melarang tegas mengarang data.
 */

export type AiCredentials = {
  provider: string;
  model: string;
  baseUrl: string | null;
  apiKeyEnc: string | null;
  language: string;
  tone: string;
};

export type GenerateInput = {
  /** Arahan singkat dari operator, mis. "upacara HUT RI tanggal 17 Agustus". */
  brief: string;
  /** Judul yang sudah diketik operator, bila ada. */
  title?: string;
  /** Nama sekolah, dipakai agar tulisan terasa milik sekolah itu. */
  schoolName: string;
  /** Apakah ini berita, pengumuman, agenda, atau galeri. */
  kind: string;
};

export type GenerateResult =
  | { ok: true; title: string; excerpt: string; content: string }
  | { ok: false; error: string };

/** Susun instruksi untuk model. */
function buildPrompt(input: GenerateInput, tone: AiTone, language: AiLanguage): string {
  const toneHint: Record<AiTone, string> = {
    formal: "Bahasa resmi sekolah. Sopan, jelas, tanpa gaya bercerita.",
    hangat: "Bahasa ramah dan mengundang, seperti mengajak orang tua berbicara.",
    ringkas: "Sesingkat mungkin. Langsung ke inti, tanpa pembukaan bertele-tele.",
    berita: "Gaya berita: pembuka yang memuat inti, lalu rincian, lalu penutup.",
  };

  const kindHint: Record<string, string> = {
    NEWS: "Berita kegiatan sekolah — apa yang terjadi, kapan, di mana, siapa yang terlibat.",
    ANNOUNCEMENT: "Pengumuman resmi — apa yang perlu diketahui orang tua, dan apa yang harus mereka lakukan.",
    AGENDA: "Agenda kegiatan yang akan datang — waktu, tempat, dan siapa yang diundang.",
    GALLERY: "Keterangan galeri foto — ringkas, menjelaskan suasana kegiatan.",
  };

  return [
    `Kamu membantu staf sekolah menulis ${input.kind} untuk website sekolah ${input.schoolName}.`,
    "",
    `ARAHAN DARI STAF:`,
    input.brief.trim(),
    input.title?.trim() ? `\nJUDUL YANG SUDAH DITULIS: ${input.title.trim()}` : "",
    "",
    `ATURAN YANG WAJIB DIPATUHI:`,
    `1. JANGAN mengarang fakta. Tanggal, nama orang, nama pejabat, jumlah peserta,`,
    `   dan angka apa pun hanya boleh ditulis bila disebutkan di ARAHAN di atas.`,
    `   Bila tidak ada, tulis tanpa menyebutkannya — jangan mengira-ngira.`,
    `2. Jangan memakai tanda seru berlebihan. Maksimal satu di seluruh tulisan.`,
    `3. Jangan membuka dengan klise seperti "Di era globalisasi", "Seiring`,
    `   perkembangan zaman", atau "Pendidikan adalah hal yang sangat penting".`,
    `4. Bahasa: ${language === "id" ? "Indonesia" : "Inggris"}.`,
    `5. Nada: ${toneHint[tone]}`,
    `6. Jenis: ${kindHint[input.kind] ?? kindHint.NEWS}`,
    "",
    `KELUARAN — balas HANYA dengan JSON, tanpa penjelasan tambahan:`,
    `{`,
    `  "title": "judul singkat maksimal 80 karakter",`,
    `  "excerpt": "ringkasan 1-2 kalimat untuk daftar berita",`,
    `  "content": "isi lengkap dalam HTML sederhana. Hanya pakai tag: <p>, <h2>,`,
    `               <h3>, <ul>, <ol>, <li>, <strong>, <em>, <blockquote>.`,
    `               Jangan pakai <html>, <head>, <body>, <script>, atau <style>."`,
    `}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Ambil JSON dari balasan model, tahan terhadap pagar kode ```json. */
function extractJson(raw: string): unknown {
  const cleaned = raw
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // Sebagian model menambahkan kalimat sebelum JSON — ambil blok {...} pertama.
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end <= start) return null;
    try {
      return JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

/** Batas waktu permintaan. Tanpa ini, satu permintaan bisa menggantung lama. */
const TIMEOUT_MS = 60_000;

/** Hasilkan tulisan memakai pengaturan AI sekolah. */
export async function generateArticle(
  creds: AiCredentials,
  input: GenerateInput,
): Promise<GenerateResult> {
  const provider = findProvider(creds.provider);
  if (!provider) {
    return { ok: false, error: "Penyedia AI tidak dikenal. Periksa pengaturan AI." };
  }

  const baseUrl = (creds.baseUrl?.trim() || provider.baseUrl).replace(/\/+$/, "");
  if (!baseUrl) {
    return { ok: false, error: "Alamat dasar penyedia AI belum diisi." };
  }

  if (provider.needsKey && !creds.apiKeyEnc) {
    return { ok: false, error: "Kunci API belum diisi. Lengkapi di Pengaturan AI." };
  }

  let apiKey = "";
  if (creds.apiKeyEnc) {
    try {
      apiKey = decryptSecret(creds.apiKeyEnc);
    } catch {
      // Kunci enkripsi berubah atau data rusak — operator harus mengisi ulang.
      return {
        ok: false,
        error: "Kunci API tidak dapat dibaca. Simpan ulang kunci di Pengaturan AI.",
      };
    }
  }

  const model = creds.model.trim() || provider.defaultModel;
  if (!model) {
    return { ok: false, error: "Nama model belum diisi." };
  }

  const tone = (creds.tone || "formal") as AiTone;
  const language = (creds.language || "id") as AiLanguage;
  const prompt = buildPrompt(input, tone, language);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const raw =
      provider.kind === "google"
        ? await callGoogle({ baseUrl, model, apiKey, prompt, signal: controller.signal })
        : await callOpenAiCompatible({
            baseUrl,
            model,
            apiKey,
            prompt,
            needsKey: provider.needsKey,
            signal: controller.signal,
          });

    const parsed = extractJson(raw) as
      | { title?: unknown; excerpt?: unknown; content?: unknown }
      | null;

    if (!parsed) {
      return {
        ok: false,
        error: "Balasan AI tidak dapat dibaca. Coba lagi atau ganti model.",
      };
    }

    const title = typeof parsed.title === "string" ? parsed.title.trim() : "";
    const excerpt = typeof parsed.excerpt === "string" ? parsed.excerpt.trim() : "";
    const content = typeof parsed.content === "string" ? parsed.content.trim() : "";

    if (!content) {
      return { ok: false, error: "AI tidak menghasilkan isi tulisan. Coba lagi." };
    }

    return { ok: true, title, excerpt, content };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { ok: false, error: "Permintaan ke AI melebihi batas waktu. Coba lagi." };
    }
    return {
      ok: false,
      error: `Gagal menghubungi penyedia AI: ${
        error instanceof Error ? error.message : "tidak diketahui"
      }`,
    };
  } finally {
    clearTimeout(timer);
  }
}

/* ============================================================
 * ADAPTER 1 — KOMPATIBEL OPENAI (Groq, OpenRouter, Cerebras, Ollama)
 * ============================================================ */

async function callOpenAiCompatible(args: {
  baseUrl: string;
  model: string;
  apiKey: string;
  prompt: string;
  needsKey: boolean;
  signal: AbortSignal;
}): Promise<string> {
  const res = await fetch(`${args.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Ollama lokal tidak memeriksa kunci, tetapi tetap menerima headernya.
      ...(args.needsKey ? { Authorization: `Bearer ${args.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: args.model,
      messages: [
        {
          role: "system",
          content:
            "Kamu asisten penulis untuk website sekolah Indonesia. Selalu membalas dengan JSON.",
        },
        { role: "user", content: args.prompt },
      ],
      temperature: 0.7,
      max_tokens: 2000,
      // Minta keluaran JSON bila penyedia mendukungnya.
      response_format: { type: "json_object" },
    }),
    signal: args.signal,
  });

  if (!res.ok) {
    throw new Error(await describeHttpError(res));
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content ?? "";
}

/* ============================================================
 * ADAPTER 2 — GOOGLE GEMINI
 * ============================================================ */

async function callGoogle(args: {
  baseUrl: string;
  model: string;
  apiKey: string;
  prompt: string;
  signal: AbortSignal;
}): Promise<string> {
  const url = `${args.baseUrl}/models/${encodeURIComponent(args.model)}:generateContent`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Gemini menerima kunci lewat header, bukan query string, agar tidak
      // ikut tercatat di log akses server.
      "x-goog-api-key": args.apiKey,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: args.prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2000,
        responseMimeType: "application/json",
      },
    }),
    signal: args.signal,
  });

  if (!res.ok) {
    throw new Error(await describeHttpError(res));
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

/**
 * Susun pesan galat yang berguna.
 *
 * Pesan mentah dari penyedia sering hanya "400 Bad Request" tanpa menjelaskan
 * apa yang salah. Di sini status yang umum diterjemahkan menjadi langkah
 * perbaikan, karena operator sekolah bukan pengembang.
 */
async function describeHttpError(res: Response): Promise<string> {
  let detail = "";
  try {
    const body = await res.text();
    detail = body.slice(0, 300);
  } catch {
    detail = "";
  }

  const hint =
    res.status === 401 || res.status === 403
      ? "Kunci API ditolak. Periksa kembali kuncinya di Pengaturan AI."
      : res.status === 404
        ? "Model tidak ditemukan. Periksa nama model di Pengaturan AI."
        : res.status === 429
          ? "Kuota gratis habis atau terlalu banyak permintaan. Tunggu sebentar, lalu coba lagi."
          : res.status >= 500
            ? "Penyedia AI sedang bermasalah. Coba lagi nanti."
            : "Permintaan ditolak penyedia AI.";

  return `${hint} (HTTP ${res.status})${detail ? ` — ${detail}` : ""}`;
}
