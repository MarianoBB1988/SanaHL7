import { describe, expect, it, vi } from "vitest";
import { createFhirClient } from "@/lib/fhir/client";

const BASE = "https://hapi.example.org/baseR4";

function mockFetch(
  impl: (url: string, init?: RequestInit) => Response | Promise<Response>,
) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
    impl(String(input), init),
  ) as unknown as typeof fetch;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/fhir+json" },
  });

describe("cliente FHIR", () => {
  it("manda Accept fhir+json, no-store y no sigue redirecciones", async () => {
    let seen: RequestInit | undefined;
    const fetchImpl = mockFetch((_u, init) => {
      seen = init;
      return json({ resourceType: "CapabilityStatement", fhirVersion: "4.0.1" });
    });
    const client = createFhirClient({ baseUrl: BASE, fetchImpl });
    const r = await client.get("metadata", "CapabilityStatement");
    expect(r.ok).toBe(true);
    expect(new Headers(seen?.headers).get("Accept")).toBe("application/fhir+json");
    expect(seen?.cache).toBe("no-store");
    expect(seen?.redirect).toBe("manual");
  });

  it("codifica los parámetros (el | de system|code)", async () => {
    let url = "";
    const fetchImpl = mockFetch((u) => {
      url = u;
      return json({ resourceType: "Bundle", type: "searchset" });
    });
    const client = createFhirClient({ baseUrl: BASE + "/", fetchImpl });
    await client.get("Observation", "Bundle", {
      patient: "a b",
      code: "http://loinc.org|8310-5",
    });
    expect(url).toBe(
      `${BASE}/Observation?patient=a+b&code=http%3A%2F%2Floinc.org%7C8310-5`,
    );
  });

  it("error HTTP sin JSON: no revienta y reporta el estado", async () => {
    const fetchImpl = mockFetch(
      () => new Response("<html>502 Bad Gateway</html>", { status: 502 }),
    );
    const r = await createFhirClient({ baseUrl: BASE, fetchImpl }).get(
      "metadata",
      "CapabilityStatement",
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.kind).toBe("http");
    expect(r.error.status).toBe(502);
    expect(r.error.outcome).toBeUndefined();
    expect(r.request.status).toBe(502);
  });

  it("error HTTP con OperationOutcome: usa diagnostics, nunca text.div", async () => {
    const fetchImpl = mockFetch(() =>
      json(
        {
          resourceType: "OperationOutcome",
          text: { status: "generated", div: "<div><script>x</script></div>" },
          issue: [
            { severity: "error", code: "processing", diagnostics: "Search ID expired" },
          ],
        },
        410,
      ),
    );
    const r = await createFhirClient({ baseUrl: BASE, fetchImpl }).follow(
      `${BASE}?_getpages=abc`,
      "Bundle",
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.status).toBe(410);
    expect(r.error.outcome?.resourceType).toBe("OperationOutcome");
    expect(r.error.message).toBe("Search ID expired");
    expect(r.error.message).not.toContain("<");
  });

  it("200 con cuerpo que no es JSON → invalid-json", async () => {
    const fetchImpl = mockFetch(() => new Response("ok", { status: 200 }));
    const r = await createFhirClient({ baseUrl: BASE, fetchImpl }).get(
      "metadata",
      "CapabilityStatement",
    );
    expect(!r.ok && r.error.kind).toBe("invalid-json");
  });

  it("200 con otro resourceType → unexpected-resource", async () => {
    const fetchImpl = mockFetch(() => json({ resourceType: "Patient", id: "x" }));
    const r = await createFhirClient({ baseUrl: BASE, fetchImpl }).get(
      "metadata",
      "CapabilityStatement",
    );
    expect(!r.ok && r.error.kind).toBe("unexpected-resource");
  });

  it("redirección → error, no se sigue", async () => {
    const fetchImpl = mockFetch(
      () => new Response(null, { status: 302, headers: { Location: "https://evil.example/" } }),
    );
    const r = await createFhirClient({ baseUrl: BASE, fetchImpl }).get(
      "metadata",
      "CapabilityStatement",
    );
    expect(!r.ok && r.error.kind).toBe("redirect");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("tiempo de espera agotado → timeout", async () => {
    const fetchImpl = mockFetch(
      (_u, init) =>
        new Promise<Response>((_, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(init.signal?.reason),
          );
        }),
    );
    const r = await createFhirClient({ baseUrl: BASE, fetchImpl, timeoutMs: 20 }).get(
      "metadata",
      "CapabilityStatement",
    );
    expect(!r.ok && r.error.kind).toBe("timeout");
  });

  it("fallo de red → network", async () => {
    const fetchImpl = mockFetch(() => {
      throw new TypeError("fetch failed");
    });
    const r = await createFhirClient({ baseUrl: BASE, fetchImpl }).get(
      "metadata",
      "CapabilityStatement",
    );
    expect(!r.ok && r.error.kind).toBe("network");
  });

  it("link de otro origen: no hace la petición", async () => {
    const fetchImpl = mockFetch(() => json({ resourceType: "Bundle" }));
    const client = createFhirClient({ baseUrl: BASE, fetchImpl });
    const r = await client.follow("https://evil.example/baseR4?_getpages=1", "Bundle");
    expect(!r.ok && r.error.kind).toBe("url-rejected");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("link del mismo servidor (raíz de la base, estilo HAPI): se sigue tal cual", async () => {
    let url = "";
    const fetchImpl = mockFetch((u) => {
      url = u;
      return json({ resourceType: "Bundle", type: "searchset" });
    });
    const next = `${BASE}?_getpages=abc&_getpagesoffset=20&_count=20`;
    const r = await createFhirClient({ baseUrl: BASE, fetchImpl }).follow(next, "Bundle");
    expect(r.ok).toBe(true);
    expect(url).toBe(next);
  });

  it("sin FHIR_BASE_URL → error de configuración, sin red", async () => {
    const fetchImpl = mockFetch(() => json({}));
    const r = await createFhirClient({ baseUrl: undefined, fetchImpl }).get(
      "metadata",
      "CapabilityStatement",
    );
    expect(!r.ok && r.error.kind).toBe("config");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
