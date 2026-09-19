import { describe, expect, it } from "vitest";
import {
  renderTemplate,
  extractVariables,
  missingVariables,
  previewTemplate,
  nextSendTime,
  backoffMinutes,
  nextAttemptAt,
  isPermanentFailure,
  summarizeQueue,
  cleanMessage,
  clampMessage,
  uniqueRecipients,
  normalizePhone,
  MAX_ATTEMPTS,
  DEFAULT_SEND_WINDOW,
} from "@/lib/notification";

/* ============================================================
 * RENDER TEMPLATE
 * ============================================================ */

describe("renderTemplate", () => {
  it("mengganti variabel dengan nilai", () => {
    const out = renderTemplate("Halo {{nama}}, kelas {{kelas}}.", {
      nama: "Aisyah",
      kelas: "VII A",
    });
    expect(out).toBe("Halo Aisyah, kelas VII A.");
  });

  it("menerima spasi di dalam kurung", () => {
    expect(renderTemplate("Halo {{ nama }}!", { nama: "Budi" })).toBe("Halo Budi!");
  });

  it("memakai '-' untuk variabel kosong agar pesan tidak tampak rusak", () => {
    const out = renderTemplate("Nilai {{nilai}} untuk {{nama}}", {
      nama: "Siti",
      nilai: null,
    });
    expect(out).toBe("Nilai - untuk Siti");
    expect(out).not.toContain("{{");
  });

  it("variabel tak dikenal tidak membuat pesan berisi kurung mentah", () => {
    const out = renderTemplate("Alpa {{tanggal}}", {});
    expect(out).toBe("Alpa -");
  });

  it("angka dikonversi menjadi teks", () => {
    expect(renderTemplate("Nilai {{n}}", { n: 85 })).toBe("Nilai 85");
  });

  it("fallback bisa dikustom", () => {
    expect(renderTemplate("X {{a}}", {}, { fallback: "?" })).toBe("X ?");
  });
});

describe("extractVariables", () => {
  it("mengambil semua variabel unik dan terurut", () => {
    const vars = extractVariables("{{b}} {{a}} {{b}} {{c}}");
    expect(vars).toEqual(["a", "b", "c"]);
  });

  it("mengembalikan array kosong bila tidak ada variabel", () => {
    expect(extractVariables("Tidak ada variabel")).toEqual([]);
  });
});

describe("missingVariables", () => {
  it("melaporkan variabel yang belum terisi", () => {
    const miss = missingVariables("{{a}} {{b}} {{c}}", { a: "x", c: "" });
    expect(miss).toEqual(["b", "c"]);
  });
});

describe("previewTemplate", () => {
  it("menampilkan elipsis untuk nilai yang belum ada", () => {
    expect(previewTemplate("Halo {{nama}}", {})).toBe("Halo …");
  });
});

/* ============================================================
 * JAM WAJAR
 * ============================================================ */

describe("nextSendTime", () => {
  it("mengirim sekarang bila berada dalam jam wajar", () => {
    // Rabu 14 Oktober 2025, 10:00 WIB (= 03:00 UTC)
    const now = new Date("2025-10-15T03:00:00Z");
    expect(nextSendTime(now).getTime()).toBe(now.getTime());
  });

  it("menahan pesan tengah malam sampai jam 07.00 keesokan hari", () => {
    // Kamis 23:30 WIB (= 16:30 UTC)
    const now = new Date("2025-10-16T16:30:00Z");
    const next = nextSendTime(now);
    // Harus setelah sekarang
    expect(next.getTime()).toBeGreaterThan(now.getTime());
    // Dalam waktu lokal WIB, jamnya 07:00
    const local = new Date(next.getTime() + 420 * 60_000);
    expect(local.getUTCHours()).toBe(DEFAULT_SEND_WINDOW.startHour);
    expect(local.getUTCMinutes()).toBe(0);
  });

  it("menahan pesan yang dibuat setelah jam 20.00", () => {
    // Kamis 21:15 WIB (= 14:15 UTC)
    const now = new Date("2025-10-16T14:15:00Z");
    const next = nextSendTime(now);
    expect(next.getTime()).toBeGreaterThan(now.getTime());
  });

  it("melewati hari Minggu bila tidak diizinkan", () => {
    // Sabtu 22:00 WIB (= 15:00 UTC, 18 Okt 2025)
    const now = new Date("2025-10-18T15:00:00Z");
    const next = nextSendTime(now);
    const local = new Date(next.getTime() + 420 * 60_000);
    // Bukan hari Minggu (0)
    expect(local.getUTCDay()).not.toBe(0);
  });

  it("mengizinkan hari Minggu bila diminta", () => {
    // Minggu 10:00 WIB (= 03:00 UTC, 19 Okt 2025)
    const now = new Date("2025-10-19T03:00:00Z");
    const win = { ...DEFAULT_SEND_WINDOW, allowSunday: true };
    expect(nextSendTime(now, win).getTime()).toBe(now.getTime());
  });
});

/* ============================================================
 * BACKOFF
 * ============================================================ */

