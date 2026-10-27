import { describe, expect, it } from "vitest";
import {
  normalisasiHost,
  evaluasiDns,
  expectedTxtValue,
  txtRecordName,
  hostAdaDiZonaTerpercaya,
} from "@/lib/domain-verify";

describe("normalisasiHost", () => {
  it("membuang skema https://", () => {
    expect(normalisasiHost("https://sman1-padang.sch.id")).toBe("sman1-padang.sch.id");
    expect(normalisasiHost("http://sman1-padang.sch.id")).toBe("sman1-padang.sch.id");
  });

  it("membuang port", () => {
    expect(normalisasiHost("sman1-padang.sch.id:3000")).toBe("sman1-padang.sch.id");
    expect(normalisasiHost("sman1-padang.sch.id:8443")).toBe("sman1-padang.sch.id");
  });

  it("membuang path, query, dan fragmen", () => {
    expect(normalisasiHost("https://sman1-padang.sch.id/berita?x=1#a")).toBe(
      "sman1-padang.sch.id",
    );
  });

  it("menurunkan huruf besar", () => {
    expect(normalisasiHost("SMAN1-Padang.SCH.ID")).toBe("sman1-padang.sch.id");
  });

  it("membuang titik di akhir (nama absolut DNS)", () => {
    expect(normalisasiHost("sman1-padang.sch.id.")).toBe("sman1-padang.sch.id");
    expect(normalisasiHost("https://sman1-padang.sch.id.:443/")).toBe("sman1-padang.sch.id");
  });

  it("menolak alamat IP", () => {
    expect(normalisasiHost("127.0.0.1")).toBeNull();
    expect(normalisasiHost("http://192.168.1.10:8080")).toBeNull();
    expect(normalisasiHost("[::1]")).toBeNull();
  });

  it("menolak host tanpa titik & localhost", () => {
    expect(normalisasiHost("sekolah")).toBeNull();
    expect(normalisasiHost("localhost")).toBeNull();
    expect(normalisasiHost("smpn1.localhost")).toBeNull();
    expect(normalisasiHost("")).toBeNull();
  });

  it("menolak wildcard & karakter aneh", () => {
    expect(normalisasiHost("*.bakoding.my.id")).toBeNull();
    expect(normalisasiHost("sman1*.sch.id")).toBeNull();
    expect(normalisasiHost("sman 1.sch.id")).toBeNull();
    expect(normalisasiHost("-sman1.sch.id")).toBeNull();
  });

  it("menerima subdomain dalam (untuk demo zona terpercaya)", () => {
    expect(normalisasiHost("sd.bakoding.my.id")).toBe("sd.bakoding.my.id");
  });
});

describe("hostAdaDiZonaTerpercaya", () => {
  const zones = ["bakoding.my.id"];

  it("host persis atau subdomain zona → terpercaya", () => {
    expect(hostAdaDiZonaTerpercaya("bakoding.my.id", zones)).toBe(true);
    expect(hostAdaDiZonaTerpercaya("sd.bakoding.my.id", zones)).toBe(true);
    expect(hostAdaDiZonaTerpercaya("a.b.bakoding.my.id", zones)).toBe(true);
  });

  it("zona sebagai AKHIRAN NAMA LAIN → TIDAK terpercaya", () => {
    // Inilah celah yang ditutup: `endsWith(zone)` mentah akan meloloskannya.
    expect(hostAdaDiZonaTerpercaya("jahatbakoding.my.id", zones)).toBe(false);
    expect(hostAdaDiZonaTerpercaya("bakoding.my.id.evil.com", zones)).toBe(false);
    expect(hostAdaDiZonaTerpercaya("sman1.sch.id", zones)).toBe(false);
  });

  it("zona kosong → tidak ada yang terpercaya (bawaan aman)", () => {
    expect(hostAdaDiZonaTerpercaya("sd.bakoding.my.id", [])).toBe(false);
  });
});

describe("expectedTxtValue & txtRecordName", () => {
  it("bentuk nilai dan nama record", () => {
    expect(expectedTxtValue("abc123")).toBe("sekolah-verify=abc123");
    expect(txtRecordName("sman1-padang.sch.id")).toBe("_sekolah-verify.sman1-padang.sch.id");
  });
});

describe("evaluasiDns", () => {
  const token = "a1b2c3d4e5f60718293a4b5c6d7e8f90";

  it("cocok", () => {
    expect(evaluasiDns([[expectedTxtValue(token)]], token)).toEqual({ ok: true });
  });

  it("tidak cocok", () => {
    const r = evaluasiDns([["v=spf1 -all"]], token);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("tidak cocok");
  });

  it("record TIDAK terpecah (satu record, satu potong)", () => {
    expect(evaluasiDns([["sekolah-verify=", token]], token).ok).toBe(true);
  });

  it("record terpecah 2 potong → digabung persis, tanpa spasi", () => {
    expect(evaluasiDns([["sekolah-", "verify=" + token]], token).ok).toBe(true);
  });

  it("gabungan potongan yang menyisipkan spasi TIDAK dianggap cocok", () => {
    expect(evaluasiDns([["sekolah-verify= ", token]], token).ok).toBe(false);
  });

  it("kosong → alasan Indonesia, bukan cocok", () => {
    const r = evaluasiDns([], token);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("belum ditemukan");
  });

  it("token lain → tidak cocok", () => {
    const r = evaluasiDns([[expectedTxtValue("token-sekolah-lain")]], token);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain(expectedTxtValue(token));
  });

  it("huruf besar pada nilai TXT tidak dianggap cocok (token peka huruf)", () => {
    // DNS tidak membedakan huruf pada NAMA record, tetapi nilai TXT dikembalikan
    // apa adanya. Token adalah rahasia; menerima variasi huruf memperbesar
    // ruang tebakan, jadi perbandingan harus persis.
    expect(evaluasiDns([[expectedTxtValue(token).toUpperCase()]], token).ok).toBe(false);
    expect(evaluasiDns([["SEKOLAH-VERIFY=" + token]], token).ok).toBe(false);
  });

  it("cocok bila salah satu dari beberapa record TXT benar", () => {
    expect(
      evaluasiDns([["v=spf1 -all"], ["_dll"], [expectedTxtValue(token)]], token).ok,
    ).toBe(true);
  });
});
