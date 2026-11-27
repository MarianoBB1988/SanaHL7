import { describe, expect, it } from "vitest";
import {
  describeSearch,
  isFiltered,
  parsePatientSearch,
  toAppParams,
  toFhirParams,
} from "@/lib/patient-search";

describe("buscador de pacientes", () => {
  it("sin filtros → solo _count", () => {
    const s = parsePatientSearch({});
    expect(isFiltered(s)).toBe(false);
    expect(toFhirParams(s, 20)).toEqual({ _count: "20" });
  });

  it("campos vacíos del formulario cuentan como sin filtro", () => {
    const s = parsePatientSearch({ nombre: "  ", modo: "empieza", sexo: "" });
    expect(isFiltered(s)).toBe(false);
    expect(s.warnings).toEqual([]);
  });

  it("'empieza con' usa name; normaliza espacios", () => {
    const s = parsePatientSearch({ nombre: "  Ana   María ", sexo: "female" });
    expect(toFhirParams(s, 20)).toEqual({ name: "Ana María", gender: "female", _count: "20" });
    expect(describeSearch(s)).toBe("nombre que empieza con “Ana María” y sexo femenino");
  });

  it("'contiene' usa el modificador name:contains", () => {
    const s = parsePatientSearch({ nombre: "mber", modo: "contiene" });
    expect(toFhirParams(s, 20)).toEqual({ "name:contains": "mber", _count: "20" });
  });

  it("modo desconocido → empieza; sexo inválido se ignora con aviso", () => {
    const s = parsePatientSearch({ nombre: "x", modo: "regex", sexo: "hombre" });
    expect(s.mode).toBe("empieza");
    expect(s.gender).toBeNull();
    expect(s.warnings[0]).toMatch(/no válido/);
    expect(toFhirParams(s, 20)).toEqual({ name: "x", _count: "20" });
  });

  it("recorta nombres demasiado largos", () => {
    const s = parsePatientSearch({ nombre: "a".repeat(150) });
    expect(s.name).toHaveLength(100);
    expect(s.warnings).toHaveLength(1);
  });

  it("toma el primer valor si el parámetro viene repetido", () => {
    expect(parsePatientSearch({ nombre: ["uno", "dos"] }).name).toBe("uno");
  });

  it("parámetros de la app para la paginación", () => {
    const s = parsePatientSearch({ nombre: "Ana", modo: "contiene", sexo: "female" });
    expect(toAppParams(s).toString()).toBe("nombre=Ana&modo=contiene&sexo=female");
    // Sin nombre, el modo no se arrastra.
    expect(toAppParams(parsePatientSearch({ modo: "contiene" })).toString()).toBe("");
  });

  it("el texto llega al servidor codificado, no como parte de la ruta", () => {
    const s = parsePatientSearch({ nombre: "a&_id=x/../metadata" });
    const q = new URLSearchParams(toFhirParams(s, 20)).toString();
    expect(q).toBe("name=a%26_id%3Dx%2F..%2Fmetadata&_count=20");
  });
});
