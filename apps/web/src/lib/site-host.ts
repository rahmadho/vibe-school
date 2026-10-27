/**
 * Resolusi sekolah dari nama host — MURNI (tanpa DB), sehingga dapat diuji.
 *
 * KENAPA INI SENSITIF:
 * Fungsi di file ini menentukan SEKOLAH MANA yang datanya ditampilkan pada
 * halaman publik. Salah resolusi = kebocoran data antar sekolah, yang
 * meruntuhkan seluruh alasan produk ini dijual. Karena itu logikanya dipisah
 * dari DB dan diuji menyeluruh.
 *
 * ATURAN (keputusan produk #17 user): "wajib punya subdomain".
 * Di produksi, subdomain adalah SATU-SATUNYA cara masuk. Tidak ada parameter
 * `?school=` di produksi, karena itu jalan pintas yang memungkinkan siapa pun
 * menampilkan data sekolah lain hanya dengan menebak slug.
 */

/** Hasil resolusi host. */
export type HostResolution =
  | {
      kind: "school";
      /** Slug sekolah (dari subdomain) atau domain penuh (dari custom domain). */
      identifier: string;
      /** Apakah identifier adalah custom domain penuh? */
      byCustomDomain: boolean;
    }
  | { kind: "portal" } // domain utama, tanpa subdomain → halaman daftar sekolah
  | { kind: "unknown"; reason: string };

export type RootDomainConfig = {
  /** Domain utama, mis. "schoolapp.id". */
  rootDomain: string;
  /** Subdomain yang DIPESAN sistem dan tidak boleh dipakai sekolah. */
  reservedSubdomains?: string[];
};

/** Subdomain yang dipesan sistem — sekolah tidak boleh memakainya. */
export const RESERVED_SUBDOMAINS = [
  "www",
  "app",
  "api",
  "admin",
  "dashboard",
  "static",
  "assets",
  "cdn",
  "mail",
  "smtp",
  "ftp",
  "dev",
  "staging",
  "test",
  "demo",
  "portal",
  "docs",
  "status",
  "blog",
  "help",
];

/** Apakah slug ini boleh dipakai sekolah? */
export function isReservedSubdomain(sub: string): boolean {
  return RESERVED_SUBDOMAINS.includes(sub.toLowerCase().trim());
}

/**
 * Slug yang sah untuk subdomain sekolah.
 * Sengaja konservatif: huruf kecil & angka & tanda hubung, tidak diawali/diakhiri
 * tanda hubung, maksimal 40 karakter.
 */
export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;

export function isValidSchoolSlug(slug: string): boolean {
  const s = slug.toLowerCase().trim();
  if (!SLUG_PATTERN.test(s)) return false;
  if (isReservedSubdomain(s)) return false;
  // Harus mengandung setidaknya satu huruf (mencegah "123" yang membingungkan).
  return /[a-z]/.test(s);
}

/** Penjelasan kenapa slug ditolak — untuk pesan galat yang berguna. */
export function explainSlugProblem(slug: string): string | null {
  const s = slug.toLowerCase().trim();
  if (s.length === 0) return "Alamat web wajib diisi.";
  if (s.length > 40) return "Alamat web maksimal 40 karakter.";
  if (!/^[a-z0-9-]+$/.test(s))
    return "Alamat web hanya boleh huruf kecil, angka, dan tanda hubung.";
  if (s.startsWith("-") || s.endsWith("-"))
    return "Alamat web tidak boleh diawali atau diakhiri tanda hubung.";
  if (isReservedSubdomain(s))
    return `"${s}" dipakai sistem dan tidak bisa digunakan sekolah.`;
  if (!/[a-z]/.test(s)) return "Alamat web harus mengandung huruf.";
  if (!SLUG_PATTERN.test(s)) return "Alamat web tidak sah.";
  return null;
}

/**
 * Buang port dari nilai host.
 * `smpn1.sekolah.id:3000` → `smpn1.sekolah.id`
 */
export function stripPort(host: string): string {
  return host.split(":")[0].trim().toLowerCase();
}

/**
 * Tentukan sekolah dari nama host.
 *
 * Urutan keputusan:
 *   1. host sama dengan akar domain → portal (daftar sekolah)
 *   2. host berakhir dengan .akar → subdomain sekolah
 *   3. selain itu → custom domain (dipetakan lewat DB)
 *
 * `localhost` diperlakukan khusus agar pengembangan bisa dilakukan tanpa DNS.
 */