describe("backoffMinutes", () => {
  it("bertambah secara eksponensial", () => {
    expect(backoffMinutes(1)).toBe(1);
    expect(backoffMinutes(2)).toBe(5);
    expect(backoffMinutes(3)).toBe(15);
    expect(backoffMinutes(4)).toBe(60);
  });

  it("tidak melewati batas untuk percobaan besar", () => {
    expect(backoffMinutes(99)).toBe(60);
  });
});

describe("nextAttemptAt", () => {
  const now = new Date("2025-10-15T03:00:00Z");

  it("menjadwalkan ulang selama belum habis jatah", () => {
    const next = nextAttemptAt(1, now);
    expect(next).not.toBeNull();
    // Percobaan ke-2 menunggu 5 menit
    expect(next!.getTime() - now.getTime()).toBe(5 * 60_000);
  });

  it("mengembalikan null setelah jatah percobaan habis", () => {
    expect(nextAttemptAt(MAX_ATTEMPTS, now)).toBeNull();
  });
});

describe("isPermanentFailure", () => {
  it("mengenali nomor tidak terdaftar sebagai kegagalan permanen", () => {
    expect(isPermanentFailure("Nomor tidak terdaftar di WhatsApp")).toBe(true);
    expect(isPermanentFailure("Phone number does not exist")).toBe(true);
    expect(isPermanentFailure("Not on WhatsApp")).toBe(true);
  });

  it("tidak menandai masalah jaringan sebagai permanen", () => {
    expect(isPermanentFailure("ETIMEDOUT")).toBe(false);
    expect(isPermanentFailure("WhatsApp belum tersambung")).toBe(false);
  });
});

/* ============================================================
 * RINGKASAN & UTIL
 * ============================================================ */

describe("summarizeQueue", () => {
  it("menghitung tiap status dan tingkat keberhasilan", () => {
    const s = summarizeQueue([
      { status: "SENT", attempts: 1 },
      { status: "SENT", attempts: 1 },
      { status: "FAILED", attempts: 4 },
      { status: "QUEUED", attempts: 0 },
      { status: "CANCELLED", attempts: 0 },
    ]);
    expect(s.total).toBe(5);
    expect(s.sent).toBe(2);
    expect(s.failed).toBe(1);
    expect(s.queued).toBe(1);
    expect(s.cancelled).toBe(1);
    // 2 dari 3 percobaan berhasil
    expect(s.successRate).toBe(66.7);
  });

  it("tingkat keberhasilan 0 bila belum ada percobaan", () => {
    expect(summarizeQueue([{ status: "QUEUED", attempts: 0 }]).successRate).toBe(0);
  });

  it("mengabaikan status tak dikenal", () => {
    const s = summarizeQueue([{ status: "ANEh", attempts: 0 }]);
    expect(s.total).toBe(1);
    expect(s.sent + s.queued + s.failed).toBe(0);
  });
});

describe("cleanMessage", () => {
  it("menyeragamkan baris baru dan membuang baris kosong berlebih", () => {
    expect(cleanMessage("Halo\r\n\r\n\r\nDunia  ")).toBe("Halo\n\nDunia");
  });
});

describe("clampMessage", () => {
  it("membiarkan pesan pendek apa adanya", () => {
    expect(clampMessage("pendek", 100)).toBe("pendek");
  });

  it("memotong pada batas baris agar tidak memutus kata", () => {
    const msg = "a".repeat(50) + "\n" + "b".repeat(50);
    const out = clampMessage(msg, 60);
    expect(out.length).toBeLessThanOrEqual(60);
    expect(out.endsWith("…")).toBe(true);
    // Tidak memotong di tengah "bbbb" karena ada batas baris
    expect(out).toBe("a".repeat(50) + "…");
  });
});

describe("normalizePhone", () => {
  it("mengubah awalan 0 menjadi 62", () => {
    expect(normalizePhone("081234567890")).toBe("6281234567890");
  });

  it("membuang + dan spasi serta tanda hubung", () => {
    expect(normalizePhone("+62 812-3456-7890")).toBe("6281234567890");
  });

  it("menerima nomor yang sudah berawalan 8", () => {
    expect(normalizePhone("81234567890")).toBe("6281234567890");
  });

  it("menolak nilai kosong", () => {
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone("")).toBeNull();
  });

  it("menolak nomor yang terlalu pendek atau bukan Indonesia", () => {
    expect(normalizePhone("0812")).toBeNull();
    expect(normalizePhone("+14155552671")).toBeNull();
  });
});

describe("uniqueRecipients", () => {
  it("membuang duplikat nomor", () => {
    const out = uniqueRecipients([
      { name: "A", phone: "081234567890" },
      { name: "B", phone: "6281234567890" }, // sama setelah normalisasi
      { name: "C", phone: "081234567891" },
    ]);
    expect(out).toHaveLength(2);
    expect(out.map((r) => r.name)).toEqual(["A", "C"]);
  });

  it("melewati nomor tidak valid", () => {
    const out = uniqueRecipients([
      { name: "A", phone: null },
      { name: "B", phone: "0812" },
      { name: "C", phone: "081234567890" },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("C");
  });
});
