import { describe, expect, it } from "vitest";
import {
  EMPTY_OPTION,
  applyTable,
  filterOptions,
  isTableFiltered,
  type TableRow,
  type TableState,
} from "@/lib/table";

const row = (key: string, inicio: number | null, modalidad: string | null, tipo: string): TableRow => ({
  key,
  cells: {
    inicio: { text: inicio === null ? null : `t${inicio}`, sort: inicio },
    modalidad: { text: modalidad },
    tipo: { text: tipo, sub: `Encounter/${key}` },
  },
});

const rows: TableRow[] = [
  row("a", 3, "Ambulatoria", "Control"),
  row("b", 1, "Urgencia", "Atención de urgencia"),
  row("c", null, "Ambulatoria", "Seguimiento"),
  row("d", 2, null, "Examen físico"),
];

const state = (over: Partial<TableState> = {}): TableState => ({
  query: "",
  filters: {},
  sort: null,
  ...over,
});
const keys = (r: TableRow[]) => r.map((x) => x.key);

describe("tabla: filtros", () => {
  it("sin filtros devuelve todo en el orden original", () => {
    expect(keys(applyTable(rows, state()))).toEqual(["a", "b", "c", "d"]);
    expect(isTableFiltered(state())).toBe(false);
  });

  it("filtra por modalidad (Urgencia)", () => {
    const s = state({ filters: { modalidad: "Urgencia" } });
    expect(keys(applyTable(rows, s))).toEqual(["b"]);
    expect(isTableFiltered(s)).toBe(true);
  });

  it("filtra por 'Sin dato'", () => {
    expect(keys(applyTable(rows, state({ filters: { modalidad: EMPTY_OPTION } })))).toEqual(["d"]);
  });

  it("combina filtros con Y", () => {
    const s = state({ filters: { modalidad: "Ambulatoria", tipo: "Control" } });
    expect(keys(applyTable(rows, s))).toEqual(["a"]);
  });

  it("búsqueda: sin mayúsculas ni acentos, incluye la referencia (sub)", () => {
    expect(keys(applyTable(rows, state({ query: "ATENCION" })))).toEqual(["b"]);
    expect(keys(applyTable(rows, state({ query: "examen fisico" })))).toEqual(["d"]);
    expect(keys(applyTable(rows, state({ query: "encounter/c" })))).toEqual(["c"]);
  });

  it("opciones del filtro con cantidades; 'Sin dato' al final", () => {
    expect(filterOptions(rows, "modalidad")).toEqual([
      { value: "Ambulatoria", label: "Ambulatoria", count: 2 },
      { value: "Urgencia", label: "Urgencia", count: 1 },
      { value: EMPTY_OPTION, label: "Sin dato", count: 1 },
    ]);
  });
});

describe("tabla: orden", () => {
  it("por fecha numérica, vacíos al final en ambos sentidos", () => {
    expect(keys(applyTable(rows, state({ sort: { key: "inicio", dir: "asc" } })))).toEqual([
      "b", "d", "a", "c",
    ]);
    expect(keys(applyTable(rows, state({ sort: { key: "inicio", dir: "desc" } })))).toEqual([
      "a", "d", "b", "c",
    ]);
  });

  it("por texto en español, ignorando acentos y mayúsculas", () => {
    expect(keys(applyTable(rows, state({ sort: { key: "tipo", dir: "asc" } })))).toEqual([
      "b", "a", "d", "c",
    ]);
  });

  it("valores numéricos no se ordenan como texto (9 < 38.5)", () => {
    const v = (key: string, n: number): TableRow => ({
      key,
      cells: { valor: { text: String(n), sort: n } },
    });
    const r = applyTable([v("x", 38.5), v("y", 9), v("z", 100)], state({ sort: { key: "valor", dir: "asc" } }));
    expect(keys(r)).toEqual(["y", "x", "z"]);
  });

  it("orden estable: empates conservan el orden original", () => {
    const r = applyTable(rows, state({ sort: { key: "modalidad", dir: "asc" } }));
    expect(keys(r)).toEqual(["a", "c", "b", "d"]);
  });

  it("filtra y ordena a la vez", () => {
    const r = applyTable(
      rows,
      state({ filters: { modalidad: "Ambulatoria" }, sort: { key: "inicio", dir: "desc" } }),
    );
    expect(keys(r)).toEqual(["a", "c"]);
  });
});
