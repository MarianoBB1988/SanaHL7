import { describe, expect, it, vi } from "vitest";
import { createFhirClient } from "@/lib/fhir/client";
import { searchAll } from "@/lib/fhir/search";

const BASE = "https://hapi.example.org/baseR4";
const page = (ids: string[], next?: string) => ({
  resourceType: "Bundle",
  type: "searchset",
  link: next ? [{ relation: "next", url: next }] : [],
  entry: ids.map((id) => ({
    resource: { resourceType: "AllergyIntolerance", id, patient: { reference: "Patient/p" } },
    search: { mode: "match" },
  })),
});
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });

function clientWith(responses: Record<string, () => Response>) {
  const calls: string[] = [];
  const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    const key = Object.keys(responses).find((k) => url.includes(k));
    if (!key) throw new Error("URL no esperada: " + url);
    return responses[key]();
  }) as unknown as typeof fetch;
  return { client: createFhirClient({ baseUrl: BASE, fetchImpl }), calls };
}

describe("searchAll: recorre todas las páginas", () => {
  it("junta los recursos de todas las páginas y marca completa", async () => {
    const { client, calls } = clientWith({
      "AllergyIntolerance?": () => json(page(["a", "b"], `${BASE}?_getpages=x&o=2`)),
      "o=2": () => json(page(["c"], `${BASE}?_getpages=x&o=3`)),
      "o=3": () => json(page([])), // última página, sin entry ni next
    });
    const r = await searchAll(client, "AllergyIntolerance", { patient: "p" });
    expect(r.complete).toBe(true);
    expect(r.resources.map((x) => x.id)).toEqual(["a", "b", "c"]);
    expect(r.sources.map((s) => s.url)).toEqual([calls[0], calls[0], calls[1]]);
    expect(r.requests).toHaveLength(3);
  });

  it("si falla una página intermedia: incompleta, conserva lo leído", async () => {
    const { client } = clientWith({
      "AllergyIntolerance?": () => json(page(["a"], `${BASE}?_getpages=x&o=2`)),
      "o=2": () => new Response("Internal error", { status: 500 }),
    });
    const r = await searchAll(client, "AllergyIntolerance", { patient: "p" });
    expect(r.complete).toBe(false);
    expect(r.incompleteReason).toBe("error");
    expect(r.error?.status).toBe(500);
    expect(r.resources.map((x) => x.id)).toEqual(["a"]);
  });

  it("si la primera consulta falla: incompleta y sin recursos", async () => {
    const { client } = clientWith({
      "AllergyIntolerance?": () => new Response("<html>", { status: 503 }),
    });
    const r = await searchAll(client, "AllergyIntolerance", { patient: "p" });
    expect(r.complete).toBe(false);
    expect(r.resources).toEqual([]);
  });

  it("link next a otro servidor: no lo sigue y marca incompleta", async () => {
    const { client, calls } = clientWith({
      "AllergyIntolerance?": () => json(page(["a"], "https://evil.example/fhir?p=2")),
    });
    const r = await searchAll(client, "AllergyIntolerance", { patient: "p" });
    expect(r.complete).toBe(false);
    expect(r.incompleteReason).toBe("link-rejected");
    expect(calls).toHaveLength(1);
  });

  it("límite de páginas: incompleta", async () => {
    const { client, calls } = clientWith({
      "AllergyIntolerance?": () => json(page(["a"], `${BASE}?_getpages=x&o=2`)),
      "o=2": () => json(page(["b"], `${BASE}?_getpages=x&o=3`)),
    });
    const r = await searchAll(client, "AllergyIntolerance", { patient: "p" }, 2);
    expect(r.complete).toBe(false);
    expect(r.incompleteReason).toBe("max-pages");
    expect(calls).toHaveLength(2);
  });
});
