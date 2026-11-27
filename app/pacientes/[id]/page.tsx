import Link from "next/link";
import { Suspense } from "react";
import { AllergySection } from "@/components/patient/AllergySection";
import { PatientHeader } from "@/components/patient/PatientHeader";
import { PatientRecordTabs } from "@/components/patient/PatientRecordTabs";
import { Card, SkeletonBar } from "@/components/ui";

function Skeleton({ label, rows = 2 }: { label: string; rows?: number }) {
  return (
    <Card aria-busy="true" className="flex flex-col gap-3">
      <p className="text-mid-gray">{label}</p>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonBar key={i} />
      ))}
    </Card>
  );
}

function TabsSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <div className="flex h-11 gap-1 self-start rounded-pill bg-canvas p-1 ring-1 ring-hairline">
        {["Temperatura", "Análisis", "Consultas", "Otras observaciones"].map((l) => (
          <span key={l} className="inline-flex items-center px-3 font-medium text-mid-gray">
            {l}
          </span>
        ))}
      </div>
      <Skeleton label="Consultando temperaturas, análisis y consultas…" rows={4} />
    </div>
  );
}

/**
 * Ficha del paciente.
 * Arriba, siempre visibles: datos del paciente y alergias (destacadas).
 * Debajo, en pestañas: temperatura (verificada), análisis, consultas y otras observaciones.
 */
export default function PatientPage({ params, searchParams }: PageProps<"/pacientes/[id]">) {
  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Ruta" className="text-mid-gray">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/" className="underline-offset-2 hover:text-ink hover:underline">
              Pacientes
            </Link>
          </li>
          <li aria-hidden>›</li>
          <li aria-current="page" className="text-ink">
            Ficha
          </li>
        </ol>
      </nav>
      <Suspense fallback={<Skeleton label="Cargando paciente…" />}>
        <PatientHeader params={params} />
      </Suspense>
      <Suspense fallback={<Skeleton label="Consultando alergias…" />}>
        <AllergySection params={params} />
      </Suspense>
      <Suspense fallback={<TabsSkeleton />}>
        <PatientRecordTabs params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
