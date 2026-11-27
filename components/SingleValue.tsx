import type { ChartSeries } from "@/lib/fhir/observation";
import { isOutOfRange } from "@/lib/fhir/reference-range";
import { Badge } from "./ui";

/**
 * Una sola medición: no hay evolución que graficar (una línea necesita dos
 * puntos). Se muestra el valor grande y, si hay rango numérico, una barra que
 * marca dónde cae el valor respecto del rango del laboratorio.
 */

const num = new Intl.NumberFormat("en-US", { maximumFractionDigits: 3, useGrouping: false });

export function SingleValue({ series }: { series: ChartSeries }) {
  const p = series.points[0];
  const band = series.band;
  const unit = series.unit ? ` ${series.unit}` : "";
  const out = isOutOfRange(p.status);
  const dir = p.status.includes("alto") ? "up" : p.status.includes("bajo") ? "down" : "none";

  // Dominio de la barra: incluye el valor y los límites del rango, con aire a los lados.
  let bar: null | {
    pos: (v: number) => number;
    from: number;
    to: number;
    ticks: { v: number; label: string }[];
  } = null;
  if (band && (band.low != null || band.high != null)) {
    const nonNegative = p.value >= 0 && (band.low ?? 0) >= 0 && (band.high ?? 0) >= 0;
    const lo = Math.min(p.value, band.low ?? (nonNegative ? 0 : p.value), band.high ?? p.value);
    const hi = Math.max(p.value, band.high ?? p.value, band.low ?? p.value);
    const pad = (hi - lo || Math.abs(hi) || 1) * 0.08;
    const d0 = nonNegative ? Math.max(0, lo - pad) : lo - pad;
    const d1 = hi + pad;
    const pos = (v: number) => ((v - d0) / (d1 - d0)) * 100;
    const ticks: { v: number; label: string }[] = [];
    if (band.low != null) ticks.push({ v: band.low, label: num.format(band.low) });
    if (band.high != null) ticks.push({ v: band.high, label: num.format(band.high) });
    bar = {
      pos,
      from: pos(band.low ?? d0),
      to: pos(band.high ?? d1),
      ticks,
    };
  }

  const position =
    dir === "up" ? "por encima del" : dir === "down" ? "por debajo del" : p.status === "normal" ? "dentro del" : "respecto del";
  const summary = band
    ? `${num.format(p.value)}${unit}, ${position} rango del laboratorio (${band.text}). ${p.statusLabel}.`
    : `${num.format(p.value)}${unit}. ${p.statusLabel}.`;

  return (
    <div className="flex flex-col gap-5 rounded-nested border border-hairline bg-canvas px-5 py-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-caption font-medium uppercase text-mid-gray">Única medición</p>
          <p className="font-heading text-[40px] leading-none font-semibold tracking-[-0.04em] tabular-nums">
            {num.format(p.value)}
            <span className="ml-1.5 text-body-lg font-normal tracking-normal text-mid-gray">{series.unit}</span>
          </p>
          <p className="text-mist">{p.dateText}</p>
        </div>
        {out ? (
          <Badge tone="warm">{p.statusLabel}</Badge>
        ) : p.status === "revision" ? (
          <Badge tone="outline">{p.statusLabel}</Badge>
        ) : (
          <Badge tone="soft">{p.statusLabel}</Badge>
        )}
      </div>

      {bar ? (
        <div role="img" aria-label={summary} className="flex flex-col gap-2">
          {/* Barra: pista, franja del rango y marcador del valor */}
          <div className="relative mx-2 h-12" aria-hidden>
            {/* etiqueta del valor sobre el marcador */}
            <span
              className={`absolute top-0 -translate-x-1/2 text-caption font-semibold tabular-nums ${out ? "text-ember" : "text-ink"}`}
              style={{ left: `${bar.pos(p.value)}%` }}
            >
              {num.format(p.value)}
            </span>
            {/* pista */}
            <div className="absolute inset-x-0 top-7 h-1.5 rounded-full bg-white/[0.08]" />
            {/* franja del rango */}
            <div
              className="absolute top-[26px] h-2.5 rounded-full border border-growth/60 bg-growth/20"
              style={{ left: `${bar.from}%`, width: `${Math.max(1.5, bar.to - bar.from)}%` }}
            />
            {/* marcador: ▲ alto, ▼ bajo, ◆ anormal, ● dentro, ○ revisión */}
            <svg
              viewBox="-8 -8 16 16"
              className="absolute top-[31px] size-4 -translate-x-1/2 -translate-y-1/2 overflow-visible"
              style={{ left: `${bar.pos(p.value)}%` }}
            >
              {out ? (
                <polygon
                  points={
                    dir === "up" ? "0,-6.5 6.5,5 -6.5,5" : dir === "down" ? "0,6.5 6.5,-5 -6.5,-5" : "0,-6.5 6.5,0 0,6.5 -6.5,0"
                  }
                  className="fill-ember stroke-canvas"
                  strokeWidth={2}
                  strokeLinejoin="round"
                />
              ) : (
                <circle
                  r={5}
                  className={p.status === "revision" ? "fill-canvas stroke-mist" : "fill-ink stroke-canvas"}
                  strokeWidth={2}
                />
              )}
            </svg>
          </div>
          {/* límites del rango debajo de la barra */}
          <div className="relative mx-2 h-4 text-caption tabular-nums text-mid-gray" aria-hidden>
            {bar.ticks.map((t, i) => (
              <span
                key={i}
                className="absolute -translate-x-1/2"
                style={{ left: `${bar.pos(t.v)}%` }}
              >
                {t.label}
              </span>
            ))}
          </div>
          <p className="text-caption text-mid-gray">
            <span aria-hidden className="mr-1.5 inline-block h-2.5 w-4 rounded-[2px] border border-growth/60 bg-growth/20 align-middle" />
            Rango del laboratorio: {band!.text}
          </p>
        </div>
      ) : (
        <p className="text-caption text-mid-gray">
          {p.rangeText
            ? `Rango informado: ${p.rangeText} (no se puede ubicar el valor en una barra).`
            : "El registro no trae rango de referencia para comparar."}
        </p>
      )}

      <p className="text-caption text-mid-gray">
        Hay una sola medición de este análisis: no hay evolución para graficar.
      </p>
    </div>
  );
}
