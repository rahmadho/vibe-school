import { wajibKonteksPortal } from "@/lib/portal-akses";
import { tagihanPortal } from "@/lib/data/portal";
import { formatDate, formatRupiah } from "@/lib/format";

export const dynamic = "force-dynamic";

const LABEL_STATUS: Record<string, string> = {
  UNPAID: "Belum dibayar",
  PARTIAL: "Dibayar sebagian",
  PAID: "Lunas",
  OVERDUE: "Terlambat",
  CANCELLED: "Dibatalkan",
  REFUNDED: "Dikembalikan",
};

/** Tagihan + riwayat pembayaran. */
export default async function PortalTagihanPage() {
  const { anak } = await wajibKonteksPortal();
  const { tagihan, pembayaran, belumLunas } = await tagihanPortal(
    anak.id,
    anak.schoolId,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="font-display text-2xl text-ink">Tagihan</h1>
        {belumLunas > 0 && (
          <p className="text-sm text-slate">
            Sisa: <span className="font-medium text-marker">{formatRupiah(belumLunas)}</span>
          </p>
        )}
      </div>

      {tagihan.length === 0 ? (
        <p className="text-sm text-slate">Belum ada tagihan.</p>
      ) : (
        <div className="space-y-3">
          {tagihan.map((t) => {
            const sisa = t.totalAmount - t.paidAmount;
            const lunas = t.status === "PAID";
            return (
              <section
                key={t.id}
                className="rounded-xl border border-chalk bg-white p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">{t.title}</p>
                    <p className="text-xs text-slate-light">
                      {t.invoiceNo} · jatuh tempo {formatDate(t.dueDate)}
                    </p>
                  </div>
                  <span
                    className={
                      "shrink-0 rounded-full px-2 py-0.5 text-xs " +
                      (lunas
                        ? "bg-chalk text-slate"
                        : t.status === "OVERDUE"
                          ? "bg-marker/10 text-marker"
                          : "bg-board/10 text-board")
                    }
                  >
                    {LABEL_STATUS[t.status] ?? t.status}
                  </span>
                </div>

                {t.items.length > 0 && (
                  <ul className="mt-3 space-y-1 border-t border-chalk pt-3">
                    {t.items.map((i, idx) => (
                      <li
                        key={idx}
                        className="flex items-center justify-between text-xs text-slate"
                      >
                        <span>
                          {i.description}
                          {i.quantity > 1 ? ` ×${i.quantity}` : ""}
                        </span>
                        <span>{formatRupiah(i.amount * i.quantity)}</span>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-3 flex items-center justify-between border-t border-chalk pt-3">
                  <span className="text-xs text-slate">
                    Dibayar {formatRupiah(t.paidAmount)}
                    {sisa > 0 ? ` · sisa ${formatRupiah(sisa)}` : ""}
                  </span>
                  <span className="font-display text-lg text-ink">
                    {formatRupiah(t.totalAmount)}
                  </span>
                </div>

                {t.payments.length > 0 && (
                  <ul className="mt-3 space-y-1 border-t border-chalk pt-3">
                    {t.payments.map((p) => (
                      <li
                        key={p.id}
                        className="flex items-center justify-between text-xs text-slate"
                      >
                        <span>
                          {formatDate(p.paidAt)}
                          {p.method?.name ? ` · ${p.method.name}` : ""}
                          {p.reference ? ` · ${p.reference}` : ""}
                        </span>
                        <span className="flex items-center gap-3">
                          {formatRupiah(p.amount)}
                          {/* Unduh kwitansi sendiri. Nomor diterbitkan server
                              saat pertama diunduh; unduhan berikutnya memakai
                              nomor yang sama. Route API memeriksa bahwa
                              pembayaran ini memang milik anak pemilik akun. */}
                          <a
                            href={`/api/kwitansi/${p.id}`}
                            target="_blank"
                            rel="noopener"
                            className="font-medium text-board underline"
                          >
                            Kwitansi
                          </a>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}

      {pembayaran.length > 0 && (
        <section className="rounded-xl border border-chalk bg-white p-5">
          <h2 className="font-display text-lg text-ink">Riwayat pembayaran</h2>
          <ul className="mt-3 divide-y divide-chalk">
            {pembayaran.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm text-ink">{p.invoice.title}</p>
                  <p className="text-xs text-slate-light">
                    {formatDate(p.paidAt)}
                    {p.method?.name ? ` · ${p.method.name}` : ""}
                  </p>
                </div>
                <span className="ml-4 text-sm text-ink">
                  {formatRupiah(p.amount)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
