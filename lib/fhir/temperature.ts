import type { Observation } from "fhir/r4";
import { parseFhirDateTime, type ParsedDateTime } from "./datetime";
import { patientMismatchReason } from "./references";

/**
 * Temperatura corporal (LOINC 8310-5). Separa las mediciones utilizables
 * de las excluidas, con el motivo de cada exclusión. Función pura.
 *
 * Utilizable: LOINC 8310-5, status final/amended/corrected, valor numérico
 * sin comparador, unidad UCUM "Cel" y effectiveDateTime con hora y zona.
 */

export const LOINC_SYSTEM = "http://loinc.org";
export const LOINC_BODY_TEMPERATURE = "8310-5";
export const UCUM_SYSTEM = "http://unitsofmeasure.org";
export const USABLE_STATUSES = ["final", "amended", "corrected"] as const;

export interface TemperatureRow {
  ref: string; // "Observation/{id}"
  value: number;
  unit: "Cel";
  effective: ParsedDateTime; // siempre con instant
  status: string;
  resource: Observation;
}

export interface ExcludedTemperature {
  ref: string;
  reasons: string[];
  valueText: string;
  effectiveText: string;
  status: string | null;
  resource: Observation;
}

export interface TemperatureClassification {
  usable: TemperatureRow[]; // de la más reciente a la más antigua
  excluded: ExcludedTemperature[];
}

export function classifyTemperatures(
  observations: Observation[],
  patientId: string,
  baseUrl: URL | null,
): TemperatureClassification {
  const usable: TemperatureRow[] = [];
  const excluded: ExcludedTemperature[] = [];

  for (const obs of observations) {
    const reasons: string[] = [];
    const ref = obs.id ? `Observation/${obs.id}` : "Observation/(sin id)";
    if (!obs.id) reasons.push("El recurso no tiene id");

    const mismatch = patientMismatchReason(obs.subject?.reference, patientId, baseUrl);
    if (mismatch) reasons.push(mismatch);

    const isBodyTemp = obs.code?.coding?.some(
      (c) => c.system === LOINC_SYSTEM && c.code === LOINC_BODY_TEMPERATURE,
    );
    if (!isBodyTemp) reasons.push("No tiene el código LOINC 8310-5");

    const status = obs.status ?? null;
    if (!status) reasons.push("Sin estado (status)");
    else if (status === "entered-in-error")
      reasons.push("Marcada como cargada por error (entered-in-error)");
    else if (!(USABLE_STATUSES as readonly string[]).includes(status))
      reasons.push(`Estado no utilizable: ${status}`);

    const q = obs.valueQuantity;
    const value = q?.value;
    if (!q) {
      reasons.push(
        obs.dataAbsentReason
          ? "Sin valor (dataAbsentReason)"
          : "Sin valor numérico (valueQuantity)",
      );
    } else {
      if (typeof value !== "number" || !Number.isFinite(value))
        reasons.push("Sin valor numérico");
      if (q.comparator) reasons.push(`Valor con comparador (${q.comparator})`);
      if (!q.system && !q.code) reasons.push("Sin unidad codificada");
      else if (q.system !== UCUM_SYSTEM || q.code !== "Cel")
        reasons.push(
          `Unidad distinta de Cel (${[q.system, q.code ?? q.unit].filter(Boolean).join(" ")})`,
        );
    }

    const effective = parseFhirDateTime(obs.effectiveDateTime);
    if (!obs.effectiveDateTime) {
      reasons.push(
        obs.effectivePeriod || obs.effectiveInstant || obs.effectiveTiming
          ? "La fecha no viene como effectiveDateTime"
          : "Sin fecha (effectiveDateTime)",
      );
    } else if (!effective) {
      reasons.push("effectiveDateTime con formato inválido");
    } else if (effective.instant === null) {
      reasons.push(
        effective.precision === "time"
          ? "La fecha tiene hora pero no zona horaria"
          : "La fecha no incluye hora y zona: no es un instante comparable",
      );
    }

    if (reasons.length === 0 && effective && typeof value === "number") {
      usable.push({ ref, value, unit: "Cel", effective, status: status!, resource: obs });
    } else {
      excluded.push({
        ref,
        reasons,
        valueText:
          typeof value === "number"
            ? `${value}${q?.unit || q?.code ? ` ${q.unit ?? q.code}` : ""}`
            : "—",
        effectiveText: effective?.display ?? obs.effectiveDateTime ?? "—",
        status,
        resource: obs,
      });
    }
  }

  usable.sort((a, b) => b.effective.instant! - a.effective.instant!);
  return { usable, excluded };
}
