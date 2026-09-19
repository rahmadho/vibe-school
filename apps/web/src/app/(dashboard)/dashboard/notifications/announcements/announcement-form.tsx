"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input } from "@/components/ui";
import { Select, FormError, FormSuccess } from "@/components/form-fields";
import {
  AUDIENCE_TYPES,
  AUDIENCE_LABEL,
  type AudienceTypeValue,
} from "@/lib/validations/notification";
import { renderTemplate } from "@/lib/notification";
import { sendAnnouncement } from "../actions";

export function AnnouncementForm({
  classes,
  schoolName,
}: {
  classes: { id: string; name: string }[];
  schoolName: string;
}) {
  const [audience, setAudience] = useState<AudienceTypeValue>("PARENTS_OF_CLASS");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const needsClass =
    audience === "PARENTS_OF_CLASS" || audience === "STUDENTS_OF_CLASS";

  const preview = useMemo(
    () =>
      renderTemplate(
        `Assalamualaikum, Bapak/Ibu.\n\n*${title || "{{judul}}"}*\n\n${
          body || "{{isi}}"
        }\n\n— ${schoolName}`,
        { judul: title, isi: body, nama_sekolah: schoolName },
      ),
    [title, body, schoolName],
  );

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    setSuccess(null);
    start(async () => {
      const res = await sendAnnouncement(fd);
      if (res.ok) {
        setSuccess(res.message ?? "Pengumuman masuk antrean.");
        setTitle("");
        setBody("");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <Field label="Judul pengumuman" htmlFor="a-title">
          <Input
            id="a-title"
            name="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Libur Semester Ganjil"
            required
          />
        </Field>

        <Field label="Audiens" htmlFor="a-audience">
          <Select
            id="a-audience"
            name="audienceType"
            value={audience}
            onChange={(e) => setAudience(e.target.value as AudienceTypeValue)}
          >
            {AUDIENCE_TYPES.map((a) => (
              <option key={a} value={a}>
                {AUDIENCE_LABEL[a as AudienceTypeValue]}
              </option>
            ))}
          </Select>
        </Field>

        {needsClass && (
          <Field label="Kelas" htmlFor="a-class">
            <Select id="a-class" name="audienceClassId" required>
              <option value="">— Pilih kelas —</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <Field label="Isi pengumuman" htmlFor="a-body">
          <textarea
            id="a-body"
            name="body"
            rows={7}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Tulis isi pengumuman…"
            className="w-full rounded-md border border-chalk bg-paper px-3 py-2 text-sm text-ink"
            required
          />
        </Field>

        <FormError message={error} />
        <FormSuccess message={success} />

        <Button type="submit" disabled={pending}>
          {pending ? "Mengantrekan…" : "Kirim pengumuman"}
        </Button>

        <p className="text-xs text-slate">
          Pesan masuk antrean lebih dahulu dan dikirim bertahap dengan jeda acak
          agar nomor sekolah tidak diblokir WhatsApp.
        </p>
      </div>

      <div>
        <p className="text-sm font-medium text-ink">Pratinjau pesan</p>
        <div className="mt-2 rounded-lg border border-chalk bg-paper p-4">
          <pre className="whitespace-pre-wrap font-sans text-sm text-ink">
            {preview}
          </pre>
        </div>
      </div>
    </form>
  );
}
