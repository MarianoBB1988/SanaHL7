"use client";

import { useId, useMemo, useRef, useState } from "react";
import type { FhirRequestInfo } from "@/lib/fhir/client";
import type { ChartSeries } from "@/lib/fhir/observation";
import { EvolutionDialog } from "./EvolutionDialog";
import {
  applyTable,
  filterOptions,
  isTableFiltered,
  type SortState,
  type TableRow,
  type TableState,
} from "@/lib/table";
import { FhirViewerButton } from "./FhirViewer";
import { Badge, buttonStyles } from "./ui";

export interface Column {
  key: string;
  label: string;
  sortable?: boolean;
  /** Muestra un desplegable para filtrar por los valores de esta columna. */
  filter?: boolean;
  mono?: boolean;
  nowrap?: boolean;
  /** En esta columna, el texto abre la gráfica de evolución de la fila (si tiene). */
  chart?: boolean;
}

export interface DataRow extends TableRow {
  viewer?: { reference: string; resource: unknown; request?: FhirRequestInfo };
  /** Clave de la serie en `charts` (mismo análisis a lo largo del tiempo). */
  chartKey?: string;
}

const th = "px-4 py-2 font-medium";
const td = "px-4 py-3 align-middle";
const field =
  "h-9 rounded-pill bg-canvas px-4 text-body outline-none ring-1 ring-line transition-shadow duration-200 placeholder:text-mid-gray focus:ring-ink/60";

/**
 * Tabla con orden por columna, filtros y búsqueda, todo en el navegador
 * (los datos ya llegaron del servidor). No cambia los datos: solo la vista.
 */
