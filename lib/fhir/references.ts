import { isWithinBase } from "./url";

/** Formato de id FHIR: letras, dígitos, "-" y ".", de 1 a 64 caracteres. */
const FHIR_ID_RE = /^[A-Za-z0-9\-.]{1,64}$/;

export function isFhirId(value: string): boolean {
  return FHIR_ID_RE.test(value);
}

export type PatientRefResult =
  | { kind: "id"; id: string }
  | { kind: "missing" }
  | { kind: "unsupported"; reference: string };

/**
 * Extrae el id de paciente de una referencia FHIR.
 * Acepta "Patient/{id}", "Patient/{id}/_history/{v}" y la forma absoluta
 * bajo el mismo servidor. Otras formas (otro servidor, "#contenido",
 * solo identifier) no se pueden comprobar.
 */
export function patientIdFromReference(
  reference: string | undefined,
  baseUrl: URL | null,
): PatientRefResult {
  if (!reference || reference.trim() === "") return { kind: "missing" };
  let rel = reference.trim();

  if (/^https?:\/\//i.test(rel)) {
    if (!baseUrl || !isWithinBase(rel, baseUrl)) {
      return { kind: "unsupported", reference };
    }
    const url = new URL(rel);
    if (url.search || url.hash) return { kind: "unsupported", reference };
    rel = url.pathname.slice(baseUrl.pathname.replace(/\/+$/, "").length + 1);
  }

  const m = /^Patient\/([^/]+)(?:\/_history\/[^/]+)?$/.exec(rel);
  if (!m || !isFhirId(m[1])) return { kind: "unsupported", reference };
  return { kind: "id", id: m[1] };
}

/** Motivo legible si la referencia no es del paciente; null si coincide. */
export function patientMismatchReason(
  reference: string | undefined,
  patientId: string,
  baseUrl: URL | null,
): string | null {
  const r = patientIdFromReference(reference, baseUrl);
  if (r.kind === "missing") return "No indica a qué paciente pertenece";
  if (r.kind === "unsupported")
    return `Referencia de paciente no comprobable (${reference})`;
  if (r.id !== patientId) return `Pertenece a otro paciente (Patient/${r.id})`;
  return null;
}
