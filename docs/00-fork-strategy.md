# Estrategia del Fork — Estruflow ERP

> Documento maestro que define **qué es este fork, qué no es, qué módulos conserva, cuáles elimina, cómo se relaciona con el upstream y cuáles son las reglas legales y técnicas para mantenerlo sano en el tiempo.**
>
> Este es el primer documento que cualquier agente IA y cualquier humano que toque el repo debe leer y entender. Si algo de un cambio propuesto contradice este documento, el cambio no se hace.

---

## 1. Identificación del proyecto

| Campo | Valor |
|---|---|
| Nombre comercial del producto | Estruflow ERP |
| Razón social (en constitución) | Estruflow S.A.P.I. de C.V. (México) |
| Propietario del fork | Jesús David Mora |
| Proyecto upstream | OpenConstructionERP (OCE) |
| Repo upstream | https://github.com/datadrivenconstruction/OpenConstructionERP |
| Autor upstream | Artem Boiko / DataDrivenConstruction (DDC) |
| Licencia upstream | AGPL-3.0-or-later |
| Licencia del fork | AGPL-3.0-or-later (heredada — obligatoria) |
| Versión upstream de partida | v2.4.0 (mayo 2026, commit `[completar al forkear]`) |
| Fecha de fork | [completar al forkear] |
| Visibilidad del repo | Público (cumplimiento §13 AGPL) |

---

## 2. Propósito del fork

Estruflow ERP es una adaptación del ERP open-source OpenConstructionERP al mercado mexicano de construcción, con foco en gestión de obra, control documental y reportería. **NO es un sistema de presupuestación** — esa parte del upstream fue removida porque no es parte del producto comercial.

El producto comercial Estruflow tiene dos componentes:

1. **Este fork público bajo AGPL-3.0** — el ERP base con gestión documental, comunicación de obra, planos, modelos BIM, schedule, procurement y reportería.
2. **Microservicios propietarios externos** (repos privados, licencia propietaria) — CFDI Engine, WhatsApp Bridge, AI Parser y Bitácora LOPSRM (v1.1+). Estos comunican con el fork solo vía HTTP REST.

Esta arquitectura híbrida cumple las obligaciones AGPL del fork sin contaminar la IP propietaria del producto comercial completo.

---

## 3. Estrategia legal

### 3.1 Cumplimiento AGPL-3.0 del fork

Como este repo es público:

- Se cumple automáticamente el §13 AGPL (oferta a usuarios de servicio en red de obtener el código fuente).
- Se conservan todos los avisos de copyright originales en `LICENSE`, `NOTICE` y headers de archivos.
- Se agrega copyright de Estruflow en archivos donde se hizo modificación sustancial, sin eliminar el original.
- El endpoint `/api/source` (heredado de OCE) responde con link al repo público.
- Cualquier modificación al fork queda automáticamente bajo AGPL-3.0.

### 3.2 Separación de microservicios propietarios

Los siguientes microservicios viven en repos privados separados con licencia comercial propietaria:

- `estruflow-cfdi-engine` — timbrado y recepción CFDI 4.0
- `estruflow-whatsapp-bridge` — webhook Meta Cloud API y gestión conversacional
- `estruflow-ai-parser` — parsing de mensajes/imágenes/audios con IA
- `estruflow-bitacora-lopsrm` — firma electrónica y bitácora oficial (v1.1+)

Para que estos microservicios NO sean considerados "obra derivada" del fork AGPL, se respetan las siguientes reglas:

- **Sin importación de código.** Ningún microservicio importa funciones, clases, modelos o módulos del fork. Comunicación únicamente vía HTTP REST con JSON sobre la red.
- **Sin BD compartida.** Cada microservicio tiene su propia base de datos. Si necesita datos del fork, los consulta vía API REST.
- **Sin tipos compartidos.** Los schemas Pydantic de un microservicio se definen independientemente, aunque dupliquen estructura del fork.
- **Autenticación entre servicios con JWT firmado** específico para comunicación servicio-a-servicio, separado de la auth de usuarios.

### 3.3 Marcas registradas

El fork **NO usa** las marcas comerciales:

