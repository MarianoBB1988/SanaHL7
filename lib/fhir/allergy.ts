import type { AllergyIntolerance, CodeableConcept } from "fhir/r4";
import { patientMismatchReason } from "./references";

/**
 * Alergias. Función pura que separa:
 * - active:   clinicalStatus active + verificationStatus confirmed (sistemas HL7 correctos)
 * - review:   cualquier otro registro del paciente → "Requiere revisión", nunca se oculta
 * - excluded: registros que no corresponden al paciente
 */

export const CLINICAL_SYSTEM =
  "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical";
export const VERIFICATION_SYSTEM =
  "http://terminology.hl7.org/CodeSystem/allergyintolerance-verification";

/**
 * Registros que expresan "sin alergias conocidas". En la versión 1 van a
 * "Requiere revisión". SNOMED CT: 716186003 No known allergy,
 * 409137002 No known drug allergy, 429625007 No known food allergy,
 * 428607008 No known environmental allergy.
 */
const NO_KNOWN_ALLERGY_SNOMED = new Set([
  "716186003",
  "409137002",
  "429625007",
  "428607008",
]);
const NO_KNOWN_ALLERGY_TEXT =
  /\b(no known|nkda|nka|sin alergias?|niega alergias?|no (tiene|presenta) alergias?)\b/i;

export type AllergyCategory = "active" | "review" | "excluded";

export interface AllergyRow {
  ref: string;
  substance: string | null;
  category: AllergyCategory;
  reasons: string[]; // vacío en "active"
  clinicalStatus: string | null;
  verificationStatus: string | null;
  criticality: string | null;
  recordedDate: string | null;
  resource: AllergyIntolerance;
}

export function conceptLabel(concept: CodeableConcept | undefined): string | null {
  if (!concept) return null;
  if (concept.text?.trim()) return concept.text.trim();
  const coding = concept.coding?.find((c) => c.display?.trim()) ?? concept.coding?.[0];
  if (!coding) return null;
  return coding.display?.trim() || coding.code || null;
}

export function isNoKnownAllergy(a: AllergyIntolerance): boolean {
  const byCode = a.code?.coding?.some(
    (c) => c.system === "http://snomed.info/sct" && !!c.code && NO_KNOWN_ALLERGY_SNOMED.has(c.code),
  );
  const texts = [a.code?.text, ...(a.code?.coding?.map((c) => c.display) ?? [])];
  const byText = texts.some((t) => !!t && NO_KNOWN_ALLERGY_TEXT.test(t));
  return !!byCode || byText;
}

/** Código del estado en el sistema esperado; "ambiguous" si hay otro sistema o varios. */
function statusCode(
  concept: CodeableConcept | undefined,
  system: string,
): { code: string | null; problem: string | null } {
  if (!concept?.coding?.length) return { code: null, problem: null };
  const inSystem = concept.coding.filter((c) => c.system === system && c.code);
  const codes = new Set(inSystem.map((c) => c.code!));
  if (codes.size === 1) return { code: [...codes][0], problem: null };
  if (codes.size > 1) return { code: null, problem: "varios códigos distintos" };
  return { code: null, problem: "sistema de códigos inesperado" };
}

export function classifyAllergy(
  a: AllergyIntolerance,
  patientId: string,
  baseUrl: URL | null,
): AllergyRow {
  const ref = a.id ? `AllergyIntolerance/${a.id}` : "AllergyIntolerance/(sin id)";
  const clinical = statusCode(a.clinicalStatus, CLINICAL_SYSTEM);
  const verification = statusCode(a.verificationStatus, VERIFICATION_SYSTEM);
  const base = {
    ref,
    substance: conceptLabel(a.code),
    clinicalStatus: clinical.code,
    verificationStatus: verification.code,
    criticality: a.criticality ?? null,
    recordedDate: a.recordedDate ?? null,
    resource: a,
  };

  const mismatch = patientMismatchReason(a.patient?.reference, patientId, baseUrl);
  if (mismatch) return { ...base, category: "excluded", reasons: [mismatch] };

  const reasons: string[] = [];
  if (!a.id) reasons.push("El recurso no tiene id");
  if (isNoKnownAllergy(a))
    reasons.push("Registro de \"sin alergias conocidas\": se revisa a mano en esta versión");
  if (!base.substance) reasons.push("Sustancia no informada");

  if (clinical.problem) reasons.push(`Estado clínico ambiguo (${clinical.problem})`);
  else if (!clinical.code) reasons.push("Sin estado clínico (clinicalStatus)");
  else if (clinical.code !== "active") reasons.push(`Estado clínico: ${clinical.code}`);

  if (verification.problem) reasons.push(`Verificación ambigua (${verification.problem})`);
  else if (!verification.code) reasons.push("Sin estado de verificación (verificationStatus)");
  else if (verification.code !== "confirmed")
    reasons.push(`Verificación: ${verification.code}`);

  return { ...base, category: reasons.length === 0 ? "active" : "review", reasons };
}

export function classifyAllergies(
  list: AllergyIntolerance[],
  patientId: string,
  baseUrl: URL | null,
) {
  const rows = list.map((a) => classifyAllergy(a, patientId, baseUrl));
  return {
    active: rows.filter((r) => r.category === "active"),
    review: rows.filter((r) => r.category === "review"),
    excluded: rows.filter((r) => r.category === "excluded"),
  };
}
