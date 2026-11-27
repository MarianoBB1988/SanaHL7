import type { Observation } from "fhir/r4";
import { describe, expect, it } from "vitest";
import { classifyTemperatures } from "@/lib/fhir/temperature";

const base = new URL("https://hapi.example.org/baseR4");

function obs(over: Partial<Observation> = {}): Observation {
  return {
    resourceType: "Observation",
    id: "t1",
    status: "final",
    code: { coding: [{ system: "http://loinc.org", code: "8310-5" }] },
    subject: { reference: "Patient/p" },
    effectiveDateTime: "2026-11-26T10:00:00-03:00",
    valueQuantity: {
      value: 38.5,
      unit: "°C",
      system: "http://unitsofmeasure.org",
      code: "Cel",
    },
    ...over,
  };
}

const classify = (list: Observation[]) => classifyTemperatures(list, "p", base);

describe("classifyTemperatures", () => {
  it("medición correcta → utilizable", () => {
    const r = classify([obs()]);
    expect(r.excluded).toEqual([]);
    expect(r.usable).toHaveLength(1);
    expect(r.usable[0]).toMatchObject({ ref: "Observation/t1", value: 38.5, unit: "Cel" });
  });

  it("ordena de la más reciente a la más antigua, comparando instantes", () => {
    const r = classify([
      obs({ id: "a", effectiveDateTime: "2026-11-20T10:00:00-03:00" }),
      obs({ id: "b", effectiveDateTime: "2026-11-26T12:00:00Z" }), // 09:00 -03:00
      obs({ id: "c", effectiveDateTime: "2026-11-26T10:00:00-03:00" }),
    ]);
    expect(r.usable.map((u) => u.ref)).toEqual([
      "Observation/c",
      "Observation/b",
      "Observation/a",
    ]);
  });

  it.each(["amended", "corrected"] as const)("status %s también es utilizable", (status) => {
    expect(classify([obs({ status })]).usable).toHaveLength(1);
  });

  const excludedCases: [string, Partial<Observation>, RegExp][] = [
    ["entered-in-error", { status: "entered-in-error" }, /cargada por error/],
    ["preliminary", { status: "preliminary" }, /Estado no utilizable: preliminary/],
    ["sin status", { status: undefined as unknown as Observation["status"] }, /Sin estado/],
    ["otro paciente", { subject: { reference: "Patient/otro" } }, /otro paciente/],
    ["sin subject", { subject: undefined }, /No indica a qué paciente/],
    [
      "unidad distinta (Fahrenheit)",
      {
        valueQuantity: {
          value: 101.3,
          unit: "°F",
          system: "http://unitsofmeasure.org",
          code: "[degF]",
        },
      },
      /Unidad distinta de Cel/,
    ],
    ["sin unidad codificada", { valueQuantity: { value: 37, unit: "C" } }, /Sin unidad codificada/],
    ["sin valor", { valueQuantity: undefined }, /Sin valor/],
    [
      "con comparador",
      {
        valueQuantity: {
          value: 38,
          comparator: ">",
          system: "http://unitsofmeasure.org",
          code: "Cel",
        },
      },
      /comparador/,
    ],
    ["fecha parcial (solo día)", { effectiveDateTime: "2026-11-26" }, /no incluye hora y zona/],
    ["hora sin zona", { effectiveDateTime: "2026-11-26T10:00:00" }, /no zona horaria/],
    [
      "fecha como período",
      { effectiveDateTime: undefined, effectivePeriod: { start: "2026-11-26T10:00:00Z" } },
      /no viene como effectiveDateTime/,
    ],
    ["sin fecha", { effectiveDateTime: undefined }, /Sin fecha/],
    [
      "otro código LOINC",
      { code: { coding: [{ system: "http://loinc.org", code: "8867-4" }] } },
      /LOINC 8310-5/,
    ],
  ];

  it.each(excludedCases)("%s → excluida con motivo", (_name, over, reason) => {
    const r = classify([obs(over)]);
    expect(r.usable).toEqual([]);
    expect(r.excluded).toHaveLength(1);
    expect(r.excluded[0].reasons.join(" | ")).toMatch(reason);
  });

  it("acumula todos los motivos de un mismo registro", () => {
    const r = classify([
      obs({ status: "entered-in-error", subject: { reference: "Patient/otro" } }),
    ]);
    expect(r.excluded[0].reasons).toHaveLength(2);
  });

  it("lista vacía → sin utilizables ni excluidas", () => {
    expect(classify([])).toEqual({ usable: [], excluded: [] });
  });
});
