import type { Observation, ObservationComponent, Quantity } from "fhir/r4";
import { conceptLabel } from "./allergy";
import { compareDesc, parseFhirDateTime } from "./datetime";
import { evaluateRange, type RangeEvaluation, type RangeStatus } from "./reference-range";
import { patientMismatchReason } from "./references";
import { LOINC_BODY_TEMPERATURE, LOINC_SYSTEM } from "./temperature";

/**
 * Observaciones de solo lectura (laboratorio, signos vitales, etc.).
 * Se muestran tal como vienen, sin verificar. El alto/bajo solo sale del
 * propio registro (rango e interpretación del laboratorio): ver reference-range.ts.
 */

export const CATEGORY_ES: Record<string, string> = {
  laboratory: "Laboratorio",
  "vital-signs": "Signos vitales",
  "social-history": "Historia social",
  imaging: "Imágenes",
  survey: "Encuesta",
  exam: "Examen",
  procedure: "Procedimiento",
  therapy: "Terapia",
  activity: "Actividad",
};

export interface ObservationRow {
  ref: string;
  name: string | null;
  categories: string[];
  valueText: string;
  /** Valor numérico de valueQuantity (para ordenar); null si no hay. */
  valueNumber: number | null;
  dateText: string | null;
  /** Para ordenar: instante si existe, si no la fecha parcial; null si no hay fecha. */
  sortKey: number | null;
  /** true si la fecha es un instante (con hora y zona); false si es parcial. */
  datePrecise: boolean;
  status: string | null;
  /** Rango de referencia e interpretación del laboratorio. */
  range: RangeEvaluation;
  /** Agrupa mediciones del mismo análisis (para la gráfica); null si no se puede identificar. */
  seriesKey: string | null;
  resource: Observation;
}

/** Identifica el análisis: LOINC si hay; si no, el primer sistema|código; si no, el texto. */
export function seriesKeyOf(o: Observation): string | null {
  const codings = o.code?.coding ?? [];
  const loinc = codings.find((c) => c.system === LOINC_SYSTEM && c.code);
  if (loinc) return `${LOINC_SYSTEM}|${loinc.code}`;
  const any = codings.find((c) => c.system && c.code);
  if (any) return `${any.system}|${any.code}`;
  const text = o.code?.text?.trim().toLowerCase();
  return text ? `text|${text}` : null;
}

export function formatQuantity(q: Quantity | undefined): string | null {
  if (!q || typeof q.value !== "number") return null;
  const unit = q.unit ?? q.code;
  return `${q.comparator ?? ""}${q.value}${unit ? ` ${unit}` : ""}`;
}

type WithValue = Pick<
  ObservationComponent,
  | "valueQuantity"
  | "valueCodeableConcept"
  | "valueString"
  | "valueBoolean"
  | "valueInteger"
  | "valueDateTime"
  | "valueTime"
  | "valuePeriod"
  | "valueRange"
  | "valueRatio"
  | "valueSampledData"
  | "dataAbsentReason"
>;

/** Texto del value[x], sea del tipo que sea. */
export function formatValue(v: WithValue): string | null {
  if (v.valueQuantity) return formatQuantity(v.valueQuantity);
  if (v.valueCodeableConcept) return conceptLabel(v.valueCodeableConcept);
  if (v.valueString !== undefined) return v.valueString;
  if (v.valueBoolean !== undefined) return v.valueBoolean ? "Sí" : "No";
  if (v.valueInteger !== undefined) return String(v.valueInteger);
  if (v.valueDateTime) return parseFhirDateTime(v.valueDateTime)?.display ?? v.valueDateTime;
  if (v.valueTime) return v.valueTime;
  if (v.valuePeriod)
    return `${v.valuePeriod.start ?? "?"} → ${v.valuePeriod.end ?? "?"}`;
  if (v.valueRange)
    return `${formatQuantity(v.valueRange.low) ?? "?"} – ${formatQuantity(v.valueRange.high) ?? "?"}`;
  if (v.valueRatio)
    return `${formatQuantity(v.valueRatio.numerator) ?? "?"} / ${formatQuantity(v.valueRatio.denominator) ?? "?"}`;
  if (v.valueSampledData) return "Datos muestreados (ver JSON)";
  if (v.dataAbsentReason)
    return `Sin valor (${conceptLabel(v.dataAbsentReason) ?? "motivo no indicado"})`;
  return null;
}

