/**
 * Ordenar y filtrar filas de una tabla en el navegador. Funciones puras.
 * Las celdas llegan ya armadas desde el servidor (texto + valor para ordenar).
 */

export interface Cell {
  /** Texto visible; null = sin dato. */
  text: string | null;
  /** Valor para ordenar (número para fechas/valores). Si falta, se usa `text`. */
  sort?: string | number | null;
  /** Segunda línea pequeña (p. ej. la referencia FHIR). */
  sub?: string;
  /** Lista de líneas (p. ej. motivos de exclusión). */
  lines?: string[];
  /** Etiqueta destacada junto al texto (p. ej. "Más reciente"). */
  badge?: string;
  /** Cómo mostrar el texto: "warm" (fuera de rango), "outline" (revisión), "muted" (secundario). */
  emphasis?: "warm" | "outline" | "muted";
}

export interface TableRow {
  key: string;
  cells: Record<string, Cell>;
}

export type SortDir = "asc" | "desc";
export interface SortState {
  key: string;
  dir: SortDir;
}

/** Valor del filtro de selección para "sin dato". */
export const EMPTY_OPTION = "__sin_dato__";

export interface TableState {
  query: string;
  /** columna → valor elegido ("" = todos). */
  filters: Record<string, string>;
  sort: SortState | null;
}

const collator = new Intl.Collator("es", { sensitivity: "base", numeric: true });

function normalize(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

function cellSearchText(c: Cell | undefined): string {
  if (!c) return "";
  return [c.text ?? "", c.sub ?? "", ...(c.lines ?? [])].join(" ");
}

/** Compara dos valores; los vacíos van siempre al final, en ambos sentidos. */
export function compareCells(a: Cell | undefined, b: Cell | undefined, dir: SortDir): number {
  const va = a?.sort ?? a?.text ?? null;
  const vb = b?.sort ?? b?.text ?? null;
  const ea = va === null || va === "";
  const eb = vb === null || vb === "";
  if (ea && eb) return 0;
  if (ea) return 1;
  if (eb) return -1;
  const base =
    typeof va === "number" && typeof vb === "number"
      ? va - vb
      : collator.compare(String(va), String(vb));
  return dir === "asc" ? base : -base;
}

/** Opciones de un filtro de selección: valores distintos con su cantidad. */
export function filterOptions(rows: TableRow[], key: string) {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const v = r.cells[key]?.text ?? EMPTY_OPTION;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({
      value,
      label: value === EMPTY_OPTION ? "Sin dato" : value,
      count,
    }))
    .sort((a, b) =>
      a.value === EMPTY_OPTION ? 1 : b.value === EMPTY_OPTION ? -1 : collator.compare(a.label, b.label),
    );
}

export function applyTable(rows: TableRow[], state: TableState): TableRow[] {
  const q = normalize(state.query.trim());
  const active = Object.entries(state.filters).filter(([, v]) => v !== "");

  const out = rows.filter((r) => {
    for (const [key, value] of active) {
      const text = r.cells[key]?.text ?? null;
      if (value === EMPTY_OPTION ? text !== null : text !== value) return false;
    }
    if (q) {
      const haystack = normalize(Object.values(r.cells).map(cellSearchText).join(" "));
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  if (state.sort) {
    const { key, dir } = state.sort;
    // sort estable: a igualdad se mantiene el orden original
    return out
      .map((r, i) => ({ r, i }))
      .sort((x, y) => compareCells(x.r.cells[key], y.r.cells[key], dir) || x.i - y.i)
      .map((x) => x.r);
  }
  return out;
}

export function isTableFiltered(state: TableState): boolean {
  return state.query.trim() !== "" || Object.values(state.filters).some((v) => v !== "");
}
