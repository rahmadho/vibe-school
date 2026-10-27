import "server-only";
import { prisma } from "@/lib/prisma";
import { asTenant } from "@/lib/tenant-context";
import { resolveTheme, type EffectiveTheme } from "@/lib/site-themes";
import {
  DEFAULT_HOMEPAGE_LAYOUT,
  buildInitialLayout,
  getBlock,
  normalizeLayout,
  type BlockDefinition,
} from "@/lib/site-blocks";

/**
 * Query layer web sekolah publik.
 *
 * Catatan arsitektur penting: fungsi `getPublic*` TIDAK memakai `scopedDb`
 * karena dipanggil dari halaman publik yang belum punya sesi user. Isolasi
 * tetap terjaga karena `schoolId` diperoleh dari RESOLUSI SUBDOMAIN (host),
 * bukan dari masukan pengguna yang bisa dipalsukan.
 *
 * Setiap fungsi publik di sini WAJIB menerima `schoolId` sebagai argumen dan
 * memfilternya secara eksplisit — tidak ada jalan lain masuk ke data sekolah.
 */

/* ============================================================
 * SEKOLAH
 * ============================================================ */

/** Cari sekolah berdasarkan slug (subdomain) atau custom domain. */
export async function findSchoolByHost(host: string) {
  const clean = host.split(":")[0].toLowerCase().trim();

  const select = {
    id: true,
    name: true,
    slug: true,
    level: true,
    logoUrl: true,
    address: true,
    phone: true,
    email: true,
  } as const;

  // Cocokkan custom domain lebih dulu (lebih spesifik).
  const byDomain = await prisma.school.findFirst({
    where: { customDomain: clean, isActive: true, deletedAt: null },
    select,
  });
  if (byDomain) return byDomain;

  // Lalu slug sebagai subdomain.
  return prisma.school.findFirst({
    where: { slug: clean, isActive: true, deletedAt: null },
    select,
  });
}

/** Data sekolah untuk header/footer halaman publik. */
export async function getSchoolIdentity(schoolId: string) {
  return prisma.school.findFirst({
    where: { id: schoolId, isActive: true, deletedAt: null },
    select: {
      id: true,
      name: true,
      slug: true,
      level: true,
      npsn: true,
      address: true,
      phone: true,
      email: true,
      logoUrl: true,
    },
  });
}

/* ============================================================
 * TEMA & PENGATURAN
 * ============================================================ */

/** Tema efektif sekolah; mengembalikan bawaan bila belum diatur. */
export async function getEffectiveTheme(schoolId: string): Promise<EffectiveTheme> {
  const theme = await asTenant(schoolId, (tx) =>
    tx.siteTheme.findUnique({ where: { schoolId } }),
  );
  return resolveTheme({
    preset: theme?.preset,
    primaryColor: theme?.primaryColor,
    accentColor: theme?.accentColor,
    headingFont: theme?.headingFont,
    bodyFont: theme?.bodyFont,
    cornerStyle: theme?.cornerStyle,
  });
}

export async function getSiteConfig(schoolId: string) {
  return prisma.siteConfig.findUnique({ where: { schoolId } });
}

/* ============================================================
 * BLOK HALAMAN DEPAN
 * ============================================================ */

export type ResolvedBlock = {
  blockKey: string;
  variantKey: string;
  order: number;
  props: Record<string, unknown>;
  definition: BlockDefinition;
};

/**
 * Ambil susunan blok halaman depan yang siap dirender.
 *
 * Blok yang tidak dikenal (mis. fitur dihapus di versi baru) DILEWATI, bukan
 * membuat halaman gagal render. Ini penting: sekolah sudah mengisi datanya,
 * halaman publik tidak boleh mati karena satu blok usang.
 */
export async function getHomepageBlocks(schoolId: string): Promise<ResolvedBlock[]> {
  const rows = await asTenant(schoolId, (tx) =>
    tx.siteBlock.findMany({
      where: { schoolId, isEnabled: true },
      orderBy: { order: "asc" },
    }),
  );

  const out: ResolvedBlock[] = [];
  for (const r of normalizeLayout(rows)) {
    const definition = getBlock(r.blockKey);
    if (!definition) continue; // blok usang — lewati diam-diam
    out.push({
      blockKey: r.blockKey,
      variantKey: r.variantKey,
      order: r.order,
      props:
        r.blockKey === "stats"
          ? await fillAutoStats(schoolId, (r.props ?? {}) as Record<string, unknown>)
          : ((r.props ?? {}) as Record<string, unknown>),
      definition,
    });
  }
  return out;
}

