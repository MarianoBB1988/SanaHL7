import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      // `server-only` lanza error fuera de React Server; en pruebas es un no-op.
      "server-only": fileURLToPath(new URL("./tests/server-only-stub.ts", import.meta.url)),
    },
  },
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
});
