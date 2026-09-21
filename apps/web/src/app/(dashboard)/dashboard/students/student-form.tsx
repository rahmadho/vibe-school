"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input } from "@/components/ui";
import { Select, Textarea, FormError } from "@/components/form-fields";
import {
  GENDERS,
  GENDER_LABEL,
  STUDENT_STATUSES,
  STUDENT_STATUS_LABEL,
} from "@/lib/validations/student";
import type { ActionResult } from "./actions";

type StudentFormValues = {
  id?: string;
  nis: string;
  nisn: string;
  fullName: string;
  gender: string;
  birthPlace: string;
  birthDate: string; // YYYY-MM-DD
  religion: string;
  address: string;
  phone: string;
  entryYear: number;
  classId: string;
  majorId: string;
  status: string;
  parentName: string;
  parentRelation: string;
  parentPhone: string;
};

/**
 * Form siswa — dipakai untuk create & edit.
 * Mengirim lewat Server Action (FormData). Validasi otoritatif di server;
 * fieldErrors dari server ditampilkan per-field.
 */
export function StudentForm({
  mode,
  classes,
  majors,
  terminology,
  initial,
  action,
}: {
  mode: "create" | "edit";
  classes: Array<{ id: string; name: string }>;
  /** Opsi jurusan. Kosong = sekolah belum memakai jurusan → field disembunyikan. */
  majors: Array<{ id: string; code: string; name: string }>;
  terminology: string;
  initial?: Partial<StudentFormValues>;
  action: (formData: FormData) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [pending, setPending] = useState(false);

  const v: StudentFormValues = {
    nis: initial?.nis ?? "",
    nisn: initial?.nisn ?? "",
    fullName: initial?.fullName ?? "",
    gender: initial?.gender ?? "",
    birthPlace: initial?.birthPlace ?? "",
    birthDate: initial?.birthDate ?? "",
    religion: initial?.religion ?? "",
    address: initial?.address ?? "",
    phone: initial?.phone ?? "",
    entryYear: initial?.entryYear ?? new Date().getFullYear(),
    classId: initial?.classId ?? "",
    majorId: initial?.majorId ?? "",
    status: initial?.status ?? "ACTIVE",
    parentName: initial?.parentName ?? "",
    parentRelation: initial?.parentRelation ?? "",
    parentPhone: initial?.parentPhone ?? "",
  };

  const fe = (name: string) => fieldErrors[name]?.[0];

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setFieldErrors({});

    const formData = new FormData(e.currentTarget);
    if (mode === "edit" && initial?.id) formData.set("id", initial.id);

    const res = await action(formData);

    if (res.ok) {
      router.push(
        res.id ? `/dashboard/students/${res.id}` : "/dashboard/students",
      );
      router.refresh();
    } else {
      setError(res.error);
      setFieldErrors(res.fieldErrors ?? {});
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8" noValidate>
      <FormError message={error} />

      {/* Identitas */}
      <section className="card space-y-4">
        <h2 className="card-title">Identitas siswa</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="NIS" htmlFor="nis" error={fe("nis")}>
            <Input
              id="nis"
              name="nis"
              defaultValue={v.nis}
              required
              className="font-mono tabular-nums"
            />
          </Field>
          <Field label="NISN (opsional)" htmlFor="nisn" error={fe("nisn")}>
            <Input
              id="nisn"
              name="nisn"
              defaultValue={v.nisn}
              className="font-mono tabular-nums"
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Nama lengkap" htmlFor="fullName" error={fe("fullName")}>
              <Input id="fullName" name="fullName" defaultValue={v.fullName} required />
            </Field>
          </div>
          <Field label="Jenis kelamin" htmlFor="gender" error={fe("gender")}>
            <Select id="gender" name="gender" defaultValue={v.gender} required>
              <option value="">Pilih…</option>
              {GENDERS.map((g) => (
                <option key={g} value={g}>
                  {GENDER_LABEL[g]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Agama (opsional)" htmlFor="religion" error={fe("religion")}>
            <Input id="religion" name="religion" defaultValue={v.religion} />
          </Field>
          <Field label="Tempat lahir (opsional)" htmlFor="birthPlace">
            <Input id="birthPlace" name="birthPlace" defaultValue={v.birthPlace} />
          </Field>
          <Field label="Tanggal lahir (opsional)" htmlFor="birthDate" error={fe("birthDate")}>
            <Input
              id="birthDate"
              name="birthDate"
              type="date"
              defaultValue={v.birthDate}
            />
          </Field>
        </div>
      </section>

      {/* Akademik */}
      <section className="card space-y-4">
        <h2 className="card-title">Data akademik</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Tahun masuk" htmlFor="entryYear" error={fe("entryYear")}>
            <Input
              id="entryYear"
              name="entryYear"
              type="number"
              defaultValue={v.entryYear}
              required
              className="tabular-nums"
            />
          </Field>
          <Field label="Kelas (opsional)" htmlFor="classId">
            <Select id="classId" name="classId" defaultValue={v.classId}>
              <option value="">Belum ditempatkan</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>

          {/* Muncul hanya bila sekolah sudah mengisi data jurusan. */}
          {majors.length > 0 ? (
            <Field label={`${terminology} (opsional)`} htmlFor="majorId">
              <Select id="majorId" name="majorId" defaultValue={v.majorId}>
                <option value="">Belum ditentukan</option>
                {majors.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.code} — {m.name}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
          <Field label="Status" htmlFor="status" error={fe("status")}>
            <Select id="status" name="status" defaultValue={v.status}>
              {STUDENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STUDENT_STATUS_LABEL[s]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </section>

      {/* Kontak & wali */}
      <section className="card space-y-4">
        <h2 className="card-title">Kontak & wali</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Alamat (opsional)" htmlFor="address">
              <Textarea id="address" name="address" defaultValue={v.address} />
            </Field>
          </div>
          <Field label="No. HP siswa (opsional)" htmlFor="phone" error={fe("phone")}>
            <Input
              id="phone"
              name="phone"
              defaultValue={v.phone}
              placeholder="081234567890"
              className="tabular-nums"
            />
          </Field>
          <div className="hidden sm:block" />
          <Field label="Nama wali (opsional)" htmlFor="parentName">
            <Input id="parentName" name="parentName" defaultValue={v.parentName} />
          </Field>
          <Field label="Hubungan" htmlFor="parentRelation">
            <Select
              id="parentRelation"
              name="parentRelation"
              defaultValue={v.parentRelation}
            >
              <option value="">—</option>
              <option value="FATHER">Ayah</option>
              <option value="MOTHER">Ibu</option>
              <option value="GUARDIAN">Wali</option>
            </Select>
          </Field>
          <Field
            label="No. WA wali (opsional)"
            htmlFor="parentPhone"
            error={fe("parentPhone")}
          >
            <Input
              id="parentPhone"
              name="parentPhone"
              defaultValue={v.parentPhone}
              placeholder="081298765432"
              className="tabular-nums"
            />
          </Field>
        </div>
        <p className="text-xs text-slate">
          Untuk pembuatan akun orang tua & kirim tagihan lewat WhatsApp,
          sediakan nomor WA wali format 08xxxx.
        </p>
      </section>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Menyimpan…" : mode === "create" ? "Simpan siswa" : "Simpan perubahan"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.back()}
          disabled={pending}
        >
          Batal
        </Button>
      </div>
    </form>
  );
}
