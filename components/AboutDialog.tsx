"use client";

import Image from "next/image";
import { useRef } from "react";
import { buttonStyles } from "./ui";

const FEATURES: { title: string; text: string }[] = [
  {
    title: "Conecta con un servidor FHIR R4",
    text: "Lee pacientes y su historia desde cualquier servidor HL7 FHIR R4 (hoy, el servidor público HAPI). Muestra el estado del servidor, la versión FHIR y cada petición hecha.",
  },
  {
    title: "Buscador de pacientes",
    text: "Búsqueda por nombre o apellido (empieza con / contiene) y por sexo, con paginación del propio servidor.",
  },
  {
    title: "Ficha clínica por paciente",
    text: "Alergias siempre a la vista y, en pestañas, temperatura, análisis de laboratorio, consultas y otras observaciones. Tablas con orden por columna y filtros.",
  },
  {
    title: "Datos verificables",
    text: "Cada registro se puede abrir en su JSON original con la petición que lo trajo. Los registros dudosos no se ocultan: se muestran con el motivo.",
  },
  {
    title: "Resúmenes con IA contrastados",
    text: "En desarrollo: una IA propone un resumen del paciente y el sistema contrasta cada afirmación con los datos FHIR (coincide, contradice, sin respaldo u omisión).",
  },
];

/** Botón "Sobre el proyecto" + modal que explica qué hace la app. */
export function AboutDialog() {
  const ref = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-haspopup="dialog"
        onClick={() => ref.current?.showModal()}
        className={`${buttonStyles.outline} h-8 px-3 text-caption sm:text-body`}
      >
        Sobre el proyecto
      </button>
      <dialog
        ref={ref}
        aria-labelledby="about-title"
        className="sana-dialog m-auto w-[min(100vw-2rem,720px)] max-h-[min(100dvh-2rem,820px)] overflow-hidden rounded-card border border-line bg-paper p-0 text-left font-normal text-ink shadow-card"
        onClick={(e) => {
          if (e.target === e.currentTarget) e.currentTarget.close(); // clic en el fondo
        }}
        // Al cerrar (botón, Escape o fondo), el foco vuelve al botón que lo abrió.
        onClose={() => trigger.current?.focus()}
      >
        <div className="flex max-h-[inherit] flex-col">
          <header className="flex items-start justify-between gap-4 border-b border-hairline px-6 py-5">
            <div className="flex flex-col gap-1">
              <h2
                id="about-title"
                className="text-[26px] leading-tight font-semibold tracking-[-0.04em]"
              >
                SanaHL7
              </h2>
              <p className="text-mid-gray">
                Visor clínico por paciente sobre el estándar HL7 FHIR R4.
              </p>
            </div>
            <form method="dialog">
              <button type="submit" className={buttonStyles.secondary} autoFocus>
                Cerrar
              </button>
            </form>
          </header>

          <div className="flex flex-col gap-6 overflow-y-auto px-6 py-6">
            <div className="flex items-center justify-center rounded-nested bg-white px-6 py-4">
              <Image
                src="/brand/hl7-fhir.png"
                alt="Logo HL7 FHIR"
                width={400}
                height={200}
                // Carga con la página: dentro de un modal cerrado, la carga diferida dejaba la placa vacía al abrir.
                loading="eager"
                unoptimized
                className="h-auto w-[240px]"
              />
            </div>

            <p className="text-mist">
              SanaHL7 lee la historia de un paciente desde un servidor{" "}
              <strong className="font-medium text-ink">HL7 FHIR R4</strong>, el estándar
              internacional para intercambiar información de salud, y la presenta en una
              ficha clara: qué dice cada registro, de dónde viene y si se puede confiar en
              él.
            </p>

            <ul className="grid gap-3 sm:grid-cols-2">
              {FEATURES.map((f) => (
                <li
                  key={f.title}
                  className="flex flex-col gap-1 rounded-nested border border-hairline bg-canvas px-4 py-3"
                >
                  <h3 className="font-medium text-ink">{f.title}</h3>
                  <p className="text-mid-gray">{f.text}</p>
                </li>
              ))}
            </ul>

            <div className="flex flex-col gap-2">
              <h3 className="text-caption font-medium uppercase text-mid-gray">Tecnología</h3>
              <ul className="flex flex-wrap gap-2">
                {["HL7 FHIR R4", "HAPI FHIR", "Next.js", "React", "TypeScript", "Tailwind CSS"].map(
                  (t) => (
                    <li
                      key={t}
                      className="rounded-pill border border-line px-3 py-1 text-caption text-mist"
                    >
                      {t}
                    </li>
                  ),
                )}
              </ul>
            </div>

            <div className="flex flex-col gap-1 border-t border-hairline pt-4 text-caption text-mid-gray">
              <p>
                <strong className="font-medium text-ember">Importante:</strong> no es un
                dispositivo médico ni está validado para decisiones clínicas. Los datos
                vienen de servidores de prueba públicos.
              </p>
              <p>
                HL7® y FHIR® son marcas registradas de Health Level Seven International. Su
                uso aquí indica el estándar implementado y no implica respaldo de HL7.
              </p>
            </div>
          </div>
        </div>
      </dialog>
    </>
  );
}
