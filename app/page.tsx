import { Suspense } from "react";
import { PatientIdForm } from "@/components/PatientIdForm";
import { PatientSearchForm } from "@/components/PatientSearchForm";
import { PatientTable } from "@/components/PatientTable";
import { ServerStatus } from "@/components/ServerStatus";
import { Card, SkeletonBar } from "@/components/ui";

function Skeleton({ label, rows = 1 }: { label: string; rows?: number }) {
  return (
    <Card aria-busy="true" className="flex flex-col gap-3">
      <p className="text-mid-gray">{label}</p>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonBar key={i} />
      ))}
    </Card>
  );
}

export default function PatientsPage({ searchParams }: PageProps<"/">) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-[36px] leading-[1.05] font-semibold tracking-[-0.045em] sm:text-[52px]">Pacientes.</h1>
          <p className="text-mid-gray">
            Lectura del servidor FHIR configurado. Los datos no se guardan.
          </p>
        </div>
        <PatientIdForm />
      </div>
      <Suspense fallback={<Skeleton label="Consultando /metadata…" />}>
        <ServerStatus />
      </Suspense>
      <Suspense
        fallback={
          <div className="flex flex-col gap-4">
            <Card>
              <PatientSearchForm disabled />
            </Card>
            <Skeleton label="Cargando pacientes…" rows={6} />
          </div>
        }
      >
        <PatientTable searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
