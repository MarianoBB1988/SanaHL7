import type { Observation } from "fhir/r4";
import { describe, expect, it } from "vitest";
import { buildSeries, toObservationRow } from "@/lib/fhir/observation";
import { INTERPRETATION_SYSTEM, evaluateRange, isOutOfRange } from "@/lib/fhir/reference-range";

const UCUM = "http://unitsofmeasure.org";
const q = (value: number, unit = "mg/dL", withCode = true) =>
  withCode ? { value, unit, system: UCUM, code: unit } : { value, unit };
const range = (low: number | null, high: number | null, unit = "mg/dL") => ({
  ...(low !== null ? { low: q(low, unit) } : {}),
  ...(high !== null ? { high: q(high, unit) } : {}),
});
const flag = (code: string) => [{ coding: [{ system: INTERPRETATION_SYSTEM, code }] }];

describe("evaluateRange", () => {
  it("sin rango ni interpretación → 'Sin rango informado'", () => {
    const r = evaluateRange({ valueQuantity: q(5) });
    expect(r.status).toBe("sin-rango");
    expect(r.statusLabel).toBe("Sin rango informado");
    expect(r.rangeText).toBeNull();
  });

  it.each([
    [0.6, "bajo", "↓ Bajo"],
    [0.7, "normal", "Dentro del rango"], // límites inclusivos
    [1.0, "normal", "Dentro del rango"],
    [1.3, "normal", "Dentro del rango"],
    [1.4, "alto", "↑ Alto"],
  ])("valor %s con rango 0.7–1.3 → %s", (v, status, label) => {
    const r = evaluateRange({ valueQuantity: q(v), referenceRange: [range(0.7, 1.3)] });
    expect(r.status).toBe(status);
    expect(r.statusLabel).toBe(label);
    expect(r.rangeText).toBe("0.7–1.3 mg/dL");
    expect(r.source).toBe("rango");
  });

  it("solo máximo / solo mínimo", () => {
    expect(evaluateRange({ valueQuantity: q(140), referenceRange: [range(null, 130)] })).toMatchObject({
      status: "alto",
      rangeText: "≤ 130 mg/dL",
    });
    expect(evaluateRange({ valueQuantity: q(30), referenceRange: [range(40, null)] })).toMatchObject({
      status: "bajo",
      rangeText: "≥ 40 mg/dL",
    });
  });

  it("caso real Observation/888702: laboratorio dice Alto, valor dentro del rango → Requiere revisión", () => {
    const r = evaluateRange({
      valueQuantity: q(0.8, "mg/dL", false), // el valor trae la unidad solo como texto
      referenceRange: [range(0.7, 1.3)],
      interpretation: flag("H"),
    });
    expect(r.status).toBe("revision");
    expect(r.notes.join()).toMatch(/laboratorio indica "Alto".*dentro del rango/);
  });

  it("laboratorio y rango coinciden → estado del laboratorio", () => {
    const r = evaluateRange({ valueQuantity: q(2), referenceRange: [range(0.7, 1.3)], interpretation: flag("HH") });
    expect(r).toMatchObject({ status: "critico-alto", source: "ambos" });
  });

  it("solo interpretación del laboratorio (sin rango)", () => {
    expect(evaluateRange({ valueQuantity: q(2), interpretation: flag("L") })).toMatchObject({
      status: "bajo",
      source: "laboratorio",
    });
    expect(evaluateRange({ valueQuantity: q(2), interpretation: flag("A") }).status).toBe("anormal");
  });

  it("interpretación no estándar → revisión, con el texto del laboratorio", () => {
    const r = evaluateRange({ valueQuantity: q(2), interpretation: [{ text: "Levemente aumentado" }] });
    expect(r.status).toBe("revision");
    expect(r.labFlag?.label).toBe("Levemente aumentado");
  });

  it("unidad distinta → no compara", () => {
    const r = evaluateRange({ valueQuantity: q(5, "mmol/L"), referenceRange: [range(70, 100)] });
    expect(r.status).toBe("no-comparable");
    expect(r.notes.join()).toMatch(/Unidad distinta/);
  });

  it("rango solo texto → se muestra, no se compara", () => {
    const r = evaluateRange({ valueQuantity: q(120), referenceRange: [{ text: "Menor de 130 mg/dL" }] });
    expect(r.rangeText).toBe("Menor de 130 mg/dL");
    expect(r.status).toBe("no-comparable");
  });

  it("varios rangos (edad/sexo) → no elige uno", () => {
    const r = evaluateRange({
      valueQuantity: q(14, "g/dL"),
      referenceRange: [
        { ...range(12, 16, "g/dL"), appliesTo: [{ text: "Mujer" }] },
        { ...range(13.5, 17.5, "g/dL"), appliesTo: [{ text: "Hombre" }] },
      ],
    });
    expect(r.status).toBe("no-comparable");
    expect(r.rangeText).toBe("12–16 g/dL · 13.5–17.5 g/dL");
  });

  it("valor con comparador → no compara", () => {
    const r = evaluateRange({
      valueQuantity: { ...q(5), comparator: "<" },
      referenceRange: [range(0, 10)],
    });
    expect(r.status).toBe("no-comparable");
  });

  it("isOutOfRange", () => {
    expect(isOutOfRange("alto")).toBe(true);
    expect(isOutOfRange("critico-bajo")).toBe(true);
    expect(isOutOfRange("normal")).toBe(false);
    expect(isOutOfRange("revision")).toBe(false);
    expect(isOutOfRange("sin-rango")).toBe(false);
  });
});

