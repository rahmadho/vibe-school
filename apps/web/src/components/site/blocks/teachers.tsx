import { BlockEmpty, Section, SectionHeading, SiteCard, SiteImage } from "@/components/site/site-ui";

/**
 * Blok "Guru & Tenaga Kependidikan" — 2 varian gaya.
 *
 * Menerima daftar orang dari luar (bukan mengambil data sendiri) supaya
 * komponen ini murni tampilan dan mudah diuji.
 */

export type PersonItem = {
  id: string;
  name: string;
  position: string;
  photoUrl: string | null;
};

export type TeachersProps = {
  heading?: string;
  itemCount?: number;
  showPosition?: boolean;
};

export function TeachersBlock({
  props,
  variantKey,
  people,
}: {
  props: TeachersProps;
  variantKey: string;
  people: PersonItem[];
}) {
  const heading = props.heading?.trim() || "";
  const showPosition = props.showPosition !== false;

  // Batasi jumlah tampil sesuai pengaturan, tetapi jangan sampai nol.
  const limit = Math.max(1, props.itemCount ?? 6);
  const list = people.slice(0, limit);

  // Belum ada data: beri tahu sekolah apa yang harus dilakukan.
  if (people.length === 0) {
    return (
      <Section>
        <SectionHeading title={heading} />
        <BlockEmpty
          message="Belum ada data guru"
          hint="Data guru dan staf yang aktif akan tampil di sini."
        />
      </Section>
    );
  }

  /* ---------- Varian: kisi foto ---------- */
  if (variantKey === "teachers.kisi-foto") {
    return (
      <Section>
        <SectionHeading title={heading} />
        <ul className="site-stagger grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
          {list.map((person) => (
            <li key={person.id} className="group text-center">
              <SiteImage src={person.photoUrl} alt={person.name} ratio="3/4" zoomOnHover />
              <p className="mt-3 font-semibold text-[var(--site-text)]">{person.name}</p>
              {showPosition && person.position ? (
                <p className="mt-0.5 text-sm text-[var(--site-muted)]">{person.position}</p>
              ) : null}
            </li>
          ))}
        </ul>
      </Section>
    );
  }

  /* ---------- Varian: daftar tanpa foto ---------- */
  return (
    <Section tone="surface">
      <SectionHeading title={heading} />
      <SiteCard className="divide-y divide-[var(--site-border)] px-5 py-2 sm:px-6">
        <ul>
          {list.map((person) => (
            <li
              key={person.id}
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3"
            >
              <span className="font-medium text-[var(--site-text)]">{person.name}</span>
              {showPosition && person.position ? (
                <span className="text-sm text-[var(--site-muted)]">{person.position}</span>
              ) : null}
            </li>
          ))}
        </ul>
      </SiteCard>
    </Section>
  );
}
