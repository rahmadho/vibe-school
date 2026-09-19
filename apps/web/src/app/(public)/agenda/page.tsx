import Link from "next/link";
import { notFound } from "next/navigation";
import { resolveSchoolFromRequest } from "@/lib/site-server";
import { listPublishedPosts } from "@/lib/data/site";
import {
  Section,
  SectionHeading,
  SiteCard,
  SiteImage,
  BlockEmpty,
  SiteButton,
  formatSiteDate,
} from "@/components/site/site-ui";

/**
 * Halaman agenda sekolah.
 *
 * Agenda berbeda dari berita dalam satu hal penting bagi pembaca: orang tua
 * mencari "apa yang akan datang", bukan "apa yang sudah terjadi". Karena itu
 * agenda yang AKAN DATANG ditaruh lebih dulu, dan yang sudah lewat ditandai
 * jelas supaya tidak tertukar.
 */
export const dynamic = "force-dynamic";
export const metadata = { title: "Agenda" };

export default async function AgendaPage() {
  const ctx = await resolveSchoolFromRequest();
  if (ctx.status !== "ok") notFound();

  const items = await listPublishedPosts(ctx.school.id, { type: "AGENDA", take: 50 });

  const now = Date.now();
  // Agenda terdekat lebih dulu; yang sudah lewat di bawah, urut terbaru.
  const upcoming = items
    .filter((i) => (i.publishedAt ?? i.createdAt).getTime() >= now)
    .sort(
      (a, b) =>
        (a.publishedAt ?? a.createdAt).getTime() - (b.publishedAt ?? b.createdAt).getTime(),
    );
  const past = items
    .filter((i) => (i.publishedAt ?? i.createdAt).getTime() < now)
    .sort(
      (a, b) =>
        (b.publishedAt ?? b.createdAt).getTime() - (a.publishedAt ?? a.createdAt).getTime(),
    );

  return (
    <Section>
      <SectionHeading
        title="Agenda Sekolah"
        subtitle={`Kegiatan yang akan datang di ${ctx.school.name}`}
      />

      {items.length === 0 && (
        <BlockEmpty
          message="Belum ada agenda"
          hint="Kegiatan yang diterbitkan sekolah akan tampil di halaman ini."
        />
      )}

      {upcoming.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-[family-name:var(--site-heading-font)] text-lg font-semibold text-[var(--site-text)]">
            Akan datang
          </h2>
          <ul className="space-y-3">
            {upcoming.map((a) => (
              <AgendaRow key={a.id} item={a} />
            ))}
          </ul>
        </div>
      )}

      {past.length > 0 && (
        <div className="mt-10 space-y-3">
          <h2 className="font-[family-name:var(--site-heading-font)] text-lg font-semibold text-[var(--site-muted)]">
            Sudah berlangsung
          </h2>
          <ul className="space-y-3">
            {past.map((a) => (
              <AgendaRow key={a.id} item={a} past />
            ))}
          </ul>
        </div>
      )}
    </Section>
  );
}

/**
 * Satu baris agenda.
 *
 * Tanggal ditampilkan sebagai kotak angka besar di kiri — pola buku agenda
 * dinding. Orang tua memindai tanggal, bukan judul, jadi mata harus jatuh ke
 * tanggal lebih dulu.
 */
function AgendaRow({
  item,
  past = false,
}: {
  item: { id: string; title: string; slug: string; excerpt: string | null; coverUrl: string | null; publishedAt: Date | null; createdAt: Date };
  past?: boolean;
}) {
  const d = item.publishedAt ?? item.createdAt;

  return (
    <li>
      <SiteCard>
        <Link href={`/berita/${item.slug}`} className="flex items-stretch gap-4 p-4">
          <div
            className="flex w-16 shrink-0 flex-col items-center justify-center border py-2"
            style={{
              borderColor: past ? "var(--site-border)" : "var(--site-primary)",
              borderRadius: "var(--site-radius-card)",
              backgroundColor: past ? "transparent" : "var(--site-surface)",
            }}
          >
            <span
              className="font-[family-name:var(--site-heading-font)] text-2xl font-semibold leading-none"
              style={{ color: past ? "var(--site-muted)" : "var(--site-primary)" }}
            >
              {d.getDate()}
            </span>
            <span className="mt-0.5 text-[11px] uppercase tracking-wide text-[var(--site-muted)]">
              {d.toLocaleDateString("id-ID", { month: "short" })}
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <h3
              className={
                past
                  ? "font-[family-name:var(--site-heading-font)] text-base font-semibold text-[var(--site-muted)]"
                  : "font-[family-name:var(--site-heading-font)] text-base font-semibold text-[var(--site-text)]"
              }
            >
              {item.title}
            </h3>
            <p className="mt-0.5 text-xs text-[var(--site-muted)]">
              {formatSiteDate(d)}
              {past ? " · sudah berlangsung" : ""}
            </p>
            {item.excerpt && (
              <p className="mt-1.5 text-sm text-[var(--site-muted)]">
                {item.excerpt.length > 150 ? `${item.excerpt.slice(0, 150)}…` : item.excerpt}
              </p>
            )}
          </div>

          {item.coverUrl && (
            <div className="hidden w-28 shrink-0 sm:block">
              <SiteImage src={item.coverUrl} alt={item.title} ratio="1/1" />
            </div>
          )}
        </Link>
      </SiteCard>
    </li>
  );
}
