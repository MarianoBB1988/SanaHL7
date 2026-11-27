import type { FhirRequestInfo } from "@/lib/fhir/client";
import { getFhirClient } from "@/lib/fhir/client";
import { classifyAllergies, type AllergyRow } from "@/lib/fhir/allergy";
import { searchAll } from "@/lib/fhir/search";
import { FhirViewerButton } from "../FhirViewer";
import { QueryInfo } from "../QueryInfo";
import { RetryButton } from "../RetryButton";
import { Badge, Card } from "../ui";
import { baseUrlOf, resolvePatientId, type PatientParams } from "./params";

const CRITICALITY: Record<string, string> = {
  low: "Criticidad baja",
  high: "Criticidad alta",
  "unable-to-assess": "Criticidad no evaluable",
};

export async function AllergySection({ params }: { params: PatientParams }) {
  const id = await resolvePatientId(params);
  const client = getFhirClient();
  const search = await searchAll(client, "AllergyIntolerance", {
    patient: id,
    _count: "100",
  });

  const requestOf = new Map(search.resources.map((r, i) => [r, search.sources[i]]));
  const { active, review, excluded } = classifyAllergies(
    search.resources,
    id,
    baseUrlOf(client.baseUrl),
  );
  const nothingForPatient = active.length === 0 && review.length === 0;

  return (
    <Card aria-labelledby="alergias-titulo" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="alergias-titulo" className="text-subheading font-semibold">
          Alergias
        </h2>
        <QueryInfo
          requests={search.requests}
          complete={search.complete}
          incompleteReason={search.incompleteReason}
        />
      </div>

      {!search.complete && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-nested border border-danger px-4 py-3"
        >
          <p>
            <strong className="font-semibold text-danger">Requiere revisión.</strong>{" "}
            {search.error?.message ?? "La consulta no se pudo completar."} No se
            puede saber si faltan alergias.
          </p>
          <RetryButton />
        </div>
      )}

      {search.complete && nothingForPatient && (
        <div className="rounded-nested bg-canvas px-4 py-4">
          <p className="font-semibold">Sin información disponible</p>
          <p className="text-mid-gray">
            El servidor no devolvió registros de alergia para este paciente. Eso no
            significa que no tenga alergias.
          </p>
        </div>
      )}

      {active.length > 0 && (
        <AllergyList
          title={`Activas y confirmadas (${active.length})`}
          rows={active}
          requestOf={requestOf}
        />
      )}
      {review.length > 0 && (
        <AllergyList
          title={`Requieren revisión (${review.length})`}
          description="Registros que no son una alergia activa y confirmada. Se muestran para no ocultarlos."
          rows={review}
          requestOf={requestOf}
        />
      )}
      {excluded.length > 0 && (
        <AllergyList
          title={`Excluidas: no corresponden al paciente (${excluded.length})`}
          rows={excluded}
          requestOf={requestOf}
        />
      )}
    </Card>
  );
}

function AllergyList({
  title,
  description,
  rows,
  requestOf,
}: {
  title: string;
  description?: string;
  rows: AllergyRow[];
  requestOf: Map<unknown, FhirRequestInfo>;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-caption font-medium uppercase text-mid-gray">{title}</h3>
      {description && <p className="text-mid-gray">{description}</p>}
      <ul className="flex flex-col divide-y divide-hairline rounded-nested border border-hairline">
        {rows.map((row) => (
          <li
            key={row.ref}
            className="flex flex-wrap items-start justify-between gap-3 px-4 py-3"
          >
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <AllergyBadge row={row} />
                <span className="font-semibold">
                  {row.substance ?? <span className="text-mid-gray">Sustancia no informada</span>}
                </span>
                {row.criticality && (
                  <span className="text-mid-gray">
                    · {CRITICALITY[row.criticality] ?? row.criticality}
                  </span>
                )}
              </div>
              <p className="font-mono text-caption text-mid-gray break-all">
                {row.ref} · clinicalStatus: {row.clinicalStatus ?? "—"} ·
                verificationStatus: {row.verificationStatus ?? "—"}
              </p>
              {row.reasons.length > 0 && (
                <ul className="list-disc pl-5 text-mid-gray">
                  {row.reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              )}
            </div>
            <FhirViewerButton
              reference={row.ref}
              resource={row.resource}
              request={requestOf.get(row.resource)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function AllergyBadge({ row }: { row: AllergyRow }) {
  if (row.category === "active")
    return (
      <Badge tone="warm">
        <span aria-hidden>●</span> Activa
      </Badge>
    );
  if (row.category === "review")
    return (
      <Badge tone="outline">
        <span aria-hidden>?</span> Requiere revisión
      </Badge>
    );
  return (
    <Badge tone="soft">
      <span aria-hidden>–</span> Excluida
    </Badge>
  );
}
