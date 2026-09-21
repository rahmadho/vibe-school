import { Section, SiteImage } from "@/components/site/site-ui";

/**
 * Blok data terstruktur: tabel, langkah, linimasa, prestasi, unduhan, kartu.
 *
 * Semuanya menerima `items` dari operator (bukan dari tabel lain), sehingga
 * tidak bergantung pada data berita, guru, atau SPMB — itulah yang membuat
 * blok ini general dan aman dipakai di halaman mana pun.
 */

/* ============================================================
 * PEMBANTU — membaca `items` dari JSON dengan aman
 * ============================================================ */

/**
 * `props` datang dari kolom JSON, jadi isinya belum tentu sesuai dugaan.
 * Fungsi ini menyaring apa pun yang bukan objek, lalu memastikan tiap field
 * berupa string. Tanpa ini, satu nilai `null` dari data lama bisa membuat
 * seluruh halaman publik gagal render.
 */
function asRecords(value: unknown): Record<string, string>[] {
  if (!Array.isArray(value)) return [];
  const out: Record<string, string>[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const rec: Record<string, string> = {};
    for (const [k, v] of Object.entries(item as Record<string, unknown>)) {
      rec[k] = v === null || v === undefined ? "" : String(v);
    }
    out.push(rec);
  }
  return out;
}

/** Buang item yang seluruh isinya kosong — sisa baris baru yang belum diisi. */
function meaningful(rows: Record<string, string>[], keys: string[]) {
  return rows.filter((r) => keys.some((k) => (r[k] ?? "").trim().length > 0));
}

/* ============================================================
 * TABEL
 * ============================================================ */

export type TableProps = {
  heading?: string;
  columns?: unknown;
  rows?: unknown;
  footnote?: string;
};

