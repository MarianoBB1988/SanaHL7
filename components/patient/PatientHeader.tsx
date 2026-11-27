import Link from "next/link";
import { getFhirClient } from "@/lib/fhir/client";
import { toPatientRow } from "@/lib/fhir/mappers";
import { FhirErrorCard } from "../FhirErrorCard";
import { FhirViewerButton } from "../FhirViewer";
import { Caption, Card, buttonStyles } from "../ui";
import { resolvePatientId, type PatientParams } from "./params";

export async function PatientHeader({ params }: { params: PatientParams }) {
  const id = await resolvePatientId(params);
  const client = getFhirClient();
  const result = await client.get(`Patient/${id}`, "Patient");

  if (!result.ok) {
    const status = result.error.status;
    const title =
      status === 404
        ? `El servidor no tiene Patient/${id}`
        : status === 410
          ? `Patient/${id} fue eliminado del servidor`
          : "No se pudo leer el paciente";
    return (
      <FhirErrorCard
        title={title}
        error={result.error}
        request={result.request}
        retry={status !== 404 && status !== 410}
        extra={
          <Link href="/" className={buttonStyles.outline}>
            Volver a pacientes
          </Link>
        }
      />
    );
  }

  const patient = result.data;
  const row = toPatientRow(patient);
  if (!row || row.id !== id) {
    return (
      <FhirErrorCard
        title="La respuesta no corresponde al paciente pedido"
        error={{
          kind: "unexpected-resource",
          message: `Se pidió Patient/${id} y llegó ${row ? row.ref : "un Patient sin id"}.`,
        }}
        request={result.request}
        retry={false}
      />
    );
  }

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-[30px] leading-[1.1] font-semibold tracking-[-0.04em] sm:text-[40px]">
            {row.name ?? <span className="text-mid-gray">Sin nombre</span>}
          </h1>
          <p className="font-mono text-caption text-mid-gray">{row.ref}</p>
        </div>
        <FhirViewerButton reference={row.ref} resource={patient} request={result.request} />
      </div>
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="flex flex-col gap-1">
          <dt>
            <Caption>Sexo</Caption>
          </dt>
          <dd>{row.gender ?? <span className="text-mid-gray">No informado</span>}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt>
            <Caption>Nacimiento</Caption>
          </dt>
          <dd className="font-mono text-caption">
            {row.birthDate ?? <span className="font-sans text-body text-mid-gray">No informada</span>}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt>
            <Caption>Activo</Caption>
          </dt>
          <dd>
            {patient.active === undefined ? (
              <span className="text-mid-gray">No informado</span>
            ) : patient.active ? (
              "Sí"
            ) : (
              "No"
            )}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt>
            <Caption>Última actualización</Caption>
          </dt>
          <dd className="font-mono text-caption">
            {patient.meta?.lastUpdated ?? (
              <span className="font-sans text-body text-mid-gray">No informada</span>
            )}
          </dd>
        </div>
      </dl>
    </Card>
  );
}
