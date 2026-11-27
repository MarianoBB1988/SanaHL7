import type {
  Bundle,
  CapabilityStatement,
  FhirResource,
  HumanName,
  Patient,
} from "fhir/r4";

/**
 * De recursos FHIR a modelos de pantalla. Funciones puras.
 * Cada modelo conserva `ref` ("ResourceType/id") para poder rastrear su origen.
 */

type ResourceTypeName = FhirResource["resourceType"];
type ResourceOf<K extends ResourceTypeName> = Extract<
  FhirResource,
  { resourceType: K }
>;

/**
 * Resultados de una búsqueda: solo entradas con `search.mode = "match"` y el
 * resourceType pedido. `entry` puede faltar (búsqueda sin resultados).
 * Si `search.mode` no viene, se acepta: es opcional en FHIR R4.
 */
export function bundleMatches<K extends ResourceTypeName>(
  bundle: Bundle,
  resourceType: K,
): ResourceOf<K>[] {
  const entries = bundle.entry ?? [];
  const out: ResourceOf<K>[] = [];
  for (const entry of entries) {
    const resource = entry.resource;
    if (!resource || resource.resourceType !== resourceType) continue;
    const mode = entry.search?.mode;
    if (mode !== undefined && mode !== "match") continue;
    out.push(resource as ResourceOf<K>);
  }
  return out;
}

export function findLink(
  bundle: Bundle,
  relation: "next" | "previous" | "self",
): string | undefined {
  // "prev" es un alias usado por algunos servidores.
  const names = relation === "previous" ? ["previous", "prev"] : [relation];
  return bundle.link?.find((l) => names.includes(l.relation))?.url;
}

// ---------- Patient ----------

export interface PatientRow {
  ref: string; // "Patient/{id}"
  id: string;
  name: string | null;
  gender: string | null;
  birthDate: string | null; // tal como viene: puede ser "1990", "1990-01" o "1990-01-01"
}

const GENDER_ES: Record<string, string> = {
  male: "Masculino",
  female: "Femenino",
  other: "Otro",
  unknown: "Desconocido",
};

export function formatHumanName(names: HumanName[] | undefined): string | null {
  if (!names || names.length === 0) return null;
  const chosen =
    names.find((n) => n.use === "official") ??
    names.find((n) => n.use !== "old") ??
    names[0];
  if (chosen.text && chosen.text.trim()) return chosen.text.trim();
  const parts = [...(chosen.given ?? []), chosen.family ?? ""]
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length ? parts.join(" ") : null;
}

/** Devuelve null si el recurso no tiene id: sin id no hay referencia posible. */
export function toPatientRow(patient: Patient): PatientRow | null {
  if (!patient.id) return null;
  return {
    ref: `Patient/${patient.id}`,
    id: patient.id,
    name: formatHumanName(patient.name),
    gender: patient.gender ? (GENDER_ES[patient.gender] ?? patient.gender) : null,
    birthDate: patient.birthDate ?? null,
  };
}

export interface PatientPage {
  rows: PatientRow[];
  skippedWithoutId: number;
  nextUrl: string | null;
  previousUrl: string | null;
}

export function toPatientPage(bundle: Bundle): PatientPage {
  const patients = bundleMatches(bundle, "Patient");
  const rows: PatientRow[] = [];
  let skipped = 0;
  for (const p of patients) {
    const row = toPatientRow(p);
    if (row) rows.push(row);
    else skipped++;
  }
  return {
    rows,
    skippedWithoutId: skipped,
    nextUrl: findLink(bundle, "next") ?? null,
    previousUrl: findLink(bundle, "previous") ?? null,
  };
}

// ---------- CapabilityStatement ----------

export interface ServerInfo {
  fhirVersion: string | null;
  software: string | null;
  status: string | null;
}

export function toServerInfo(cs: CapabilityStatement): ServerInfo {
  const software = cs.software
    ? [cs.software.name, cs.software.version].filter(Boolean).join(" ")
    : null;
  return {
    fhirVersion: cs.fhirVersion ?? null,
    software: software || null,
    status: cs.status ?? null,
  };
}
