import { connection } from "next/server";
import { getFhirClient } from "@/lib/fhir/client";
import { toServerInfo } from "@/lib/fhir/mappers";
import { FhirErrorCard } from "./FhirErrorCard";
import { Badge, Caption, Card, Mono } from "./ui";

/** Estado del servidor a partir de GET /metadata (CapabilityStatement). */
export async function ServerStatus() {
  await connection(); // siempre en el momento del pedido: nunca prerenderizar datos del servidor
  const client = getFhirClient();
  const result = await client.get("metadata", "CapabilityStatement");

  if (!result.ok) {
    return (
      <FhirErrorCard
        title="No se pudo leer el servidor FHIR"
        error={result.error}
        request={result.request}
      />
    );
  }

  const info = toServerInfo(result.data);
  const isR4 = info.fhirVersion?.startsWith("4.0") ?? false;

  return (
    <Card aria-live="polite" className="grid gap-4 sm:grid-cols-3">
      <div className="flex flex-col gap-1">
        <Caption>Servidor</Caption>
        <p className="flex items-center gap-2 text-subheading font-semibold">
          <span aria-hidden className="inline-block size-2 rounded-full bg-growth shadow-[0_0_10px_rgba(78,190,150,0.8)]" />
          Conectado
        </p>
        <p className="text-mid-gray">{info.software ?? "Software no informado"}</p>
      </div>
      <div className="flex flex-col gap-1">
        <Caption>Versión FHIR</Caption>
        <p className="text-subheading font-semibold">
          {info.fhirVersion ?? "No informada"}
        </p>
        {info.fhirVersion && !isR4 && (
          <Badge tone="error">
            <span aria-hidden>!</span> Este prototipo espera R4 (4.0.x)
          </Badge>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <Caption>Petición</Caption>
        <Mono>
          {result.request.method} {result.request.url}
        </Mono>
        <p className="text-mid-gray">
          HTTP {result.request.status} · {result.request.durationMs} ms
        </p>
      </div>
    </Card>
  );
}
