import { parseBaseUrl } from "../fhir/url.ts";

/**
 * ¿Se puede escribir en este servidor? Solo si el host es EXACTAMENTE
 * "localhost" o "127.0.0.1". Nunca en el servidor público ni en otro host
 * (tampoco "localhost.ejemplo.com", "127.0.0.2" ni "0.0.0.0").
 */
export const ALLOWED_WRITE_HOSTS = ["localhost", "127.0.0.1"] as const;

export type WriteTargetResult = { ok: true; baseUrl: URL } | { ok: false; message: string };

export function checkLocalWriteTarget(raw: string | undefined): WriteTargetResult {
  const parsed = parseBaseUrl(raw);
  if (!parsed.ok) return { ok: false, message: parsed.message };
  const host = parsed.baseUrl.hostname;
  if (!(ALLOWED_WRITE_HOSTS as readonly string[]).includes(host)) {
    return {
      ok: false,
      message:
        `Escritura bloqueada: el host es "${host}". El script de carga solo escribe en ` +
        `localhost o 127.0.0.1 (HAPI local en Docker), nunca en un servidor compartido.`,
    };
  }
  return { ok: true, baseUrl: parsed.baseUrl };
}
