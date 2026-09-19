import { BlockEmpty, Section, SectionHeading, SiteButton, SiteCard } from "@/components/site/site-ui";

/**
 * Blok "Kontak & Lokasi" — 2 varian gaya.
 *
 * Semua field sifatnya opsional: yang kosong DILEWATI, tidak ditampilkan
 * sebagai tanda hubung. Bila seluruhnya kosong, tampilkan BlockEmpty agar
 * sekolah tahu harus mengisi lewat Pengaturan Website.
 */

export type ContactInfo = {
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  mapsUrl?: string | null;
  officeHours?: string | null;
  contactWa?: string | null;
  facebookUrl?: string | null;
  instagramUrl?: string | null;
  youtubeUrl?: string | null;
  tiktokUrl?: string | null;
};

export type ContactProps = {
  heading?: string;
  showMap?: boolean;
  showHours?: boolean;
};

/**
 * Ubah nomor WhatsApp menjadi bentuk yang diterima wa.me:
 * hanya angka, tanpa "+" dan tanpa "0" di depan.
 * Contoh: "+62 812-3456" / "0812-3456" -> "628123456"
 */
function waNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.startsWith("0") ? `62${digits.slice(1)}` : digits;
}

export function ContactBlock({
  props,
  variantKey,
  contact,
  schoolName,
}: {
  props: ContactProps;
  variantKey: string;
  contact: ContactInfo;
  schoolName: string;
}) {
  const heading = props.heading?.trim() || "";
  const showMap = props.showMap !== false;
  const showHours = props.showHours !== false;

  const address = contact.address?.trim() || "";
  const phone = contact.phone?.trim() || "";
  const email = contact.email?.trim() || "";
  const mapsUrl = contact.mapsUrl?.trim() || "";
  const officeHours = contact.officeHours?.trim() || "";
  const wa = contact.contactWa?.trim() || "";

  // Tidak ada satu pun info kontak yang bisa ditampilkan.
  if (!address && !phone && !email && !officeHours && !wa) {
    return (
      <Section>
        <SectionHeading title={heading} />
        <BlockEmpty
          message="Info kontak belum diisi"
          hint="Isi alamat, telepon, atau email lewat Pengaturan Website."
        />
      </Section>
    );
  }

  // Daftar info kontak dipakai bersama oleh kedua varian.
  const infoList = (
    <dl className="space-y-4">
      {address ? (
        <div>
          <dt className="text-sm font-semibold text-[var(--site-text)]">Alamat</dt>
          <dd className="mt-0.5 text-[var(--site-text)]">{address}</dd>
        </div>
      ) : null}

      {phone ? (
        <div>
          <dt className="text-sm font-semibold text-[var(--site-text)]">Telepon</dt>
          <dd className="mt-0.5">
            <a
              href={`tel:${phone}`}
              className="text-[var(--site-primary)] hover:underline"
            >
              {phone}
            </a>
          </dd>
        </div>
      ) : null}

      {email ? (
        <div>
          <dt className="text-sm font-semibold text-[var(--site-text)]">Email</dt>
          <dd className="mt-0.5">
            <a
              href={`mailto:${email}`}
              className="text-[var(--site-primary)] hover:underline"
            >
              {email}
            </a>
          </dd>
        </div>
      ) : null}

      {showHours && officeHours ? (
        <div>
          <dt className="text-sm font-semibold text-[var(--site-text)]">Jam Layanan</dt>
          <dd className="mt-0.5 whitespace-pre-line text-[var(--site-text)]">{officeHours}</dd>
        </div>
      ) : null}

      {wa ? (
        <div>
          <SiteButton href={`https://wa.me/${waNumber(wa)}`} variant="accent" external>
            Hubungi via WhatsApp
          </SiteButton>
        </div>
      ) : null}
    </dl>
  );

  /* ---------- Varian: ringkas (tanpa peta) ---------- */
  if (variantKey === "contact.ringkas") {
    return (
      <Section>
        <SectionHeading title={heading} />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{infoList}</div>
      </Section>
    );
  }

  /* ---------- Varian: peta + info ---------- */
  const mapVisible = showMap && mapsUrl;

  return (
    <Section tone="surface">
      <SectionHeading title={heading} />
      <div className={`grid gap-8 ${mapVisible ? "lg:grid-cols-2" : ""}`}>
        <div>{infoList}</div>

        {mapVisible ? (
          <SiteCard className="overflow-hidden p-0">
            <iframe
              src={mapsUrl}
              title={`Peta lokasi ${schoolName}`}
              loading="lazy"
              className="h-full w-full"
              style={{ aspectRatio: "16/9", border: 0 }}
              referrerPolicy="no-referrer-when-downgrade"
            />
          </SiteCard>
        ) : null}
      </div>
    </Section>
  );
}
