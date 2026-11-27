import type { FhirRequestInfo } from "@/lib/fhir/client";
import { buildSeries, type ObservationRow } from "@/lib/fhir/observation";
import { isOutOfRange } from "@/lib/fhir/reference-range";
import type { SearchAllResult } from "@/lib/fhir/search";
import type { Cell } from "@/lib/table";
import { DataTable, type Column, type DataRow } from "../DataTable";
import { ReadOnlyShell } from "./ReadOnlyShell";

/** Celda del estado del rango: destacada si está fuera, contorno si requiere revisión. */
function rangeStatusCell(r: ObservationRow): Cell {
  const { status, statusLabel, source } = r.range;
  const suffix = source === "laboratorio" || source === "ambos" ? " (laboratorio)" : "";
  return {
    text: statusLabel,
    sub: r.range.notes.length ? r.range.notes.join(" ") : suffix ? `según el laboratorio` : undefined,
    emphasis: isOutOfRange(status) ? "warm" : status === "revision" ? "outline" : "muted",
  };
}

/**
 * Tabla de observaciones de solo lectura (Análisis y Otras observaciones).
 * Al tocar el nombre se abre la evolución de ese análisis en una gráfica.
 */
export function ObservationTablePanel({
  id,
  title,
  subtitle,
  emptyText,
  search,
  rows,
  otherPatient,
  showCategory,
}: {
  id: string;
  title: string;
  subtitle: string;
  emptyText: string;
  search: SearchAllResult<unknown>;
  rows: ObservationRow[];
  otherPatient: number;
  showCategory: boolean;
}) {
  const requestOf = new Map<unknown, FhirRequestInfo>(
    search.resources.map((r, i) => [r, search.sources[i]]),
  );
  const charts = buildSeries(rows);
  const anyRange = rows.some((r) => r.range.status !== "sin-rango");

  const columns: Column[] = [
    { key: "fecha", label: "Fecha", sortable: true, nowrap: true },
    { key: "nombre", label: "Observación", sortable: true, chart: true },
    { key: "valor", label: "Valor", sortable: true, mono: true },
    { key: "rango", label: "Rango", sortable: true, nowrap: true },
    { key: "enRango", label: "Según el rango", sortable: true, filter: true },
    ...(showCategory
      ? [{ key: "categoria", label: "Categoría", sortable: true, filter: true }]
      : []),
    { key: "estado", label: "Estado", sortable: true, filter: true },
  ];

  const data: DataRow[] = rows.map((r, i) => ({
    key: `${r.ref}-${i}`,
    chartKey: r.seriesKey ?? undefined,
    cells: {
      fecha: { text: r.dateText, sort: r.sortKey },
      nombre: { text: r.name, sub: r.ref },
      valor: { text: r.valueText === "—" ? null : r.valueText, sort: r.valueNumber ?? r.valueText },
      rango: { text: r.range.rangeText, emphasis: "muted" },
      enRango: rangeStatusCell(r),
      categoria: { text: r.categories.join(", ") || null },
      estado: { text: r.status },
    },
    viewer: { reference: r.ref, resource: r.resource, request: requestOf.get(r.resource) },
  }));

  return (
    <ReadOnlyShell id={id} title={title} subtitle={subtitle} search={search} otherPatient={otherPatient}>
      {rows.length > 0 && (
        <p className="mx-5 text-caption text-mid-gray">
          Tocá el nombre de una observación para ver su evolución.{" "}
          {anyRange
            ? "El rango y la marca alto/bajo vienen del laboratorio, dentro de cada registro."
            : "Ningún registro trae rango de referencia del laboratorio."}
        </p>
      )}
      <DataTable
        caption={title}
        columns={columns}
        rows={data}
        initialSort={{ key: "fecha", dir: "desc" }}
        emptyText={emptyText}
        minWidth={showCategory ? 1080 : 980}
        searchPlaceholder="Nombre, valor o referencia…"
        charts={charts}
      />
    </ReadOnlyShell>
  );
}
