import { auth } from "@/lib/auth";
import { buildStudentTemplate } from "@/lib/import/students";

/**
 * Unduh template import siswa (XLSX).
 * Perlu login agar tidak jadi endpoint publik terbuka.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const buf = buildStudentTemplate();
  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        'attachment; filename="template-import-siswa.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
