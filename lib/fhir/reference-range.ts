import type { CodeableConcept, Observation, ObservationReferenceRange, Quantity } from "fhir/r4";

/**
 * Rango de referencia e interpretación de un resultado. Función pura.
 *
 * Reglas:
 * - El rango y la marca vienen del laboratorio, dentro del registro
 *   (`referenceRange`, `interpretation`). Nunca se inventa un rango.
 * - La comparación propia solo se hace con un rango numérico único y la misma
 *   unidad que el valor.
 * - Si la marca del laboratorio y la comparación no coinciden: "Requiere revisión".
 * - No se usa la palabra "malo": se dice alto, bajo o crítico respecto del rango.
 */

export const INTERPRETATION_SYSTEM =
  "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation";

export type RangeStatus =
  | "normal"
  | "alto"
  | "bajo"
  | "critico-alto"
  | "critico-bajo"
  | "anormal"
  | "critico"
  | "revision"
  | "no-comparable"
  | "sin-rango";

export const RANGE_STATUS_LABEL: Record<RangeStatus, string> = {
  normal: "Dentro del rango",
  alto: "↑ Alto",
  bajo: "↓ Bajo",
  "critico-alto": "‼ Crítico alto",
  "critico-bajo": "‼ Crítico bajo",
  anormal: "Anormal",
  critico: "‼ Crítico",
  revision: "? Requiere revisión",
  "no-comparable": "No comparable",
  "sin-rango": "Sin rango informado",
};

/** ¿El estado indica fuera de rango (para filtros y la gráfica)? */
export function isOutOfRange(s: RangeStatus): boolean {
  return ["alto", "bajo", "critico-alto", "critico-bajo", "anormal", "critico"].includes(s);
}

type Position = "below" | "within" | "above";

interface LabFlag {
  code: string;
  label: string;
  /** Posición que implica la marca (si la implica). */
  implies: Position | null;
  status: RangeStatus;
}

/** Códigos v3 de interpretación más usados. */
const FLAGS: Record<string, Omit<LabFlag, "code">> = {
  N: { label: "Normal", implies: "within", status: "normal" },
  H: { label: "Alto", implies: "above", status: "alto" },
  L: { label: "Bajo", implies: "below", status: "bajo" },
  HH: { label: "Crítico alto", implies: "above", status: "critico-alto" },
  LL: { label: "Crítico bajo", implies: "below", status: "critico-bajo" },
  HU: { label: "Significativamente alto", implies: "above", status: "alto" },
  LU: { label: "Significativamente bajo", implies: "below", status: "bajo" },
  A: { label: "Anormal", implies: null, status: "anormal" },
  AA: { label: "Crítico anormal", implies: null, status: "critico" },
};

export interface RangeEvaluation {
  /** Rango como texto para mostrar ("0.7–1.3 mg/dL", "< 130 mg/dL" o el texto del laboratorio). */
  rangeText: string | null;
  low: number | null;
  high: number | null;
  /** Marca del laboratorio, si vino. */
  labFlag: { code: string; label: string } | null;
  /** Comparación propia del valor contra el rango (si fue posible). */
  computed: Position | null;
  status: RangeStatus;
  statusLabel: string;
  /** De dónde sale el estado. */
  source: "laboratorio" | "rango" | "ambos" | null;
  /** Explicaciones para mostrar (motivos de "no comparable" o de "revisión"). */
  notes: string[];
}

function unitKey(q: Quantity | undefined): string | null {
  const k = q?.code ?? q?.unit;
  return k ? k.trim().toLowerCase() : null;
}

function fmt(n: number): string {
  return String(n);
}

function rangeToText(r: ObservationReferenceRange): string | null {
  const unit = r.low?.unit ?? r.high?.unit ?? r.low?.code ?? r.high?.code;
  const u = unit ? ` ${unit}` : "";
  const lo = typeof r.low?.value === "number" ? r.low.value : null;
  const hi = typeof r.high?.value === "number" ? r.high.value : null;
  if (lo !== null && hi !== null) return `${fmt(lo)}–${fmt(hi)}${u}`;
  if (hi !== null) return `≤ ${fmt(hi)}${u}`;
  if (lo !== null) return `≥ ${fmt(lo)}${u}`;
  return r.text?.trim() || null;
}

