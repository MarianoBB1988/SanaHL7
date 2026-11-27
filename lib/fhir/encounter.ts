import type { Encounter } from "fhir/r4";
import { conceptLabel } from "./allergy";
import { compareDesc, parseFhirDateTime } from "./datetime";
import { patientMismatchReason } from "./references";

/** Consultas (Encounter) de solo lectura: se muestran tal como vienen. */

/** Clases de encuentro (v3 ActCode) más comunes. */
export const ENCOUNTER_CLASS_ES: Record<string, string> = {
  AMB: "Ambulatoria",
  EMER: "Urgencia",
  IMP: "Internación",
  ACUTE: "Internación aguda",
  NONAC: "Internación no aguda",
  OBSENC: "Observación",
  PRENC: "Preingreso",
  SS: "Corta estancia",
  HH: "Domicilio",
  FLD: "Terreno",
  VR: "Virtual",
};

export const ENCOUNTER_STATUS_ES: Record<string, string> = {
  planned: "Planificada",
  arrived: "Llegó",
  triaged: "Triada",
  "in-progress": "En curso",
  onleave: "De permiso",
  finished: "Finalizada",
  cancelled: "Cancelada",
  "entered-in-error": "Cargada por error",
  unknown: "Desconocido",
};

export interface EncounterRow {
  ref: string;
  startText: string | null;
  endText: string | null;
  sortKey: number | null;
  classText: string | null;
  typeText: string | null;
  reasonText: string | null;
  status: string | null;
  statusText: string | null;
  resource: Encounter;
}

export function toEncounterRow(e: Encounter): EncounterRow {
  const start = parseFhirDateTime(e.period?.start);
  const end = parseFhirDateTime(e.period?.end);
  const raw = e.period?.start;
  const sortKey =
    start?.instant ?? (raw && Number.isFinite(Date.parse(raw)) ? Date.parse(raw) : null);
  const classCode = e.class?.code;
  return {
    ref: e.id ? `Encounter/${e.id}` : "Encounter/(sin id)",
    startText: start?.display ?? raw ?? null,
    endText: end?.display ?? e.period?.end ?? null,
    sortKey,
    classText: classCode
      ? (ENCOUNTER_CLASS_ES[classCode] ?? e.class.display ?? classCode)
      : (e.class?.display ?? null),
    typeText:
      (e.type ?? []).map((t) => conceptLabel(t)).filter(Boolean).join(", ") || null,
    reasonText:
      (e.reasonCode ?? []).map((r) => conceptLabel(r)).filter(Boolean).join(", ") || null,
    status: e.status ?? null,
    statusText: e.status ? (ENCOUNTER_STATUS_ES[e.status] ?? e.status) : null,
    resource: e,
  };
}

export function readOnlyEncounters(
  list: Encounter[],
  patientId: string,
  baseUrl: URL | null,
) {
  let otherPatient = 0;
  const rows: EncounterRow[] = [];
  for (const e of list) {
    if (patientMismatchReason(e.subject?.reference, patientId, baseUrl)) {
      otherPatient++;
      continue;
    }
    rows.push(toEncounterRow(e));
  }
  rows.sort((a, b) => compareDesc(a.sortKey, b.sortKey));
  return { rows, otherPatient };
}
