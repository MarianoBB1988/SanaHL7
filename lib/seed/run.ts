import type { FhirResource, OperationOutcome } from "fhir/r4";
import { checkLocalWriteTarget } from "./guard.ts";

/**
 * Carga de datos ficticios: un PUT por recurso (ids fijos → repetir no duplica).
 * - Solo escribe en localhost / 127.0.0.1 (ver guard.ts).
 * - No sigue redirecciones: una 3xx podría mandar la escritura a otro host.
 * - Si un recurso falla, se detiene: los siguientes pueden depender de él.
 */

export interface SeedLine {
  ref: string;
  status: number | null;
  /** "creado" (201), "actualizado" (200) o el error. */
  result: string;
  ok: boolean;
}

export interface SeedReport {
  ok: boolean;
  baseUrl: string | null;
  lines: SeedLine[];
  error?: string;
}

export async function runSeed(
  baseUrlRaw: string | undefined,
  resources: FhirResource[],
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 20_000,
): Promise<SeedReport> {
  const target = checkLocalWriteTarget(baseUrlRaw);
  if (!target.ok) return { ok: false, baseUrl: baseUrlRaw ?? null, lines: [], error: target.message };
  const base = target.baseUrl.href.replace(/\/+$/, "");

  const lines: SeedLine[] = [];
  for (const r of resources) {
    const ref = `${r.resourceType}/${r.id}`;
    if (!r.id) {
      lines.push({ ref, status: null, result: "Recurso sin id: no se puede usar PUT", ok: false });
      return { ok: false, baseUrl: base, lines };
    }
    const url = `${base}/${r.resourceType}/${encodeURIComponent(r.id)}`;
    let res: Response;
    try {
      res = await fetchImpl(url, {
        method: "PUT",
        headers: { "Content-Type": "application/fhir+json", Accept: "application/fhir+json" },
        body: JSON.stringify(r),
        redirect: "manual",
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      const timeout = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
      lines.push({
        ref,
        status: null,
        result: timeout ? "Tiempo agotado" : "No se pudo conectar (¿está corriendo el HAPI local?)",
        ok: false,
      });
      return { ok: false, baseUrl: base, lines };
    }

    if (res.status >= 300 && res.status < 400) {
      lines.push({ ref, status: res.status, result: "Redirección: no se sigue al escribir", ok: false });
      return { ok: false, baseUrl: base, lines };
    }
    if (res.status === 200 || res.status === 201) {
      lines.push({ ref, status: res.status, result: res.status === 201 ? "creado" : "actualizado", ok: true });
      continue;
    }
    const text = await res.text().catch(() => "");
    let detail = `HTTP ${res.status}`;
    try {
      const body = JSON.parse(text) as OperationOutcome;
      const issue = body.resourceType === "OperationOutcome" ? body.issue?.[0] : undefined;
      if (issue?.diagnostics) detail += `: ${issue.diagnostics.slice(0, 300)}`;
    } catch {
      // cuerpo no JSON: alcanza con el estado
    }
    lines.push({ ref, status: res.status, result: detail, ok: false });
    return { ok: false, baseUrl: base, lines };
  }
  return { ok: true, baseUrl: base, lines };
}
