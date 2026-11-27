import "server-only";

import type { FhirResource, OperationOutcome } from "fhir/r4";
import { buildUrl, isWithinBase, parseBaseUrl } from "./url";

/**
 * Cliente HTTP FHIR. Solo servidor: nunca se importa desde el navegador.
 * No lanza excepciones por errores esperables: devuelve un resultado tipado,
 * así la pantalla puede mostrar qué se pidió y qué respondió el servidor.
 */

export const DEFAULT_TIMEOUT_MS = 15_000;

export type FhirErrorKind =
  | "config" // FHIR_BASE_URL ausente o inválida
  | "url-rejected" // un link apunta fuera del servidor configurado
  | "timeout"
  | "network"
  | "redirect" // no seguimos redirecciones
  | "http" // 4xx / 5xx
  | "invalid-json"
  | "unexpected-resource"; // llegó JSON, pero no el resourceType esperado

export interface FhirRequestInfo {
  method: "GET";
  url: string;
  status?: number;
  durationMs?: number;
}

export interface FhirError {
  kind: FhirErrorKind;
  message: string;
  status?: number;
  outcome?: OperationOutcome;
}

export type FhirResult<T> =
  | { ok: true; data: T; request: FhirRequestInfo }
  | { ok: false; error: FhirError; request: FhirRequestInfo };

type ResourceTypeName = FhirResource["resourceType"];
type ResourceOf<K extends ResourceTypeName> = Extract<
  FhirResource,
  { resourceType: K }
>;

export interface FhirClientOptions {
  baseUrl: string | undefined;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export function createFhirClient(options: FhirClientOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const parsed = parseBaseUrl(options.baseUrl);

  async function request<K extends ResourceTypeName>(
    url: URL | null,
    expected: K,
    displayUrl: string,
  ): Promise<FhirResult<ResourceOf<K>>> {
    const info: FhirRequestInfo = { method: "GET", url: displayUrl };
    if (!parsed.ok) {
      return fail(info, { kind: "config", message: parsed.message });
    }
    if (!url) {
      return fail(info, {
        kind: "url-rejected",
        message:
          "El enlace no pertenece al servidor FHIR configurado; no se siguió.",
      });
    }

    const started = performance.now();
    let response: Response;
    try {
      response = await fetchImpl(url, {
        method: "GET",
        headers: { Accept: "application/fhir+json" },
        redirect: "manual",
        cache: "no-store", // no guardar datos del servidor (ni en .next/cache)
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      info.durationMs = Math.round(performance.now() - started);
      const name = err instanceof Error ? err.name : "";
      if (name === "TimeoutError" || name === "AbortError") {
        return fail(info, {
          kind: "timeout",
          message: `El servidor no respondió en ${Math.round(timeoutMs / 1000)} s.`,
        });
      }
      return fail(info, {
        kind: "network",
        message: "No se pudo conectar con el servidor FHIR.",
      });
    }
    info.durationMs = Math.round(performance.now() - started);
    info.status = response.status;

    if (response.status >= 300 && response.status < 400) {
      return fail(info, {
        kind: "redirect",
        status: response.status,
        message: `El servidor respondió con una redirección (${response.status}); no se siguió.`,
      });
    }

    // Leemos texto primero: un error puede venir en HTML o texto plano.
    let text = "";
    try {
      text = await response.text();
    } catch {
      return fail(info, {
        kind: "network",
        status: response.status,
        message: "La respuesta se cortó antes de terminar.",
      });
    }
    const json = tryParseJson(text);

    if (!response.ok) {
      const outcome = isOperationOutcome(json) ? json : undefined;
      return fail(info, {
        kind: "http",
        status: response.status,
        outcome,
        message:
          (outcome && summarizeOutcome(outcome)) ||
          `El servidor respondió HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""}.`,
      });
    }

    if (json === undefined) {
      return fail(info, {
        kind: "invalid-json",
        status: response.status,
        message: "La respuesta no es JSON válido.",
      });
    }

    if (!hasResourceType(json, expected)) {
      const outcome = isOperationOutcome(json) ? json : undefined;
      return fail(info, {
        kind: "unexpected-resource",
        status: response.status,
        outcome,
        message:
          (outcome && summarizeOutcome(outcome)) ||
          `Se esperaba ${expected} y llegó otro tipo de recurso.`,
      });
    }

    return { ok: true, data: json as ResourceOf<K>, request: info };
  }

  return {
    /** GET base/ruta?params, esperando un resourceType concreto. */
    get<K extends ResourceTypeName>(
      path: string,
      expected: K,
      params?: Record<string, string>,
    ) {
      if (!parsed.ok) return request(null, expected, path);
      const url = buildUrl(parsed.baseUrl, path, params);
      return request(url, expected, url.href);
    },

    /**
     * Sigue un link absoluto que vino del servidor (p. ej. Bundle.link next).
     * No armamos la URL: la usamos tal cual, pero solo si es del mismo servidor.
     */
    follow<K extends ResourceTypeName>(absoluteUrl: string, expected: K) {
      if (!parsed.ok) return request(null, expected, absoluteUrl);
      const allowed = isWithinBase(absoluteUrl, parsed.baseUrl);
      return request(allowed ? new URL(absoluteUrl) : null, expected, absoluteUrl);
    },

    /** ¿Esta URL se puede seguir con este cliente? */
    canFollow(absoluteUrl: string): boolean {
      return parsed.ok && isWithinBase(absoluteUrl, parsed.baseUrl);
    },

    baseUrl: parsed.ok ? parsed.baseUrl.href : null,
  };
}

export type FhirClient = ReturnType<typeof createFhirClient>;

/** Cliente configurado desde FHIR_BASE_URL. */
export function getFhirClient(): FhirClient {
  return createFhirClient({ baseUrl: process.env.FHIR_BASE_URL });
}

// ---------- utilidades ----------

function fail<T>(request: FhirRequestInfo, error: FhirError): FhirResult<T> {
  return { ok: false, error, request };
}

function tryParseJson(text: string): unknown {
  if (text.trim() === "") return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function hasResourceType(value: unknown, expected: string): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { resourceType?: unknown }).resourceType === expected
  );
}

export function isOperationOutcome(value: unknown): value is OperationOutcome {
  return hasResourceType(value, "OperationOutcome");
}

/** Texto plano del primer issue. Nunca usamos `text.div` (es HTML). */
export function summarizeOutcome(outcome: OperationOutcome): string | undefined {
  const issue = outcome.issue?.find((i) => i.diagnostics || i.details?.text);
  const text = issue?.diagnostics ?? issue?.details?.text;
  return text ? text.slice(0, 500) : undefined;
}
