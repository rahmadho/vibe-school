/**
 * Logika MURNI verifikasi domain — tanpa DB, tanpa `server-only`, sehingga
 * bisa diuji langsung.
 *
 * KENAPA ADA VERIFIKASI SAMA SEKALI:
 * Kolom `customDomain` dulu diisi apa saja yang diketik admin. Artinya siapa pun
 * bisa mengetik `google.com` dan halaman publik aplikasi ini akan menyajikan
 * web sekolah di bawah nama domain orang lain. DNS TXT membuktikan orang yang
 * mendaftarkan memang mengendalikan DNS domain tersebut.
 *
 * MODE ZONA TERPERCAYA (demo):
 * Domain di dalam zona milik penyedia layanan (mis. `*.bakoding.my.id`) tidak
 * perlu TXT — zona itu memang di tangan kita, bukan pelanggan, jadi tidak ada
 * domain yang bisa "dicuri". Lihat `hostAdaDiZonaTerpercaya`.
 */

/** Prefiks nilai TXT. Dibuat spesifik agar tidak bentrok dengan TXT lain. */
export const TXT_PREFIX = "sekolah-verify=";

/** Nama record TXT untuk sebuah host. */
export function txtRecordName(host: string): string {
  return `_sekolah-verify.${host}`;
}

/** Nilai TXT yang harus dipasang pelanggan. */
export function expectedTxtValue(token: string): string {
  return `${TXT_PREFIX}${token}`;
}

/**
 * Rapikan masukan host dari admin menjadi nama host polos.
 *
 * Menerima `https://SMPN1.sch.id:8443/path/` → `smpn1.sch.id`.
 * Mengembalikan null bila masukan jelas tidak mungkin menjadi domain publik:
 * tanpa titik, alamat IP, localhost, wildcard, atau karakter aneh.
 *
 * Ini VALIDASI di batas kepercayaan (input admin) — bukan sekadar kosmetik:
 * tanpa penolakan IP/localhost, orang bisa mendaftarkan `127.0.0.1` dan
 * memancing server ini melakukan permintaan ke jaringannya sendiri.
 */
export function normalisasiHost(input: string): string | null {
  let h = input.trim().toLowerCase();
  if (!h) return null;

  // Buang skema (https://, http://) dan apa pun setelah garis miring pertama.
  h = h.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  h = h.split("/")[0];
  // Buang userinfo (user:pass@host).
  const at = h.lastIndexOf("@");
  if (at >= 0) h = h.slice(at + 1);
  // Buang port. IPv6 [::1]:80 ditolak di bawah, jadi split ':' aman di sini.
  h = h.split(":")[0];
  // Buang query/fragmen yang mungkin tersisa.
  h = h.split("?")[0].split("#")[0];

  // Titik di akhir = nama absolut pada DNS ("sch.id.") — buang.
  h = h.replace(/\.+$/, "");

  if (!h) return null;
  if (h === "localhost" || h.endsWith(".localhost")) return null;
  if (h.includes("*")) return null;
  // Alamat IP (v4). IPv6 mengandung ':' sehingga sudah terpotong/aneh — tolak
  // juga bentuk berkurung.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return null;
  if (h.includes("[") || h.includes("]")) return null;
  // Wajib berlabel: minimal satu titik, tiap label 1..63 karakter
  // [a-z0-9-], tidak diawali/diakhiri tanda hubung.
  if (!h.includes(".")) return null;
  const labels = h.split(".");
  for (const l of labels) {
    if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(l)) return null;
  }
  // TLD numerik = hampir pasti sisa alamat IP yang tidak lolos regex di atas.
  if (/^\d+$/.test(labels[labels.length - 1]!)) return null;
  if (h.length > 253) return null;

  return h;
}

/**
 * Apakah host berada di dalam salah satu zona terpercaya?
 *
 * Pencocokan domain-suffix PENUH: `host === zone` atau `host.endsWith('.'+zone)`.
 * JANGAN `endsWith(zone)` mentah — itu membuat `jahatbakoding.my.id` lolos
 * untuk zona `bakoding.my.id` dan membuka pintu pencurian domain.
 *
 * Zona kosong → tidak ada yang terpercaya (bawaan aman).
 */
export function hostAdaDiZonaTerpercaya(host: string, zones: readonly string[]): boolean {
  const h = normalisasiHost(host) ?? host.trim().toLowerCase().replace(/\.+$/, "");
  if (!h) return false;
  for (const raw of zones) {
    const z = raw.trim().toLowerCase().replace(/^\.+/, "").replace(/\.+$/, "");
    if (!z) continue;
    if (h === z || h.endsWith(`.${z}`)) return true;
  }
  return false;
}

/** Baca `DOMAIN_TRUSTED_ZONES` ("a.com, b.com") → array zona. */
export function zonaTerpercayaFromEnv(): string[] {
  return (process.env.DOMAIN_TRUSTED_ZONES ?? "")
    .split(",")
    .map((z) => z.trim().toLowerCase())
    .filter(Boolean);
}

export type HasilDns = { ok: boolean; reason?: string };

/**
 * Nilai record TXT untuk sebuah nama bisa datang sebagai beberapa potongan
 * string (batas 255 byte per potongan). DNS tidak menyisipkan pemisah, jadi
 * potongan digabung TANPA spasi lalu dibandingkan persis.
 */
export function evaluasiDns(records: string[][], token: string): HasilDns {
  const expected = expectedTxtValue(token);
  // Pembandingan dilakukan TANPA mengubah huruf token: token adalah rahasia,
  // dan menerima variasi huruf berarti memperbesar ruang tebakan. DNS sendiri
  // tidak membedakan huruf pada NAMA record, tetapi NILAI TXT dikembalikan apa
  // adanya — jadi kita bandingkan persis. (Kelonggaran lama yang meng-huruf-
  // kecilkan semuanya membuat "SEKOLAH-VERIFY=<token>" dianggap cocok.)
  const nilai = records.map((chunks) => chunks.join("").trim());

  if (nilai.length === 0) {
    return {
      ok: false,
      reason:
        `Record TXT ${expected} belum ditemukan pada ` +
        `_sekolah-verify. DNS perlu waktu menyebar (biasanya 5–30 menit).`,
    };
  }

  if (nilai.includes(expected)) return { ok: true };

  // Ada record, tapi isinya bukan token kita: sebutkan apa yang diharapkan
  // supaya admin bisa membandingkan sendiri tanpa menebak.
  return {
    ok: false,
    reason: `Record TXT ditemukan, tetapi nilainya tidak cocok. Nilai yang diharapkan: ${expected}`,
  };
}