export function resolveHost(
  host: string,
  config: RootDomainConfig,
): HostResolution {
  const clean = stripPort(host);
  const root = stripPort(config.rootDomain);

  if (!clean) return { kind: "unknown", reason: "Host kosong." };

  // --- Pengembangan lokal tanpa DNS ---
  //
  // Di dev, subdomain kadang belum bisa diatur. Kita pakai bentuk
  // "<slug>.localhost" supaya pengujian tetap bisa dilakukan.
  if (clean === "localhost" || clean.endsWith(".localhost")) {
    if (clean === "localhost") return { kind: "portal" };
    const sub = clean.slice(0, -".localhost".length);
    if (!sub || !isValidSchoolSlug(sub)) {
      return { kind: "unknown", reason: `Subdomain "${sub}" tidak sah.` };
    }
    return { kind: "school", identifier: sub, byCustomDomain: false };
  }

  // --- Alamat IP (mis. 127.0.0.1) ---
  // Tidak ada subdomain di alamat IP; arahkan ke portal.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(clean)) {
    return { kind: "portal" };
  }

  // --- Domain utama persis ---
  if (clean === root) return { kind: "portal" };

  // --- Subdomain dari domain utama ---
  if (clean.endsWith(`.${root}`)) {
    const sub = clean.slice(0, -(root.length + 1));
    // Hanya satu tingkat subdomain yang sah: "a.sekolah.id" ya,
    // "a.b.sekolah.id" tidak — mencegah kejutan dari wildcard DNS.
    if (sub.includes(".")) {
      return { kind: "unknown", reason: `Subdomain bertingkat tidak didukung: "${sub}".` };
    }
    if (!sub) return { kind: "portal" };
    if (!isValidSchoolSlug(sub)) {
      return { kind: "unknown", reason: `Subdomain "${sub}" tidak sah.` };
    }
    return { kind: "school", identifier: sub, byCustomDomain: false };
  }

  // --- Selain itu: mungkin custom domain milik sekolah ---
  // Resolusinya lewat DB (School.customDomain). Kita tandai saja di sini.
  //
  // `byCustomDomain: true` membuat pemanggil mencari lewat kolom customDomain
  // SAJA (lihat findSchoolByHost). Untuk host sembarang — termasuk tunnel
  // pratinjau seperti *.trycloudflare.com — kolom itu kosong, sehingga tidak
  // ada sekolah yang tampil walau `?school=<slug>` diberikan. Karena itu
  // jangan tandai byCustomDomain bila host tidak layak jadi domain sekolah,
  // supaya cadangan pengembangan tetap bisa dipakai.
  if (!isValidSchoolSlug(clean.replace(/\./g, "-"))) {
    return { kind: "unknown", reason: `Alamat "${clean}" bukan domain sekolah.` };
  }
  return { kind: "school", identifier: clean, byCustomDomain: true };
}

/**
 * Bangun alamat lengkap sebuah halaman untuk ditampilkan/dibagikan.
 * Dipakai agar tautan di WA dan email menunjuk ke sekolah yang benar.
 */
export function buildSchoolUrl(
  slug: string,
  config: RootDomainConfig,
  opts: { path?: string; scheme?: string; port?: string } = {},
): string {
  const scheme = opts.scheme ?? "https";
  const path = opts.path ?? "/";
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const root = stripPort(config.rootDomain);

  // Pengembangan: subdomain.localhost
  if (root === "localhost" || root.endsWith(".localhost")) {
    const base = `${slug}.${root}`;
    return `${scheme === "https" ? "http" : scheme}://${base}${opts.port ? `:${opts.port}` : ""}${normalizedPath}`;
  }

  return `${scheme}://${slug}.${root}${normalizedPath}`;
}

/**
 * Cadangan pengembangan: ambil slug dari parameter `?school=`.
 *
 * PENTING — hanya dipakai bila `allowFallback` true, dan pemanggil HANYA
 * mengizinkannya saat NODE_ENV !== "production". Di produksi jalan pintas ini
 * memungkinkan siapa pun membaca data sekolah lain dengan menebak slug.
 */
export function resolveDevFallback(
  param: string | null | undefined,
  allowFallback: boolean,
): HostResolution | null {
  if (!allowFallback) return null;
  if (!param) return null;

  const p = param.trim().toLowerCase();

  // Bentuk "smpn1.localhost" diterima agar cocok dengan alamat asli.
  const sub = p.endsWith(".localhost") ? p.slice(0, -".localhost".length) : p;

  if (!isValidSchoolSlug(sub)) {
    return { kind: "unknown", reason: `Tidak ada sekolah dengan alamat "${sub}".` };
  }
  return { kind: "school", identifier: sub, byCustomDomain: false };
}

/** Baca konfigurasi domain dari lingkungan. */
export function rootDomainConfigFromEnv(source: NodeJS.ProcessEnv = process.env): RootDomainConfig {
  // Bawaan aman untuk pengembangan.
  const rootDomain = source.ROOT_DOMAIN?.trim() || "localhost";
  return { rootDomain, reservedSubdomains: RESERVED_SUBDOMAINS };
}

/**
 * Bolehkah memakai cadangan `?school=` / header `x-dev-school`?
 *
 * PRODUKSI SELALU TIDAK — subdomain wajib, tanpa pengecualian. Di produksi
 * jalan pintas ini memungkinkan siapa pun membaca web sekolah lain hanya
 * dengan menebak slug, dan itu meruntuhkan janji isolasi antar-sekolah.
 *
 * Di luar produksi: aktif secara bawaan, dapat dimatikan dengan
 * ALLOW_SCHOOL_QUERY=false (mis. saat menguji perilaku subdomain asli).
 *
 * Parameternya sengaja bertipe sempit (`{ NODE_ENV?: string; … }`), bukan
 * `NodeJS.ProcessEnv`: yang dibutuhkan fungsi ini hanya dua variabel, dan tipe
 * sempit membuatnya bisa diuji dengan objek biasa tanpa memalsukan seluruh
 * ProcessEnv.
 */
export function allowDevFallback(
  source: { NODE_ENV?: string; ALLOW_SCHOOL_QUERY?: string } = process.env,
): boolean {
  if (source.NODE_ENV === "production") return false;
  const flag = source.ALLOW_SCHOOL_QUERY?.trim().toLowerCase();
  return flag !== "false" && flag !== "0";
}
