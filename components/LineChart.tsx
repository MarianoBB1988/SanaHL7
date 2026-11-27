"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { ChartSeries } from "@/lib/fhir/observation";
import { isOutOfRange } from "@/lib/fhir/reference-range";

/**
 * Gráfica de línea de una sola serie (sin leyenda: el título la nombra).
 * - Franja verde tenue: rango del laboratorio (el más reciente comparable).
 * - Puntos fuera de rango: triángulo ▲/▼ en Ember (forma + texto, no solo color).
 * - Línea vertical que sigue al puntero y salta al punto más cercano; flechas del teclado.
 * La tabla de valores (en el diálogo) contiene todo lo que muestra la gráfica.
 */

const HEIGHT = 260;
const PAD = { top: 18, right: 64, bottom: 30, left: 52 };

function niceStep(span: number, count: number): number {
  const raw = span / Math.max(count, 1);
  const mag = 10 ** Math.floor(Math.log10(raw || 1));
  const n = raw / mag;
  return (n >= 5 ? 10 : n >= 2 ? 5 : n >= 1 ? 2 : 1) * mag;
}

function niceTicks(min: number, max: number, count = 5): number[] {
  if (min === max) {
    const d = Math.abs(min) * 0.1 || 1;
    min -= d;
    max += d;
  }
  const step = niceStep(max - min, count);
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= end + step / 2; v += step) ticks.push(Number(v.toPrecision(12)));
  return ticks;
}

const dateFmt = new Intl.DateTimeFormat("es-UY", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "UTC" });
const yearFmt = new Intl.DateTimeFormat("es-UY", { year: "numeric", timeZone: "UTC" });
// Valores con punto decimal, igual que en las tablas y en el JSON de FHIR.
const num = new Intl.NumberFormat("en-US", { maximumFractionDigits: 3, useGrouping: false });

