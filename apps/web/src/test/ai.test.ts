import { describe, expect, it } from "vitest";
import {
  AI_PROVIDERS,
  AI_TONES,
  AI_LANGUAGES,
  findProvider,
} from "@/lib/ai-providers";
import { aiSettingSchema, aiGenerateSchema } from "@/lib/validations/ai";

/**
 * Uji daftar penyedia AI dan validasinya.
 *
 * KENAPA TEST INI ADA:
 * `provider` menentukan bentuk permintaan HTTP yang dibuat (OpenAI vs Google)
 * dan alamat tujuannya. Salah daftar berarti permintaan pergi ke tempat yang
 * salah — dan gejalanya baru muncul saat operator menekan "Susun draf", jauh
 * dari penyebabnya.
 */

describe("AI_PROVIDERS", () => {
  it("semua penyedia punya id unik", () => {
    const ids = AI_PROVIDERS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("semua penyedia punya nama dan keterangan", () => {
    for (const p of AI_PROVIDERS) {
      expect(p.name.length, `${p.id} tanpa nama`).toBeGreaterThan(0);
      expect(p.note.length, `${p.id} tanpa keterangan`).toBeGreaterThan(0);
    }
  });

  it("penyedia ber-key punya halaman pengambilan kunci", () => {
    for (const p of AI_PROVIDERS) {
      if (!p.needsKey) continue;
      // `custom` dikecualikan: penyedianya ditentukan operator sendiri, jadi
      // tidak ada halaman kunci tetap yang bisa ditautkan.
      if (p.id === "custom") continue;
      expect(p.keyUrl, `${p.id} tanpa tautan kunci`).toMatch(/^https?:\/\//);
    }
  });

  it("penyedia bawaan punya base URL dan model", () => {
    for (const p of AI_PROVIDERS) {
      // `custom` sengaja kosong: operator wajib mengisinya sendiri.
      if (p.id === "custom") continue;
      expect(p.baseUrl, `${p.id} tanpa base URL`).toMatch(/^https?:\/\//);
      expect(p.defaultModel.length, `${p.id} tanpa model bawaan`).toBeGreaterThan(0);
    }
  });

  it("model bawaan ada di daftar saran", () => {
    for (const p of AI_PROVIDERS) {
      if (p.models.length === 0) continue;
      expect(
        p.models.includes(p.defaultModel),
        `${p.id}: model bawaan tidak ada di daftar saran`,
      ).toBe(true);
    }
  });

  it("Ollama tidak memerlukan kunci API", () => {
    const ollama = findProvider("ollama");
    expect(ollama?.needsKey).toBe(false);
  });

  it("menyediakan penyedia gratis yang siap dipakai", () => {
    // Fitur ini dimaksudkan agar sekolah tidak perlu membayar langganan AI.
    const withKey = AI_PROVIDERS.filter((p) => p.needsKey && p.keyUrl);
    expect(withKey.length).toBeGreaterThanOrEqual(4);
  });
});

describe("findProvider", () => {
  it("menemukan penyedia yang dikenal", () => {
    expect(findProvider("groq")?.name).toBe("Groq");
    expect(findProvider("google")?.kind).toBe("google");
  });

  it("mengembalikan null untuk penyedia tak dikenal", () => {
    expect(findProvider("tidak-ada")).toBeNull();
    expect(findProvider("")).toBeNull();
  });
});

describe("AI_TONES / AI_LANGUAGES", () => {
  it("setiap nada punya label dan penjelasan", () => {
    for (const t of AI_TONES) {
      expect(t.label.length).toBeGreaterThan(0);
      expect(t.hint.length).toBeGreaterThan(0);
    }
  });

  it("bahasa Indonesia tersedia sebagai pilihan", () => {
    expect(AI_LANGUAGES.some((l) => l.value === "id")).toBe(true);
  });
});

describe("aiSettingSchema", () => {
  const base = { provider: "groq" };

  it("menerima pengaturan minimal", () => {
    const r = aiSettingSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.tone).toBe("formal");
      expect(r.data.language).toBe("id");
      expect(r.data.isActive).toBe(false);
    }
  });

  it("menolak penyedia tak dikenal", () => {
    const r = aiSettingSchema.safeParse({ provider: "entah-apa" });
    expect(r.success).toBe(false);
  });

  it("menolak alamat dasar yang bukan URL", () => {
    const r = aiSettingSchema.safeParse({ ...base, baseUrl: "bukan-url" });
    expect(r.success).toBe(false);
  });

  it("menerima alamat dasar kosong", () => {
    const r = aiSettingSchema.safeParse({ ...base, baseUrl: "" });
    expect(r.success).toBe(true);
  });

  it("menerima URL https yang sah", () => {
    const r = aiSettingSchema.safeParse({
      ...base,
      baseUrl: "https://api.contoh.id/v1",
    });
    expect(r.success).toBe(true);
  });

  it("menafsirkan checkbox isActive 'on' sebagai true", () => {
    const r = aiSettingSchema.safeParse({ ...base, isActive: "on" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.isActive).toBe(true);
  });

  it("menafsirkan clearApiKey 'on' sebagai true", () => {
    const r = aiSettingSchema.safeParse({ ...base, clearApiKey: "on" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.clearApiKey).toBe(true);
  });

  it("menolak nada tak dikenal", () => {
    const r = aiSettingSchema.safeParse({ ...base, tone: "puitis" });
    expect(r.success).toBe(false);
  });
});

describe("aiGenerateSchema", () => {
  it("menerima arahan yang cukup panjang", () => {
    const r = aiGenerateSchema.safeParse({
      brief: "Upacara HUT RI tanggal 17 Agustus di lapangan sekolah.",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.kind).toBe("NEWS");
  });

  it("menolak arahan yang terlalu pendek", () => {
    // Arahan kosong membuat model mengarang isi — justru yang harus dicegah.
    const r = aiGenerateSchema.safeParse({ brief: "upacara" });
    expect(r.success).toBe(false);
  });

  it("menolak arahan kosong", () => {
    expect(aiGenerateSchema.safeParse({ brief: "" }).success).toBe(false);
  });

  it("menolak jenis konten tak dikenal", () => {
    const r = aiGenerateSchema.safeParse({
      brief: "Catatan yang cukup panjang untuk lolos validasi.",
      kind: "PUISI",
    });
    expect(r.success).toBe(false);
  });

  it("menerima semua jenis konten yang ada", () => {
    for (const kind of ["NEWS", "ANNOUNCEMENT", "AGENDA", "GALLERY"]) {
      const r = aiGenerateSchema.safeParse({
        brief: "Catatan yang cukup panjang untuk lolos validasi.",
        kind,
      });
      expect(r.success, `jenis ${kind} seharusnya valid`).toBe(true);
    }
  });
});
