import { guard } from "@/lib/action-guard";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_THEME_KEY,
  DEFAULT_HEADING_FONT,
  DEFAULT_BODY_FONT,
  DEFAULT_CORNER_STYLE,
} from "@/lib/site-themes";
import { ThemePicker } from "./theme-picker";

export const metadata = { title: "Tema Web" };
export const dynamic = "force-dynamic";

export default async function ThemePage() {
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

  const theme = await prisma.siteTheme.findUnique({ where: { schoolId: g.ctx.schoolId } });

  return (
    <div className="mx-auto max-w-3xl">
      <ThemePicker
        current={{
          preset: theme?.preset ?? DEFAULT_THEME_KEY,
          primaryColor: theme?.primaryColor ?? null,
          accentColor: theme?.accentColor ?? null,
          headingFont: theme?.headingFont ?? DEFAULT_HEADING_FONT,
          bodyFont: theme?.bodyFont ?? DEFAULT_BODY_FONT,
          cornerStyle: theme?.cornerStyle ?? DEFAULT_CORNER_STYLE,
        }}
      />
    </div>
  );
}
