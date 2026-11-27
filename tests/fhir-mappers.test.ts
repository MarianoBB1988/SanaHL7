import type { Bundle as B, FhirResource } from "fhir/r4";

// Bundle<FhirResource> permite escribir recursos concretos en entry.resource.
type Bundle = B<FhirResource>;
import { describe, expect, it } from "vitest";
import {
  bundleMatches,
  formatHumanName,
  toPatientPage,
  toServerInfo,
} from "@/lib/fhir/mappers";

describe("Bundle", () => {
  it("sin entry → lista vacía, sin error", () => {
    const b: Bundle = { resourceType: "Bundle", type: "searchset" };
    expect(bundleMatches(b, "Patient")).toEqual([]);
    expect(toPatientPage(b)).toEqual({
      rows: [],
      skippedWithoutId: 0,
      nextUrl: null,
      previousUrl: null,
    });
  });

  it("filtra por resourceType y search.mode (descarta include y outcome)", () => {
    const b: Bundle = {
      resourceType: "Bundle",
      type: "searchset",
      entry: [
        { resource: { resourceType: "Patient", id: "a" }, search: { mode: "match" } },
        { resource: { resourceType: "Patient", id: "b" }, search: { mode: "include" } },
        {
          resource: { resourceType: "OperationOutcome", issue: [] },
          search: { mode: "outcome" },
        },
        { resource: { resourceType: "Patient", id: "c" } }, // sin search.mode: se acepta
        { fullUrl: "urn:uuid:sin-recurso" },
      ],
    };
    expect(bundleMatches(b, "Patient").map((p) => p.id)).toEqual(["a", "c"]);
  });

  it("lee links next y previous; previous acepta el alias prev", () => {
    const b: Bundle = {
      resourceType: "Bundle",
      type: "searchset",
      link: [
        { relation: "self", url: "https://x/fhir/Patient" },
        { relation: "next", url: "https://x/fhir?_getpages=1&_getpagesoffset=40" },
        { relation: "prev", url: "https://x/fhir?_getpages=1&_getpagesoffset=0" },
      ],
    };
    const page = toPatientPage(b);
    expect(page.nextUrl).toContain("offset=40");
    expect(page.previousUrl).toContain("offset=0");
  });

  it("paciente sin id: no se muestra y se cuenta", () => {
    const b: Bundle = {
      resourceType: "Bundle",
      type: "searchset",
      entry: [
        { resource: { resourceType: "Patient" }, search: { mode: "match" } },
        {
          resource: { resourceType: "Patient", id: "x", gender: "female", birthDate: "1990" },
          search: { mode: "match" },
        },
      ],
    };
    const page = toPatientPage(b);
    expect(page.skippedWithoutId).toBe(1);
    expect(page.rows).toEqual([
      { ref: "Patient/x", id: "x", name: null, gender: "Femenino", birthDate: "1990" },
    ]);
  });
});

describe("formatHumanName", () => {
  it("prefiere official y usa text si existe", () => {
    expect(
      formatHumanName([
        { use: "nickname", text: "Anita" },
        { use: "official", given: ["Ana", "María"], family: "Ficticia" },
      ]),
    ).toBe("Ana María Ficticia");
    expect(formatHumanName([{ text: " Ana F. " }])).toBe("Ana F.");
  });
  it("campos faltantes → null", () => {
    expect(formatHumanName(undefined)).toBeNull();
    expect(formatHumanName([{}])).toBeNull();
  });
});

describe("toServerInfo", () => {
  it("toma versión y software, tolera ausencias", () => {
    expect(
      toServerInfo({
        resourceType: "CapabilityStatement",
        status: "active",
        date: "2026-11-26",
        kind: "instance",
        fhirVersion: "4.0.1",
        format: ["json"],
        software: { name: "HAPI FHIR Server", version: "8.0" },
      }),
    ).toEqual({ fhirVersion: "4.0.1", software: "HAPI FHIR Server 8.0", status: "active" });
  });
});
