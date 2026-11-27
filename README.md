# SanaHL7

Dashboard clínico por paciente que lee datos **HL7 FHIR R4**. Más adelante, una IA propondrá un resumen y el código contrastará cada afirmación con los datos FHIR.


Especificación: [PROMPT_SanaHL7.md](PROMPT_SanaHL7.md) · Estilo visual: [DESIGN.md](DESIGN.md)

## Estado

| Etapa | Contenido | Estado |
|---|---|---|
| 1. Base | Proyecto, cliente FHIR, `/metadata`, lista de pacientes y paginación | ✅ Hecha |
| 2. Ficha | Datos, temperaturas, alergias y visor FHIR | ✅ Hecha |
| 3. Datos y dashboard | HAPI local (Docker), script de carga, gráfica y cards | Pendiente |
| 4. Verificador sin IA | Afirmaciones a mano, "Demostración manual" | Pendiente |
| 5. Evaluación | Casos con resultado esperado, errores inyectados | Pendiente |
| 6. Groq | Afirmaciones generadas por IA, mismo verificador | Pendiente |

## Instalación

Requisitos: Node.js 22 o superior y npm.

```bash
npm install
cp .env.example .env.local   # luego revisá los valores
npm run dev                  # http://localhost:3000
```

Variables (`.env.local`, no se sube al repositorio):

| Variable | Uso |
|---|---|
| `FHIR_BASE_URL` | Base del servidor FHIR R4. Etapas 1 y 2: `https://hapi.fhir.org/baseR4` (solo lectura). |
| `GROQ_API_KEY`, `GROQ_MODEL` | Etapa 6. Vacías por ahora. |

Scripts:

| Comando | Qué hace |
|---|---|
| `npm test` | Pruebas unitarias (Vitest), sin red |
| `npm run typecheck` | Chequeo de tipos de TypeScript |
| `npm run lint` | ESLint |
| `npm run build` | Build de producción |

### HAPI local con datos ficticios (Docker)

El servidor local es donde viven los pacientes ficticios (Ana y Bruno). Los datos se guardan en `D:\SanaHL7-datos\hapi` (base H2), así que sobreviven aunque se borre el contenedor.

```bash
# Primera vez (crea el contenedor; el puerto solo escucha en 127.0.0.1)
docker run -d --name sanahl7-hapi -p 127.0.0.1:8080:8080 \
  -v "D:/SanaHL7-datos/hapi:/data" \
  -e "SPRING_DATASOURCE_URL=jdbc:h2:file:/data/hapi" \
  hapiproject/hapi:latest

# Después: iniciar / detener (o desde Docker Desktop → Containers)
docker start sanahl7-hapi
docker stop sanahl7-hapi

# Cargar los datos ficticios (repetirlo no duplica: PUT con ids fijos)
FHIR_BASE_URL=http://localhost:8080/fhir npm run seed
npm run seed -- --dry-run     # ver qué cargaría, sin escribir
```

- HAPI tarda ~2 minutos en arrancar la primera vez. Base URL: `http://localhost:8080/fhir` (FHIR 4.0.1).
- `npm run seed` **se niega a escribir** si el host no es exactamente `localhost` o `127.0.0.1`, y no sigue redirecciones.
- Para que la app lea el servidor local, en `.env.local`: `FHIR_BASE_URL=http://localhost:8080/fhir` (y reiniciar `npm run dev`).
- Datos cargados: `Patient/ana-ficticia` (3 temperaturas, alergia a penicilina, 4 glucosas con rango, 1 hemoglobina, 1 consulta) y `Patient/bruno-ficticio` (sin datos). Todos con `meta.tag` `urn:sanahl7:dataset|ficticio`.

> **Windows:** si la terminal no encuentra `docker` (Docker Desktop instalado por usuario), su carpeta es `%LOCALAPPDATA%\Programs\DockerDesktop\resources\bin`; abrí una terminal nueva o agregala al PATH.

> **Windows:** `npm test` usa `scripts/vitest.mjs`, que normaliza la letra de unidad. Si la carpeta se abre como `c:\…` (minúscula), Vitest falla con `Cannot read properties of undefined (reading 'config')`.

## Arquitectura

