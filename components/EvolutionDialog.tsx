"use client";

import { forwardRef } from "react";
import type { ChartSeries } from "@/lib/fhir/observation";
import { isOutOfRange } from "@/lib/fhir/reference-range";
import { LineChart } from "./LineChart";
import { SingleValue } from "./SingleValue";
import { Badge, buttonStyles } from "./ui";

/**
 * Diálogo "Evolución": gráfica de un análisis en el tiempo + la tabla con
 * los mismos datos (la gráfica nunca es la única forma de leer un valor).
 */
export const EvolutionDialog = forwardRef<
  HTMLDialogElement,
  { series: ChartSeries | null; onClose: () => void }
>(function EvolutionDialog({ series, onClose }, ref) {
  const outCount = series?.points.filter((p) => isOutOfRange(p.status)).length ?? 0;
  return (
    <dialog
      ref={ref}
      aria-labelledby="evolucion-titulo"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) e.currentTarget.close();
      }}
      className="sana-dialog m-auto w-[min(100vw-2rem,860px)] max-h-[min(100dvh-2rem,880px)] overflow-hidden rounded-card border border-line bg-paper p-0 text-left font-normal text-ink shadow-card"
    >
      {series && (
        <div className="flex max-h-[inherit] flex-col">
          <header className="flex items-start justify-between gap-4 border-b border-hairline px-6 py-5">
            <div className="flex min-w-0 flex-col gap-1">
              <p className="text-caption font-medium uppercase text-mid-gray">Evolución</p>
              <h2 id="evolucion-titulo" className="text-[22px] leading-tight font-semibold tracking-[-0.03em]">
                {series.name}
              </h2>
              <p className="text-mid-gray">
                {series.points.length} {series.points.length === 1 ? "medición" : "mediciones"}
                {series.unit ? ` · en ${series.unit}` : ""}
                {outCount > 0 ? ` · ${outCount} fuera del rango` : ""}
              </p>
              <p className="font-mono text-caption break-all text-mid-gray">{series.key}</p>
            </div>
            <form method="dialog">
              <button type="submit" className={buttonStyles.secondary} autoFocus>
                Cerrar
              </button>
            </form>
          </header>

          <div className="flex flex-col gap-5 overflow-y-auto px-6 py-5">
            {/* Una línea necesita dos puntos: con una sola medición, valor + barra de rango. */}
            {series.points.length === 1 ? <SingleValue series={series} /> : <LineChart series={series} />}

            <section aria-labelledby="evolucion-tabla" className="flex flex-col gap-2">
              <h3 id="evolucion-tabla" className="text-caption font-medium uppercase text-mid-gray">
                Valores
              </h3>
              <div className="overflow-x-auto rounded-nested border border-hairline">
                <table className="w-full min-w-[560px] border-collapse text-left">
                  <caption className="sr-only">Valores de {series.name}</caption>
                  <thead>
                    <tr className="border-b border-hairline bg-surface-alt text-caption uppercase text-mid-gray">
                      <th scope="col" className="px-4 py-2 font-medium">Fecha</th>
                      <th scope="col" className="px-4 py-2 font-medium">Valor</th>
                      <th scope="col" className="px-4 py-2 font-medium">Rango</th>
                      <th scope="col" className="px-4 py-2 font-medium">Estado</th>
                      <th scope="col" className="px-4 py-2 font-medium">Referencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...series.points].reverse().map((p) => (
                      <tr key={p.ref} className="border-b border-hairline last:border-b-0">
                        <td className="whitespace-nowrap px-4 py-2">{p.dateText}</td>
                        <td className="whitespace-nowrap px-4 py-2 font-mono">
                          {p.value}
                          {series.unit ? <span className="text-mid-gray"> {series.unit}</span> : null}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-mid-gray">{p.rangeText ?? "—"}</td>
                        <td className="px-4 py-2">
                          {isOutOfRange(p.status) ? (
                            <Badge tone="warm">{p.statusLabel}</Badge>
                          ) : p.status === "revision" ? (
                            <Badge tone="outline">{p.statusLabel}</Badge>
                          ) : (
                            <span className="text-mid-gray">{p.statusLabel}</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 font-mono text-caption text-mid-gray">{p.ref}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {series.excluded.length > 0 && (
              <section aria-labelledby="evolucion-excluidas" className="flex flex-col gap-1 text-caption text-mid-gray">
                <h3 id="evolucion-excluidas" className="font-medium uppercase">
                  No graficadas ({series.excluded.length})
                </h3>
                <ul className="list-disc pl-5">
                  {series.excluded.map((x) => (
                    <li key={x.ref}>
                      <span className="font-mono">{x.ref}</span>: {x.reason}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <p className="border-t border-hairline pt-4 text-caption text-mid-gray">
              Solo lectura · no verificado. El rango y la marca alto/bajo vienen del laboratorio, dentro de
              cada registro; la franja muestra el rango del registro más reciente. Un valor fuera del rango
              no es un diagnóstico.
            </p>
          </div>
        </div>
      )}
    </dialog>
  );
});
