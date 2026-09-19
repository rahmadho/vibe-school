import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listTimeSlots } from "@/lib/data/schedule";
import { Button } from "@/components/ui";
import { PageHeader, Table, EmptyState } from "@/components/data-table";
import { FormError } from "@/components/form-fields";
import {
  createTimeSlot,
  updateTimeSlot,
  deleteTimeSlot,
  seedDefaultTimeSlots,
} from "./actions";
import { TimeSlotForm, SeedDefaultsButton } from "./time-slot-client";
import { TimeSlotRow } from "./time-slot-row";

export const metadata = { title: "Jam pelajaran" };

export default async function TimeSlotsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.schoolId) redirect("/dashboard");

  const canManage = can(session.user.role, "academic", "manage");
  if (!can(session.user.role, "academic", "read")) {
    return <p className="text-slate">Anda tidak punya akses ke modul akademik.</p>;
  }

  const slots = await listTimeSlots(session.user.schoolId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Jam pelajaran"
        context={`${slots.length} jam · dipakai sebagai baris pada jadwal`}
        actions={
          <Link href="/dashboard/academic">
            <Button variant="ghost">Kembali</Button>
          </Link>
        }
      />

      <p className="max-w-prose text-sm text-slate">
        Jam pelajaran adalah kerangka waktu sekolah — jam ke-1, jam ke-2, dan
        seterusnya. Jadwal pelajaran nanti disusun di atas kerangka ini, jadi
        atur jamnya terlebih dahulu.
      </p>

      {slots.length === 0 ? (
        <>
          <EmptyState
            title="Belum ada jam pelajaran"
            description="Buat jam standar sekali klik, atau tambahkan satu per satu sesuai jadwal sekolah Anda."
          />
          {canManage ? (
            <div className="flex flex-wrap items-end gap-4">
              <SeedDefaultsButton action={seedDefaultTimeSlots} />
              <span className="pb-3 text-sm text-slate">atau</span>
            </div>
          ) : null}
        </>
      ) : (
        <Table
          head={
            <>
              <th className="w-20">Jam</th>
              <th className="w-40">Waktu</th>
              <th>Keterangan</th>
              <th className="w-32">Dipakai</th>
              <th className="w-44 text-right">Aksi</th>
            </>
          }
        >
          {slots.map((s) => (
            <TimeSlotRow
              key={s.id}
              slot={{
                id: s.id,
                slotNumber: s.slotNumber,
                startTime: s.startTime,
                endTime: s.endTime,
                label: s.label,
                usedBy: s._count.schedules,
              }}
              updateAction={updateTimeSlot}
              deleteAction={deleteTimeSlot}
            />
          ))}
        </Table>
      )}

      {canManage ? (
        <div className="max-w-2xl">
          <TimeSlotForm mode="create" action={createTimeSlot} />
        </div>
      ) : (
        <FormError message="Hanya admin akademik yang dapat mengubah jam pelajaran." />
      )}
    </div>
  );
}