```
app/
  layout.tsx          Aviso de prototipo, encabezado, fuentes Geist
  page.tsx            Pantalla Pacientes (dos <Suspense>: estado del servidor y tabla)
  error.tsx           Error inesperado con "Reintentar"
  not-found.tsx       Ruta inexistente o id FHIR inválido
  pacientes/[id]/     Ficha: encabezado y alergias siempre arriba; debajo, pestañas
                      (Temperatura, Análisis, Consultas, Otras observaciones; ?tab=…)
components/
  ServerStatus.tsx    GET /metadata → estado, versión FHIR y petición
  PatientTable.tsx    GET /Patient?_count=20 y paginación por links del Bundle
  FhirErrorCard.tsx   Muestra tipo de error, estado HTTP, petición y OperationOutcome
  RetryButton.tsx     Reintento (router.refresh)
  ui.tsx              Card, botones, badges (tokens de DESIGN.md)
  PatientIdForm.tsx   Abrir una ficha escribiendo el id
  PatientSearchForm.tsx  Buscador (GET): nombre, coincidencia y sexo; filtros en la URL
  FhirViewer.tsx      Visor FHIR: <dialog> con referencia, petición, HTTP y JSON sin modificar
  QueryInfo.tsx       Consulta completa/incompleta, páginas y peticiones
  AboutDialog.tsx     "Sobre el proyecto": modal con qué hace la app, logo HL7 FHIR
                      (public/brand/hl7-fhir.png) y advertencia de uso
  Tabs.tsx            Pestañas accesibles (flechas, Inicio, Fin); pestaña activa en la URL
  DataTable.tsx       Tabla con orden por columna, filtros por valor y búsqueda (en el navegador)
  patient/            PatientHeader, AllergySection y PatientRecordTabs, que pide en paralelo
                      temperaturas, observaciones y consultas y arma los paneles:
                      TemperaturePanel, ObservationTablePanel (análisis / otras), EncounterPanel
lib/
  patient-search.ts   Filtros del buscador → parámetros FHIR (puro)
  table.ts            Ordenar y filtrar filas: vacíos al final, español sin acentos, orden estable (puro)
lib/fhir/
  url.ts              Validación de FHIR_BASE_URL y control "mismo servidor" (puro)
  client.ts           HTTP: timeout, errores tipados, OperationOutcome. Solo servidor
  mappers.ts          FHIR → modelos de pantalla, conservando "ResourceType/id"
  search.ts           searchAll: recorre todas las páginas; marca si quedó incompleta
  references.ts       Id FHIR válido; "¿esta referencia es de este paciente?"
  datetime.ts         Fechas FHIR (parciales o instantes), sin convertir zona
  temperature.ts      Temperaturas utilizables / excluidas con motivo (puro)
  allergy.ts          Alergias activas / requiere revisión / excluidas (puro)
  observation.ts      Observaciones de solo lectura: cualquier value[x] y componentes (puro)
  encounter.ts        Consultas de solo lectura: modalidad, tipo, motivo, estado (puro)
tests/                Vitest
```

Decisiones:

- **Solo servidor.** `lib/fhir/client.ts` importa `server-only`. El navegador nunca habla con el servidor FHIR.
- **Errores como datos.** El cliente devuelve `{ ok, data | error, request }` en lugar de lanzar excepciones. Así la pantalla muestra qué se pidió, qué estado HTTP volvió y el `OperationOutcome` si vino. Lee siempre el cuerpo como texto, porque un error puede no ser JSON. De un `OperationOutcome` usa `issue.diagnostics` o `details.text`, **nunca `text.div`** (es HTML).
- **Sin caché.** `fetch` con `cache: "no-store"`, y `connection()` para que nada se prerenderice en el build. No se guardan datos del servidor público, ni en `.next`.
- **Sin redirecciones.** `redirect: "manual"`: una respuesta 3xx se informa como error y no se sigue.
- **Paginación por links.** Se sigue `link[relation=next|previous]` tal como lo da el servidor, sin armar la URL. Antes se comprueba que tenga el mismo origen y esté bajo la ruta de `FHIR_BASE_URL`. Así se evita que el parámetro `?page=` sirva para que el servidor pida URLs arbitrarias (SSRF).
- **Diseño.** Tokens de DESIGN.md ("Fey", oscuro) en `app/globals.css` con Tailwind v4: negro mate `#0b0b0b`, cards `#191919` con halo negro, texto blanco y gris `#868f97`, controles en píldora fantasma. Tipografía: Lexend (texto e interfaz) y Geist (títulos: h1 y títulos de sección; DM Sans es la alternativa probada), cargadas con `next/font/google`: se descargan en el build y se sirven desde la app, sin pedidos a Google desde el navegador. Monoespaciada para JSON e ids. Color solo con significado: Ember (alergia activa, aviso), Signal (pestaña activa), Growth (consulta completa), rojo desaturado `#f2837a` (errores). Cada estado se indica también con texto o ícono. Los tokens tienen nombres semánticos (`page`, `paper`, `ink`, `mid-gray`…), así que cambiar de estilo es, sobre todo, cambiar sus valores.
- **Transiciones.** Aparición suave de cards y paneles de pestaña, visor JSON con fundido y escala, brillo en hover, línea de pestaña activa animada y barras de carga con barrido. Todo se desactiva con "reducir movimiento" del sistema.

