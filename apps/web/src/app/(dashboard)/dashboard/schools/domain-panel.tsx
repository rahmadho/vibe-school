"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input } from "@/components/ui";
import { FormError } from "@/components/form-fields";
import type { ActionResult } from "@/lib/action-result";
import { DOMAIN_STATUS_LABEL } from "@/lib/domain-labels";

/**
 * Panel "Domain" — dipakai di halaman Ubah sekolah.
 *
 * Terpisah dari SchoolForm karena alurnya berbeda: domain TIDAK disimpan lewat
 * "Simpan perubahan", melainkan didaftarkan, lalu diverifikasi terhadap DNS.
 * Menggabungkannya ke satu tombol simpan membuat admin mengira domain langsung
 * aktif padahal record TXT belum ada.
 */

export type StatusDomain = "UNVERIFIED" | "PENDING" | "VERIFIED" | "FAILED";

const STATUS_TONE: Record<StatusDomain, string> = {
  UNVERIFIED: "text-slate",
  PENDING: "text-marker",
  VERIFIED: "text-board",
  FAILED: "text-marker",
};

export function DomainPanel({
  schoolId,
  customDomain,
  customStatus,
  customToken,
  aliases,
  rootDomain,
  zonaTerpercaya,
  bolehWhiteLabel,
  daftar,
  verifikasi,
  hapus,
}: {
  schoolId: string;
  customDomain: string | null;
  customStatus: StatusDomain;
  customToken: string | null;
  aliases: Array<{ id: string; host: string; verifyStatus: StatusDomain; verifyToken: string }>;
  rootDomain: string;
  /** Nilai DOMAIN_TRUSTED_ZONES yang cocok untuk host ini (kosong = tidak). */
  zonaTerpercaya: boolean;
  bolehWhiteLabel: boolean;
  daftar: (fd: FormData) => Promise<ActionResult>;
  verifikasi: (fd: FormData) => Promise<ActionResult>;
  hapus: (fd: FormData) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function jalankan(
    kunci: string,
    action: (fd: FormData) => Promise<ActionResult>,
    fd: FormData,
  ) {
    setPending(kunci);
    setError(null);
    setInfo(null);
    fd.set("schoolId", schoolId);
    const res = await action(fd);
    if (res.ok) setInfo(res.message ?? "Selesai.");
    else setError(res.error);
    setPending(null);
    router.refresh();
  }

  return (
    <section className="card space-y-4">
      <div>
        <h2 className="card-title">Domain</h2>
        <p className="mt-1 text-sm text-slate">
          Domain sendiri adalah <strong>add-on berbayar (White-label)</strong>. Tanpa
          add-on, sekolah tetap punya alamat gratis{" "}
          <span className="font-mono">&lt;slug&gt;.{rootDomain}</span>.
        </p>
      </div>

      {!bolehWhiteLabel ? (
        <p className="border-l-4 border-marker bg-marker/5 px-3 py-2 text-sm text-ink">
          Paket sekolah ini belum mencakup add-on domain. Tambahkan sebagai add-on
          dari halaman Langganan.
        </p>
      ) : null}

      <FormError message={error} />
      {info ? <p className="text-sm text-board">{info}</p> : null}

      {/* ---- Daftarkan domain ---- */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          jalankan("daftar", daftar, new FormData(e.currentTarget));
        }}
        className="flex flex-wrap items-end gap-3 border-t border-chalk pt-4"
      >
        <div className="min-w-[16rem] flex-1">
        <Field label="Nama domain" htmlFor="host">
          <Input
            id="host"
            name="host"
            placeholder="sman1-padang.sch.id"
            className="font-mono lowercase"
            disabled={!bolehWhiteLabel || pending !== null}
          />
        </Field>
        </div>
        <Button type="submit" disabled={!bolehWhiteLabel || pending !== null}>
          {pending === "daftar" ? "Mendaftarkan…" : "Daftarkan domain"}
        </Button>
      </form>

      {zonaTerpercaya ? (
        <p className="text-xs text-board">
          Domain di zona layanan — terverifikasi otomatis tanpa record TXT.
        </p>
      ) : null}

      {/* ---- Domain utama ---- */}
      {customDomain ? (
        <div className="space-y-3 border-t border-chalk pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-mono text-sm text-ink">{customDomain}</p>
              <p className="text-xs text-slate">
                Domain utama ·{" "}
                <span className={STATUS_TONE[customStatus]}>
                  {DOMAIN_STATUS_LABEL[customStatus]}
                </span>
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                disabled={pending !== null || !bolehWhiteLabel}
                onClick={() => {
                  const fd = new FormData();
                  fd.set("target", "customDomain");
                  if (confirm(`Hapus domain utama ${customDomain}?`)) {
                    void jalankan("hapus-utama", hapus, fd);
                  }
                }}
              >
                Hapus
              </Button>
            </div>
          </div>

          {/* Tombol verifikasi asli (dengan host) — di luar form daftar. */}
          {customStatus !== "VERIFIED" && customToken ? (
            <>
              <InstruksiDns host={customDomain} token={customToken} rootDomain={rootDomain} />
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  jalankan("verif-utama", verifikasi, fd);
                }}
              >
                <input type="hidden" name="host" value={customDomain} />
                <Button type="submit" disabled={pending !== null || !bolehWhiteLabel}>
                  {pending === "verif-utama" ? "Memeriksa DNS…" : "Verifikasi sekarang"}
                </Button>
              </form>
            </>
          ) : null}
        </div>
      ) : null}

      {/* ---- Domain tambahan ---- */}
      {aliases.length > 0 ? (
        <div className="space-y-3 border-t border-chalk pt-4">
          <h3 className="text-sm font-medium text-ink">Domain tambahan</h3>
          <ul className="space-y-3">
            {aliases.map((a) => (
              <li key={a.id} className="rounded border border-chalk px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-mono text-sm text-ink">{a.host}</p>
                    <p className={`text-xs ${STATUS_TONE[a.verifyStatus]}`}>
                      {DOMAIN_STATUS_LABEL[a.verifyStatus]}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {a.verifyStatus !== "VERIFIED" ? (
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={pending !== null || !bolehWhiteLabel}
                        onClick={() => {
                          const fd = new FormData();
                          fd.set("aliasId", a.id);
                          void jalankan(`verif-${a.id}`, verifikasi, fd);
                        }}
                      >
                        {pending === `verif-${a.id}` ? "Memeriksa DNS…" : "Verifikasi sekarang"}
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={pending !== null || !bolehWhiteLabel}
                      onClick={() => {
                        if (!confirm(`Hapus domain ${a.host}?`)) return;
                        const fd = new FormData();
                        fd.set("aliasId", a.id);
                        void jalankan(`hapus-${a.id}`, hapus, fd);
                      }}
                    >
                      Hapus
                    </Button>
                  </div>
                </div>
                {a.verifyStatus !== "VERIFIED" ? (
                  <div className="mt-2">
                    <InstruksiDns host={a.host} token={a.verifyToken} rootDomain={rootDomain} />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

/** Instruksi DNS: record TXT untuk verifikasi + CNAME untuk pengalihan. */
function InstruksiDns({
  host,
  token,
  rootDomain,
}: {
  host: string;
  token: string;
  rootDomain: string;
}) {
  const txName = `_sekolah-verify.${host}`;
  const txValue = `sekolah-verify=${token}`;

  return (
    <div className="space-y-2 rounded border border-chalk bg-chalk/20 px-3 py-2 text-xs">
      <p className="text-slate">
        Pasang dua record berikut di panel DNS domain Anda, lalu tekan{" "}
        <em>Verifikasi sekarang</em>.
      </p>
      <Salin label="TXT (verifikasi)" name={txName} value={txValue} />
      <Salin label={`CNAME (arahkan ke server)`} name={host} value={rootDomain} />
    </div>
  );
}

function Salin({ label, name, value }: { label: string; name: string; value: string }) {
  const [tersalin, setTersalin] = useState(false);
  return (
    <div>
      <p className="text-slate">{label}</p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <code className="break-all rounded bg-white px-2 py-1 font-mono text-ink">{name}</code>
        <span aria-hidden className="text-slate-light">→</span>
        <code className="break-all rounded bg-white px-2 py-1 font-mono text-ink">{value}</code>
        <button
          type="button"
          className="text-board underline"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setTersalin(true);
              setTimeout(() => setTersalin(false), 1500);
            } catch {
              setTersalin(false);
            }
          }}
        >
          {tersalin ? "Tersalin" : "Salin nilai"}
        </button>
      </div>
    </div>
  );
}
