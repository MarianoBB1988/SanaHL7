/**
 * Filtros del buscador de pacientes: de los parámetros de la URL de la app
 * a parámetros de búsqueda FHIR. Función pura.
 *
 * FHIR: `name` busca nombres que EMPIEZAN con el texto (en cualquier parte del
 * nombre: nombre o apellido); `name:contains` busca nombres que lo CONTIENEN.
 * HAPI ignora mayúsculas y acentos.
 */

export type MatchMode = "empieza" | "contiene";
export const GENDERS = ["female", "male", "other", "unknown"] as const;
export type Gender = (typeof GENDERS)[number];
export const NAME_MAX_LENGTH = 100;

export interface PatientSearch {
  name: string; // "" = sin filtro
  mode: MatchMode;
  gender: Gender | null;
  /** Avisos de valores descartados (no se envían al servidor). */
  warnings: string[];
}

type RawParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function parsePatientSearch(params: RawParams): PatientSearch {
  const warnings: string[] = [];

  let name = (first(params.nombre) ?? "").replace(/\s+/g, " ").trim();
  if (name.length > NAME_MAX_LENGTH) {
    name = name.slice(0, NAME_MAX_LENGTH);
    warnings.push(`El nombre se recortó a ${NAME_MAX_LENGTH} caracteres.`);
  }

  const rawMode = first(params.modo);
  const mode: MatchMode = rawMode === "contiene" ? "contiene" : "empieza";

  const rawGender = first(params.sexo);
  let gender: Gender | null = null;
  if (rawGender) {
    if ((GENDERS as readonly string[]).includes(rawGender)) gender = rawGender as Gender;
    else warnings.push(`Sexo "${rawGender}" no válido; se ignoró.`);
  }

  return { name, mode, gender, warnings };
}

export function isFiltered(s: PatientSearch): boolean {
  return s.name !== "" || s.gender !== null;
}

/** Parámetros FHIR para GET /Patient. */
export function toFhirParams(s: PatientSearch, count: number): Record<string, string> {
  const params: Record<string, string> = {};
  if (s.name) params[s.mode === "contiene" ? "name:contains" : "name"] = s.name;
  if (s.gender) params.gender = s.gender;
  params._count = String(count);
  return params;
}

/** Parámetros de la app (para conservar los filtros en los enlaces de paginación). */
export function toAppParams(s: PatientSearch): URLSearchParams {
  const p = new URLSearchParams();
  if (s.name) p.set("nombre", s.name);
  if (s.name && s.mode === "contiene") p.set("modo", "contiene");
  if (s.gender) p.set("sexo", s.gender);
  return p;
}

export function describeSearch(s: PatientSearch): string {
  const parts: string[] = [];
  if (s.name) parts.push(`nombre ${s.mode === "contiene" ? "que contiene" : "que empieza con"} “${s.name}”`);
  if (s.gender) parts.push(`sexo ${GENDER_LABEL[s.gender].toLowerCase()}`);
  return parts.join(" y ");
}

export const GENDER_LABEL: Record<Gender, string> = {
  female: "Femenino",
  male: "Masculino",
  other: "Otro",
  unknown: "Desconocido",
};