## Reglas de la ficha (etapa 2)

**Temperatura utilizable** (LOINC 8310-5), si cumple todo esto:
- `status` es `final`, `amended` o `corrected`.
- `valueQuantity` es numérico y no tiene `comparator`.
- La unidad es UCUM `http://unitsofmeasure.org|Cel`.
- `effectiveDateTime` tiene **hora y zona**.
- `subject` es el paciente de la ficha.

Lo demás va a la tabla de excluidos con **todos** sus motivos. No se convierten unidades (°F queda excluida). Una fecha parcial (`1889-11-17`) se excluye porque no es un instante comparable.

**Alergias**
- *Activa*: `clinicalStatus` `active` y `verificationStatus` `confirmed`, ambos con los sistemas HL7 oficiales, con sustancia informada y del paciente.
- *Requiere revisión*: cualquier otro registro del paciente (`unconfirmed`, `refuted`, `inactive`, estado ausente o ambiguo, "sin alergias conocidas"). Se muestra con su motivo; no se oculta.
- *Excluida*: el `patient` no es este paciente.
- "Sin alergias conocidas" se detecta por SNOMED CT 716186003, 409137002, 429625007 o 428607008, o por texto (`no known`, `NKA`, `NKDA`, `sin alergias`).
- Si la consulta está completa y no hay registros: **"Sin información disponible"**, nunca "Sin alergias".

**Consultas incompletas**: si una página falla, el link `next` apunta a otro servidor o se pasan 20 páginas, la sección muestra "Requiere revisión" y no concluye nada sobre lo que falta.

**Pestañas, orden y filtros**
- *Análisis* = observaciones con categoría `laboratory`. *Otras observaciones* = el resto (signos vitales salvo temperatura, historia social, sin categoría…).
- Cada pestaña muestra su cantidad; "?" si la consulta falló sin traer nada y "!" si quedó incompleta.
- Las tablas de la ficha se ordenan por columna (clic en el encabezado; fechas y valores como números) y se filtran por valor (p. ej. modalidad Ambulatoria / Urgencia / Internación) o con texto libre. Es solo la vista: no cambia los datos ni las reglas de verificación.
- El listado de pacientes no se ordena por columna: el orden tendría que hacerlo el servidor (`_sort`), y en el HAPI público tarda 20–30 s.

**Rangos de referencia y evolución** ([lib/fhir/reference-range.ts](lib/fhir/reference-range.ts))
- El rango (`referenceRange`) y la marca alto/bajo (`interpretation`, códigos v3 `N`, `H`, `L`, `HH`, `LL`, `A`, `AA`) vienen del laboratorio, dentro de cada registro. **No hay tablas de valores normales en la app**: cada laboratorio define los suyos.
- Comparación propia solo con un rango numérico único y la misma unidad (código UCUM o el mismo texto). Varios rangos, rango solo texto, unidad distinta o valor con comparador: se muestra, no se compara.
- Si el laboratorio marca "Alto" pero el valor está dentro de su propio rango (pasa en el servidor público, p. ej. `Observation/888702`): **"Requiere revisión"**, con el motivo.
- Al tocar el nombre de un análisis se abre su evolución: gráfica de línea (mismo código LOINC a lo largo del tiempo), franja del rango más reciente, ▲/▼ para fuera de rango, línea vertical y tooltip con mouse o flechas del teclado, y la tabla con los mismos valores. No se convierten unidades: lo que no se puede graficar se lista con su motivo.
- Con **una sola medición** no hay línea (no hay evolución que mostrar): se ve el valor grande con su estado y una **barra de rango** que marca dónde cae respecto del rango del laboratorio ([components/SingleValue.tsx](components/SingleValue.tsx)).
- En el servidor público, muchos datos viejos no traen rango; entre los 500 análisis más recientes, el 56 % sí.

**Solo lectura (no verificado)**
- *Laboratorio y otras observaciones*: `GET /Observation?patient={id}`, sin la temperatura (ya tiene su sección). Se muestra cualquier `value[x]` y los `component` (p. ej. presión arterial) tal como vienen. **No se interpreta**: no hay alto/bajo ni rangos destacados.
- *Consultas*: `GET /Encounter?patient={id}`, con modalidad (`class`), tipo, motivo registrado (`reasonCode`, como texto, no como diagnóstico) y estado.
- Ambas filtran los registros de otro paciente y ordenan del más reciente al más antiguo. La IA no usa estos datos.

