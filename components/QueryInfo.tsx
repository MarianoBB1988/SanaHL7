import type { FhirRequestInfo } from "@/lib/fhir/client";
import type { IncompleteReason } from "@/lib/fhir/search";
import { Badge } from "./ui";

const INCOMPLETE_TEXT: Record<IncompleteReason, string> = {
  error: "una página falló",
  "max-pages": "se alcanzó el límite de páginas",
  "link-rejected": "el enlace a la página siguiente apuntaba a otro servidor",
};

/** Qué se consultó, cuántas páginas y si la consulta quedó completa. */
export function QueryInfo({
  requests,
  complete,
  incompleteReason,
}: {
  requests: FhirRequestInfo[];
  complete: boolean;
  incompleteReason?: IncompleteReason;
}) {
  const first = requests[0];
  return (
    <details className="group text-caption text-mid-gray">
      <summary className="flex cursor-pointer flex-wrap items-center gap-2 rounded-small transition-colors marker:content-none hover:text-mist">
        {complete ? (
          <Badge tone="positive">
            <span aria-hidden>✓</span> Consulta completa
          </Badge>
        ) : (
          <Badge tone="error">
            <span aria-hidden>!</span> Consulta incompleta
            {incompleteReason ? `: ${INCOMPLETE_TEXT[incompleteReason]}` : ""}
          </Badge>
        )}
        <span>
          {requests.length} {requests.length === 1 ? "página" : "páginas"}
        </span>
        {first && <span className="font-mono break-all">GET {first.url}</span>}
        <span className="underline underline-offset-2 group-open:hidden">ver peticiones</span>
      </summary>
      <ol className="mt-2 flex flex-col gap-1 pl-5 list-decimal">
        {requests.map((r, i) => (
          <li key={i} className="break-all">
            <span className="font-mono">
              {r.method} {r.url}
            </span>{" "}
            · {r.status ? `HTTP ${r.status}` : "sin respuesta"}
            {r.durationMs !== undefined ? ` · ${r.durationMs} ms` : ""}
          </li>
        ))}
      </ol>
    </details>
  );
}
