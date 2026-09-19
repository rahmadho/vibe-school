import { guard } from "@/lib/action-guard";
import { listNavigation } from "@/lib/data/site";
import { NavList, type NavRow } from "./nav-list";

/**
 * Editor menu navigasi web sekolah (header & footer).
 *
 * Menu adalah "peta" yang membimbing pengunjung. Karena itu urutan penting —
 * dan urutannya diatur dengan tombol naik/turun, bukan geser-lepas, supaya
 * bisa dipakai dari ponsel.
 */

export const metadata = { title: "Menu Web" };
export const dynamic = "force-dynamic";

export default async function WebsiteNavigationPage() {
  const g = await guard("website", "read");
  if ("fail" in g) {
    return (
      <div className="mx-auto max-w-md border-2 border-[var(--chalk)] bg-white p-6 text-center">
        <p className="font-display text-lg font-semibold text-[var(--ink)]">
          Tidak dapat diakses
        </p>
        <p className="mt-2 text-sm text-[var(--slate)]">
          {g.fail.ok ? "Tidak diizinkan." : g.fail.error}
        </p>
      </div>
    );
  }

  const schoolId = g.ctx.schoolId;

  const [header, footer] = await Promise.all([
    listNavigation(schoolId, "header"),
    listNavigation(schoolId, "footer"),
  ]);

  const toRows = (items: typeof header): NavRow[] =>
    items.map((i) => ({
      id: i.id,
      label: i.label,
      href: i.href,
      area: i.area === "footer" ? "footer" : "header",
      order: i.order,
      isExternal: i.isExternal,
      onlyIfSpmb: i.onlyIfSpmb,
    }));

  return (
    <div className="mx-auto max-w-4xl">
      <NavList header={toRows(header)} footer={toRows(footer)} />
    </div>
  );
}