/**
 * Isi "Angka Capaian" dari data yang SUDAH ada di database.
 *
 * KENAPA: sekolah baru hampir selalu membiarkan blok `stats` kosong, sehingga
 * halaman depan menampilkan 0 siswa / 0 guru / 0 kelas padahal datanya ada.
 * Angka nol di halaman publik merusak kredibilitas sekolah, dan mengisinya
 * manual berarti menghitung ulang tiap kali ada siswa baru.
 *
 * ATURAN: angka yang diisi sekolah SELALU menang. Pengisian otomatis hanya
 * menambal posisi yang kosong, dan hanya untuk label yang dikenal. Jadi
 * sekolah tetap bisa menulis angka yang ia inginkan ("Akreditasi A").
 *
 * Dihitung sekali per permintaan halaman (3 COUNT paralel, semua terindeks
 * schoolId) — bukan mahal, dan tidak di-cache supaya angka tidak basi.
 */
const AUTO_STAT_LABELS = ["siswa", "guru", "kelas"] as const;

/** Angka ringkas sekolah untuk blok "Angka Capaian". */
export async function getSchoolCounts(
  schoolId: string,
): Promise<{ label: string; value: string }[]> {
  const [siswa, guru, kelas] = await asTenant(schoolId, (tx) =>
    Promise.all([
      tx.student.count({ where: { schoolId, deletedAt: null } }),
      tx.teacher.count({ where: { schoolId } }),
      tx.class.count({ where: { schoolId } }),
    ]),
  );
  const angka = { siswa, guru, kelas } as const;
  return AUTO_STAT_LABELS.map((label) => ({
    label: label.charAt(0).toUpperCase() + label.slice(1),
    value: angka[label].toLocaleString("id-ID"),
  }));
}

async function fillAutoStats(
  schoolId: string,
  props: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  type StatItem = { label?: string; value?: string };
  const current = Array.isArray(props.items) ? (props.items as StatItem[]) : [];

  const needs = (label: string) =>
    !current.some(
      (it) =>
        it?.label?.trim().toLowerCase() === label &&
        String(it?.value ?? "").trim() !== "",
    );

  const wanted = AUTO_STAT_LABELS.filter(needs);
  if (wanted.length === 0) return props;

  const semua = await getSchoolCounts(schoolId);
  const items: StatItem[] = [...current];

  for (const label of wanted) {
    const found = semua.find((s) => s.label.toLowerCase() === label);
    if (found) items.push(found);
  }

  return { ...props, items };
}

/** Susunan blok untuk EDITOR — termasuk yang nonaktif, tanpa penyaringan. */
export async function getEditableBlocks(schoolId: string) {
  return prisma.siteBlock.findMany({
    where: { schoolId },
    orderBy: { order: "asc" },
  });
}

/**
 * Susun blok awal untuk sekolah yang belum pernah mengatur apa pun.
 * Mengembalikan data siap-tampil TANPA menulis ke DB, supaya halaman publik
 * tetap bisa dibuka walau sekolah belum menyentuh editor.
 */
export function fallbackHomepageBlocks(
  autoStats?: { label: string; value: string }[],
): ResolvedBlock[] {
  return buildInitialLayout(DEFAULT_HOMEPAGE_LAYOUT)
    .map((b) => {
      const definition = getBlock(b.blockKey);
      if (!definition) return null;
      return {
        blockKey: b.blockKey,
        variantKey: b.variantKey,
        order: b.order,
        // Susunan bawaan dipakai untuk sekolah yang belum punya blok sama
        // sekali. Blok `stats` bawaannya kosong, jadi tanpa ini halaman depan
        // sekolah baru menampilkan "0 Siswa / 0 Guru / 0 Kelas" padahal
        // datanya ada di dasbor.
        props: b.blockKey === "stats" && autoStats ? { items: autoStats } : b.props,
        definition,
      };
    })
    .filter((b): b is ResolvedBlock => b !== null);
}

/** Berapa banyak blok aktif — untuk indikator kelengkapan di dasbor. */
export async function countSiteBlocks(schoolId: string): Promise<number> {
  return prisma.siteBlock.count({ where: { schoolId, isEnabled: true } });
}

/* ============================================================
 * HALAMAN KUSTOM
 * ============================================================ */