function observationDate(o: Observation) {
  const raw = o.effectiveDateTime ?? o.effectivePeriod?.start ?? o.effectiveInstant ?? o.issued;
  const parsed = parseFhirDateTime(raw);
  if (!raw) return { text: null, key: null, precise: false };
  const key = parsed?.instant ?? (Number.isFinite(Date.parse(raw)) ? Date.parse(raw) : null);
  const precise = parsed?.instant != null;
  const text = parsed?.display ?? raw;
  const suffix = o.effectiveDateTime
    ? ""
    : o.effectivePeriod
      ? " (inicio del período)"
      : o.effectiveInstant
        ? ""
        : " (fecha de emisión)";
  return { text: text + suffix, key, precise };
}

export function isBodyTemperature(o: Observation): boolean {
  return !!o.code?.coding?.some(
    (c) => c.system === LOINC_SYSTEM && c.code === LOINC_BODY_TEMPERATURE,
  );
}

export function toObservationRow(o: Observation): ObservationRow {
  const own = formatValue(o);
  const components = (o.component ?? [])
    .map((c) => {
      const v = formatValue(c);
      return v ? `${conceptLabel(c.code) ?? "Componente"}: ${v}` : null;
    })
    .filter((x): x is string => !!x);
  const valueText = [own, ...components].filter(Boolean).join(" · ") || "—";
  const date = observationDate(o);
  return {
    ref: o.id ? `Observation/${o.id}` : "Observation/(sin id)",
    name: conceptLabel(o.code),
    categories: (o.category ?? [])
      .flatMap((c) => c.coding ?? [])
      .map((c) => (c.code ? (CATEGORY_ES[c.code] ?? c.display ?? c.code) : c.display ?? ""))
      .filter(Boolean),
    valueText,
    valueNumber:
      typeof o.valueQuantity?.value === "number" && Number.isFinite(o.valueQuantity.value)
        ? o.valueQuantity.value
        : null,
    dateText: date.text,
    sortKey: date.key,
    datePrecise: date.precise,
    status: o.status ?? null,
    range: evaluateRange(o),
    seriesKey: seriesKeyOf(o),
    resource: o,
  };
}

// ---------- Series para la gráfica de evolución ----------

export interface ChartPoint {
  ref: string;
  x: number; // ms desde epoch
  dateText: string;
  datePrecise: boolean;
  value: number;
  status: RangeStatus;
  statusLabel: string;
  rangeText: string | null;
}

export interface ChartSeries {
  key: string;
  name: string;
  unit: string | null;
  /** De la más antigua a la más reciente. */
  points: ChartPoint[];
  /** Franja: rango numérico del registro más reciente con rango comparable. */
  band: { low: number | null; high: number | null; text: string; ref: string } | null;
  /** Mediciones del análisis que no se grafican, con su motivo. */
  excluded: { ref: string; reason: string }[];
}

/**
 * Agrupa filas por análisis. Solo se grafican valores numéricos, con fecha y en
 * la unidad de la medición más reciente (no se convierten unidades).
 */
