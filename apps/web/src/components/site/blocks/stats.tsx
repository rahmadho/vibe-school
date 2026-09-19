import { BlockEmpty, Section, SectionHeading, SiteCard } from "@/components/site/site-ui";

/**
 * Blok "stats" (Angka Capaian) — 2 varian gaya.
 *
 * APA: menampilkan angka-angka penting sekolah (jumlah siswa, guru, kelas, dll).
 * KENAPA memakai SiteCard + warna CSS variable: kartu harus seragam dengan blok
 * lain dan otomatis ikut tema yang dipilih sekolah. Blok ini server component
 * murni (statis) karena tidak butuh interaksi.
 */

export type StatsProps = {
  heading?: string;
  items?: { label: string; value: string }[];
};

export function StatsBlock({
  props,
  variantKey,
}: {
  props: StatsProps;
  variantKey: string;
}) {
  const heading = props.heading?.trim() || "";
  // Hanya terima item yang benar-benar punya label dan angka agar tidak ada
  // kartu kosong yang tampil aneh di halaman.
  const items = (props.items ?? []).filter(
    (item) => item.label?.trim() && item.value?.trim(),
  );

  // Tanpa data, tampilkan panduan agar sekolah tahu harus mengisi apa.
  if (items.length === 0) {
    return (
      <Section>
        <SectionHeading title={heading || "Angka Capaian"} />
        <BlockEmpty
          message="Belum ada angka yang diisi"
          hint="Tambahkan jumlah siswa, guru, atau kelas melalui editor halaman depan."
        />
      </Section>
    );
  }

  /* ---------- Varian: tiga angka (grid 3 kolom, angka besar) ---------- */
  if (variantKey === "stats.tiga-angka") {
    return (
      <Section>
        <SectionHeading title={heading || undefined} />
        <div className="grid gap-6 sm:grid-cols-3">
          {items.map((item, index) => (
            <SiteCard key={index} className="px-6 py-8 text-center">
              <div className="font-[family-name:var(--site-heading-font)] text-4xl font-bold leading-none text-[var(--site-primary)]">
                {item.value}
              </div>
              <div className="mt-3 text-sm font-medium text-[var(--site-muted)]">
                {item.label}
              </div>
            </SiteCard>
          ))}
        </div>
      </Section>
    );
  }

  /* ---------- Varian: bilah capaian (satu baris memanjang) ---------- */
  return (
    <Section tone="primary">
      <SectionHeading title={heading || undefined} onPrimary align="center" />
      <div className="flex flex-wrap items-stretch justify-center">
        {items.map((item, index) => (
          <div
            key={index}
            className={`min-w-[9rem] flex-1 px-6 py-4 text-center ${
              index > 0 ? "border-l border-[var(--site-border)]" : ""
            }`}
          >
            <div className="font-[family-name:var(--site-heading-font)] text-3xl font-bold leading-none sm:text-4xl">
              {item.value}
            </div>
            <div className="mt-2 text-sm font-medium opacity-90">{item.label}</div>
          </div>
        ))}
      </div>
    </Section>
  );
}