export function LineChart({ series }: { series: ChartSeries }) {
  const uid = useId();
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pts = series.points;
  const geo = useMemo(() => {
    const innerW = width - PAD.left - PAD.right;
    const innerH = HEIGHT - PAD.top - PAD.bottom;
    const xs = pts.map((p) => p.x);
    const values = pts.map((p) => p.value);
    if (series.band?.low != null) values.push(series.band.low);
    if (series.band?.high != null) values.push(series.band.high);
    const yTicks = niceTicks(Math.min(...values), Math.max(...values));
    const yMin = yTicks[0];
    const yMax = yTicks[yTicks.length - 1];
    const xMin = Math.min(...xs);
    const xMax = Math.max(...xs);
    const single = xMin === xMax;
    const x = (v: number) => PAD.left + (single ? innerW / 2 : ((v - xMin) / (xMax - xMin)) * innerW);
    const y = (v: number) => PAD.top + innerH - ((v - yMin) / (yMax - yMin)) * innerH;
    const spanYears = (xMax - xMin) / (365.25 * 864e5);
    const tickCount = single ? 1 : Math.min(5, pts.length, Math.max(2, Math.floor(innerW / 110)));
    const xTicks = single
      ? [xMin]
      : Array.from({ length: tickCount }, (_, i) => xMin + ((xMax - xMin) * i) / (tickCount - 1));
    const fmtX = (v: number) => (spanYears > 3 ? yearFmt.format(v) : dateFmt.format(v));
    return { innerW, innerH, x, y, yTicks, yMin, yMax, xTicks, fmtX };
  }, [pts, series.band, width]);

  if (pts.length === 0) {
    return (
      <p className="rounded-nested bg-canvas px-4 py-4 text-mid-gray">
        No hay mediciones numéricas con fecha para graficar.
      </p>
    );
  }

  const path = pts.map((p, i) => `${i ? "L" : "M"}${geo.x(p.x).toFixed(1)},${geo.y(p.value).toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];
  const band = series.band;
  const bandTop = band ? geo.y(band.high ?? geo.yMax) : 0;
  const bandBottom = band ? geo.y(band.low ?? geo.yMin) : 0;
  const unit = series.unit ? ` ${series.unit}` : "";
  const a = active !== null ? pts[active] : null;

  function nearest(clientX: number) {
    const rect = wrap.current!.getBoundingClientRect();
    const px = clientX - rect.left;
    let best = 0;
    let bestD = Infinity;
    pts.forEach((p, i) => {
      const d = Math.abs(geo.x(p.x) - px);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  }

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    const lastI = pts.length - 1;
    const cur = active ?? lastI;
    const next =
      e.key === "ArrowRight" ? Math.min(lastI, cur + 1)
      : e.key === "ArrowLeft" ? Math.max(0, cur - 1)
      : e.key === "Home" ? 0
      : e.key === "End" ? lastI
      : e.key === "Escape" ? null
      : undefined;
    if (next === undefined) return;
    e.preventDefault();
    setActive(next);
  }

  // Tooltip: centrado sobre el punto; cerca de los bordes se abre hacia adentro
  // para no tapar las etiquetas de los ejes.
  const ax = a ? geo.x(a.x) : 0;
  const tipAlign: "left" | "center" | "right" =
    ax < PAD.left + 110 ? "left" : ax > width - PAD.right - 110 ? "right" : "center";
  const tipLeft = tipAlign === "left" ? ax + 14 : tipAlign === "right" ? ax - 14 : ax;
  const tipShiftX = tipAlign === "left" ? "0" : tipAlign === "right" ? "-100%" : "-50%";
  const tipAbove = a ? geo.y(a.value) > 90 : true;

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={wrap}
        className="relative touch-none rounded-nested outline-none focus-visible:ring-2 focus-visible:ring-ink"
        tabIndex={0}
        role="group"
        aria-label={`Gráfica de ${series.name}: ${pts.length} mediciones. Flechas izquierda y derecha para recorrer los puntos.`}
        aria-describedby={`${uid}-live`}
        onKeyDown={onKey}
        onFocus={() => setActive((v) => v ?? pts.length - 1)}
        onBlur={() => setActive(null)}
        onPointerMove={(e: PointerEvent<HTMLDivElement>) => setActive(nearest(e.clientX))}
        onPointerLeave={() => setActive(null)}
      >
        <svg width={width} height={HEIGHT} className="block overflow-visible" aria-hidden>
          {/* Cuadrícula horizontal y eje Y */}
          {geo.yTicks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={PAD.left + geo.innerW}
                y1={geo.y(t)}
                y2={geo.y(t)}
                className="stroke-white/[0.07]"
                strokeWidth={1}
              />
              <text x={PAD.left - 10} y={geo.y(t)} dy="0.32em" textAnchor="end" className="fill-mid-gray text-[11px] tabular-nums">
                {num.format(t)}
              </text>
            </g>
          ))}

          {/* Franja del rango del laboratorio */}
          {band && (
            <g>
              <rect
                x={PAD.left}
                width={geo.innerW}
                y={Math.min(bandTop, bandBottom)}
                height={Math.max(1, Math.abs(bandBottom - bandTop))}
                className="fill-growth/[0.10]"
              />
              {band.high != null && (
                <line x1={PAD.left} x2={PAD.left + geo.innerW} y1={bandTop} y2={bandTop} className="stroke-growth/50" strokeWidth={1} />
              )}
              {band.low != null && (
                <line x1={PAD.left} x2={PAD.left + geo.innerW} y1={bandBottom} y2={bandBottom} className="stroke-growth/50" strokeWidth={1} />
              )}
            </g>
          )}

          {/* Eje X */}
          <line
            x1={PAD.left}
            x2={PAD.left + geo.innerW}
            y1={PAD.top + geo.innerH}
            y2={PAD.top + geo.innerH}
            className="stroke-white/[0.16]"
            strokeWidth={1}
          />
          {geo.xTicks.map((t, i) => (
            <text
              key={i}
              x={geo.x(t)}
              y={HEIGHT - 8}
              textAnchor={geo.xTicks.length === 1 ? "middle" : i === 0 ? "start" : i === geo.xTicks.length - 1 ? "end" : "middle"}
              className="fill-mid-gray text-[11px] tabular-nums"
            >
              {geo.fmtX(t)}
            </text>
          ))}

          {/* Línea vertical del punto activo */}
          {a && (
            <line
              x1={geo.x(a.x)}
              x2={geo.x(a.x)}
              y1={PAD.top}
              y2={PAD.top + geo.innerH}
              className="stroke-white/30"
              strokeWidth={1}
            />
          )}

          {/* Serie */}
          {pts.length > 1 && (
            <path d={path} fill="none" className="stroke-mist" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          )}
          {pts.map((p, i) => {
            const cx = geo.x(p.x);
            const cy = geo.y(p.value);
            const out = isOutOfRange(p.status);
            const dir = p.status.includes("alto") ? "up" : p.status.includes("bajo") ? "down" : "none";
            const isActive = i === active;
            const r = isActive ? 6 : 4.5;
            if (out) {
              const s = r + 1.5;
              // ▲ alto, ▼ bajo, ◆ anormal sin dirección
              const tri =
                dir === "up"
                  ? `${cx},${cy - s} ${cx + s},${cy + s * 0.8} ${cx - s},${cy + s * 0.8}`
                  : dir === "down"
                    ? `${cx},${cy + s} ${cx + s},${cy - s * 0.8} ${cx - s},${cy - s * 0.8}`
                    : `${cx},${cy - s} ${cx + s},${cy} ${cx},${cy + s} ${cx - s},${cy}`;
              return (
                <polygon key={p.ref} points={tri} className="fill-ember stroke-paper" strokeWidth={2} strokeLinejoin="round" />
              );
            }
            return (
              <circle
                key={p.ref}
                cx={cx}
                cy={cy}
                r={r}
                className={`${p.status === "revision" ? "fill-paper stroke-mist" : "fill-ink stroke-paper"}`}
                strokeWidth={2}
              />
            );
          })}

          {/* Valor rotulado al final de la línea */}
          <text
            x={geo.x(last.x) + 10}
            y={geo.y(last.value)}
            dy="0.32em"
            className="fill-ink text-[12px] font-medium tabular-nums"
          >
            {num.format(last.value)}
          </text>
        </svg>

        {/* Tooltip: valor primero, después fecha y estado */}
        {a && (
          <div
            className="pointer-events-none absolute z-10 w-max max-w-[220px] rounded-nested border border-line bg-page/95 px-3 py-2 text-caption shadow-card"
            style={{
              left: tipLeft,
              top: tipAlign === "center" ? (tipAbove ? geo.y(a.value) - 12 : geo.y(a.value) + 14) : geo.y(a.value),
              transform:
                tipAlign === "center"
                  ? `translate(${tipShiftX}, ${tipAbove ? "-100%" : "0"})`
                  : `translate(${tipShiftX}, -50%)`,
            }}
          >
            <p className="text-body font-semibold text-ink tabular-nums">
              {num.format(a.value)}
              <span className="font-normal text-mid-gray">{unit}</span>
            </p>
            <p className="text-mist">{a.dateText}</p>
            <p className={isOutOfRange(a.status) ? "text-ember" : "text-mid-gray"}>{a.statusLabel}</p>
            {a.rangeText && <p className="text-mid-gray">Rango: {a.rangeText}</p>}
          </div>
        )}
      </div>

      <p id={`${uid}-live`} aria-live="polite" className="sr-only">
        {a ? `${a.dateText}: ${num.format(a.value)}${unit}. ${a.statusLabel}.` : ""}
      </p>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-mid-gray">
        {band && (
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-2.5 w-4 rounded-[2px] border border-growth/50 bg-growth/10" />
            Rango del laboratorio: {band.text}
          </span>
        )}
        {pts.some((p) => isOutOfRange(p.status)) && (
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="text-ember">▲▼</span> Fuera del rango
          </span>
        )}
        {pts.some((p) => p.status === "revision") && (
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="inline-block size-2.5 rounded-full border-2 border-mist" /> Requiere revisión
          </span>
        )}
        {pts.some((p) => !p.datePrecise) && <span>Algunas fechas no tienen hora: se ubican en el día.</span>}
        {new Set(pts.map((p) => p.x)).size < pts.length && (
          <span>Hay mediciones con la misma fecha y hora: se dibujan en la misma vertical.</span>
        )}
      </div>
    </div>
  );
}
