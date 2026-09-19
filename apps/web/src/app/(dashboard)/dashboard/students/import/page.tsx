import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { PageHeader } from "@/components/data-table";
import { Button } from "@/components/ui";
import { ImportClient } from "./import-client";

export const metadata = { title: "Import siswa" };

export default async function ImportPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.schoolId) redirect("/dashboard");
  if (!can(session.user.role, "students", "create")) {
    return <p className="text-slate">Anda tidak punya izin mengimpor siswa.</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Import siswa"
        context="Unggah file Excel. Baris yang bermasalah dilaporkan, baris lain tetap diimpor."
        actions={
          <a href="/api/students/template" download>
            <Button variant="secondary">Unduh template</Button>
          </a>
        }
      />

      {/* Panduan kolom */}
      <section className="card">
        <h2 className="card-title">Kolom yang dikenali</h2>
        <p className="mt-1 text-sm text-slate">
          Nama kolom tidak peka huruf besar/kecil. Dua kolom wajib:{" "}
          <code className="rounded bg-chalk/50 px-1 py-0.5 text-xs">nis</code>{" "}
          dan{" "}
          <code className="rounded bg-chalk/50 px-1 py-0.5 text-xs">
            fullName
          </code>
          .
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Kolom</th>
                <th>Wajib</th>
                <th>Contoh</th>
              </tr>
            </thead>
            <tbody>
              {COLUMNS.map((c) => (
                <tr key={c.name}>
                  <td className="font-mono text-xs">{c.name}</td>
                  <td className="text-slate">{c.required ? "Wajib" : "Opsional"}</td>
                  <td className="text-slate">{c.example}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <ImportClient />
    </div>
  );
}

const COLUMNS = [
  { name: "nis", required: true, example: "2025001" },
  { name: "fullName", required: true, example: "Ani Contoh" },
  { name: "nisn", required: false, example: "0012345678" },
  { name: "gender", required: false, example: "P / L" },
  { name: "birthPlace", required: false, example: "Bandung" },
  { name: "birthDate", required: false, example: "2012-05-17" },
  { name: "religion", required: false, example: "Islam" },
  { name: "address", required: false, example: "Jl. Melati No. 3" },
  { name: "phone", required: false, example: "081234567890" },
  { name: "entryYear", required: false, example: "2025" },
  { name: "status", required: false, example: "Aktif" },
  { name: "parentName", required: false, example: "Budi Contoh" },
  { name: "parentRelation", required: false, example: "Ayah" },
  { name: "parentPhone", required: false, example: "081298765432" },
];
