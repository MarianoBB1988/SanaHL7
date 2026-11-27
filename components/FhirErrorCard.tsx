import type { FhirError, FhirRequestInfo } from "@/lib/fhir/client";
import type { ReactNode } from "react";
import { RetryButton } from "./RetryButton";
import { Badge, Card, Mono } from "./ui";

const KIND_LABEL: Record<FhirError["kind"], string> = {
  config: "Configuración",
  "url-rejected": "Enlace rechazado",
  timeout: "Tiempo agotado",
  network: "Sin conexión",
  redirect: "Redirección",
  http: "Error HTTP",
  "invalid-json": "Respuesta no válida",
  "unexpected-resource": "Recurso inesperado",
};

/** Muestra un error del cliente FHIR: qué se pidió, qué respondió y cómo seguir. */
export function FhirErrorCard({
  title,
  error,
  request,
  retry = true,
  extra,
}: {
  title: string;
  error: FhirError;
  request: FhirRequestInfo;
  retry?: boolean;
  extra?: ReactNode;
}) {
  return (
    <Card role="alert" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="error">
          <span aria-hidden>✕</span> {KIND_LABEL[error.kind]}
          {error.status ? ` · ${error.status}` : ""}
        </Badge>
        <h2 className="text-subheading font-semibold">{title}</h2>
      </div>
      <p>{error.message}</p>
      <dl className="grid gap-1 text-mid-gray">
        <div className="flex flex-wrap gap-x-2">
          <dt>Petición:</dt>
          <dd>
            <Mono>
              {request.method} {request.url}
            </Mono>
          </dd>
        </div>
        {error.outcome && (
          <div className="flex flex-wrap gap-x-2">
            <dt>OperationOutcome:</dt>
            <dd>
              {error.outcome.issue?.length ?? 0} issue(s)
              {error.outcome.issue?.[0]?.code
                ? ` · código ${error.outcome.issue[0].code}`
                : ""}
            </dd>
          </div>
        )}
      </dl>
      <div className="flex flex-wrap gap-2">
        {retry && error.kind !== "config" && <RetryButton />}
        {extra}
      </div>
    </Card>
  );
}