export async function listPages(schoolId: string) {
  return prisma.page.findMany({
    where: { schoolId, deletedAt: null },
    orderBy: [{ navOrder: "asc" }, { title: "asc" }],
  });
}

export async function getPageBySlug(schoolId: string, slug: string) {
  return prisma.page.findFirst({
    where: { schoolId, slug, isPublished: true, deletedAt: null },
  });
}

/** Halaman yang tampil di menu navigasi. */
export async function listNavPages(schoolId: string) {
  return prisma.page.findMany({
    where: { schoolId, isPublished: true, showInNav: true, deletedAt: null },
    orderBy: [{ navOrder: "asc" }, { title: "asc" }],
    select: { title: true, slug: true, navOrder: true },
  });
}

/* ============================================================
 * MENU
 * ============================================================ */

export async function listNavigation(schoolId: string, area: "header" | "footer") {
  return prisma.navigationItem.findMany({
    where: { schoolId, area },
    orderBy: [{ order: "asc" }],
  });
}

/** Menu siap render: item `onlyIfSpmb` disembunyikan bila SPMB tidak aktif. */
export async function getPublicNavigation(schoolId: string) {
  const [header, footer, spmbActive] = await Promise.all([
    listNavigation(schoolId, "header"),
    listNavigation(schoolId, "footer"),
    hasActiveSpmb(schoolId),
  ]);

  const filter = <T extends { onlyIfSpmb: boolean }>(items: T[]) =>
    items.filter((i) => !i.onlyIfSpmb || spmbActive);

  return { header: filter(header), footer: filter(footer), spmbActive };
}

/* ============================================================
 * BERITA / AGENDA / GALERI
 * ============================================================ */

/** Tulisan terbit, terbaru lebih dulu. */
export async function listPublishedPosts(
  schoolId: string,
  opts: {
    type?: "NEWS" | "ANNOUNCEMENT" | "AGENDA" | "GALLERY";
    take?: number;
    /** Lompati N baris awal — untuk pagination (halaman 2 = skip (per-1)*N). */
    skip?: number;
  } = {},
) {
  const now = new Date();
  return prisma.post.findMany({
    where: publishedPostWhere(schoolId, now, opts.type),
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: opts.take ?? 12,
    skip: opts.skip ?? 0,
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      coverUrl: true,
      type: true,
      publishedAt: true,
      createdAt: true,
    },
  });
}

/**
 * Jumlah tulisan terbit — dipakai pagination untuk menghitung total halaman.
 *
 * Memakai filter yang SAMA dengan listPublishedPosts (lewat helper) agar
 * hitungan dan daftar tidak pernah berbeda; kalau salah satunya diubah dan
 * yang lain tertinggal, halaman terakhir bisa tampak kosong atau ada tulisan
 * yang tak pernah muncul.
 */
export async function countPublishedPosts(
  schoolId: string,
  opts: { type?: "NEWS" | "ANNOUNCEMENT" | "AGENDA" | "GALLERY" } = {},
) {
  return prisma.post.count({
    where: publishedPostWhere(schoolId, new Date(), opts.type),
  });
}

/** Filter bersama: tulisan terbit & sudah waktunya tayang (terbit terjadwal). */
function publishedPostWhere(
  schoolId: string,
  now: Date,
  type?: "NEWS" | "ANNOUNCEMENT" | "AGENDA" | "GALLERY",
) {
  return {
    schoolId,
    deletedAt: null,
    isPublished: true,
    // Jangan tampilkan tulisan yang belum waktunya (terbit terjadwal).
    OR: [{ publishedAt: null }, { publishedAt: { lte: now } }],
    ...(type ? { type } : {}),
  };
}

export async function getPostBySlug(schoolId: string, slug: string) {
  const now = new Date();
  return prisma.post.findFirst({
    where: {
      schoolId,
      slug,
      deletedAt: null,
      isPublished: true,
      OR: [{ publishedAt: null }, { publishedAt: { lte: now } }],
    },
  });
}

/** Semua tulisan untuk panel admin (termasuk draf). */
export async function listAllPosts(
  schoolId: string,
  opts: { type?: string; search?: string } = {},
) {
  return prisma.post.findMany({
    where: {
      schoolId,
      deletedAt: null,
      ...(opts.type ? { type: opts.type as never } : {}),
      ...(opts.search
        ? { title: { contains: opts.search, mode: "insensitive" as const } }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }],
    take: 200,
  });
}