- "OpenConstructionERP" (marca DDC)
- "OpenEstimate" (marca DDC histórica)
- "DataDrivenConstruction" / "DDC" (marca DDC)
- "CWICR" (cuando se use como branding, no como referencia técnica)
- Dominios `openconstructionerp.com`, `datadrivenconstruction.io`

Sí se conservan los avisos de **copyright** y **autoría técnica** en código, que son derechos separados de las marcas. Solo se reemplaza el branding visible al usuario final.

### 3.4 Auditoría de licencias mensual

El primer lunes de cada mes:

1. `grep -r "from app\." estruflow-cfdi-engine/` → debe ser 0 matches
2. `grep -r "from app\." estruflow-whatsapp-bridge/` → debe ser 0 matches
3. `grep -r "from app\." estruflow-ai-parser/` → debe ser 0 matches
4. Revisar `requirements.txt` y `package.json` de cada repo en busca de dependencias nuevas con licencia incompatible
5. Documentar en `docs/upstream-merges/audit-YYYY-MM.md`

---

## 4. Módulos eliminados del fork

Eliminados completamente del repo en la limpieza inicial (semanas 1-2 del roadmap). **No restaurar sin autorización explícita del owner.**

### 4.1 Backend — módulos eliminados (24)

| Módulo | Razón de eliminación | Endpoints removidos |
|---|---|---|
| `boq` | Presupuestación fuera de scope. Producto Estruflow no maneja Bill of Quantities. | 70 |
| `costs` | BD de costos para BOQ — fuera de scope. | 24 |
| `costmodel` | 5D Cost Model — fuera de scope. | 18 |
| `assemblies` | Recetas de costo — fuera de scope. | 16 |
| `catalog` | Catálogo de recursos para BOQ — fuera de scope. | 9 |
| `takeoff` | Cuantificación cuantitativa — fuera de scope. | 34 |
| `ai` | Estimación con IA — fuera de scope. (La IA del producto Estruflow vive en el microservicio externo `estruflow-ai-parser`.) | 10 |
| `validation` | Motor de validación de reglas DIN/NRM/MasterFormat — solo aplicaba a BOQ. | 7 |
| `bim_requirements` | Requerimientos IDS/COBie — más de fase de diseño que de obra. | 8 |
| `requirements` | EAC triplets — más de fase de diseño que de obra. | 19 |
| `tendering` | Licitaciones — fuera de scope. | 11 |
| `rfq_bidding` | RFQ a subcontratistas — fuera de scope. | 11 |
| `full_evm` | EVM avanzado (S-curves, TCPI) — diferido a v1.1, código eliminado. | 3 |
| `architecture_map` | Herramienta de desarrollo interno, no funcionalidad de producto. | 6 |
| `cad` | Pipeline de conversión CAD que solo alimentaba takeoff. | varios |
| `dach_pack` | Regional Alemania/Austria/Suiza — no aplica México. | 1 |
| `uk_pack` | Regional Reino Unido. | 1 |
| `us_pack` | Regional Estados Unidos. | 1 |
| `india_pack` | Regional India. | 1 |
| `russia_pack` | Regional Rusia. | 1 |
| `latam_pack` | Regional LatAm genérico — se reemplaza con `mx_pack` propio más específico. | 1 |
| `middle_east_pack` | Regional GCC. | 1 |
| `asia_pac_pack` | Regional Asia Pacífico. | 1 |
| `enterprise_workflows` | Aprobaciones complejas — diferido a v1.1. | 11 |

### 4.2 Frontend — módulos opcionales eliminados (30)

Todos los exchanges regionales (21): `gaeb-exchange`, `uk-nrm-exchange`, `us-masterformat-exchange`, `fr-dpgf-exchange`, `uae-boq-exchange`, `au-boq-exchange`, `ca-boq-exchange`, `nordic-ns3420-exchange`, `cz-boq-exchange`, `de-din276-exchange`, `cn-boq-exchange`, `in-boq-exchange`, `br-sinapi-exchange`, `es-pbc-exchange`, `ru-gesn-exchange`, `tr-birimfiyat-exchange`, `jp-sekisan-exchange`, `it-computo-exchange`, `nl-stabu-exchange`, `pl-knr-exchange`, `kr-boq-exchange`.

