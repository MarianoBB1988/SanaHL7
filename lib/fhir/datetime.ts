/**
 * Fechas FHIR (tipo dateTime). Pueden ser parciales: "2026", "2026-11",
 * "2026-11-26", o completas con hora y zona: "2026-11-26T10:00:00-03:00".
 * Solo las completas representan un instante comparable.
 */

const DATE_TIME_RE =
  /^(\d{4})(?:-(\d{2})(?:-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?)?)?$/;

export type DateTimePrecision = "year" | "month" | "day" | "time";

export interface ParsedDateTime {
  raw: string;
  precision: DateTimePrecision;
  /** ms desde epoch; solo si tiene hora y zona horaria. */
  instant: number | null;
  /** Texto legible conservando la zona original (no se convierte). */
  display: string;
}

export function parseFhirDateTime(raw: string | undefined): ParsedDateTime | null {
  if (!raw) return null;
  const m = DATE_TIME_RE.exec(raw.trim());
  if (!m) return null;
  const [, y, mo, d, hh, mi, ss, , tz] = m;
  if (!mo) return { raw, precision: "year", instant: null, display: y };
  if (!d) return { raw, precision: "month", instant: null, display: `${mo}/${y}` };
  if (!hh) return { raw, precision: "day", instant: null, display: `${d}/${mo}/${y}` };

  // Con hora, FHIR exige zona horaria; sin ella no es un instante.
  const instant = tz ? Date.parse(raw) : NaN;
  const time = `${hh}:${mi}${ss ? `:${ss}` : ""}`;
  const zone = tz ? ` (${tz === "Z" ? "UTC" : tz})` : " (sin zona)";
  return {
    raw,
    precision: "time",
    instant: Number.isFinite(instant) ? instant : null,
    display: `${d}/${mo}/${y} ${time}${zone}`,
  };
}

/** Orden descendente por fecha; los registros sin fecha van al final. */
export function compareDesc(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return b - a;
}
