import type { Encounter } from "fhir/r4";
import type { EncounterRow } from "@/lib/fhir/encounter";
import type { SearchAllResult } from "@/lib/fhir/search";
import { DataTable, type Column, type DataRow } from "../DataTable";
import { ReadOnlyShell } from "./ReadOnlyShell";

const columns: Column[] = [
  { key: "inicio", label: "Inicio", sortable: true, nowrap: true },
  { key: "modalidad", label: "Modalidad", sortable: true, filter: true },
  { key: "tipo", label: "Tipo", sortable: true, filter: true },
  { key: "motivo", label: "Motivo registrado", sortable: true, filter: true },
  { key: "estado", label: "Estado", sortable: true, filter: true },
];

/** Consultas médicas (Encounter), tal como vienen del servidor. */
export function EncounterPanel({
  search,
  rows,
  otherPatient,
}: {
  search: SearchAllResult<Encounter>;
  rows: EncounterRow[];
  otherPatient: number;
}) {
  const requestOf = new Map(search.resources.map((r, i) => [r, search.sources[i]]));
  const data: DataRow[] = rows.map((r, i) => ({
    key: `${r.ref}-${i}`,
    cells: {
      inicio: { text: r.startText, sort: r.sortKey, sub: r.ref },
      modalidad: { text: r.classText },
      tipo: { text: r.typeText },
      motivo: { text: r.reasonText },
      estado: { text: r.statusText },
    },
    viewer: { reference: r.ref, resource: r.resource, request: requestOf.get(r.resource) },
  }));

  return (
    <ReadOnlyShell
      id="enc-titulo"
      title="Consultas"
      subtitle="Encuentros registrados (Encounter). El motivo se muestra como texto del registro, no como diagnóstico verificado."
      search={search}
      otherPatient={otherPatient}
    >
      <DataTable
        caption="Consultas"
        columns={columns}
        rows={data}
        initialSort={{ key: "inicio", dir: "desc" }}
        emptyText="Sin información disponible: el servidor no devolvió consultas."
        minWidth={860}
        searchPlaceholder="Tipo, motivo o referencia…"
      />
    </ReadOnlyShell>
  );
}
