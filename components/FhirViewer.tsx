"use client";

import { useRef, useState } from "react";
import type { FhirRequestInfo } from "@/lib/fhir/client";
import { buttonStyles } from "./ui";

/**
 * Visor FHIR: muestra el recurso tal como llegó (JSON), su referencia y la
 * petición que lo trajo. Se renderiza como texto: nunca se interpreta HTML
 * (por ejemplo `text.div`).
 */
export function FhirViewerButton({
  reference,
  resource,
  request,
  label = "Ver JSON",
}: {
  reference: string;
  resource: unknown;
  request?: FhirRequestInfo;
  label?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState(false);
  const json = JSON.stringify(resource, null, 2);
  const titleId = `fhir-viewer-${reference.replace(/[^A-Za-z0-9-]/g, "-")}`;

  return (
    <>
      <button
        type="button"
        className={`${buttonStyles.outline} h-7 px-2.5 text-caption`}
        onClick={() => ref.current?.showModal()}
        aria-haspopup="dialog"
        aria-label={`${label} de ${reference}`}
      >
        {label}
      </button>
      <dialog
        ref={ref}
        aria-labelledby={titleId}
        // text-left: el diálogo vive dentro de una celda alineada a la derecha y heredaba esa alineación.
        className="sana-dialog m-auto w-[min(100vw-2rem,880px)] max-h-[min(100dvh-2rem,860px)] overflow-hidden rounded-card border border-line bg-paper p-0 text-left font-normal text-ink shadow-card"
        onClick={(e) => {
          if (e.target === e.currentTarget) e.currentTarget.close(); // clic en el fondo
        }}
      >
        <div className="flex max-h-[inherit] flex-col">
          <header className="flex items-start justify-between gap-3 border-b border-hairline px-5 py-4">
            <div className="flex min-w-0 flex-col gap-1">
              <h2 id={titleId} className="font-mono text-body font-medium break-all">
                {reference}
              </h2>
              {request && (
                <p className="text-caption text-mid-gray break-all">
                  <span className="font-mono">
                    {request.method} {request.url}
                  </span>
                  {request.status ? ` · HTTP ${request.status}` : ""}
                  {request.durationMs !== undefined ? ` · ${request.durationMs} ms` : ""}
                </p>
              )}
            </div>
            <form method="dialog">
              <button type="submit" className={buttonStyles.secondary} autoFocus>
                Cerrar
              </button>
            </form>
          </header>
          <pre className="flex-1 overflow-auto bg-page px-5 py-4 font-mono text-caption leading-relaxed whitespace-pre text-mist">
            {json}
          </pre>
          <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-hairline px-5 py-3 text-caption text-mid-gray">
            <span>JSON recibido del servidor, sin modificar.</span>
            <button
              type="button"
              className={`${buttonStyles.outline} h-7 px-2.5 text-caption`}
              onClick={async () => {
                try {
                  await navigator.clipboard?.writeText(json);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1600);
                } catch {
                  setCopied(false);
                }
              }}
            >
              <span aria-live="polite">{copied ? "✓ Copiado" : "Copiar JSON"}</span>
            </button>
          </footer>
        </div>
      </dialog>
    </>
  );
}
