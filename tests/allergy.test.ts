import type { AllergyIntolerance } from "fhir/r4";
import { describe, expect, it } from "vitest";
import {
  CLINICAL_SYSTEM,
  VERIFICATION_SYSTEM,
  classifyAllergies,
  classifyAllergy,
} from "@/lib/fhir/allergy";

const base = new URL("https://hapi.example.org/baseR4");

function allergy(over: Partial<AllergyIntolerance> = {}): AllergyIntolerance {
  return {
    resourceType: "AllergyIntolerance",
    id: "a1",
    patient: { reference: "Patient/p" },
    code: { text: "Penicilina" },
    clinicalStatus: { coding: [{ system: CLINICAL_SYSTEM, code: "active" }] },
    verificationStatus: { coding: [{ system: VERIFICATION_SYSTEM, code: "confirmed" }] },
    ...over,
  };
}
const verification = (code: string) => ({
  verificationStatus: { coding: [{ system: VERIFICATION_SYSTEM, code }] },
});
const clinical = (code: string) => ({
  clinicalStatus: { coding: [{ system: CLINICAL_SYSTEM, code }] },
});
const classify = (a: AllergyIntolerance) => classifyAllergy(a, "p", base);

describe("classifyAllergy", () => {
  it("activa y confirmada → active", () => {
    const r = classify(allergy());
    expect(r.category).toBe("active");
    expect(r.substance).toBe("Penicilina");
    expect(r.reasons).toEqual([]);
  });

  it.each([
    ["refutada", verification("refuted"), /Verificación: refuted/],
    ["no confirmada", verification("unconfirmed"), /Verificación: unconfirmed/],
    ["cargada por error", verification("entered-in-error"), /entered-in-error/],
    ["inactiva", clinical("inactive"), /Estado clínico: inactive/],
    ["resuelta", clinical("resolved"), /Estado clínico: resolved/],
    ["sin clinicalStatus", { clinicalStatus: undefined }, /Sin estado clínico/],
    ["sin verificationStatus", { verificationStatus: undefined }, /Sin estado de verificación/],
    [
      "sistema de códigos inesperado",
      { clinicalStatus: { coding: [{ system: "http://otro", code: "active" }] } },
      /ambiguo/,
    ],
    [
      "códigos contradictorios",
      {
        clinicalStatus: {
          coding: [
            { system: CLINICAL_SYSTEM, code: "active" },
            { system: CLINICAL_SYSTEM, code: "resolved" },
          ],
        },
      },
      /varios códigos/,
    ],
    ["sin sustancia", { code: undefined }, /Sustancia no informada/],
  ])("%s → requiere revisión", (_n, over, reason) => {
    const r = classify(allergy(over as Partial<AllergyIntolerance>));
    expect(r.category).toBe("review");
    expect(r.reasons.join(" | ")).toMatch(reason);
  });

  it.each([
    [{ coding: [{ system: "http://snomed.info/sct", code: "716186003" }] }],
    [{ text: "No known allergies" }],
    [{ text: "NKDA" }],
    [{ text: "Sin alergias conocidas" }],
  ])("'sin alergias conocidas' activo y confirmado → requiere revisión", (code) => {
    const r = classify(allergy({ code }));
    expect(r.category).toBe("review");
    expect(r.reasons.join()).toMatch(/sin alergias conocidas/);
  });

  it("de otro paciente → excluded", () => {
    const r = classify(allergy({ patient: { reference: "Patient/otro" } }));
    expect(r.category).toBe("excluded");
    expect(r.reasons[0]).toMatch(/otro paciente/);
  });

  it("sustancia desde coding.display si no hay text", () => {
    const r = classify(
      allergy({
        code: { coding: [{ system: "http://snomed.info/sct", code: "387406002", display: "Sulfonamide" }] },
      }),
    );
    expect(r.substance).toBe("Sulfonamide");
  });
});

describe("classifyAllergies", () => {
  it("separa en activas, revisión y excluidas sin perder ninguna", () => {
    const r = classifyAllergies(
      [
        allergy({ id: "1" }),
        allergy({ id: "2", ...verification("refuted") }),
        allergy({ id: "3", patient: { reference: "Patient/otro" } }),
      ],
      "p",
      base,
    );
    expect(r.active.map((a) => a.ref)).toEqual(["AllergyIntolerance/1"]);
    expect(r.review.map((a) => a.ref)).toEqual(["AllergyIntolerance/2"]);
    expect(r.excluded.map((a) => a.ref)).toEqual(["AllergyIntolerance/3"]);
  });
});