Más estos 9: `assemblies`, `validation`, `5d-cost-model`, `tendering`, `sustainability`, `cost-benchmark`, `pdf-takeoff`, `risk-analysis`, `architecture-map`.

### 4.3 Frontend — features fijas eliminadas (15)

`ai`, `assemblies`, `boq`, `catalog`, `costmodel`, `costs`, `quantities`, `reports` (duplicado de `reporting`), `requirements`, `sustainability`, `takeoff`, `tendering`, `validation`, `architecture`, `analytics`.

### 4.4 Idiomas eliminados (17)

`de`, `ru`, `zh`, `ar` (con RTL), `hi`, `tr`, `it`, `nl`, `pl`, `cs`, `ja`, `ko`, `sv`, `no`, `da`, `fi`, `bg`.

Soporte RTL también se removió porque árabe ya no está.

---

## 5. Módulos conservados

### 5.1 Conservados intactos (27 módulos backend)

Plataforma: `users`, `projects`, `teams`, `contacts`, `notifications`, `integrations`, `search`, `backup`, `i18n_foundation`.

Documental: `documents`, `cde`, `transmittals`, `submittals`, `correspondence`, `markups`, `opencde_api`.

Comunicación de obra: `rfi`, `ncr`, `punchlist`, `meetings`, `tasks`.

Ejecución y calidad: `fieldreports`, `inspections`, `safety`.

Visualización: `dwg_takeoff` (renombrar a `dwg_viewer`), `collaboration`.

Planeación: `risk`.

### 5.2 Conservados con refactor obligatorio (6 módulos)

Los siguientes módulos conservaban dependencia con `boq` en su manifest. Al eliminar `boq`, hay que limpiar esas referencias antes de que el módulo pueda funcionar.

| Módulo | Qué refactorizar |
|---|---|
| `bim_hub` | Eliminar endpoints de BOQ-BIM linking y quantity maps. Conservar visor 3D, gestión de modelos, elementos, propiedades, schemas, comentarios. Quitar `"oe_boq"` de `depends` en manifest. |
| `schedule` | Eliminar cost-loading de actividades desde BOQ. Las actividades pueden tener costo manual o vacío. Quitar `"oe_boq"` de `depends`. |
| `reporting` | Eliminar reportes específicos de BOQ. Conservar reportes generales (proyecto, fieldreports, RFI, etc.). Quitar `"oe_boq"` de `depends`. |
| `changeorders` | Cambiar impacto de "líneas de BOQ" a "monto global + horas + descripción de alcance". Quitar `"oe_boq"` de `depends`. |
| `procurement` | Limpiar referencias a líneas de BOQ en POs. Conservar PO directos por concepto manual. |
| `finance` | Limpiar vinculación con BOQ para budget tracking. Conservar budget tracking por concepto manual. |

### 5.3 Conservados pero deshabilitados (3 módulos diferidos a v1.1)

Estos módulos quedan en el código con `enabled=False` en su manifest. No se cargan en runtime, no aparecen en UI. Se reactivarán en v1.1 cuando el producto esté maduro.

| Módulo | Razón de diferimiento |
|---|---|
| `collaboration_locks` | Real-time collaboration con yjs — complejidad alta, no crítico para MVP. |
| `erp_chat` | Chat IA con tool-calling — requiere refactor (dependía de módulo `ai` eliminado). |
| `project_intelligence` | Scoring IA del proyecto — útil pero no crítico para MVP. |

---

## 6. Módulos nuevos agregados al fork

### 6.1 `mx_pack` (semana 5 del roadmap)

Reemplaza a los packs regionales eliminados con uno específico para México.

**Responsabilidades:**

- Configuración de moneda MXN como default
- IVA 16% configurable por tenant
- IEPS según concepto
- Retenciones automáticas (5 al millar construcción, ISR 1.25%, retención IVA 4%/6%)
- Calendario laboral mexicano (días festivos federales + posibilidad de agregar estatales)
- Catálogo de unidades de obra mexicanas (m³, m², m.l., kg, ton, jornal, pza, lote, viaje)
- Zona horaria America/Mexico_City por default
- Formato fecha dd/mm/yyyy, números con separador apropiado
- Plantillas de inspección NMX/NOM precargadas (NMX-C-155, NOM-001-SEDE, NOM-031-STPS, NMX-C-414)
- Categorías de personal mexicanas (oficial albañil, ayudante, fierrero, carpintero, soldador, plomero, electricista, encargado, maestro, residente, sobrestante)

