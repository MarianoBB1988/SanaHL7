import { describe, expect, it } from "vitest";
import { parseFhirDateTime } from "@/lib/fhir/datetime";
import {
  isFhirId,
  patientIdFromReference,
  patientMismatchReason,
} from "@/lib/fhir/references";

const base = new URL("https://hapi.example.org/baseR4");

describe("patientIdFromReference", () => {
  it.each([
    ["Patient/abc", "abc"],
    ["Patient/abc/_history/3", "abc"],
    ["https://hapi.example.org/baseR4/Patient/abc", "abc"],
    ["https://hapi.example.org/baseR4/Patient/abc/_history/2", "abc"],
  ])("%s → %s", (ref, id) => {
    expect(patientIdFromReference(ref, base)).toEqual({ kind: "id", id });
  });

  it.each([
    "https://otro.example/fhir/Patient/abc", // otro servidor
    "#p1", // recurso contenido
    "Group/abc",
    "Patient/",
    "Patient/a/b",
    "Patient/abc?x=1",
  ])("no comprobable: %s", (ref) => {
    expect(patientIdFromReference(ref, base).kind).toBe("unsupported");
  });

  it("vacía o ausente", () => {
    expect(patientIdFromReference(undefined, base).kind).toBe("missing");
    expect(patientIdFromReference("  ", base).kind).toBe("missing");
  });

  it("motivo de no coincidencia", () => {
    expect(patientMismatchReason("Patient/abc", "abc", base)).toBeNull();
    expect(patientMismatchReason("Patient/otro", "abc", base)).toMatch(/otro paciente/);
  });
});

describe("isFhirId", () => {
  it("valida el formato", () => {
    expect(isFhirId("nhanes-111640")).toBe(true);
    expect(isFhirId("a.b-C9")).toBe(true);
    expect(isFhirId("")).toBe(false);
    expect(isFhirId("a/b")).toBe(false);
    expect(isFhirId("../metadata")).toBe(false);
    expect(isFhirId("x".repeat(65))).toBe(false);
  });
});

describe("parseFhirDateTime", () => {
  it("con hora y zona: instante comparable, conserva la zona", () => {
    const a = parseFhirDateTime("2026-11-26T10:00:00-03:00")!;
    const b = parseFhirDateTime("2026-11-26T13:00:00Z")!;
    expect(a.precision).toBe("time");
    expect(a.instant).toBe(b.instant); // mismo instante con zonas distintas
    expect(a.display).toBe("26/11/2026 10:00:00 (-03:00)");
  });

  it.each([
    ["2026", "year"],
    ["2026-11", "month"],
    ["2026-11-26", "day"],
  ])("parcial %s → %s sin instante", (raw, precision) => {
    const p = parseFhirDateTime(raw)!;
    expect(p.precision).toBe(precision);
    expect(p.instant).toBeNull();
  });

  it("hora sin zona: no es instante", () => {
    expect(parseFhirDateTime("2026-11-26T10:00:00")!.instant).toBeNull();
  });

  it("formato inválido o ausente → null", () => {
    expect(parseFhirDateTime("26/11/2026")).toBeNull();
    expect(parseFhirDateTime(undefined)).toBeNull();
  });
});