export function TableBlock({
  props,
  variantKey,
}: {
  props: TableProps;
  variantKey: string;
}) {
  const heading = props.heading?.trim() ?? "";
  const columns = asRecords(props.columns).map((c) => c.label ?? "").filter(Boolean);
  const rows = meaningful(asRecords(props.rows), ["c0", "c1", "c2", "c3", "c4"]);

  if (columns.length === 0 || rows.length === 0) {
    return (
      <Section>
        {heading ? (
          <h2 className="font-display text-[var(--site-text)] text-2xl">{heading}</h2>
        ) : null}
        <p className="mt-2 text-sm italic text-[var(--site-muted)]">
          Tabel belum diisi.
        </p>
      </Section>
    );
  }

  const zebra = variantKey === "table.belang";

  return (
    <Section>
      {heading ? (
        <h2 className="font-display text-[var(--site-text)] text-2xl">{heading}</h2>
      ) : null}

      {/* Tabel lebar digulir mendatar, bukan dipaksa mengecil sampai tidak
          terbaca. Kolom pertama tetap menempel agar konteks baris tidak hilang. */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-[var(--site-border)]">
              {columns.map((label, i) => (
                <th
                  key={`${label}-${i}`}
                  className="px-3 py-2 text-left font-semibold text-[var(--site-text)]"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr
                key={ri}
                className={
                  zebra && ri % 2 === 1 ? "bg-[var(--site-surface)]" : undefined
                }
              >
                {columns.map((_, ci) => (
                  <td
                    key={ci}
                    className="border-b border-[var(--site-border)] px-3 py-2 align-top text-[var(--site-text)]"
                  >
                    {row[`c${ci}`] ?? ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {props.footnote?.trim() ? (
        <p className="mt-2 text-xs text-[var(--site-muted)]">{props.footnote}</p>
      ) : null}
    </Section>
  );
}

/* ============================================================
 * LANGKAH
 * ============================================================ */

export type StepsProps = {
  heading?: string;
  items?: unknown;
};

export function StepsBlock({
  props,
  variantKey,
}: {
  props: StepsProps;
  variantKey: string;
}) {
  const heading = props.heading?.trim() ?? "";
  const items = meaningful(asRecords(props.items), ["title", "body"]);

  if (items.length === 0) {
    return (
      <Section>
        {heading ? (
          <h2 className="font-display text-[var(--site-text)] text-2xl">{heading}</h2>
        ) : null}
        <p className="mt-2 text-sm italic text-[var(--site-muted)]">
          Langkah belum diisi.
        </p>
      </Section>
    );
  }

  if (variantKey === "steps.mendatar") {
    return (
      <Section>
        {heading ? (
          <h2 className="font-display text-[var(--site-text)] text-2xl">{heading}</h2>
        ) : null}
        <ol className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {items.slice(0, 4).map((item, i) => (
            <li key={i}>
              <span
                className="tabular-display block text-[var(--site-accent)]"
                style={{ fontSize: "clamp(1.75rem, 1.3rem + 1.6vw, 2.5rem)" }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-2 font-semibold text-[var(--site-text)]">
                {item.title}
              </h3>
              {item.body ? (
                <p className="mt-1 text-sm text-[var(--site-muted)]">{item.body}</p>
              ) : null}
            </li>
          ))}
        </ol>
      </Section>
    );
  }

  return (
    <Section>
      {heading ? (
        <h2 className="font-display text-[var(--site-text)] text-2xl">{heading}</h2>
      ) : null}
      <ol className="mt-6 space-y-6">
        {items.map((item, i) => (
          <li key={i} className="flex gap-5">
            <span
              aria-hidden
              className="tabular-display shrink-0 text-[var(--site-accent)]"
              style={{ fontSize: "clamp(1.5rem, 1.1rem + 1.4vw, 2rem)" }}
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0 border-l border-[var(--site-border)] pl-5">
              <h3 className="font-semibold text-[var(--site-text)]">{item.title}</h3>
              {item.body ? (
                <p className="mt-1 text-[var(--site-muted)]">{item.body}</p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </Section>
  );
}

/* ============================================================
 * LINIMASA
 * ============================================================ */

export type TimelineProps = {
  heading?: string;
  items?: unknown;
};

export function TimelineBlock({
  props,
  variantKey,
}: {
  props: TimelineProps;
  variantKey: string;
}) {
  const heading = props.heading?.trim() ?? "";
  const items = meaningful(asRecords(props.items), ["year", "title", "body"]);

  if (items.length === 0) {
    return (
      <Section>
        {heading ? (
          <h2 className="font-display text-[var(--site-text)] text-2xl">{heading}</h2>
        ) : null}
        <p className="mt-2 text-sm italic text-[var(--site-muted)]">
          Linimasa belum diisi.
        </p>
      </Section>
    );
  }

  const alternating = variantKey === "timeline.berselang";

  return (
    <Section>
      {heading ? (
        <h2 className="font-display text-[var(--site-text)] text-2xl">{heading}</h2>
      ) : null}

      <ol className="mt-8 space-y-8">
        {items.map((item, i) => {
          const right = alternating && i % 2 === 1;
          return (
            <li
              key={i}
              className={
                alternating
                  ? `sm:flex ${right ? "sm:justify-end" : ""}`
                  : "border-l-2 border-[var(--site-border)] pl-6"
              }
            >
              <div className={alternating ? "sm:w-1/2" : undefined}>
                {item.year ? (
                  <span className="tabular-display block text-sm font-semibold uppercase tracking-[0.16em] text-[var(--site-accent)]">
                    {item.year}
                  </span>
                ) : null}
                <h3 className="mt-1 font-semibold text-[var(--site-text)]">
                  {item.title}
                </h3>
                {item.body ? (
                  <p className="mt-1 text-[var(--site-muted)]">{item.body}</p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </Section>
  );
}

/* ============================================================
 * PRESTASI
 * ============================================================ */

export type AchievementsProps = {
  heading?: string;
  items?: unknown;
};

export function AchievementsBlock({
  props,
  variantKey,
}: {
  props: AchievementsProps;
  variantKey: string;
}) {
  const heading = props.heading?.trim() ?? "";
  const items = meaningful(asRecords(props.items), ["year", "title", "level", "winner"]);

  if (items.length === 0) {
    return (
      <Section>
        {heading ? (
          <h2 className="font-display text-[var(--site-text)] text-2xl">{heading}</h2>
        ) : null}
        <p className="mt-2 text-sm italic text-[var(--site-muted)]">
          Prestasi belum diisi.
        </p>
      </Section>
    );
  }

  if (variantKey === "achievements.sorotan") {
    return (
      <Section>
        {heading ? (
          <h2 className="font-display text-[var(--site-text)] text-2xl">{heading}</h2>
        ) : null}
        <ul className="mt-6 grid gap-6 sm:grid-cols-3">
          {items.slice(0, 3).map((item, i) => (
            <li key={i} className="border-t-2 border-[var(--site-accent)] pt-3">
              <span className="tabular-display block text-sm uppercase tracking-[0.16em] text-[var(--site-muted)]">
                {item.level || item.year}
              </span>
              <h3 className="mt-1 font-display text-lg text-[var(--site-text)]">
                {item.title}
              </h3>
              {item.winner ? (
                <p className="mt-1 text-sm text-[var(--site-muted)]">{item.winner}</p>
              ) : null}
            </li>
          ))}
        </ul>
      </Section>
    );
  }

  return (
    <Section>
      {heading ? (
        <h2 className="font-display text-[var(--site-text)] text-2xl">{heading}</h2>
      ) : null}
      <ul className="mt-4 divide-y divide-[var(--site-border)]">
        {items.map((item, i) => (
          <li key={i} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3">
            <span className="tabular-nums w-14 shrink-0 text-sm text-[var(--site-muted)]">
              {item.year}
            </span>
            <span className="min-w-0 flex-1 text-[var(--site-text)]">
              {item.title}
              {item.winner ? (
                <span className="text-[var(--site-muted)]"> — {item.winner}</span>
              ) : null}
            </span>
            {item.level ? (
              <span className="shrink-0 text-xs uppercase tracking-[0.14em] text-[var(--site-accent)]">
                {item.level}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </Section>
  );
}

/* ============================================================
 * UNDUHAN
 * ============================================================ */

export type DownloadsProps = {
  heading?: string;
  items?: unknown;
};

export function DownloadsBlock({
  props,
  variantKey,
}: {
  props: DownloadsProps;
  variantKey: string;
}) {
  const heading = props.heading?.trim() ?? "";
  const items = meaningful(asRecords(props.items), ["title", "url"]).filter(
    (r) => (r.url ?? "").trim().length > 0,
  );

  if (items.length === 0) {
    return (
      <Section>
        {heading ? (
          <h2 className="font-display text-[var(--site-text)] text-2xl">{heading}</h2>
        ) : null}
        <p className="mt-2 text-sm italic text-[var(--site-muted)]">
          Belum ada berkas unduhan.
        </p>
      </Section>
    );
  }

  const asCards = variantKey === "downloads.kartu";

  return (
    <Section>
      {heading ? (
        <h2 className="font-display text-[var(--site-text)] text-2xl">{heading}</h2>
      ) : null}

      <ul
        className={
          asCards ? "mt-6 grid gap-4 sm:grid-cols-2" : "mt-4 divide-y divide-[var(--site-border)]"
        }
      >
        {items.map((item, i) => (
          <li key={i} className={asCards ? "border border-[var(--site-border)] p-4" : "py-3"}>
            <a
              href={item.url}
              // Berkas unduhan hampir selalu PDF di server lain; dibuka di tab
              // baru agar pengunjung tidak meninggalkan halaman sekolah.
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-baseline justify-between gap-4"
            >
              <span className="min-w-0">
                <span className="block font-medium text-[var(--site-text)] underline-offset-4 group-hover:underline">
                  {item.title || "Berkas"}
                </span>
                {item.note ? (
                  <span className="mt-0.5 block text-sm text-[var(--site-muted)]">
                    {item.note}
                  </span>
                ) : null}
              </span>
              {item.size ? (
                <span className="shrink-0 text-xs tabular-nums text-[var(--site-muted)]">
                  {item.size}
                </span>
              ) : null}
            </a>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/* ============================================================
 * KARTU
 * ============================================================ */

export type CardsProps = {
  heading?: string;
  items?: unknown;
};

export function CardsBlock({
  props,
  variantKey,
}: {
  props: CardsProps;
  variantKey: string;
}) {
  const heading = props.heading?.trim() ?? "";
  const items = meaningful(asRecords(props.items), ["title", "body", "imageUrl", "value"]);

  if (items.length === 0) {
    return (
      <Section>
        {heading ? (
          <h2 className="font-display text-[var(--site-text)] text-2xl">{heading}</h2>
        ) : null}
        <p className="mt-2 text-sm italic text-[var(--site-muted)]">
          Kartu belum diisi.
        </p>
      </Section>
    );
  }

  if (variantKey === "cards.daftar") {
    return (
      <Section>
        {heading ? (
          <h2 className="font-display text-[var(--site-text)] text-2xl">{heading}</h2>
        ) : null}
        <ul className="mt-6 space-y-4">
          {items.map((item, i) => (
            <li
              key={i}
              className="border-l-2 border-[var(--site-accent)] bg-[var(--site-surface)] p-5"
            >
              <h3 className="font-display text-lg text-[var(--site-text)]">
                {item.title}
              </h3>
              {item.body ? (
                <p className="mt-1 text-[var(--site-muted)]">{item.body}</p>
              ) : null}
            </li>
          ))}
        </ul>
      </Section>
    );
  }

  if (variantKey === "cards.angka") {
    return (
      <Section>
        {heading ? (
          <h2 className="font-display text-[var(--site-text)] text-2xl">{heading}</h2>
        ) : null}
        <ul className="mt-6 grid gap-8 sm:grid-cols-3">
          {items.slice(0, 6).map((item, i) => (
            <li key={i}>
              <span
                className="tabular-display block text-[var(--site-accent)]"
                style={{ fontSize: "clamp(2rem, 1.4rem + 2.4vw, 3rem)" }}
              >
                {item.value || item.title}
              </span>
              <span className="mt-1 block text-sm text-[var(--site-muted)]">
                {item.value ? item.title : item.body}
              </span>
            </li>
          ))}
        </ul>
      </Section>
    );
  }

  return (
    <Section>
      {heading ? (
        <h2 className="font-display text-[var(--site-text)] text-2xl">{heading}</h2>
      ) : null}
      <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item, i) => (
          <li key={i} className="border border-[var(--site-border)]">
            {item.imageUrl ? (
              <SiteImage src={item.imageUrl} alt={item.title || "Gambar"} ratio="4/3" />
            ) : null}
            <div className="p-4">
              <h3 className="font-semibold text-[var(--site-text)]">{item.title}</h3>
              {item.body ? (
                <p className="mt-1 text-sm text-[var(--site-muted)]">{item.body}</p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/* ============================================================
 * KUTIPAN
 * ============================================================ */

export type QuoteProps = {
  quote?: string;
  attribution?: string;
  role?: string;
  photoUrl?: string;
};

export function QuoteBlock({
  props,
  variantKey,
}: {
  props: QuoteProps;
  variantKey: string;
}) {
  const quote = props.quote?.trim() ?? "";
  if (!quote) return null;

  const attribution = props.attribution?.trim() ?? "";
  const role = props.role?.trim() ?? "";

  if (variantKey === "quote.kartu") {
    return (
      <Section>
        <figure className="flex flex-col gap-5 border-l-4 border-[var(--site-accent)] bg-[var(--site-surface)] p-6 sm:flex-row sm:items-start">
          {props.photoUrl ? (
            <div className="w-24 shrink-0">
              <SiteImage src={props.photoUrl} alt={attribution || "Foto"} ratio="1/1" />
            </div>
          ) : null}
          <div className="min-w-0">
            <blockquote className="font-display text-lg leading-relaxed text-[var(--site-text)]">
              &ldquo;{quote}&rdquo;
            </blockquote>
            {attribution ? (
              <figcaption className="mt-3 text-sm">
                <span className="font-semibold text-[var(--site-text)]">{attribution}</span>
                {role ? <span className="text-[var(--site-muted)]"> · {role}</span> : null}
              </figcaption>
            ) : null}
          </div>
        </figure>
      </Section>
    );
  }

  return (
    <Section>
      <figure className="mx-auto max-w-3xl text-center">
        <blockquote
          className="font-display leading-snug text-[var(--site-text)]"
          style={{ fontSize: "clamp(1.35rem, 1rem + 1.6vw, 2rem)" }}
        >
          &ldquo;{quote}&rdquo;
        </blockquote>
        {attribution ? (
          <figcaption className="mt-4 text-sm text-[var(--site-muted)]">
            {attribution}
            {role ? ` · ${role}` : ""}
          </figcaption>
        ) : null}
      </figure>
    </Section>
  );
}

/* ============================================================
 * VIDEO
 * ============================================================ */

export type VideoProps = {
  heading?: string;
  youtubeUrl?: string;
  caption?: string;
};

/**
 * Ambil ID video YouTube dari berbagai bentuk alamat.
 *
 * Operator menempel alamat apa adanya dari bilah alamat peramban — bisa
 * `watch?v=`, `youtu.be/`, atau `embed/`. Menuntut satu bentuk tertentu berarti
 * menolak alamat yang jelas benar.
 */
function youtubeId(url: string): string | null {
  const patterns = [
    /youtu\.be\/([\w-]{11})/,
    /[?&]v=([\w-]{11})/,
    /youtube\.com\/embed\/([\w-]{11})/,
    /youtube\.com\/shorts\/([\w-]{11})/,
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m) return m[1];
  }
  return null;
}

export function VideoBlock({
  props,
  variantKey,
}: {
  props: VideoProps;
  variantKey: string;
}) {
  const heading = props.heading?.trim() ?? "";
  const url = props.youtubeUrl?.trim() ?? "";
  const id = url ? youtubeId(url) : null;

  if (!id) {
    return (
      <Section>
        {heading ? (
          <h2 className="font-display text-[var(--site-text)] text-2xl">{heading}</h2>
        ) : null}
        <p className="mt-2 text-sm italic text-[var(--site-muted)]">
          {url
            ? "Alamat video tidak dikenali. Tempel alamat YouTube yang lengkap."
            : "Blok video belum diisi."}
        </p>
      </Section>
    );
  }

  return (
    <Section>
      {heading ? (
        <h2 className="font-display text-[var(--site-text)] text-2xl">{heading}</h2>
      ) : null}
      <div className={variantKey === "video.tengah" ? "mx-auto mt-4 max-w-2xl" : "mt-4"}>
        <div className="relative aspect-video w-full bg-[var(--site-surface)]">
          <iframe
            // `youtube-nocookie.com`: halaman sekolah tidak perlu memberi
            // YouTube cookie pelacak hanya karena pengunjung melihat video.
            src={`https://www.youtube-nocookie.com/embed/${id}`}
            title={heading || "Video sekolah"}
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
            className="absolute inset-0 h-full w-full"
          />
        </div>
        {props.caption?.trim() ? (
          <p className="mt-2 text-sm text-[var(--site-muted)]">{props.caption}</p>
        ) : null}
      </div>
    </Section>
  );
}
