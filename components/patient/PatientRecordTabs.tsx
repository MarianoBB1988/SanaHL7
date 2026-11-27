import { getFhirClient } from "@/lib/fhir/client";
import { readOnlyEncounters } from "@/lib/fhir/encounter";
import { readOnlyObservations, splitObservations } from "@/lib/fhir/observation";
import { searchAll } from "@/lib/fhir/search";
import {
  LOINC_BODY_TEMPERATURE,
  LOINC_SYSTEM,
  classifyTemperatures,
} from "@/lib/fhir/temperature";
import { Tabs, type TabDef } from "../Tabs";
import { EncounterPanel } from "./EncounterPanel";
import { ObservationTablePanel } from "./ObservationTablePanel";
import { baseUrlOf, resolvePatientId, type PatientParams } from "./params";
import { TemperaturePanel } from "./TemperaturePanel";

export const PATIENT_TABS = ["temperatura", "analisis", "consultas", "otras"] as const;

/**
 * Historia del paciente en pestañas. Las tres consultas van en paralelo;
 * cuando llegan, se arman las pestañas con sus cantidades.
 */
export async function PatientRecordTabs({
  params,
  searchParams,
}: {
  params: PatientParams;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [id, query] = await Promise.all([resolvePatientId(params), searchParams]);
  const rawTab = Array.isArray(query.tab) ? query.tab[0] : query.tab;
  const client = getFhirClient();
  const baseUrl = baseUrlOf(client.baseUrl);

  const [temps, observations, encounters] = await Promise.all([
    searchAll(client, "Observation", {
      patient: id,
      code: `${LOINC_SYSTEM}|${LOINC_BODY_TEMPERATURE}`,
      _count: "100",
    }),
    searchAll(client, "Observation", { patient: id, _count: "100" }),
    searchAll(client, "Encounter", { patient: id, _count: "100" }),
  ]);

  const tempClass = classifyTemperatures(temps.resources, id, baseUrl);
  const obs = readOnlyObservations(observations.resources, id, baseUrl);
  const { lab, other } = splitObservations(obs.rows);
  const enc = readOnlyEncounters(encounters.resources, id, baseUrl);

  // Si la consulta falló sin traer nada, la cantidad es desconocida ("?").
  const countOf = (n: number, s: { complete: boolean; resources: unknown[] }) =>
    !s.complete && s.resources.length === 0 ? null : n;

  const tabs: TabDef[] = [
    {
      id: "temperatura",
      label: "Temperatura",
      hint: "verificada",
      count: countOf(tempClass.usable.length, temps),
      incomplete: !temps.complete,
    },
    {
      id: "analisis",
      label: "Análisis",
      count: countOf(lab.length, observations),
      incomplete: !observations.complete,
    },
    {
      id: "consultas",
      label: "Consultas",
      count: countOf(enc.rows.length, encounters),
      incomplete: !encounters.complete,
    },
    {
      id: "otras",
      label: "Otras observaciones",
      count: countOf(other.length, observations),
      incomplete: !observations.complete,
    },
  ];

  return (
    <Tabs
      label="Historia del paciente"
      tabs={tabs}
      initial={rawTab ?? "temperatura"}
      panels={{
        temperatura: <TemperaturePanel search={temps} patientId={id} baseUrl={baseUrl} />,
        analisis: (
          <ObservationTablePanel
            id="analisis-titulo"
            title="Análisis"
            subtitle="Resultados de laboratorio tal como vienen del servidor. Alto o bajo solo según el rango y la marca del propio laboratorio; la app no inventa rangos."
            emptyText="Sin información disponible: el servidor no devolvió análisis de laboratorio."
            search={observations}
            rows={lab}
            otherPatient={obs.otherPatient}
            showCategory={false}
          />
        ),
        consultas: (
          <EncounterPanel search={encounters} rows={enc.rows} otherPatient={enc.otherPatient} />
        ),
        otras: (
          <ObservationTablePanel
            id="otras-titulo"
            title="Otras observaciones"
            subtitle="Signos vitales (salvo temperatura, que tiene su pestaña), historia social, encuestas y observaciones sin categoría."
            emptyText="Sin información disponible: el servidor no devolvió otras observaciones."
            search={observations}
            rows={other}
            otherPatient={obs.otherPatient}
            showCategory
          />
        ),
      }}
    />
  );
}
