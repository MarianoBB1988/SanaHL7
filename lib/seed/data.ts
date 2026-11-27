import type {
  AllergyIntolerance,
  Encounter,
  Observation,
  Patient,
  Quantity,
  Reference,
} from "fhir/r4";

/**
 * Datos FICTICIOS para el HAPI local. Ids fijos: cargar dos veces no duplica (PUT).
 * Todo lleva la etiqueta urn:sanahl7:dataset|ficticio.
 * No se inventan códigos clínicos: los LOINC usados existen (8310-5 temperatura
 * corporal, 2345-7 glucosa, 718-7 hemoglobina); alergia, motivo y tipo de consulta
 * van solo como texto. Los valores y rangos son inventados para probar la app.
 */

export const DATASET_TAG = { system: "urn:sanahl7:dataset", code: "ficticio", display: "Dato ficticio" };
export const FICTITIOUS_PATIENT_IDS = ["ana-ficticia", "bruno-ficticio"] as const;

const meta = { tag: [DATASET_TAG] };
const UCUM = "http://unitsofmeasure.org";
const LOINC = "http://loinc.org";
const OBS_CATEGORY = "http://terminology.hl7.org/CodeSystem/observation-category";
const INTERP = "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation";

const ana: Reference = { reference: "Patient/ana-ficticia" };
const qty = (value: number, unit: string, code = unit): Quantity => ({ value, unit, system: UCUM, code });
const category = (code: "vital-signs" | "laboratory", display: string) => [
  { coding: [{ system: OBS_CATEGORY, code, display }] },
];

const patients: Patient[] = [
  {
    resourceType: "Patient",
    id: "ana-ficticia",
    meta,
    active: true,
    name: [{ use: "official", family: "Ficticia", given: ["Ana"] }],
    gender: "female",
    birthDate: "1990-01-01",
  },
  {
    // Sin observaciones ni alergias: para probar datos ausentes ("Sin información disponible").
    resourceType: "Patient",
    id: "bruno-ficticio",
    meta,
    active: true,
    name: [{ use: "official", family: "Ficticio", given: ["Bruno"] }],
    gender: "male",
    birthDate: "1985-01-01",
  },
];

const temperature = (id: string, value: number, when: string): Observation => ({
  resourceType: "Observation",
  id,
  meta,
  status: "final",
  category: category("vital-signs", "Vital Signs"),
  code: { coding: [{ system: LOINC, code: "8310-5", display: "Body temperature" }], text: "Temperatura corporal" },
  subject: ana,
  effectiveDateTime: when,
  valueQuantity: qty(value, "°C", "Cel"),
});

const temperatures: Observation[] = [
  temperature("ana-temp-1", 36.8, "2026-11-20T08:00:00-03:00"),
  temperature("ana-temp-2", 37.4, "2026-11-23T08:00:00-03:00"),
  temperature("ana-temp-3", 38.5, "2026-11-26T08:00:00-03:00"),
];

type Flag = "N" | "H" | "L";
const FLAG_DISPLAY: Record<Flag, string> = { N: "Normal", H: "High", L: "Low" };

const lab = (
  id: string,
  loinc: { code: string; display: string; text: string },
  value: Quantity,
  range: { low: number; high: number },
  flag: Flag,
  when: string,
): Observation => ({
  resourceType: "Observation",
  id,
  meta,
  status: "final",
  category: category("laboratory", "Laboratory"),
  code: { coding: [{ system: LOINC, code: loinc.code, display: loinc.display }], text: loinc.text },
  subject: ana,
  effectiveDateTime: when,
  valueQuantity: value,
  referenceRange: [
    { low: qty(range.low, value.unit!, value.code), high: qty(range.high, value.unit!, value.code) },
  ],
  interpretation: [{ coding: [{ system: INTERP, code: flag, display: FLAG_DISPLAY[flag] }] }],
});

const GLUCOSE = { code: "2345-7", display: "Glucose [Mass/volume] in Serum or Plasma", text: "Glucosa en suero" };
const HEMOGLOBIN = { code: "718-7", display: "Hemoglobin [Mass/volume] in Blood", text: "Hemoglobina" };
const glucoseRange = { low: 70, high: 100 };

const labs: Observation[] = [
  // Glucosa repetida: para ver la gráfica de línea con normal, alto y bajo.
  lab("ana-glucosa-1", GLUCOSE, qty(92, "mg/dL"), glucoseRange, "N", "2026-05-10T09:00:00-03:00"),
  lab("ana-glucosa-2", GLUCOSE, qty(108, "mg/dL"), glucoseRange, "H", "2026-07-12T09:00:00-03:00"),
  lab("ana-glucosa-3", GLUCOSE, qty(88, "mg/dL"), glucoseRange, "N", "2026-09-14T09:00:00-03:00"),
  lab("ana-glucosa-4", GLUCOSE, qty(66, "mg/dL"), glucoseRange, "L", "2026-11-20T09:00:00-03:00"),
  // Hemoglobina única: para ver la vista de una sola medición con barra de rango.
  lab("ana-hemoglobina-1", HEMOGLOBIN, qty(13.1, "g/dL"), { low: 12, high: 15.5 }, "N", "2026-11-20T09:00:00-03:00"),
];

const allergies: AllergyIntolerance[] = [
  {
    resourceType: "AllergyIntolerance",
    id: "ana-alergia-penicilina",
    meta,
    clinicalStatus: {
      coding: [{ system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical", code: "active" }],
    },
    verificationStatus: {
      coding: [{ system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-verification", code: "confirmed" }],
    },
    code: { text: "Penicilina" },
    patient: ana,
  },
];

const encounters: Encounter[] = [
  {
    resourceType: "Encounter",
    id: "ana-consulta-1",
    meta,
    status: "finished",
    class: { system: "http://terminology.hl7.org/CodeSystem/v3-ActCode", code: "AMB", display: "ambulatory" },
    type: [{ text: "Consulta por fiebre" }],
    reasonCode: [{ text: "Fiebre de 38.5 °C" }],
    subject: ana,
    period: { start: "2026-11-26T09:00:00-03:00", end: "2026-11-26T09:30:00-03:00" },
  },
];

/** En orden de carga: pacientes primero (los demás los referencian). */
export function seedResources() {
  return [...patients, ...temperatures, ...labs, ...allergies, ...encounters];
}
