"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { buttonStyles } from "./ui";

const FHIR_ID_RE = /^[A-Za-z0-9\-.]{1,64}$/;

/** Abrir una ficha escribiendo el id (p. ej. "31193" o "Patient/31193"). */
export function PatientIdForm() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="flex flex-col gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        const id = value.trim().replace(/^Patient\//, "");
        if (!FHIR_ID_RE.test(id)) {
          setError("Id FHIR inválido: letras, dígitos, “-” y “.”, hasta 64 caracteres.");
          return;
        }
        setError(null);
        router.push(`/pacientes/${encodeURIComponent(id)}`);
      }}
    >
      <label htmlFor="patient-id" className="text-caption font-medium uppercase text-mid-gray">
        Abrir ficha por id
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          id="patient-id"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Patient/31193"
          aria-invalid={!!error}
          aria-describedby={error ? "patient-id-error" : undefined}
          className="h-9 w-64 max-w-full rounded-pill bg-canvas px-4 font-mono text-caption outline-none ring-1 ring-line transition-shadow duration-200 placeholder:text-mid-gray focus:ring-ink/60"
        />
        <button type="submit" className={buttonStyles.primary}>
          Abrir
        </button>
      </div>
      {error && (
        <p id="patient-id-error" className="text-caption text-danger">
          {error}
        </p>
      )}
    </form>
  );
}
