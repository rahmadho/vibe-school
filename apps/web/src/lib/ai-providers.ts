/**
 * Daftar penyedia AI yang bisa dipakai sekolah.
 *
 * ============================================================
 * KENAPA SEMUA PENYEDIA DI SINI GRATIS
 * ============================================================
 * Fitur ini membantu menulis berita, bukan menjalankan bisnis. Memaksa sekolah
 * membayar langganan AI untuk menulis pengumuman membuat fitur ini tidak akan
 * pernah dinyalakan. Semua penyedia di daftar ini punya kuota gratis yang
 * cukup untuk beberapa tulisan sehari:
 *
 *   - Groq        : gratis, sangat cepat, kuota harian lega
 *   - Google AI   : gratis (Gemini), kuota harian lega
 *   - OpenRouter  : model bertanda `:free` tanpa biaya
 *   - Cerebras    : gratis, cepat
 *   - Ollama      : dijalankan sendiri di komputer sekolah, tanpa internet
 *
 * ============================================================
 * KENAPA HANYA DUA BENTUK API
 * ============================================================
 * Groq, OpenRouter, Cerebras, dan Ollama semuanya memakai bentuk
 * "chat completions" ala OpenAI. Gemini memakai bentuknya sendiri. Karena itu
 * cukup dua adapter, bukan satu per penyedia — menambah penyedia
 * kompatibel-OpenAI baru berarti menambah SATU baris di daftar ini.
 */

export type AiProviderId =
  | "groq"
  | "google"
  | "openrouter"
  | "cerebras"
  | "ollama"
  | "custom";

export type AiProvider = {
  id: AiProviderId;
  name: string;
  /** Bentuk API yang dipakai. */
  kind: "openai" | "google";
  /** Base URL bawaan. Kosong = wajib diisi operator (penyedia `custom`). */
  baseUrl: string;
  /** Model yang disarankan — sudah teruji cukup baik untuk menulis berita. */
  defaultModel: string;
  /** Beberapa model pilihan, ditampilkan sebagai saran di UI. */
  models: string[];
  /** Di mana operator mengambil kunci API. Ditampilkan sebagai tautan bantuan. */
  keyUrl: string;
  /** Apakah kunci API diperlukan. Ollama lokal tidak butuh. */
  needsKey: boolean;
  /** Catatan singkat untuk UI. */
  note: string;
};

export const AI_PROVIDERS: AiProvider[] = [
  {
    id: "groq",
    name: "Groq",
    kind: "openai",
    baseUrl: "https://api.groq.com/openai/v1",
    defaultModel: "llama-3.3-70b-versatile",
    models: [
      "llama-3.3-70b-versatile",
      "llama-3.1-8b-instant",
      "openai/gpt-oss-20b",
    ],
    keyUrl: "https://console.groq.com/keys",
    needsKey: true,
    note: "Gratis dan paling cepat. Pilihan pertama bila sekolah baru mencoba.",
  },
  {
    id: "google",
    name: "Google AI (Gemini)",
    kind: "google",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    defaultModel: "gemini-2.0-flash",
    models: ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-2.5-flash-lite"],
    keyUrl: "https://aistudio.google.com/apikey",
    needsKey: true,
    note: "Kuota gratis harian lega. Baik untuk tulisan panjang.",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    kind: "openai",
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "meta-llama/llama-3.3-70b-instruct:free",
    models: [
      "meta-llama/llama-3.3-70b-instruct:free",
      "google/gemini-2.0-flash-exp:free",
      "qwen/qwen-2.5-72b-instruct:free",
    ],
    keyUrl: "https://openrouter.ai/keys",
    needsKey: true,
    note: "Banyak pilihan model. Pilih yang berakhiran ':free' agar tanpa biaya.",
  },
  {
    id: "cerebras",
    name: "Cerebras",
    kind: "openai",
    baseUrl: "https://api.cerebras.ai/v1",
    defaultModel: "llama-3.3-70b",
    models: ["llama-3.3-70b", "llama3.1-8b"],
    keyUrl: "https://cloud.cerebras.ai/",
    needsKey: true,
    note: "Gratis dan cepat. Kuota harian terbatas.",
  },
  {
    id: "ollama",
    name: "Ollama (lokal)",
    kind: "openai",
    baseUrl: "http://localhost:11434/v1",
    defaultModel: "llama3.1",
    models: ["llama3.1", "qwen2.5", "gemma2"],
    keyUrl: "https://ollama.com/download",
    needsKey: false,
    note: "Berjalan di komputer sekolah sendiri. Tanpa biaya dan tanpa internet.",
  },
  {
    id: "custom",
    name: "Lainnya (kompatibel OpenAI)",
    kind: "openai",
    baseUrl: "",
    defaultModel: "",
    models: [],
    keyUrl: "",
    needsKey: true,
    note: "Untuk penyedia lain yang mengikuti bentuk API OpenAI. Isi alamat dasarnya.",
  },
];

/** Cari penyedia berdasarkan id. Mengembalikan null bila tidak dikenal. */
export function findProvider(id: string): AiProvider | null {
  return AI_PROVIDERS.find((p) => p.id === id) ?? null;
}

/** Nada tulisan yang bisa dipilih operator. */
export const AI_TONES = [
  { value: "formal", label: "Formal", hint: "Bahasa resmi sekolah, seperti surat dinas." },
  { value: "hangat", label: "Hangat", hint: "Ramah dan mengundang, cocok untuk pengumuman ke orang tua." },
  { value: "ringkas", label: "Ringkas", hint: "Singkat dan langsung ke inti." },
  { value: "berita", label: "Gaya berita", hint: "Seperti tulisan jurnalis: ada pembuka, isi, penutup." },
] as const;

export type AiTone = (typeof AI_TONES)[number]["value"];

/** Bahasa keluaran. */
export const AI_LANGUAGES = [
  { value: "id", label: "Bahasa Indonesia" },
  { value: "en", label: "English" },
] as const;

export type AiLanguage = (typeof AI_LANGUAGES)[number]["value"];