export async function getPostById(schoolId: string, id: string) {
  return prisma.post.findFirst({ where: { id, schoolId, deletedAt: null } });
}

/* ============================================================
 * GURU (untuk blok guru)
 * ============================================================ */

/**
 * Guru & staf untuk ditampilkan di web sekolah.
 *
 * Guru dan staf digabung karena pengunjung web tidak membedakannya — yang
 * mereka cari "siapa saja orang di sekolah ini". Tenaga kependidikan (TU,
 * bendahara) sering diminta tampil berdampingan dengan guru.
 */
export async function listPeopleForSite(schoolId: string, take: number) {
  const [teachers, staffs] = await Promise.all([
    prisma.teacher.findMany({
      where: { schoolId, deletedAt: null, isActive: true },
      orderBy: [{ fullName: "asc" }],
      take,
      select: { id: true, fullName: true, photoUrl: true },
    }),
    prisma.staff.findMany({
      where: { schoolId, deletedAt: null, isActive: true },
      orderBy: [{ fullName: "asc" }],
      take,
      select: { id: true, fullName: true, position: true },
    }),
  ]);

  return [
    ...teachers.map((t) => ({
      id: t.id,
      name: t.fullName,
      position: "Guru",
      photoUrl: t.photoUrl,
    })),
    ...staffs.map((s) => ({
      id: s.id,
      name: s.fullName,
      position: s.position ?? "Tenaga Kependidikan",
      photoUrl: null as string | null,
    })),
  ].slice(0, take);
}

/* ============================================================
 * SPMB
 * ============================================================ */

/** Apakah sekolah punya gelombang SPMB yang sedang dibuka? */
export async function hasActiveSpmb(schoolId: string): Promise<boolean> {
  const now = new Date();
  const count = await asTenant(schoolId, (tx) =>
    tx.admissionBatch.count({
      where: {
        schoolId,
        isActive: true,
        openDate: { lte: now },
        closeDate: { gte: now },
      },
    }),
  );
  return count > 0;
}

/**
 * Gelombang SPMB yang sedang dibuka (untuk halaman publik).
 * Menyertakan jalur aktif agar pendaftar bisa memilih.
 */
export async function getOpenBatches(schoolId: string) {
  const now = new Date();
  return prisma.admissionBatch.findMany({
    where: {
      schoolId,
      isActive: true,
      openDate: { lte: now },
      closeDate: { gte: now },
    },
    orderBy: { openDate: "asc" },
    include: {
      paths: {
        where: { isActive: true },
        orderBy: [{ order: "asc" }, { name: "asc" }],
      },
    },
  });
}

/** Semua gelombang (panel operator). */
export async function listBatches(schoolId: string) {
  return prisma.admissionBatch.findMany({
    where: { schoolId },
    orderBy: { openDate: "desc" },
    include: {
      paths: { orderBy: [{ order: "asc" }] },
      _count: { select: { registrations: true } },
    },
  });
}

export async function getBatch(schoolId: string, id: string) {
  return prisma.admissionBatch.findFirst({
    where: { id, schoolId },
    include: { paths: { orderBy: { order: "asc" } } },
  });
}

/** Jalur pendaftaran satu gelombang. */
export async function listPaths(schoolId: string, batchId: string) {
  return prisma.admissionPath.findMany({
    where: { schoolId, batchId },
    orderBy: [{ order: "asc" }, { name: "asc" }],
    include: { _count: { select: { registrations: true } } },
  });
}

/**
 * Hitung sisa kuota per jalur.
 *
 * Dihitung dari pendaftaran yang SUDAH DIVERIFIKASI ke atas — pendaftar yang
 * baru mengisi formulir belum dianggap memakai kuota, karena banyak yang
 * batal atau tidak lolos verifikasi.
 */
export async function getPathQuotaUsage(schoolId: string, batchId: string) {
  const { paths, counts } = await asTenant(schoolId, async (tx) => ({
    paths: await tx.admissionPath.findMany({
      where: { schoolId, batchId },
      orderBy: { order: "asc" },
    }),
    counts: await tx.registration.groupBy({
      by: ["pathId"],
      where: {
        schoolId,
        batchId,
        status: { in: ["VERIFIED", "TESTED", "ACCEPTED"] },
      },
      _count: { _all: true },
    }),
  }));

  const used = new Map<string, number>(
    counts.map((c): [string, number] => [c.pathId ?? "", c._count._all]),
  );

  return paths.map((p) => {
    const filled: number = used.get(p.id) ?? 0;
    const quota: number = p.quota;
    return {
      ...p,
      filled,
      remaining: Math.max(0, quota - filled),
      isFull: quota > 0 && filled >= quota,
    };
  });
}

