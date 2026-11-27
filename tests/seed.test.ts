import { describe, expect, it, vi } from "vitest";
import { DATASET_TAG, FICTITIOUS_PATIENT_IDS, seedResources } from "@/lib/seed/data";
import { checkLocalWriteTarget } from "@/lib/seed/guard";
import { runSeed } from "@/lib/seed/run";
import { classifyTemperatures } from "@/lib/fhir/temperature";
import { classifyAllergies } from "@/lib/fhir/allergy";
import { buildSeries, toObservationRow } from "@/lib/fhir/observation";
import type { AllergyIntolerance, Observation } from "fhir/r4";

const LOCAL = "http://localhost:8080/fhir";

describe("bloqueo de escritura remota", () => {
  it.each([
    "http://localhost:8080/fhir",
    "http://127.0.0.1:8080/fhir",
    "https://localhost/fhir",
  ])("permite %s", (u) => {
    expect(checkLocalWriteTarget(u).ok).toBe(true);
  });

  it.each([
    "https://hapi.fhir.org/baseR4",
    "http://localhost.evil.example/fhir",
    "http://127.0.0.2:8080/fhir",
    "http://0.0.0.0:8080/fhir",
    "http://[::1]:8080/fhir",
    "http://192.168.1.10:8080/fhir",
    "http://user:pw@localhost:8080/fhir",
    undefined,
  ])("bloquea %s", (u) => {
    expect(checkLocalWriteTarget(u).ok).toBe(false);
  });

  it("con host remoto no hace ninguna petición", async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    const r = await runSeed("https://hapi.fhir.org/baseR4", seedResources(), fetchImpl);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/Escritura bloqueada/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("carga con PUT", () => {
  it("un PUT por recurso, a Tipo/id, con fhir+json y sin seguir redirecciones", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchImpl = vi.fn(async (u: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(u), init: init! });
      return new Response("{}", { status: calls.length % 2 ? 201 : 200 });
    }) as unknown as typeof fetch;
    const resources = seedResources();
    const r = await runSeed(LOCAL + "/", resources, fetchImpl);
    expect(r.ok).toBe(true);
    expect(calls).toHaveLength(resources.length);
    expect(calls[0].url).toBe(`${LOCAL}/Patient/ana-ficticia`);
    expect(calls[0].init.method).toBe("PUT");
    expect(calls[0].init.redirect).toBe("manual");
    expect(new Headers(calls[0].init.headers).get("Content-Type")).toBe("application/fhir+json");
    expect(r.lines.map((l) => l.result)).toContain("creado");
    expect(r.lines.map((l) => l.result)).toContain("actualizado");
  });

  it("una redirección al escribir se informa como error y no se sigue", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(null, { status: 307, headers: { Location: "https://hapi.fhir.org/baseR4/Patient/x" } }),
    ) as unknown as typeof fetch;
    const r = await runSeed(LOCAL, seedResources(), fetchImpl);
    expect(r.ok).toBe(false);
    expect(r.lines[0].result).toMatch(/Redirección/);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("si un recurso falla, se detiene y muestra el OperationOutcome", async () => {
    let n = 0;
    const fetchImpl = vi.fn(async () => {
      n++;
      if (n === 2)
        return new Response(
          JSON.stringify({ resourceType: "OperationOutcome", issue: [{ severity: "error", code: "invalid", diagnostics: "Recurso inválido" }] }),
          { status: 400 },
        );
      return new Response("{}", { status: 201 });
    }) as unknown as typeof fetch;
    const r = await runSeed(LOCAL, seedResources(), fetchImpl);
    expect(r.ok).toBe(false);
    expect(r.lines).toHaveLength(2);
    expect(r.lines[1].result).toBe("HTTP 400: Recurso inválido");
  });

  it("servidor apagado → mensaje claro", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    const r = await runSeed(LOCAL, seedResources(), fetchImpl);
    expect(r.lines[0].result).toMatch(/HAPI local/);
  });
});

describe("datos ficticios", () => {
  const all = seedResources();

  it("todos tienen id fijo y la etiqueta ficticio", () => {
    for (const r of all) {
      expect(r.id).toMatch(/^[a-z0-9-]+$/);
      expect(r.meta?.tag).toContainEqual(DATASET_TAG);
    }
    expect(new Set(all.map((r) => `${r.resourceType}/${r.id}`)).size).toBe(all.length);
  });

  it("los pacientes van primero y son los dos ficticios", () => {
    expect(all.slice(0, 2).map((r) => r.id)).toEqual([...FICTITIOUS_PATIENT_IDS]);
  });

  it("Ana: 3 temperaturas utilizables, la más reciente 38.5", () => {
    // Como la búsqueda real (code=http://loinc.org|8310-5), solo temperaturas.
    const obs = all.filter(
      (r): r is Observation => r.resourceType === "Observation" && r.code.coding?.[0]?.code === "8310-5",
    );
    const t = classifyTemperatures(obs, "ana-ficticia", new URL(LOCAL));
    expect(t.usable.map((u) => u.value)).toEqual([38.5, 37.4, 36.8]);
    expect(t.excluded).toEqual([]);
  });

  it("Ana: alergia a penicilina activa y confirmada", () => {
    const al = all.filter((r): r is AllergyIntolerance => r.resourceType === "AllergyIntolerance");
    const c = classifyAllergies(al, "ana-ficticia", new URL(LOCAL));
    expect(c.active.map((a) => a.substance)).toEqual(["Penicilina"]);
  });

  it("Ana: glucosa con normal, alto y bajo, coherentes con el rango", () => {
    const obs = all.filter((r): r is Observation => r.resourceType === "Observation" && r.code.coding?.[0]?.code === "2345-7");
    const s = buildSeries(obs.map(toObservationRow))["http://loinc.org|2345-7"];
    expect(s.points.map((p) => p.status)).toEqual(["normal", "alto", "normal", "bajo"]);
    expect(s.band).toMatchObject({ low: 70, high: 100 });
  });

  it("Bruno no tiene datos clínicos", () => {
    const refs = all.flatMap((r) =>
      "subject" in r && r.subject ? [r.subject.reference] : "patient" in r && r.patient ? [r.patient.reference] : [],
    );
    expect(refs).not.toContain("Patient/bruno-ficticio");
  });
});
