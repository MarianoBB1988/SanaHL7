/**
 * Carga los pacientes FICTICIOS en el HAPI local.
 *
 *   npm run seed                 (usa FHIR_BASE_URL de .env.local o del entorno)
 *   npm run seed -- --dry-run    (muestra qué cargaría, sin escribir)
 *
 * Se niega a escribir si el host no es exactamente localhost o 127.0.0.1.
 */
import { existsSync } from "node:fs";
import { seedResources } from "../lib/seed/data.ts";
import { runSeed } from "../lib/seed/run.ts";

// Las variables ya definidas en el entorno tienen prioridad sobre .env.local.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const dryRun = process.argv.includes("--dry-run");
const resources = seedResources();
const base = process.env.FHIR_BASE_URL;

if (dryRun) {
  console.log(`Simulación (no escribe). Destino: ${base ?? "(sin FHIR_BASE_URL)"}`);
  for (const r of resources) console.log(`  PUT ${r.resourceType}/${r.id}`);
  process.exit(0);
}

const report = await runSeed(base, resources);
if (report.error) {
  console.error(`✕ ${report.error}`);
  console.error(`  Para cargar en el HAPI local: FHIR_BASE_URL=http://localhost:8080/fhir npm run seed`);
  process.exit(1);
}
console.log(`Destino: ${report.baseUrl}`);
for (const l of report.lines) {
  console.log(`  ${l.ok ? "✓" : "✕"} ${l.ref.padEnd(40)} ${l.status ?? "—"}  ${l.result}`);
}
if (!report.ok) {
  console.error("✕ Carga interrumpida.");
  process.exit(1);
}
console.log(`✓ ${report.lines.length} recursos ficticios cargados.`);