describe("buildSeries (gráfica de evolución)", () => {
  const obs = (id: string, date: string | undefined, value: number | null, extra: Partial<Observation> = {}): Observation => ({
    resourceType: "Observation",
    id,
    status: "final",
    code: { text: "Glucosa", coding: [{ system: "http://loinc.org", code: "2345-7" }] },
    subject: { reference: "Patient/p" },
    effectiveDateTime: date,
    ...(value !== null ? { valueQuantity: q(value) } : {}),
    referenceRange: [range(70, 100)],
    ...extra,
  });

  it("agrupa por LOINC, ordena por fecha y marca fuera de rango", () => {
    const rows = [
      obs("c", "2026-03-01T09:00:00Z", 130),
      obs("a", "2026-01-01T09:00:00Z", 90),
      obs("b", "2026-02-01T09:00:00Z", 60),
    ].map(toObservationRow);
    const s = buildSeries(rows)["http://loinc.org|2345-7"];
    expect(s.name).toBe("Glucosa");
    expect(s.unit).toBe("mg/dL");
    expect(s.points.map((p) => [p.ref, p.status])).toEqual([
      ["Observation/a", "normal"],
      ["Observation/b", "bajo"],
      ["Observation/c", "alto"],
    ]);
    expect(s.band).toMatchObject({ low: 70, high: 100, text: "70–100 mg/dL", ref: "Observation/c" });
  });

  it("no grafica sin valor, sin fecha, con otra unidad o con comparador, y dice por qué", () => {
    const rows = [
      obs("ok", "2026-01-01T09:00:00Z", 90),
      obs("sinvalor", "2026-01-02T09:00:00Z", null),
      obs("sinfecha", undefined, 95),
      obs("mmol", "2026-01-03T09:00:00Z", null, { valueQuantity: q(5, "mmol/L") }),
      obs("comp", "2026-01-04T09:00:00Z", null, { valueQuantity: { ...q(50), comparator: "<" } }),
    ].map(toObservationRow);
    const s = buildSeries(rows)["http://loinc.org|2345-7"];
    // La unidad de la serie es la de la medición numérica más reciente con fecha.
    expect(s.unit).toBe("mmol/L");
    expect(s.points.map((p) => p.ref)).toEqual(["Observation/mmol"]);
    const reasons = Object.fromEntries(s.excluded.map((x) => [x.ref, x.reason]));
    expect(reasons["Observation/sinvalor"]).toBe("Sin valor numérico");
    expect(reasons["Observation/sinfecha"]).toBe("Sin fecha");
    expect(reasons["Observation/comp"]).toMatch(/comparador/);
    expect(reasons["Observation/ok"]).toMatch(/Unidad distinta/);
  });

  it("análisis distintos van en series distintas; sin código usa el texto", () => {
    const rows = [
      obs("g", "2026-01-01T09:00:00Z", 90),
      obs("h", "2026-01-01T09:00:00Z", 5, { code: { text: "HbA1c" } }),
    ].map(toObservationRow);
    expect(Object.keys(buildSeries(rows)).sort()).toEqual(["http://loinc.org|2345-7", "text|hba1c"]);
  });
});
