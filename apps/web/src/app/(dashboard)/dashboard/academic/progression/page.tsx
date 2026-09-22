import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { PageHeader } from "@/components/data-table";
import { getProgressionContext } from "@/lib/data/academic";
import { ProgressionWizard } from "./progression-wizard";

export const metadata = { title: "Kenaikan Kelas" };

export default async function ProgressionPage({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.schoolId) redirect("/dashboard");
  if (!can(session.user.role, "academic", "manage", session.user.permissions)) {
    return <p className="text-slate">Anda tidak punya izin mengelola kenaikan kelas.</p>;
  }

  const { classId } = await searchParams;
  const context = await getProgressionContext(session.user.schoolId, {
    sourceClassId: classId,
  });

  // Jika classId tidak ada dan ada daftar kelas, pilih kelas pertama
  const activeClassId = classId ?? context.classes[0]?.id;
  const activeStudents = classId
    ? context.students
    : context.classes[0]
      ? (
          await getProgressionContext(session.user.schoolId, {
            sourceClassId: context.classes[0].id,
          })
        ).students
      : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kenaikan Kelas Massal"
        context="Proses mutasi siswa akhir tahun ajaran: naik kelas, tinggal kelas, atau kelulusan."
      />

      {context.classes.length === 0 ? (
        <div className="card text-center text-sm text-[var(--slate)]">
          Belum ada kelas yang terdaftar. Buat kelas terlebih dahulu di menu Kelas.
        </div>
      ) : (
        <ProgressionWizard
          classes={context.classes}
          academicYears={context.academicYears}
          initialSourceClassId={activeClassId}
          students={activeStudents}
        />
      )}
    </div>
  );
}