## Conceptos FHIR

- **`CapabilityStatement`** (`GET /metadata`): la ficha técnica del servidor: versión FHIR, software y recursos que soporta.
- **`Bundle` `searchset`**: el sobre de una búsqueda. `entry` puede faltar si no hay resultados. Cada entrada tiene `search.mode`: `match` (resultado), `include` (agregado por `_include`) u `outcome` (avisos).
- **Paginación**: el `Bundle` trae `link` con `relation` `self`, `next` y `previous`. HAPI apunta a la raíz (`baseR4?_getpages=<id>&_getpagesoffset=20`), no informa `total`, y sus cursores vencen (responde **410 Gone** con un `OperationOutcome`).
- **Referencia `ResourceType/id`**: cómo FHIR identifica un recurso (`Patient/nhanes-111640`). Se conserva en cada fila para rastrear el origen. Una referencia puede venir relativa (`Patient/x`), con versión (`Patient/x/_history/2`) o absoluta (`https://…/Patient/x`).
- **Fechas parciales**: `Patient.birthDate` o `effectiveDateTime` pueden ser `1990`, `1990-01` o `1990-01-01`. Solo con hora y zona son un instante.
- **Búsqueda por texto en `Patient`**: `name=pemb` busca nombres o apellidos que **empiezan** con el texto; con el modificador `name:contains=mber`, que lo **contienen**. HAPI ignora mayúsculas y acentos. `gender` filtra por sexo (`female`, `male`, `other`, `unknown`). Los parámetros se combinan con Y. El cursor de paginación recuerda la búsqueda, así que "Siguiente" no la repite.
- **Búsqueda por token** `code=http://loinc.org|8310-5`: tiene la forma `sistema|código`. El `|` viaja codificado (`%7C`).
- **`Observation`**: `status`, `code` (qué se midió), `subject` (de quién), `effective[x]` (cuándo) y `value[x]`. En `valueQuantity`, `unit` es para mostrar; `system` + `code` (UCUM) son para comparar.
- **`AllergyIntolerance`**: `clinicalStatus` (¿sigue vigente?) y `verificationStatus` (¿está confirmada?) son ejes distintos. `code` es la sustancia y `criticality` el riesgo potencial.
- **`Observation.category`**: agrupa observaciones (`laboratory`, `vital-signs`, …). **`component`**: una observación con varias partes, como la presión arterial (sistólica y diastólica).
- **`Encounter`**: una consulta o internación. `class` es la modalidad (AMB ambulatoria, EMER urgencia, IMP internación, VR virtual), `period` cuándo, `reasonCode` el motivo registrado.
- **Elementos `[x]`**: `effective[x]` puede venir como `effectiveDateTime`, `effectivePeriod`, etc. Aquí solo se acepta `effectiveDateTime`.

## Limitaciones

- El HAPI público es compartido y cambia: los pacientes pueden desaparecer y los cursores de paginación vencen. Si un cursor venció, la pantalla ofrece volver a la primera página.
- No se muestra "página X de N" porque el servidor no informa el total.
- Los registros `nhanes-*` del servidor público declaran mediciones reales de NHANES con identidad generada (no verificado). No se guardan ni se enviarán a la IA.
- Las pruebas usan `fetch` simulado. El funcionamiento contra el servidor real se comprobó a mano el 26/11/2026 (ver abajo).
- La ficha de un id inexistente muestra el 404 del paciente, pero las búsquedas de alergias y temperaturas igual se hacen (HAPI devuelve 200 vacío).
- Un id con formato inválido muestra "Página no encontrada", pero el estado HTTP es 200 porque la página ya empezó a transmitirse (streaming).
- No hay gráfica ni cards de verificación (etapa 3), HAPI local, verificador ni IA.

## Comprobar con Postman

Etapa 2:

```
GET https://hapi.fhir.org/baseR4/Observation?patient=35180&code=http%3A%2F%2Floinc.org%7C8310-5
GET https://hapi.fhir.org/baseR4/AllergyIntolerance?patient=31193
Accept: application/fhir+json
```

Compará con `/pacientes/35180` (una utilizable y dos excluidas por fecha parcial) y `/pacientes/31193` (dos activas, una `unconfirmed` en revisión).

Etapa 1:

```
GET https://hapi.fhir.org/baseR4/Patient?_count=20
Accept: application/fhir+json
```

Compará los ids de `entry[].resource` con la tabla, y `link[relation=next].url` con el destino del botón "Siguiente". Para el estado del servidor: `GET https://hapi.fhir.org/baseR4/metadata` → `fhirVersion`.