export function buildSeries(rows: ObservationRow[]): Record<string, ChartSeries> {
  const groups = new Map<string, ObservationRow[]>();
  for (const r of rows) {
    if (!r.seriesKey) continue;
    const g = groups.get(r.seriesKey) ?? [];
    g.push(r);
    groups.set(r.seriesKey, g);
  }

  const out: Record<string, ChartSeries> = {};
  for (const [key, list] of groups) {
    const sorted = [...list].sort((a, b) => compareDesc(b.sortKey, a.sortKey)); // ascendente
    const unitOf = (r: ObservationRow) =>
      (r.resource.valueQuantity?.code ?? r.resource.valueQuantity?.unit ?? "").trim().toLowerCase() || null;
    // La unidad de la serie es la de la medición graficable más reciente (con valor, fecha y sin comparador).
    const latestNumeric = [...sorted]
      .reverse()
      .find((r) => r.valueNumber !== null && r.sortKey !== null && !r.resource.valueQuantity?.comparator);
    const unitKey = latestNumeric ? unitOf(latestNumeric) : null;
    const unitLabel = latestNumeric
      ? (latestNumeric.resource.valueQuantity?.unit ?? latestNumeric.resource.valueQuantity?.code ?? null)
      : null;

    const points: ChartPoint[] = [];
    const excluded: ChartSeries["excluded"] = [];
    for (const r of sorted) {
      if (r.valueNumber === null) excluded.push({ ref: r.ref, reason: "Sin valor numérico" });
      else if (r.sortKey === null) excluded.push({ ref: r.ref, reason: "Sin fecha" });
      else if (r.resource.valueQuantity?.comparator)
        excluded.push({ ref: r.ref, reason: `Valor con comparador (${r.resource.valueQuantity.comparator})` });
      else if (unitOf(r) !== unitKey)
        excluded.push({ ref: r.ref, reason: `Unidad distinta (${r.resource.valueQuantity?.unit ?? r.resource.valueQuantity?.code ?? "sin unidad"})` });
      else
        points.push({
          ref: r.ref,
          x: r.sortKey,
          dateText: r.dateText ?? "",
          datePrecise: r.datePrecise,
          value: r.valueNumber,
          status: r.range.status,
          statusLabel: r.range.statusLabel,
          rangeText: r.range.rangeText,
        });
    }

    // Franja: el rango numérico más reciente cuya unidad coincide (computed != null lo garantiza).
    const withBand = [...sorted]
      .reverse()
      .find((r) => r.range.computed !== null && unitOf(r) === unitKey);
    const band = withBand
      ? {
          low: withBand.range.low,
          high: withBand.range.high,
          text: withBand.range.rangeText ?? "",
          ref: withBand.ref,
        }
      : null;

    out[key] = {
      key,
      name: list[0].name ?? "Sin nombre",
      unit: unitLabel,
      points,
      band,
      excluded,
    };
  }
  return out;
}

/**
 * Filas de solo lectura del paciente, de la más reciente a la más antigua.
 * Excluye la temperatura (tiene su propia sección) y lo que no es del paciente.
 */
export function readOnlyObservations(
  list: Observation[],
  patientId: string,
  baseUrl: URL | null,
) {
  let otherPatient = 0;
  const rows: ObservationRow[] = [];
  for (const o of list) {
    if (patientMismatchReason(o.subject?.reference, patientId, baseUrl)) {
      otherPatient++;
      continue;
    }
    if (isBodyTemperature(o)) continue;
    rows.push(toObservationRow(o));
  }
  rows.sort((a, b) => compareDesc(a.sortKey, b.sortKey));
  return { rows, otherPatient };
}

export const LAB_CATEGORY_SYSTEM =
  "http://terminology.hl7.org/CodeSystem/observation-category";

/** ¿Tiene la categoría `laboratory`? (con el sistema oficial o sin sistema). */
export function isLaboratory(o: Observation): boolean {
  return !!o.category?.some((c) =>
    c.coding?.some(
      (cd) => cd.code === "laboratory" && (!cd.system || cd.system === LAB_CATEGORY_SYSTEM),
    ),
  );
}

/** Separa análisis de laboratorio del resto (signos vitales, historia social, etc.). */
export function splitObservations(rows: ObservationRow[]) {
  const lab: ObservationRow[] = [];
  const other: ObservationRow[] = [];
  for (const r of rows) (isLaboratory(r.resource) ? lab : other).push(r);
  return { lab, other };
}
