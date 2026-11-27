import { notFound } from "next/navigation";
import { isFhirId } from "@/lib/fhir/references";

export type PatientParams = Promise<{ id: string }>;

/** Lee el id de la ruta y lo valida como id FHIR antes de usarlo en una URL. */
export async function resolvePatientId(params: PatientParams): Promise<string> {
  const { id } = await params;
  if (!isFhirId(id)) notFound();
  return id;
}

/** Base URL del servidor como objeto URL (para comparar referencias absolutas). */
export function baseUrlOf(href: string | null): URL | null {
  return href ? new URL(href) : null;
}
