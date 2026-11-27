import type { Observation } from "fhir/r4";
import type { SearchAllResult } from "@/lib/fhir/search";
import { classifyTemperatures } from "@/lib/fhir/temperature";
import { DataTable, type Column, type DataRow } from "../DataTable";
import { QueryInfo } from "../QueryInfo";
import { RetryButton } from "../RetryButton";
import { Card } from "../ui";

const usableColumns: Column[] = [
  { key: "fecha", label: "Fecha y hora", sortable: true, nowrap: true },
  { key: "valor", label: "Valor (Cel)", sortable: true, mono: true, nowrap: true },
  { key: "estado", label: "Estado", sortable: true, filter: true },
  { key: "ref", label: "Referencia", sortable: true, mono: true, nowrap: true },
];

const excludedColumns: Column[] = [
  { key: "ref", label: "Referencia", sortable: true, mono: true, nowrap: true },
  { key: "valor", label: "Valor", sortable: true, mono: true, nowrap: true },
  { key: "fecha", label: "Fecha", sortable: true, nowrap: true },
  { key: "motivo", label: "Motivo", sortable: true },
];

/** Panel de temperatura (verificada). Recibe la búsqueda ya hecha. */
export function TemperaturePanel({
  search,
  patientId,
  baseUrl,
}: {
  search: SearchAllResult<Observation>;
  patientId: string;
  baseUrl: URL | null;
}) {
  const requestOf = new Map(search.resources.map((r, i) => [r, search.sources[i]]));
  const { usable, excluded } = classifyTemperatures(search.resources, patientId, baseUrl);

  // `usable` viene de la más reciente a la más antigua: la primera es la más reciente.
  const usableRows: DataRow[] = usable.map((r, i) => ({
    key: r.ref,
    cells: {
      fecha: {
        text: r.effective.display,
        sort: r.effective.instant,
        badge: i === 0 ? "Más reciente" : undefined,
      },
      valor: { text: String(r.value), sort: r.value },
      estado: { text: r.status },
      ref: { text: r.ref },
    },
    viewer: { reference: r.ref, resource: r.resource, request: requestOf.get(r.resource) },
  }));

  const excludedRows: DataRow[] = excluded.map((r, i) => ({
    key: `${r.ref}-${i}`,
    cells: {
      ref: { text: r.ref },
      valor: { text: r.valueText === "—" ? null : r.valueText },
      fecha: { text: r.effectiveText === "—" ? null : r.effectiveText },
      motivo: { text: r.reasons.join("; "), lines: r.reasons },
    },
    viewer: { reference: r.ref, resource: r.resource, request: requestOf.get(r.resource) },
  }));

  return (
    <Card padded={false} aria-labelledby="temp-titulo" className="flex flex-col gap-4 pb-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pt-5">
        <div>
          <h2 id="temp-titulo" className="text-subheading font-semibold">
            Temperatura corporal
          </h2>
          <p className="text-mid-gray">
            LOINC <span className="font-mono text-caption">8310-5</span> · solo mediciones
            utilizables en <span className="font-mono text-caption">Cel</span>
          </p>
        </div>
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
            <strong className="font-semibold text-danger">Requiere revisión.</strong>{" "}
            {search.error?.message ?? "La consulta no se pudo completar."} Puede haber
            mediciones que no se ven.
          </p>
          <RetryButton />
        </div>
      )}

      {usable.length === 0 ? (
        <p className="mx-5 rounded-nested bg-canvas px-4 py-4 text-mid-gray">
          {search.resources.length === 0
            ? "Sin información disponible: el servidor no devolvió mediciones de temperatura."
            : "Ninguna medición es utilizable. Mirá los motivos en la tabla de excluidas."}
        </p>
      ) : (
        <DataTable
          caption="Mediciones de temperatura utilizables"
          columns={usableColumns}
          rows={usableRows}
          initialSort={{ key: "fecha", dir: "desc" }}
          emptyText="Sin mediciones utilizables."
          minWidth={640}
          searchPlaceholder="Fecha, valor o referencia…"
        />
      )}

      {excluded.length > 0 && (
        <section aria-labelledby="temp-excluidas" className="flex flex-col gap-2">
          <h3 id="temp-excluidas" className="px-5 text-caption font-medium uppercase text-mid-gray">
            Registros excluidos ({excluded.length})
          </h3>
          <DataTable
            caption="Registros de temperatura excluidos y su motivo"
            columns={excludedColumns}
            rows={excludedRows}
            emptyText="Sin registros excluidos."
            minWidth={720}
            searchPlaceholder="Motivo, valor o referencia…"
          />
        </section>
      )}
    </Card>
  );
}
