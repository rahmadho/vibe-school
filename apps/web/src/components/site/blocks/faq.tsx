import { BlockEmpty, Section, SectionHeading, SiteCard } from "@/components/site/site-ui";

/**
 * Blok "faq" (Tanya Jawab) — 2 varian gaya.
 *
 * APA: daftar pertanyaan yang sering diajukan orang tua beserta jawabannya.
 * KENAPA memakai <details>/<summary> asli: akordeon tanpa JavaScript berarti
 * blok ini tetap server component, tanpa useState, tanpa hidrasi — cepat dan
 * tetap berfungsi walau JS gagal dimuat.
 */

export type FaqProps = {
  heading?: string;
  items?: { question: string; answer: string }[];
};

export function FaqBlock({
  props,
  variantKey,
}: {
  props: FaqProps;
  variantKey: string;
}) {
  const heading = props.heading?.trim() || "";
  // Buang item yang tidak lengkap supaya tidak ada akordeon berisi jawaban kosong.
  const items = (props.items ?? []).filter(
    (item) => item.question?.trim() && item.answer?.trim(),
  );

  if (items.length === 0) {
    return (
      <Section>
        <SectionHeading title={heading || "Tanya Jawab"} />
        <BlockEmpty
          message="Belum ada tanya jawab"
          hint="Tambahkan pertanyaan yang sering diajukan orang tua."
        />
      </Section>
    );
  }

  /* ---------- Varian: akordeon (details/summary, tanpa JS) ---------- */
  if (variantKey === "faq.akordeon") {
    return (
      <Section>
        <SectionHeading title={heading || undefined} />
        <div className="site-stagger space-y-3">
          {items.map((item, index) => (
            <SiteCard key={index} className="overflow-hidden">
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-semibold text-[var(--site-text)] transition-colors hover:text-[var(--site-primary)]">
                  <span>{item.question}</span>
                  {/*
                    Penanda buka/tutup murni CSS, tanpa state React.
                    Berputar 45° sehingga "+" menjadi "×" — gerakan kecil yang
                    memberi tahu keadaan akordeon tanpa perlu teks tambahan.
                  */}
                  <span
                    aria-hidden="true"
                    className="shrink-0 text-lg leading-none text-[var(--site-muted)] transition-transform duration-300 ease-out group-open:rotate-45 group-open:text-[var(--site-primary)] motion-reduce:transition-none"
                  >
                    +
                  </span>
                </summary>
                {/*
                  Jawaban muncul dengan gerakan halus saat dibuka.
                  `details[open]` baru ada setelah diklik, jadi animasinya
                  berjalan sekali di setiap pembukaan — tanpa JavaScript.
                */}
                <div
                  className="border-t border-[var(--site-border)] px-5 py-4 text-sm leading-relaxed text-[var(--site-muted)]"
                  style={{
                    animation: "site-fade 340ms cubic-bezier(0.16, 1, 0.3, 1) both",
                  }}
                >
                  {item.answer}
                </div>
              </details>
            </SiteCard>
          ))}
        </div>
      </Section>
    );
  }

  /* ---------- Varian: dua kolom (semua jawaban terbuka) ---------- */
  return (
    <Section tone="surface">
      <SectionHeading title={heading || undefined} />
      <div className="site-stagger grid gap-6 lg:grid-cols-2">
        {items.map((item, index) => (
          <SiteCard key={index} className="px-5 py-5">
            <h3 className="font-[family-name:var(--site-heading-font)] text-base font-semibold text-[var(--site-text)]">
              {item.question}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--site-muted)]">
              {item.answer}
            </p>
          </SiteCard>
        ))}
      </div>
    </Section>
  );
}
