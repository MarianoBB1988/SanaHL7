import type { Encounter, Observation } from "fhir/r4";
import { describe, expect, it } from "vitest";
import { compareDesc } from "@/lib/fhir/datetime";
import { readOnlyEncounters, toEncounterRow } from "@/lib/fhir/encounter";
import { formatValue, readOnlyObservations, toObservationRow } from "@/lib/fhir/observation";

const base = new URL("https://hapi.example.org/baseR4");

const lab = (over: Partial<Observation> = {}): Observation => ({
  resourceType: "Observation",
  id: "l1",
  status: "final",
  category: [
    {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/observation-category",
          code: "laboratory",
        },
      ],
    },
  ],
  code: { text: "Albumin", coding: [{ system: "http://loinc.org", code: "1751-7" }] },
  subject: { reference: "Patient/p" },
  effectiveDateTime: "2026-01-15T09:00:00Z",
  valueQuantity: { value: 3.8, unit: "g/dL", system: "http://unitsofmeasure.org", code: "g/dL" },
  ...over,
});

describe("observaciones de solo lectura", () => {
  it("fila de laboratorio: nombre, valor con unidad, categoría en español", () => {
    const r = toObservationRow(lab());
    expect(r).toMatchObject({
      ref: "Observation/l1",
      name: "Albumin",
      valueText: "3.8 g/dL",
      categories: ["Laboratorio"],
      dateText: "15/01/2026 09:00:00 (UTC)",
      status: "final",
    });
  });

  it("formatea distintos value[x]", () => {
    expect(formatValue({ valueString: "Negativo" })).toBe("Negativo");
    expect(formatValue({ valueBoolean: false })).toBe("No");
    expect(formatValue({ valueInteger: 3 })).toBe("3");
    expect(formatValue({ valueCodeableConcept: { text: "Positivo" } })).toBe("Positivo");
    expect(formatValue({ valueQuantity: { value: 5, comparator: "<", unit: "mg/L" } })).toBe(
      "<5 mg/L",
    );
    expect(formatValue({ dataAbsentReason: { text: "No realizado" } })).toBe(
      "Sin valor (No realizado)",
    );
    expect(formatValue({})).toBeNull();
  });

  it("componentes (p. ej. presión arterial)", () => {
    const r = toObservationRow(
      lab({
        valueQuantity: undefined,
        component: [
          { code: { text: "Sistólica" }, valueQuantity: { value: 120, unit: "mm[Hg]" } },
          { code: { text: "Diastólica" }, valueQuantity: { value: 80, unit: "mm[Hg]" } },
        ],
      }),
    );
    expect(r.valueText).toBe("Sistólica: 120 mm[Hg] · Diastólica: 80 mm[Hg]");
  });

  it("excluye temperatura y registros de otro paciente; ordena por fecha", () => {
    const { rows, otherPatient } = readOnlyObservations(
      [
        lab({ id: "viejo", effectiveDateTime: "2020-01-01T00:00:00Z" }),
        lab({ id: "nuevo", effectiveDateTime: "2026-01-01T00:00:00Z" }),
        lab({ id: "sin-fecha", effectiveDateTime: undefined }),
        lab({ id: "temp", code: { coding: [{ system: "http://loinc.org", code: "8310-5" }] } }),
        lab({ id: "ajeno", subject: { reference: "Patient/otro" } }),
      ],
      "p",
      base,
    );
    expect(rows.map((r) => r.ref)).toEqual([
      "Observation/nuevo",
      "Observation/viejo",
      "Observation/sin-fecha",
    ]);
    expect(otherPatient).toBe(1);
  });

  it("sin effective usa issued y lo aclara", () => {
    const r = toObservationRow(
      lab({ effectiveDateTime: undefined, issued: "2026-02-01T10:00:00Z" }),
    );
    expect(r.dateText).toMatch(/fecha de emisión/);
  });
});

describe("consultas de solo lectura", () => {
  const enc = (over: Partial<Encounter> = {}): Encounter => ({
    resourceType: "Encounter",
    id: "e1",
    status: "finished",
    class: { system: "http://terminology.hl7.org/CodeSystem/v3-ActCode", code: "AMB" },
    type: [{ text: "Encounter for symptom" }],
    reasonCode: [{ coding: [{ display: "Acute viral pharyngitis" }] }],
    subject: { reference: "Patient/p" },
    period: { start: "2025-10-24T00:01:25-03:00", end: "2025-10-24T00:16:25-03:00" },
    ...over,
  });

  it("fila con modalidad, tipo, motivo y estado en español", () => {
    expect(toEncounterRow(enc())).toMatchObject({
      ref: "Encounter/e1",
      classText: "Ambulatoria",
      typeText: "Encounter for symptom",
      reasonText: "Acute viral pharyngitis",
      statusText: "Finalizada",
      startText: "24/10/2025 00:01:25 (-03:00)",
    });
  });

  it("clase desconocida usa display o código", () => {
    expect(toEncounterRow(enc({ class: { code: "XYZ", display: "Otra" } })).classText).toBe("Otra");
  });

  it("excluye otro paciente y ordena", () => {
    const { rows, otherPatient } = readOnlyEncounters(
      [
        enc({ id: "a", period: { start: "2024-01-01" } }),
        enc({ id: "b", period: { start: "2026-01-01T10:00:00Z" } }),
        enc({ id: "c", subject: { reference: "Patient/otro" } }),
      ],
      "p",
      base,
    );
    expect(rows.map((r) => r.ref)).toEqual(["Encounter/b", "Encounter/a"]);
    expect(otherPatient).toBe(1);
  });
});

describe("compareDesc", () => {
  it("nulos al final, sin NaN", () => {
    expect([3, null, 1, null, 2].sort(compareDesc)).toEqual([3, 2, 1, null, null]);
  });
});

describe("separar análisis del resto", () => {
  it("laboratory → análisis; signos vitales y sin categoría → otras", async () => {
    const { splitObservations, toObservationRow } = await import("@/lib/fhir/observation");
    const vital = lab({
      id: "v",
      category: [
        {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/observation-category",
              code: "vital-signs",
            },
          ],
        },
      ],
    });
    const none = lab({ id: "n", category: undefined });
    const otherSystem = lab({
      id: "x",
      category: [{ coding: [{ system: "http://otro", code: "laboratory" }] }],
    });
    const { lab: l, other } = splitObservations(
      [lab(), vital, none, otherSystem].map(toObservationRow),
    );
    expect(l.map((r) => r.ref)).toEqual(["Observation/l1"]);
    expect(other.map((r) => r.ref)).toEqual([
      "Observation/v",
      "Observation/n",
      "Observation/x",
    ]);
  });
});