/**
 * Gelombang SPMB publik beserta jalur, sisa kuota, dan tanggal penting.
 *
 * Dibuat TERPISAH dari `getOpenBatches` (yang hanya mengembalikan gelombang
 * terbuka) karena halaman pendaftaran publik perlu menampilkan gelombang yang
 * BELUM dibuka sebagai pengumuman ("Gelombang 2 dibuka 1 Juli") — orang tua
 * sering datang lebih awal dan perlu tahu jadwalnya, bukan halaman kosong.
 */
export type PublicBatchPath = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  requirements: string | null;
  registrationFee: number | null;
  quota: number;
  filled: number;
  remaining: number;
  isFull: boolean;
  /** Butuh pendaftar memilih jalur ini? Selalu true; membantu form. */
  isActive: boolean;
};

export type PublicBatch = {
  id: string;
  name: string;
  description: string | null;
  requirements: string | null;
  openDate: Date;
  closeDate: Date;
  quota: number | null;
  isOpen: boolean;
  /** "belum" | "buka" | "tutup" — dipakai UI untuk memilih kalimat. */
  phase: "belum" | "buka" | "tutup";
  paths: PublicBatchPath[];
};

/**
 * Gelombang + jalur yang layak tampil di halaman pendaftaran publik.
 *
 * Menyertakan satu gelombang yang barusan ditutup agar orang tua yang hendak
 * mengecek status tidak melihat halaman kosong, tetapi tidak lebih dari itu.
 */
export async function getPublicBatches(schoolId: string): Promise<PublicBatch[]> {
  const now = new Date();

  const batches = await asTenant(schoolId, (tx) =>
    tx.admissionBatch.findMany({
      where: { schoolId, isActive: true },
      orderBy: { openDate: "desc" },
      take: 12,
      include: {
        paths: {
          where: { isActive: true },
          orderBy: [{ order: "asc" }, { name: "asc" }],
        },
      },
    }),
  );

  if (batches.length === 0) return [];

  // Hitung pemakai kuota per jalur dalam SATU query — bukan per jalur (N+1).
  const counts = await asTenant(schoolId, (tx) =>
    tx.registration.groupBy({
      by: ["pathId", "batchId"],
      where: {
        schoolId,
        batchId: { in: batches.map((b) => b.id) },
        // Hanya pendaftaran yang sudah diverifikasi ke atas yang dianggap memakai
        // kuota — pendaftar yang belum diverifikasi sering batal.
        status: { in: ["VERIFIED", "TESTED", "ACCEPTED"] },
      },
      _count: { _all: true },
    }),
  );

  const usedByKey = new Map<string, number>(
    counts.map((c): [string, number] => [
      `${c.batchId}:${c.pathId ?? ""}`,
      c._count._all,
    ]),
  );

  const mapped: PublicBatch[] = batches.map((b) => {
    const paths: PublicBatchPath[] = b.paths.map((p) => {
      const filled = usedByKey.get(`${b.id}:${p.id}`) ?? 0;
      const quota = p.quota;
      return {
        id: p.id,
        name: p.name,
        code: p.code,
        description: p.description,
        requirements: p.requirements,
        registrationFee: p.registrationFee,
        quota,
        filled,
        remaining: quota > 0 ? Math.max(0, quota - filled) : Number.MAX_SAFE_INTEGER,
        isFull: quota > 0 && filled >= quota,
        isActive: true,
      };
    });

    const phase: PublicBatch["phase"] =
      b.openDate.getTime() > now.getTime()
        ? "belum"
        : b.closeDate.getTime() < now.getTime()
          ? "tutup"
          : "buka";

    return {
      id: b.id,
      name: b.name,
      description: b.description,
      requirements: b.requirements,
      openDate: b.openDate,
      closeDate: b.closeDate,
      quota: b.quota,
      isOpen: phase === "buka",
      phase,
      paths,
    };
  });

  // Tampilkan gelombang yang sedang buka lebih dulu, lalu yang belum buka,
  // lalu yang barusan tutup (maksimal satu) supaya halaman tetap fokus.
  const open = mapped.filter((b) => b.phase === "buka");
  const upcoming = mapped.filter((b) => b.phase === "belum");
  const closed = mapped.filter((b) => b.phase === "tutup").slice(0, 1);
  return [...open, ...upcoming, ...closed];
}