**Tablas (todas con prefijo `ef_`):**

- `ef_mx_holidays` — días festivos por estado/tipo
- `ef_mx_work_categories` — categorías de personal
- `ef_mx_units` — unidades de obra
- `ef_mx_tax_config` — configuración fiscal por tenant
- `ef_mx_inspection_templates` — plantillas NMX/NOM

### 6.2 `tenants` (semana 3 del roadmap)

Multi-tenancy compartido — OCE no lo trae nativo. Cada constructora cliente es un tenant aislado lógicamente.

**Tablas:**

- `ef_tenants` — id, nombre, slug, status, plan, created_at, updated_at
- `ef_tenant_members` — relación many-to-many con users y rol por tenant
- `ef_tenant_settings` — configuración por tenant (subdominio, branding personalizado, locale override)

**Modificaciones a tablas existentes:**

Todas las tablas `oe_*` con datos de proyecto reciben columna `tenant_id` vía migración Alembic en 3 fases (agregar nullable → backfill → NOT NULL + índice + FK).

Tablas que NO reciben `tenant_id`: catálogos compartidos (unidades genéricas, países, currencies), auth de sistema (users, sessions), configuración global.

---

## 7. Convenciones de naming

### 7.1 Prefijos de tablas

| Prefijo | Origen | Ejemplos |
|---|---|---|
| `oe_` | Tablas heredadas del upstream OpenConstructionERP. Conservar prefijo. | `oe_projects`, `oe_documents`, `oe_rfis` |
| `ef_` | Tablas nuevas agregadas por Estruflow. | `ef_tenants`, `ef_mx_holidays`, `ef_tenant_members` |

Si modificas una tabla existente con `ALTER`, conserva su prefijo original.

Si renombras una tabla existente (rara vez justificado), documenta en la migración la razón y conserva alias temporal.

### 7.2 Naming de módulos

| Patrón | Uso | Ejemplo |
|---|---|---|
| `oe_<nombre>` | Módulos del upstream | `oe_projects`, `oe_documents` |
| `ef_<nombre>` | Módulos nuevos de Estruflow | `ef_mx_pack`, `ef_tenants` |

Carpetas siguen el mismo patrón: `backend/app/modules/mx_pack/` (sin prefijo en carpeta) pero el `manifest.name` interno usa `ef_mx_pack`.

### 7.3 API versioning

| Patrón | Uso |
|---|---|
| `/api/v1/...` | Endpoints v1 — estables |
| `/api/v2/...` | Endpoints v2 — cuando hay breaking change, conservar v1 hasta que consumidores migren |

Nunca eliminar v1 sin avisar 90 días antes a consumidores documentados.

---

## 8. Plan de cherry-picks del upstream

El upstream OpenConstructionERP sigue siendo mantenido por DDC. Sacan releases con bugfixes y features nuevos que pueden ser útiles para nuestro fork. **No hacer merge automático** — solo cherry-picks selectivos.

### 8.1 Cadencia recomendada

**Primer lunes de cada mes**, dedicar 2-3 horas a:

1. Revisar releases del upstream desde el último review (https://github.com/datadrivenconstruction/OpenConstructionERP/releases)
2. Generar diff entre nuestra base actual y el HEAD del upstream
3. Clasificar cambios en cuatro categorías:
   - **Bugfixes en módulos que conservamos** → cherry-pick directo
   - **Features nuevos en módulos que conservamos** → evaluar si los queremos
   - **Cambios en módulos que eliminamos** → ignorar
   - **Cambios en core/infraestructura (auth, db, hooks, etc.)** → evaluar caso por caso
4. Documentar el review en `docs/upstream-merges/YYYY-MM-review.md`
5. Aplicar cherry-picks aprobados con commit message claro: `chore: cherry-pick from upstream <commit> - <description>`

### 8.2 Qué NO traer del upstream

- Restauraciones de módulos que eliminamos (boq, costs, etc.)
- Nuevos exchanges regionales no-México
- Nuevos idiomas
- Cambios que reintroduzcan dependencias `oe_boq` en módulos que ya refactorizamos
- Cambios que afecten al sistema multi-tenant (somos custom aquí)

### 8.3 Cómo manejar conflictos de merge

Si un archivo del upstream que queremos cherry-pick fue modificado por nosotros y hay conflicto:

1. Resolver manualmente respetando nuestras modificaciones (multi-tenancy, mx_pack, refactor sin boq)
2. Documentar la decisión en el commit message
3. Correr todos los tests antes de aceptar el cherry-pick

---

## 9. Reglas de no-contaminación con microservicios propietarios

Esta sección es crítica para que la IP propietaria de Estruflow se mantenga separada del fork AGPL.

### 9.1 Lo que NUNCA debe pasar

- Importar módulos del fork desde un microservicio propietario: `from app.modules.users import ...`  ❌
- Copiar bloques de código del fork al microservicio  ❌
- Compartir tablas de BD entre fork y microservicios  ❌
- Compartir secretos de aplicación entre repos  ❌
- Que el frontend del fork incluya bundled código de un microservicio propietario  ❌

### 9.2 Lo que SÍ se hace

- Microservicios consumen API REST pública del fork  ✅
- Fork consume API REST de microservicios cuando los necesita (con timeouts y fallbacks)  ✅
- Schemas de datos se duplican en cada repo independientemente (mismo concepto, distinta implementación)  ✅
- JWT de servicio firmado para autenticación entre repos  ✅
- Cada repo tiene su propia base de datos y migraciones  ✅

### 9.3 Auditoría automática

Configurar GitHub Action en cada microservicio que falla el CI si detecta:

```bash
grep -rE "(from app\.|import app\.)" --include="*.py" .
```

Output esperado: vacío. Si aparece algo, el PR no puede mergearse.

---

## 10. Histórico del fork

### 10.1 Hitos del fork

| Fecha | Evento |
|---|---|
| Mayo 2026 | Fork inicial desde OCE v2.4.0 |
| Mayo 2026 (S1) | Rebrand sistemático completado |
| Mayo 2026 (S2) | Limpieza de módulos eliminados completada |
| Junio 2026 (S3-4) | Multi-tenancy implementado |
| Junio 2026 (S5-6) | mx_pack agregado |
| ... | (actualizar conforme avanza el roadmap) |

### 10.2 Versión actual

| Componente | Versión |
|---|---|
| Fork Estruflow | v0.1.0 (pre-release, en construcción) |
| Upstream OCE base | v2.4.0 |
| Próxima release planeada | v0.1.0-alpha (cierre fase A — agosto 2026) |

---

## 11. Cómo proponer un cambio a esta estrategia

Si un agente IA o un humano considera que algún punto de este documento debería cambiar:

1. **No hagas el cambio todavía.** Documenta la propuesta.
2. Crea un issue o nota en el repo de docs con título `PROPUESTA: <descripción del cambio>`.
3. Incluye: motivación, alternativas consideradas, impacto técnico, impacto legal.
4. Espera revisión y aprobación del owner.
5. Si se aprueba, actualiza este documento ANTES de implementar el cambio en código.

---

## 12. Referencias externas

- **Licencia AGPL-3.0 oficial:** https://www.gnu.org/licenses/agpl-3.0.html
- **FAQ AGPL en español:** https://www.gnu.org/licenses/agpl-3.0.es.html
- **OpenConstructionERP upstream:** https://github.com/datadrivenconstruction/OpenConstructionERP
- **Análisis arquitectónico del repo (memoria interna Estruflow):** ver `Plan_Implementacion_Estruflow_ERP.md` en docs internos.

---

**Versión del documento:** 1.0
**Última actualización:** Mayo 2026
**Próxima revisión obligatoria:** al cierre de cada fase del roadmap (S4, S8, S12, S16, S20, S24).
**Owner del documento:** Jesús David Mora