function readFlag(list: CodeableConcept[] | undefined): LabFlag | null {
  for (const c of list ?? []) {
    for (const cd of c.coding ?? []) {
      if (cd.code && (!cd.system || cd.system === INTERPRETATION_SYSTEM) && FLAGS[cd.code]) {
        return { code: cd.code, ...FLAGS[cd.code] };
      }
    }
  }
  const first = list?.[0];
  if (first) {
    const label = first.text ?? first.coding?.[0]?.display ?? first.coding?.[0]?.code;
    if (label) return { code: first.coding?.[0]?.code ?? "?", label, implies: null, status: "revision" };
  }
  return null;
}

const POSITION_ES: Record<Position, string> = {
  below: "por debajo del",
  within: "dentro del",
  above: "por encima del",
};

export function evaluateRange(o: Pick<Observation, "valueQuantity" | "referenceRange" | "interpretation">): RangeEvaluation {
  const notes: string[] = [];
  const ranges = o.referenceRange ?? [];
  const flag = readFlag(o.interpretation);

  // Con varios rangos (por edad, sexo, embarazo…) no elegimos uno: se muestran, no se comparan.
  const range = ranges.length === 1 ? ranges[0] : null;
  if (ranges.length > 1) notes.push(`El registro trae ${ranges.length} rangos (p. ej. por edad o sexo): no se compara.`);

  const rangeText =
    range ? rangeToText(range) : ranges.length > 1 ? ranges.map(rangeToText).filter(Boolean).join(" · ") || null : null;
  const low = typeof range?.low?.value === "number" ? range.low.value : null;
  const high = typeof range?.high?.value === "number" ? range.high.value : null;

  // Comparación propia
  let computed: Position | null = null;
  const value = o.valueQuantity?.value;
  if (range && (low !== null || high !== null)) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      notes.push("No hay valor numérico para comparar.");
    } else if (o.valueQuantity?.comparator) {
      notes.push(`El valor tiene comparador (${o.valueQuantity.comparator}): no se compara.`);
    } else {
      const vu = unitKey(o.valueQuantity);
      const ru = unitKey(range.low ?? range.high);
      if (!ru) notes.push("El rango no indica unidad: no se compara.");
      else if (!vu) notes.push("El valor no indica unidad: no se compara.");
      else if (vu !== ru)
        notes.push(`Unidad distinta (valor en ${o.valueQuantity?.unit ?? vu}, rango en ${range.low?.unit ?? range.high?.unit ?? ru}): no se compara.`);
      else computed = low !== null && value < low ? "below" : high !== null && value > high ? "above" : "within";
    }
  } else if (range && range.text) {
    notes.push("El rango viene solo como texto: no se compara.");
  }

  let status: RangeStatus;
  let source: RangeEvaluation["source"] = null;
  if (flag && computed) {
    source = "ambos";
    if (flag.implies && flag.implies !== computed) {
      status = "revision";
      notes.push(
        `El laboratorio indica "${flag.label}", pero el valor está ${POSITION_ES[computed]} rango informado.`,
      );
    } else {
      status = flag.status === "revision" ? "revision" : flag.status;
    }
  } else if (flag) {
    source = "laboratorio";
    status = flag.status;
    if (status === "revision") notes.push(`Interpretación no estándar: "${flag.label}".`);
  } else if (computed) {
    source = "rango";
    status = computed === "above" ? "alto" : computed === "below" ? "bajo" : "normal";
  } else {
    status = ranges.length ? "no-comparable" : "sin-rango";
  }

  return {
    rangeText,
    low,
    high,
    labFlag: flag ? { code: flag.code, label: flag.label } : null,
    computed,
    status,
    statusLabel: RANGE_STATUS_LABEL[status],
    source,
    notes,
  };
}
