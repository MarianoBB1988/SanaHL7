// En Windows, si la carpeta se abrió como "c:\..." (minúscula), Vitest carga
// su runner dos veces y falla con "Cannot read properties of undefined (reading 'config')".
// Normalizamos la letra de unidad y lanzamos Vitest con los mismos argumentos.
import { spawnSync } from "node:child_process";
import path from "node:path";

const cwd = process.cwd().replace(/^([a-z]):/, (_, d) => d.toUpperCase() + ":");
process.chdir(cwd);
const bin = path.join(cwd, "node_modules", "vitest", "vitest.mjs");
const r = spawnSync(process.execPath, [bin, ...process.argv.slice(2)], {
  cwd,
  stdio: "inherit",
});
process.exit(r.status ?? 1);
