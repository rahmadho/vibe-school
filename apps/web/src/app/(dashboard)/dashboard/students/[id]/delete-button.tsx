"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { FormError } from "@/components/form-fields";
import { softDeleteStudent } from "../actions";

/** Tombol nonaktifkan siswa dengan konfirmasi dua-langkah. */
export function DeleteStudentButton({
  id,
  name,
}: {
  id: string;
  name: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      const res = await softDeleteStudent(id);
      if (res.ok) {
        router.push("/dashboard/students");
        router.refresh();
      } else {
        setError(res.error);
        setConfirming(false);
      }
    });
  }

  if (!confirming) {
    return (
      <Button variant="danger" onClick={() => setConfirming(true)}>
        Nonaktifkan siswa
      </Button>
    );
  }

  return (
    <div className="space-y-3">
      <FormError message={error} />
      <p className="text-sm text-ink">
        Nonaktifkan <strong>{name}</strong>? Tindakan ini tercatat di log.
      </p>
      <div className="flex gap-2">
        <Button variant="danger" onClick={run} disabled={pending}>
          {pending ? "Memproses…" : "Ya, nonaktifkan"}
        </Button>
        <Button
          variant="ghost"
          onClick={() => setConfirming(false)}
          disabled={pending}
        >
          Batal
        </Button>
      </div>
    </div>
  );
}
