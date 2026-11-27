import Form from "next/form";
import Link from "next/link";
import {
  GENDERS,
  GENDER_LABEL,
  NAME_MAX_LENGTH,
  isFiltered,
  type PatientSearch,
} from "@/lib/patient-search";
import { buttonStyles } from "./ui";

const field =
  "h-9 rounded-pill bg-canvas px-4 text-body outline-none ring-1 ring-line transition-shadow duration-200 placeholder:text-mid-gray focus:ring-ink/60";
const label = "text-caption font-medium uppercase text-mid-gray";

/**
 * Buscador (GET): los filtros quedan en la URL, así se pueden compartir y
 * funciona con el botón Atrás. Sin JavaScript también funciona.
 */
export function PatientSearchForm({
  search,
  disabled = false,
}: {
  search?: PatientSearch;
  disabled?: boolean;
}) {
  return (
    <Form
      action="/"
      role="search"
      aria-label="Buscar pacientes"
      // `key` reinicia los valores al navegar (p. ej. con "Limpiar").
      key={search ? `${search.name}|${search.mode}|${search.gender}` : "vacío"}
      className="flex flex-wrap items-end gap-3"
    >
      <div className="flex min-w-[220px] flex-1 flex-col gap-1">
        <label htmlFor="buscar-nombre" className={label}>
          Nombre o apellido
        </label>
        <input
          id="buscar-nombre"
          name="nombre"
          type="search"
          defaultValue={search?.name}
          maxLength={NAME_MAX_LENGTH}
          placeholder="Ej.: pemberton"
          autoComplete="off"
          disabled={disabled}
          className={field}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="buscar-modo" className={label}>
          Coincidencia
        </label>
        <select
          id="buscar-modo"
          name="modo"
          defaultValue={search?.mode ?? "empieza"}
          disabled={disabled}
          className={field}
        >
          <option value="empieza">Empieza con</option>
          <option value="contiene">Contiene</option>
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="buscar-sexo" className={label}>
          Sexo
        </label>
        <select
          id="buscar-sexo"
          name="sexo"
          defaultValue={search?.gender ?? ""}
          disabled={disabled}
          className={field}
        >
          <option value="">Todos</option>
          {GENDERS.map((g) => (
            <option key={g} value={g}>
              {GENDER_LABEL[g]}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-2">
        <button type="submit" className={buttonStyles.primary} disabled={disabled}>
          Buscar
        </button>
        {search && isFiltered(search) && (
          <Link href="/" className={buttonStyles.secondary}>
            Limpiar
          </Link>
        )}
      </div>
    </Form>
  );
}