export function DataTable({
  caption,
  columns,
  rows,
  initialSort = null,
  emptyText,
  minWidth = 760,
  searchPlaceholder = "Buscar en la tabla…",
  charts,
}: {
  caption: string;
  columns: Column[];
  rows: DataRow[];
  initialSort?: SortState | null;
  emptyText: string;
  minWidth?: number;
  searchPlaceholder?: string;
  /** Series para la gráfica de evolución, por clave. */
  charts?: Record<string, ChartSeries>;
}) {
  const uid = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const [chartKey, setChartKey] = useState<string | null>(null);

  function openChart(key: string, el: HTMLElement) {
    opener.current = el;
    setChartKey(key);
    // Abrir después de que React pinte el contenido de la serie.
    requestAnimationFrame(() => dialog.current?.showModal());
  }
  const initial: TableState = { query: "", filters: {}, sort: initialSort };
  const [state, setState] = useState<TableState>(initial);
  const visible = useMemo(() => applyTable(rows, state) as DataRow[], [rows, state]);
  const filterCols = columns.filter((c) => c.filter);
  const hasViewer = rows.some((r) => r.viewer);
  const filtered = isTableFiltered(state);

  function toggleSort(key: string) {
    setState((s) => {
      // Columna nueva: ascendente. Misma columna: invierte el sentido.
      if (s.sort?.key !== key) return { ...s, sort: { key, dir: "asc" } };
      return { ...s, sort: { key, dir: s.sort.dir === "asc" ? "desc" : "asc" } };
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {rows.length > 1 && (
        <div className="flex flex-wrap items-end gap-3 px-5">
          <div className="flex min-w-[200px] flex-1 flex-col gap-1">
            <label
              htmlFor={`${uid}-q`}
              className="text-caption font-medium uppercase text-mid-gray"
            >
              Buscar
            </label>
            <input
              id={`${uid}-q`}
              type="search"
              value={state.query}
              placeholder={searchPlaceholder}
              onChange={(e) => setState((s) => ({ ...s, query: e.target.value }))}
              className={field}
            />
          </div>
          {filterCols.map((c) => {
            const options = filterOptions(rows, c.key);
            return (
              <div key={c.key} className="flex flex-col gap-1">
                <label
                  htmlFor={`${uid}-f-${c.key}`}
                  className="text-caption font-medium uppercase text-mid-gray"
                >
                  {c.label}
                </label>
                <select
                  id={`${uid}-f-${c.key}`}
                  value={state.filters[c.key] ?? ""}
                  onChange={(e) =>
                    setState((s) => ({
                      ...s,
                      filters: { ...s.filters, [c.key]: e.target.value },
                    }))
                  }
                  className={`${field} max-w-[260px]`}
                >
                  <option value="">Todos ({rows.length})</option>
                  {options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label} ({o.count})
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
          {filtered && (
            <button
              type="button"
              className={buttonStyles.secondary}
              onClick={() => setState((s) => ({ ...s, query: "", filters: {} }))}
            >
              Limpiar filtros
            </button>
          )}
        </div>
      )}

      <p aria-live="polite" className="px-5 text-caption text-mid-gray">
        {filtered
          ? `Mostrando ${visible.length} de ${rows.length}`
          : `${rows.length} ${rows.length === 1 ? "registro" : "registros"}`}
        {state.sort &&
          ` · ordenado por ${columns.find((c) => c.key === state.sort!.key)?.label.toLowerCase()} (${
            state.sort.dir === "asc" ? "ascendente" : "descendente"
          })`}
      </p>

      {visible.length === 0 ? (
        <p className="mx-5 mb-3 rounded-nested bg-canvas px-4 py-4 text-mid-gray">
          {filtered ? "Ningún registro coincide con los filtros." : emptyText}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table
            className="w-full border-collapse text-left"
            style={{ minWidth }}
          >
            <caption className="sr-only">{caption}</caption>
            <thead>
              <tr className="border-y border-hairline bg-surface-alt text-caption uppercase text-mid-gray">
                {columns.map((c, i) => {
                  const sorted = state.sort?.key === c.key ? state.sort.dir : null;
                  return (
                    <th
                      key={c.key}
                      scope="col"
                      aria-sort={
                        sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined
                      }
                      className={`${th} ${i === 0 ? "pl-5" : ""}`}
                    >
                      {c.sortable ? (
                        <button
                          type="button"
                          onClick={() => toggleSort(c.key)}
                          className={`-mx-1 inline-flex items-center gap-1 rounded-small px-1 uppercase hover:text-ink ${
                            sorted ? "text-ink" : ""
                          }`}
                        >
                          {c.label}
                          <span aria-hidden className="w-3 text-center">
                            {sorted === "asc" ? "↑" : sorted === "desc" ? "↓" : "↕"}
                          </span>
                          <span className="sr-only">
                            {sorted === "asc"
                              ? ", orden ascendente; clic para descendente"
                              : sorted === "desc"
                                ? ", orden descendente; clic para ascendente"
                                : ", clic para ordenar"}
                          </span>
                        </button>
                      ) : (
                        c.label
                      )}
                    </th>
                  );
                })}
                {hasViewer && (
                  <th scope="col" className={`${th} pr-5`}>
                    <span className="sr-only">Visor</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.key} className="border-b border-hairline transition-colors duration-150 last:border-b-0 hover:bg-white/[0.025]">
                  {columns.map((c, i) => {
                    const cell = row.cells[c.key];
                    return (
                      <td
                        key={c.key}
                        className={`${td} ${i === 0 ? "pl-5" : ""} ${c.nowrap ? "whitespace-nowrap" : ""} ${
                          c.mono ? "font-mono" : ""
                        }`}
                      >
                        {c.chart && row.chartKey && charts?.[row.chartKey]?.points.length ? (
                          <button
                            type="button"
                            onClick={(e) => openChart(row.chartKey!, e.currentTarget)}
                            className="group inline-flex items-start gap-2 rounded-small text-left transition-colors hover:text-signal"
                          >
                            <span className="underline decoration-line decoration-dotted underline-offset-4 group-hover:decoration-signal">
                              {cell?.text ?? "Sin nombre"}
                            </span>
                            <svg aria-hidden viewBox="0 0 16 16" className="mt-0.5 size-4 shrink-0 fill-none stroke-mid-gray stroke-[1.5] transition-colors group-hover:stroke-signal">
                              <path d="M2 12 L6 7 L9 9.5 L14 4" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            <span className="sr-only">
                              : ver evolución ({charts[row.chartKey].points.length}{" "}
                              {charts[row.chartKey].points.length === 1 ? "medición" : "mediciones"})
                            </span>
                          </button>
                        ) : cell?.lines ? (
                          <ul className="list-disc pl-4 font-sans">
                            {cell.lines.map((l) => (
                              <li key={l}>{l}</li>
                            ))}
                          </ul>
                        ) : cell?.text && cell.emphasis === "warm" ? (
                          <Badge tone="warm">{cell.text}</Badge>
                        ) : cell?.text && cell.emphasis === "outline" ? (
                          <Badge tone="outline">{cell.text}</Badge>
                        ) : cell?.text && cell.emphasis === "muted" ? (
                          <span className="font-sans text-mid-gray">{cell.text}</span>
                        ) : cell?.text ? (
                          cell.text
                        ) : (
                          <span className="font-sans text-mid-gray">—</span>
                        )}
                        {cell?.badge && (
                          <span className="ml-2 font-sans">
                            <Badge tone="solid">{cell.badge}</Badge>
                          </span>
                        )}
                        {cell?.sub && (
                          <span className="block font-mono text-caption text-mid-gray">
                            {cell.sub}
                          </span>
                        )}
                      </td>
                    );
                  })}
                  {hasViewer && (
                    <td className={`${td} pr-5 text-right`}>
                      {row.viewer && (
                        <FhirViewerButton
                          reference={row.viewer.reference}
                          resource={row.viewer.resource}
                          request={row.viewer.request}
                        />
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {charts && (
        <EvolutionDialog
          ref={dialog}
          series={chartKey ? (charts[chartKey] ?? null) : null}
          onClose={() => opener.current?.focus()}
        />
      )}
    </div>
  );
}
