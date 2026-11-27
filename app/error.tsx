"use client";

import { buttonStyles } from "@/components/ui";

// Error inesperado (no previsto por el cliente FHIR). Los errores esperables se muestran inline.
export default function Error({ retry }: { error: Error; retry: () => void }) {
  return (
    <section
      role="alert"
      className="animate-enter flex flex-col gap-3 rounded-card border border-hairline bg-paper p-6 shadow-card"
    >
      <h2 className="text-subheading font-semibold text-danger">Ocurrió un error inesperado</h2>
      <p className="text-mist">La pantalla no pudo cargarse. Podés intentar de nuevo.</p>
      <div>
        <button type="button" onClick={() => retry()} className={buttonStyles.primary}>
          Reintentar
        </button>
      </div>
    </section>
  );
}
