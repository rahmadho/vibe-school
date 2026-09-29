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

  /* ---------- Data administrasi (Dapodik/Disdik) ---------- */
  nik: string;
  kkNumber: string;
  village: string;
  district: string;
  city: string;
  province: string;
  postalCode: string;
  villageCode: string;
  residenceType: string;
  transportation: string;
  livingWith: string;
  distanceKm: string;
  bloodType: string;
  heightCm: string;
  weightKg: string;
  isKipRecipient: string;

  entryYear: number;
  classId: string;
  majorId: string;
  status: string;
  parentName: string;
  parentRelation: string;
  parentPhone: string;
  parentNik: string;
  parentKkNumber: string;
  parentOccupation: string;
  parentEducation: string;
  parentIncomeRange: string;
  parentBirthYear: string;
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

    // Data administrasi
    nik: initial?.nik ?? "",
    kkNumber: initial?.kkNumber ?? "",
    village: initial?.village ?? "",
    district: initial?.district ?? "",
    city: initial?.city ?? "",
    province: initial?.province ?? "",
    postalCode: initial?.postalCode ?? "",
    villageCode: initial?.villageCode ?? "",
    residenceType: initial?.residenceType ?? "",
    transportation: initial?.transportation ?? "",
    livingWith: initial?.livingWith ?? "",
    distanceKm: initial?.distanceKm ?? "",
    bloodType: initial?.bloodType ?? "",
    heightCm: initial?.heightCm ?? "",
    weightKg: initial?.weightKg ?? "",
    isKipRecipient: initial?.isKipRecipient ?? "",

    entryYear: initial?.entryYear ?? new Date().getFullYear(),
    classId: initial?.classId ?? "",
    majorId: initial?.majorId ?? "",
    status: initial?.status ?? "ACTIVE",
    parentName: initial?.parentName ?? "",
    parentRelation: initial?.parentRelation ?? "",
    parentPhone: initial?.parentPhone ?? "",
    parentNik: initial?.parentNik ?? "",
    parentKkNumber: initial?.parentKkNumber ?? "",
    parentOccupation: initial?.parentOccupation ?? "",
    parentEducation: initial?.parentEducation ?? "",
    parentIncomeRange: initial?.parentIncomeRange ?? "",
    parentBirthYear: initial?.parentBirthYear ?? "",
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
            <Field
              label="Alamat jalan (opsional)"
              htmlFor="address"
              hint="Jalan, nomor rumah, RT/RW"
            >
              <Textarea id="address" name="address" defaultValue={v.address} />
            </Field>
          </div>
          <Field label="Desa/kelurahan" htmlFor="village">
            <Input id="village" name="village" defaultValue={v.village} />
          </Field>
          <Field label="Kecamatan" htmlFor="district">
            <Input id="district" name="district" defaultValue={v.district} />
          </Field>
          <Field label="Kabupaten/kota" htmlFor="city">
            <Input id="city" name="city" defaultValue={v.city} />
          </Field>
          <Field label="Provinsi" htmlFor="province">
            <Input id="province" name="province" defaultValue={v.province} />
          </Field>
          <Field label="Kode pos" htmlFor="postalCode">
            <Input
              id="postalCode"
              name="postalCode"
              defaultValue={v.postalCode}
              className="tabular-nums"
            />
          </Field>
          <Field
            label="Kode wilayah desa"
            htmlFor="villageCode"
            hint="10 digit BPS, bila sekolah memakainya"
            error={fe("villageCode")}
          >
            <Input
              id="villageCode"
              name="villageCode"
              defaultValue={v.villageCode}
              className="tabular-nums"
            />
          </Field>
          <Field label="No. HP siswa (opsional)" htmlFor="phone" error={fe("phone")}>
            <Input
              id="phone"
              name="phone"
              defaultValue={v.phone}
              placeholder="081234567890"
              className="tabular-nums"
            />
          </Field>
        </div>
      </section>

      {/* Data administrasi — diminta Dapodik & Disdik */}
      <section className="card space-y-4">
        <div>
          <h2 className="card-title">Data administrasi</h2>
          <p className="text-sm text-[var(--slate)]">
            Dibutuhkan untuk Dapodik, laporan ke Dinas, dan pengajuan bantuan.
            Boleh dikosongkan sekarang dan dilengkapi kemudian.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="NIK siswa"
            htmlFor="nik"
            hint="16 digit sesuai KK/akta"
            error={fe("nik")}
          >
            <Input
              id="nik"
              name="nik"
              defaultValue={v.nik}
              inputMode="numeric"
              className="tabular-nums"
            />
          </Field>
          <Field
            label="Nomor Kartu Keluarga"
            htmlFor="kkNumber"
            error={fe("kkNumber")}
          >
            <Input
              id="kkNumber"
              name="kkNumber"
              defaultValue={v.kkNumber}
              inputMode="numeric"
              className="tabular-nums"
            />
          </Field>
          <Field label="Tempat tinggal" htmlFor="residenceType">
            <Select
              id="residenceType"
              name="residenceType"
              defaultValue={v.residenceType}
            >
              <option value="">—</option>
              <option value="BERSAMA_ORANG_TUA">Bersama orang tua</option>
              <option value="BERSAMA_WALI">Bersama wali</option>
              <option value="KOST">Kost</option>
              <option value="ASRAMA">Asrama</option>
              <option value="PANTI_ASUH">Panti asuhan</option>
              <option value="LAINNYA">Lainnya</option>
            </Select>
          </Field>
          <Field label="Tinggal bersama" htmlFor="livingWith">
            <Select
              id="livingWith"
              name="livingWith"
              defaultValue={v.livingWith}
            >
              <option value="">—</option>
              <option value="ORANG_TUA">Orang tua</option>
              <option value="WALI">Wali</option>
              <option value="SENDIRI">Sendiri</option>
              <option value="LAINNYA">Lainnya</option>
            </Select>
          </Field>
          <Field label="Transportasi ke sekolah" htmlFor="transportation">
            <Select
              id="transportation"
              name="transportation"
              defaultValue={v.transportation}
            >
              <option value="">—</option>
              <option value="JALAN_KAKI">Jalan kaki</option>
              <option value="SEPEDA">Sepeda</option>
              <option value="SEPEDA_MOTOR">Sepeda motor</option>
              <option value="MOBIL_PRIBADI">Mobil pribadi</option>
              <option value="ANTAR_JEMPUT">Antar jemput</option>
              <option value="ANGKUTAN_UMUM">Angkutan umum</option>
              <option value="OJEK_ONLINE">Ojek online</option>
              <option value="PERAHU">Perahu</option>
              <option value="LAINNYA">Lainnya</option>
            </Select>
          </Field>
          <Field
            label="Jarak ke sekolah (km)"
            htmlFor="distanceKm"
            error={fe("distanceKm")}
          >
            <Input
              id="distanceKm"
              name="distanceKm"
              type="number"
              min={0}
              defaultValue={v.distanceKm}
              className="tabular-nums"
            />
          </Field>
          <Field label="Golongan darah" htmlFor="bloodType">
            <Select id="bloodType" name="bloodType" defaultValue={v.bloodType}>
              <option value="">—</option>
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="AB">AB</option>
              <option value="O">O</option>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Tinggi (cm)" htmlFor="heightCm" error={fe("heightCm")}>
              <Input
                id="heightCm"
                name="heightCm"
                type="number"
                defaultValue={v.heightCm}
                className="tabular-nums"
              />
            </Field>
            <Field label="Berat (kg)" htmlFor="weightKg" error={fe("weightKg")}>
              <Input
                id="weightKg"
                name="weightKg"
                type="number"
                defaultValue={v.weightKg}
                className="tabular-nums"
              />
            </Field>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="isKipRecipient"
            defaultChecked={v.isKipRecipient === "true" || v.isKipRecipient === "on"}
            className="size-4"
          />
          <span>Penerima KIP/PIP (bantuan pendidikan)</span>
        </label>
      </section>

      {/* Wali */}
      <section className="card space-y-4">
        <h2 className="card-title">Orang tua / wali</h2>
        <div className="grid gap-4 sm:grid-cols-2">
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
          <Field
            label="NIK orang tua/wali"
            htmlFor="parentNik"
            error={fe("parentNik")}
          >
            <Input
              id="parentNik"
              name="parentNik"
              defaultValue={v.parentNik}
              inputMode="numeric"
              className="tabular-nums"
            />
          </Field>
          <Field label="No. KK orang tua" htmlFor="parentKkNumber" error={fe("parentKkNumber")}>
            <Input
              id="parentKkNumber"
              name="parentKkNumber"
              defaultValue={v.parentKkNumber}
              inputMode="numeric"
              className="tabular-nums"
            />
          </Field>
          <Field label="Pekerjaan" htmlFor="parentOccupation">
            <Input
              id="parentOccupation"
              name="parentOccupation"
              defaultValue={v.parentOccupation}
            />
          </Field>
          <Field label="Pendidikan terakhir" htmlFor="parentEducation">
            <Select
              id="parentEducation"
              name="parentEducation"
              defaultValue={v.parentEducation}
            >
              <option value="">—</option>
              <option value="TIDAK_SEKOLAH">Tidak sekolah</option>
              <option value="SD">SD</option>
              <option value="SMP">SMP</option>
              <option value="SMA_SMK">SMA/SMK</option>
              <option value="D1_D3">D1–D3</option>
              <option value="D4_S1">D4/S1</option>
              <option value="S2">S2</option>
              <option value="S3">S3</option>
            </Select>
          </Field>
          <Field
            label="Penghasilan per bulan"
            htmlFor="parentIncomeRange"
            hint="Rentang — tidak perlu angka pasti"
          >
            <Select
              id="parentIncomeRange"
              name="parentIncomeRange"
              defaultValue={v.parentIncomeRange}
            >
              <option value="">—</option>
              <option value="TIDAK_BERPERGHASILAN">Tidak berpenghasilan</option>
              <option value="KURANG_1_JUTA">Kurang dari Rp1 juta</option>
              <option value="JUTA_1_2">Rp1–2 juta</option>
              <option value="JUTA_2_5">Rp2–5 juta</option>
              <option value="JUTA_5_10">Rp5–10 juta</option>
              <option value="LEBIH_10_JUTA">Lebih dari Rp10 juta</option>
            </Select>
          </Field>
          <Field
            label="Tahun lahir orang tua"
            htmlFor="parentBirthYear"
            error={fe("parentBirthYear")}
          >
            <Input
              id="parentBirthYear"
              name="parentBirthYear"
              type="number"
              defaultValue={v.parentBirthYear}
              className="tabular-nums"
            />
          </Field>
        </div>
        <p className="text-xs text-[var(--slate)]">
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
