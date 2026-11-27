import type { ReactNode } from "react";
import type { FhirRequestInfo } from "@/lib/fhir/client";
import type { IncompleteReason } from "@/lib/fhir/search";
import { QueryInfo } from "../QueryInfo";
import { RetryButton } from "../RetryButton";
import { Badge, Card } from "../ui";

/** Contenedor común de las secciones de solo lectura (no verificadas). */
export function ReadOnlyShell({
  id,
  title,
  subtitle,
  search,
  otherPatient,
  children,
}: {
  id: string;
  title: string;
  subtitle: string;
  search: {
    requests: FhirRequestInfo[];
    complete: boolean;
    incompleteReason?: IncompleteReason;
    error?: { message: string };
  };
  otherPatient: number;
  children: ReactNode;
}) {
  return (
    <Card padded={false} aria-labelledby={id} className="flex flex-col gap-4 pb-2">
      <div className="flex flex-col gap-2 px-5 pt-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id={id} className="text-subheading font-semibold">
            {title}
          </h2>
          <Badge tone="soft">Solo lectura · no verificado</Badge>
        </div>
        <p className="text-mid-gray">{subtitle}</p>
        <QueryInfo
          requests={search.requests}
          complete={search.complete}
          incompleteReason={search.incompleteReason}
        />
      </div>
      {!search.complete && (
        <div
          role="alert"
          className="mx-5 flex flex-wrap items-center justify-between gap-3 rounded-nested border border-danger px-4 py-3"
        >
          <p>
            <strong className="font-semibold text-danger">Consulta incompleta.</strong>{" "}
            {search.error?.message ?? "No se leyeron todas las páginas."} Puede haber
            registros que no se ven.
          </p>
          <RetryButton />
        </div>
      )}
      {otherPatient > 0 && (
        <p className="mx-5 text-caption text-mid-gray">
          {otherPatient} registro(s) de otro paciente no se muestran.
        </p>
      )}
      {children}
    </Card>
  );
}

export const th = "px-4 py-2 font-medium";
export const td = "px-4 py-3 align-middle";
export const theadRow =
  "border-y border-hairline bg-surface-alt text-caption uppercase text-mid-gray";
