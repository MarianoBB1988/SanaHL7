import type { Bundle, FhirResource } from "fhir/r4";
import type { FhirClient, FhirError, FhirRequestInfo } from "./client";
import { bundleMatches, findLink } from "./mappers";

type ResourceTypeName = FhirResource["resourceType"];
type ResourceOf<K extends ResourceTypeName> = Extract<
  FhirResource,
  { resourceType: K }
>;

export const DEFAULT_MAX_PAGES = 20;

export type IncompleteReason =
  | "error" // una página falló
  | "max-pages" // quedaban páginas y se llegó al límite
  | "link-rejected"; // el link next apuntaba a otro servidor

export interface SearchAllResult<T> {
  resources: T[];
  /** Petición de la que salió cada recurso (mismo orden que resources). */
  sources: FhirRequestInfo[];
  requests: FhirRequestInfo[];
  /** true solo si se recorrieron todas las páginas sin errores. */
  complete: boolean;
  incompleteReason?: IncompleteReason;
  error?: FhirError;
}

/**
 * Búsqueda recorriendo todas las páginas (link next).
 * Si algo falla, `complete` es false: no se puede concluir que algo "no existe".
 */
export async function searchAll<K extends ResourceTypeName>(
  client: FhirClient,
  resourceType: K,
  params: Record<string, string>,
  maxPages = DEFAULT_MAX_PAGES,
): Promise<SearchAllResult<ResourceOf<K>>> {
  const resources: ResourceOf<K>[] = [];
  const requests: FhirRequestInfo[] = [];
  const sources: FhirRequestInfo[] = [];

  let result = await client.get(resourceType, "Bundle", params);
  for (let page = 1; ; page++) {
    requests.push(result.request);
    if (!result.ok) {
      return { resources, sources, requests, complete: false, incompleteReason: "error", error: result.error };
    }
    const bundle: Bundle = result.data;
    for (const r of bundleMatches(bundle, resourceType)) {
      resources.push(r);
      sources.push(result.request);
    }

    const next = findLink(bundle, "next");
    if (!next) return { resources, sources, requests, complete: true };
    if (!client.canFollow(next)) {
      return { resources, sources, requests, complete: false, incompleteReason: "link-rejected" };
    }
    if (page >= maxPages) {
      return { resources, sources, requests, complete: false, incompleteReason: "max-pages" };
    }
    result = await client.follow(next, "Bundle");
  }
}
