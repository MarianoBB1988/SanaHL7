import Link from "next/link";
import type { ReactNode } from "react";
import { getFhirClient } from "@/lib/fhir/client";
import { toPatientPage } from "@/lib/fhir/mappers";
import {
  describeSearch,
  isFiltered,
  parsePatientSearch,
  toAppParams,
  toFhirParams,
  type PatientSearch,
} from "@/lib/patient-search";
import { FhirErrorCard } from "./FhirErrorCard";
import { PatientSearchForm } from "./PatientSearchForm";
import { Card, Mono, PagerLink, buttonStyles } from "./ui";

export const PAGE_SIZE = 20;

/** Enlace de la app que sigue un cursor del servidor, conservando los filtros visibles. */
function pageHref(
  url: string | null,
  canFollow: (u: string) => boolean,
  search: PatientSearch,
) {
  if (!url || !canFollow(url)) return null;
  const p = toAppParams(search);
  p.set("page", url);
  return `/?${p.toString()}`;
}

function firstPageHref(search: PatientSearch) {
  const q = toAppParams(search).toString();
  return q ? `/?${q}` : "/";
}

/** Buscador arriba y, debajo, la tabla o el error. */
function Layout({ search, children }: { search: PatientSearch; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <PatientSearchForm search={search} />
        {search.warnings.length > 0 && (
          <ul className="mt-2 text-caption text-mid-gray">
            {search.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        )}
      </Card>
      {children}
    </div>
  );
}

/**
 * Lista de pacientes. Sin cursor: GET /Patient?name=…&gender=…&_count=20.
 * Con cursor: seguimos el link `next`/`previous` que dio el servidor, tal cual
 * (el cursor ya recuerda la búsqueda original).
 */
export async function PatientTable({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawCursor = Array.isArray(params.page) ? params.page[0] : params.page;
  const search = parsePatientSearch(params);
  const filtered = isFiltered(search);
  const client = getFhirClient();

  const result = rawCursor
    ? await client.follow(rawCursor, "Bundle")
    : await client.get("Patient", "Bundle", toFhirParams(search, PAGE_SIZE));

  if (!result.ok) {
    const expired = result.error.status === 410 || result.error.status === 404;
    return (
      <Layout search={search}>
        <FhirErrorCard
          title={
            rawCursor && expired
              ? "La paginación expiró"
              : "No se pudo cargar la lista de pacientes"
          }
          error={result.error}
          request={result.request}
          retry={!(rawCursor && expired) && result.error.kind !== "url-rejected"}
          extra={
            rawCursor ? (
              <Link href={firstPageHref(search)} className={buttonStyles.outline}>
                Volver a la primera página
              </Link>
            ) : null
          }
        />
      </Layout>
    );
  }

  const page = toPatientPage(result.data);
  const canFollow = (u: string) => client.canFollow(u);
  const nextHref = pageHref(page.nextUrl, canFollow, search);
  // En la primera página HAPI no da `previous`; si estamos en un cursor, ofrecemos volver al inicio.
  const prevHref =
    pageHref(page.previousUrl, canFollow, search) ?? (rawCursor ? firstPageHref(search) : null);
  const rejectedLink =
    (page.nextUrl && !canFollow(page.nextUrl)) ||
    (page.previousUrl && !canFollow(page.previousUrl));

  return (
    <Layout search={search}>
      <Card padded={false} className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pt-5">
          <div>
            <h2 className="text-subheading font-semibold">
              {filtered ? "Resultados" : "Pacientes"}
            </h2>
            {filtered && (
              <p className="text-mid-gray">Pacientes con {describeSearch(search)}</p>
            )}
          </div>
          <p className="text-mid-gray">
            {page.rows.length} en esta página · el servidor no informa el total
          </p>
        </div>

        {page.rows.length === 0 ? (
          <div className="px-5 pb-2">
            <p className="rounded-nested bg-canvas px-4 py-6 text-center text-mid-gray">
              {filtered
                ? `Ningún paciente con ${describeSearch(search)}.`
                : "La búsqueda no devolvió pacientes en esta página."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-left">
              <caption className="sr-only">Pacientes del servidor FHIR, página actual</caption>
              <thead>
                <tr className="border-y border-hairline bg-surface-alt text-caption uppercase text-mid-gray">
                  <th scope="col" className="px-5 py-2 font-medium">Referencia</th>
                  <th scope="col" className="px-5 py-2 font-medium">Nombre</th>
                  <th scope="col" className="px-5 py-2 font-medium">Sexo</th>
                  <th scope="col" className="px-5 py-2 font-medium">Nacimiento</th>
                </tr>
              </thead>
              <tbody>
                {page.rows.map((row) => (
                  <tr key={row.ref} className="border-b border-hairline transition-colors duration-150 last:border-b-0 hover:bg-white/[0.025]">
                    <td className="whitespace-nowrap px-5 py-3 align-middle font-mono text-caption">
                      <Link
                        href={`/pacientes/${encodeURIComponent(row.id)}`}
                        className="underline decoration-hairline underline-offset-4 hover:decoration-ink"
                      >
                        {row.ref}
                      </Link>
                    </td>
                    <td className="px-5 py-3 align-middle">
                      {row.name ?? <span className="text-mid-gray">Sin nombre</span>}
                    </td>
                    <td className="px-5 py-3 align-middle">
                      {row.gender ?? <span className="text-mid-gray">No informado</span>}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 align-middle font-mono text-caption">
                      {row.birthDate ?? (
                        <span className="font-sans text-body text-mid-gray">No informada</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {(page.skippedWithoutId > 0 || rejectedLink) && (
          <ul className="mx-5 list-disc pl-5 text-mid-gray">
            {page.skippedWithoutId > 0 && (
              <li>{page.skippedWithoutId} recurso(s) sin id no se muestran.</li>
            )}
            {rejectedLink && (
              <li>Un enlace de paginación apuntaba a otro servidor y no se sigue.</li>
            )}
          </ul>
        )}

        <nav
          aria-label="Paginación"
          className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline px-5 py-4"
        >
          <div className="flex gap-2">
            <PagerLink href={prevHref} rel="prev">← Anterior</PagerLink>
            <PagerLink href={nextHref} rel="next">Siguiente →</PagerLink>
          </div>
          <p className="text-caption text-mid-gray">
            <Mono>GET {result.request.url}</Mono> · HTTP {result.request.status} ·{" "}
            {result.request.durationMs} ms
          </p>
        </nav>
      </Card>
    </Layout>
  );
}