/** Satu gelombang publik berdasarkan id, hanya bila memang milik sekolah ini. */
export async function getPublicBatch(schoolId: string, batchId: string) {
  const list = await getPublicBatches(schoolId);
  return list.find((b) => b.id === batchId) ?? null;
}

/**
 * Cari pendaftaran untuk pengecekan status publik.
 *
 * Pencarian memakai nomor pendaftaran + nomor HP orang tua yang sudah
 * dinormalkan. `schoolId` wajib agar pendaftar sekolah A tidak bisa melihat
 * data sekolah B hanya dengan menebak nomor.
 *
 * SENGAJA mengembalikan lebih dari sekadar yang ditampilkan: pemanggil
 * (halaman) WAJIB menyaringnya sebelum dikirim ke komponen agar tidak ada data
 * keluarga yang bocor ke HTML.
 */
export async function findRegistrationForStatus(
  schoolId: string,
  registrationNo: string,
  normalizedParentPhone: string,
) {
  return prisma.registration.findFirst({
    where: {
      schoolId,
      registrationNo,
      parentPhone: normalizedParentPhone,
    },
    select: {
      id: true,
      registrationNo: true,
      status: true,
      fullName: true,
      gender: true,
      parentPhone: true,
      submittedAt: true,
      verifiedAt: true,
      decidedAt: true,
      resultNote: true,
      score: true,
      selectedRank: true,
      batch: {
        select: {
          name: true,
          resultAnnouncement: true,
          resultDate: true,
        },
      },
      path: { select: { name: true, code: true } },
    },
  });
}

/* ============================================================
 * KELENGKAPAN SITUS
 * ============================================================ */

export type CompletenessItem = {
  label: string;
  done: boolean;
  hint: string;
  href: string;
};

/**
 * Apa saja yang belum diisi sekolah.
 *
 * Alasan fitur ini ada: sekolah baru biasanya membuka editor, melihat banyak
 * kolom kosong, lalu menutupnya dan tidak pernah kembali. Daftar periksa yang
 * jelas membuat pekerjaan terasa ada ujungnya.
 */
export async function getSiteCompleteness(schoolId: string): Promise<CompletenessItem[]> {
  const [school, theme, config, blocks, pages, posts, nav] = await Promise.all([
    getSchoolIdentity(schoolId),
    prisma.siteTheme.findUnique({ where: { schoolId } }),
    prisma.siteConfig.findUnique({ where: { schoolId } }),
    countSiteBlocks(schoolId),
    prisma.page.count({ where: { schoolId, deletedAt: null } }),
    prisma.post.count({ where: { schoolId, deletedAt: null, isPublished: true } }),
    prisma.navigationItem.count({ where: { schoolId, area: "header" } }),
  ]);

  return [
    {
      label: "Logo sekolah",
      done: Boolean(school?.logoUrl),
      hint: "Logo tampil di header dan kop halaman.",
      href: "/dashboard/schools",
    },
    {
      label: "Alamat & telepon",
      done: Boolean(school?.address && school?.phone),
      hint: "Dipakai di halaman kontak dan footer.",
      href: "/dashboard/schools",
    },
    {
      label: "Sambutan & deskripsi singkat",
      done: Boolean(config?.shortDescription),
      hint: "Muncul di halaman depan; membantu orang tua mengenal sekolah.",
      href: "/dashboard/website/settings",
    },
    {
      label: "Tema warna",
      done: Boolean(theme),
      hint: "Pilih warna agar web terasa milik sekolah sendiri.",
      href: "/dashboard/website/appearance",
    },
    {
      label: "Susunan halaman depan",
      done: blocks > 0,
      hint: "Atur blok mana yang tampil dan urutannya.",
      href: "/dashboard/website/homepage",
    },
    {
      label: "Menu navigasi",
      done: nav > 0,
      hint: "Menu membantu pengunjung menemukan hal penting.",
      href: "/dashboard/website/menu",
    },
    {
      label: "Minimal satu halaman",
      done: pages > 0,
      hint: "Misalnya Profil, Visi & Misi, atau Sambutan Kepala Sekolah.",
      href: "/dashboard/website/pages",
    },
    {
      label: "Minimal tiga berita terbit",
      done: posts >= 3,
      hint: "Web yang jarang diperbarui membuat orang ragu.",
      href: "/dashboard/website/posts",
    },
  ];
}
