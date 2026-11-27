/**
 * Reglas de URL para el servidor FHIR. Funciones puras (sin red).
 */

export type BaseUrlResult =
  | { ok: true; baseUrl: URL }
  | { ok: false; message: string };

/** Valida FHIR_BASE_URL: http(s), sin credenciales, sin query ni fragmento. */
export function parseBaseUrl(raw: string | undefined): BaseUrlResult {
  if (!raw || raw.trim() === "") {
    return {
      ok: false,
      message:
        "Falta FHIR_BASE_URL. Copiá .env.example a .env.local y completala.",
    };
  }
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { ok: false, message: "FHIR_BASE_URL no es una URL válida." };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, message: "FHIR_BASE_URL debe usar http o https." };
  }
  if (url.username || url.password) {
    return { ok: false, message: "FHIR_BASE_URL no puede incluir credenciales." };
  }
  if (url.search || url.hash) {
    return {
      ok: false,
      message: "FHIR_BASE_URL no puede incluir parámetros ni fragmento.",
    };
  }
  // Normalizamos sin barra final: "https://x/baseR4/" -> "https://x/baseR4"
  url.pathname = url.pathname.replace(/\/+$/, "");
  return { ok: true, baseUrl: url };
}

/**
 * ¿La URL (por ejemplo un link `next` de un Bundle) pertenece al mismo
 * servidor que la base? Mismo origen y la ruta es la base o está debajo.
 * HAPI pagina con links a la raíz: `https://hapi.fhir.org/baseR4?_getpages=...`.
 */
export function isWithinBase(candidate: string, baseUrl: URL): boolean {
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return false;
  }
  if (url.origin !== baseUrl.origin) return false;
  if (url.username || url.password) return false;
  const basePath = baseUrl.pathname.replace(/\/+$/, "");
  const path = url.pathname.replace(/\/+$/, "");
  return path === basePath || path.startsWith(basePath + "/");
}

/** Arma `base/ruta?params` codificando los parámetros con URLSearchParams. */
export function buildUrl(
  baseUrl: URL,
  path: string,
  params?: Record<string, string>,
): URL {
  const cleanPath = path.replace(/^\/+/, "");
  const url = new URL(baseUrl.href.replace(/\/+$/, "") + "/" + cleanPath);
  if (params) {
    const search = new URLSearchParams(params);
    url.search = search.toString();
  }
  return url;
}
