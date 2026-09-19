"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { FormError, FormSuccess } from "@/components/form-fields";
import type { ActionResult } from "@/lib/action-result";

/**
 * Tombol "hitung & simpan nilai akhir" untuk satu kelas + mapel.
 * Menulis ke ReportCard sebagai draf rapor.
 */
export function GenerateReportButton({
  classId,
  subjectId,
  semesterId,
  action,
}: {
  classId: string;
  subjectId: string;
  semesterId: string;
  action: (formData: FormData) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function run() {
    setPending(true);
    setError(null);
    setSuccess(null);
    const fd = new FormData();
    fd.set("classId", classId);
    fd.set("subjectId", subjectId);
    fd.set("semesterId", semesterId);
    void action(fd).then((res) => {
      if (res.ok) {
        setSuccess(res.message ?? "Tersimpan.");
        router.refresh();
      } else {
        setError(res.error);
      }
      setPending(false);
    });
  }

  return (
    <div className="space-y-2">
      <FormError message={error} />
      <FormSuccess message={success} />
      <Button onClick={run} disabled={pending}>
        {pending ? "Menghitung…" : "Hitung & simpan nilai akhir"}
      </Button>
    </div>
  );
}
