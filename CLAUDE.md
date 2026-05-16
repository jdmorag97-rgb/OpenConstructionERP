# CLAUDE.md

> Este archivo lo cargan automáticamente Claude Code, Codex y Antigravity al iniciar cada sesión. Es la primera referencia que cualquier agente debe consultar antes de hacer cualquier cambio. Si dudas, pregunta antes de implementar.

---

## Proyecto

**Nombre comercial:** Estruflow ERP
**Razón social:** [pendiente de constitución — Estruflow S.A.P.I. de C.V.]
**Tipo de proyecto:** Fork de OpenConstructionERP (AGPL-3.0)
**Versión upstream de partida:** OpenConstructionERP v2.4.0 (mayo 2026)
**Propósito:** SaaS multi-tenant de gestión de obra, control documental y comunicación para constructoras mexicanas. **NO maneja presupuestación de obra** — esa funcionalidad fue eliminada del fork porque está fuera de scope.
**Mercado objetivo:** PyME constructora mexicana (30-150 empleados, 3-12 obras simultáneas), vertical primario vivienda media/media-alta en CDMX y zona metropolitana.
**Licencia heredada:** AGPL-3.0 (este repo es público).

---

## Reglas inviolables

Estas reglas no son sugerencias. Si una tarea requiere romper alguna, **detente y pregunta al humano antes de continuar**.

1. **Convención modular intacta.** Respeta la estructura modular de OpenConstructionERP en `backend/app/modules/<nombre>/` con sus archivos estándar (`manifest.py`, `router.py`, `service.py`, `repository.py`, `schemas.py`, `models.py`, `permissions.py`). No inventes patrones nuevos.

2. **Idiomas soportados: solo es-MX (default), en, pt-BR, fr.** Los otros 17 idiomas del upstream fueron eliminados. No restaurarlos ni agregar idiomas nuevos sin autorización.

3. **Prefijo de tablas nuevas: `ef_` (no `oe_`).** Las tablas que vienen del upstream conservan su prefijo `oe_`. Las tablas que YO agregue al fork llevan prefijo `ef_` para distinguir mis adiciones. Excepción: si modifico una tabla existente con `ALTER`, conserva su prefijo original.

4. **Cero importaciones desde microservicios propietarios.** Los microservicios `estruflow-cfdi-engine`, `estruflow-whatsapp-bridge`, `estruflow-ai-parser` y `estruflow-bitacora-lopsrm` (v1.1+) viven en repos separados con licencia propietaria. Este fork público AGPL **NO importa código de ellos**. Comunicación únicamente vía HTTP REST con autenticación JWT de servicio.

5. **Preservar avisos de copyright AGPL.** Los archivos `LICENSE`, `NOTICE`, y los headers de archivos con copyright de Artem Boiko / DataDrivenConstruction **se conservan intactos**. Solo se agrega mi copyright en archivos que modifico sustancialmente, sin eliminar el original.

6. **Dependencias nuevas: solo MIT, Apache 2.0, BSD o ISC.** Antes de agregar una dependencia, verifica su licencia. Nunca usar dependencias GPL, AGPL, LGPL, SSPL o CC-BY-SA — contaminarían el fork.

7. **Multi-tenancy obligatorio.** Toda tabla con datos de proyecto tiene columna `tenant_id`. Toda query con esos datos filtra por `tenant_id` del request actual. Si una migración crea una tabla sin `tenant_id`, justifícalo explícitamente.

8. **No reintroducir módulos eliminados.** La lista de módulos eliminados en `docs/00-fork-strategy.md` es vinculante. Si un agente quiere "restaurar" un módulo eliminado (porque ve referencias en commits antiguos), detente y pregunta.

9. **Auditorías de licencia mensuales.** El primer lunes de cada mes, grep buscando imports cruzados entre fork y microservicios. Cero matches debe ser el resultado.

10. **Pregunta antes de implementar.** Si la tarea es ambigua, si requiere decisión técnica importante, o si introduces conceptos nuevos al codebase, **propón el plan primero y espera aprobación**. No avances sobre suposiciones.

---

## Estructura del repositorio

```
estruflow-erp/
├── CLAUDE.md                        # Este archivo
├── README.md                        # Rebrandeado a Estruflow
├── LICENSE                          # AGPL-3.0 (preservado)
├── NOTICE                           # Atribuciones DDC + agregar Estruflow
├── Makefile
├── docker-compose.yml
├── docs/
│   ├── 00-fork-strategy.md          # Estrategia del fork (LEER PRIMERO)
│   ├── 01-mexico-locale.md          # Decisiones México
│   ├── 02-removed-modules.md        # Lista de módulos eliminados
│   ├── 03-api-contracts-exposed.md  # APIs que expongo a microservicios
│   ├── 04-rebrand-inventory.md      # Inventario de strings rebrandeadas
│   └── upstream-merges/             # Bitácora de cherry-picks del upstream
├── backend/
│   ├── app/
│   │   ├── modules/                 # Módulos backend (auto-discovered)
│   │   ├── core/                    # Auth, events, hooks, RBAC, etc.
│   │   └── ...
│   ├── alembic/versions/            # Migraciones
│   └── tests/
├── frontend/
│   ├── src/
│   │   ├── modules/                 # Módulos opcionales (registry)
│   │   ├── features/                # Features fijas
│   │   ├── app/                     # i18n, routing, layout
│   │   └── shared/
│   └── public/locales/              # JSON de idiomas (solo es, en, pt, fr)
└── deploy/                          # Dockerfiles, docker-compose
```

---

## Comandos útiles

```bash
make dev              # Levanta backend (8000) + frontend (5173)
make test             # Corre tests backend + frontend
make test-backend     # Solo tests backend
make test-frontend    # Solo tests frontend
make migrate          # Aplica migraciones Alembic
make migrate-new MSG="add ef_tenants table"   # Nueva migración
make lint             # Ruff (backend) + ESLint (frontend)
make format           # Auto-format con ruff + prettier
make typecheck        # mypy backend + tsc frontend
```

**Para desarrollo local:** usa SQLite (default) — cero config.
**Para staging/producción:** PostgreSQL 16 — variable `DATABASE_URL`.

---

## Idiomas

Solo 4 idiomas en `frontend/src/app/i18n.ts`:

| Código | Nombre | Notas |
|---|---|---|
| `es` | Español (es-MX) | Default. Formatos México (dd/mm/yyyy, $X,XXX.XX MXN) |
| `en` | English | Para clientes internacionales o demos |
| `pt` | Português (pt-BR) | Expansión futura Brasil |
| `fr` | Français | Cualquier cliente francófono |

**Eliminados:** de, ru, zh, ar (RTL), hi, tr, it, nl, pl, cs, ja, ko, sv, no, da, fi, bg. NO restaurarlos.

---

## Cómo trabajar conmigo (el humano)

- **No sé programar.** Cuando me expliques un concepto técnico, hazlo en lenguaje claro. Si introduces términos nuevos, defínelos.
- **Plan antes de código siempre.** No empieces a modificar archivos sin haberme mostrado primero qué vas a hacer.
- **Pasos chiquitos.** Después de cada cambio significativo, corre tests, muéstrame qué cambió, espera mi visto bueno.
- **Verificación visual.** Cuando termines algo demoable, dame los pasos exactos (clicks) para probarlo en el navegador. Yo hago las pruebas.
- **Errores con honestidad.** Si algo se rompe, dime qué se rompió, las 3 causas más probables, y cómo verificar cada una. No me digas "ya lo arreglé" sin que yo confirme.
- **Conversaciones limpias.** Si una sesión se enredó, dímelo y abrimos una nueva con contexto fresco.

---

## Documentación relacionada

Antes de cualquier sesión, lee también según corresponda a la tarea:

- **`docs/00-fork-strategy.md`** — historia del fork, módulos in/out, plan de cherry-picks, reglas de no-contaminación. **LEER SIEMPRE EN PRIMERA SESIÓN.**
- **`docs/01-mexico-locale.md`** — decisiones de México (moneda, IVA, retenciones, calendarios, plantillas NMX/NOM).
- **`docs/02-removed-modules.md`** — lista completa de módulos eliminados con razón. Útil cuando ves referencias huérfanas en commits antiguos.
- **`docs/03-api-contracts-exposed.md`** — endpoints REST que este fork expone a los microservicios propietarios externos.
- **`docs/04-rebrand-inventory.md`** — inventario de strings a reemplazar en el rebrand inicial.

---

## Información que NO debes asumir

Si necesitas alguno de estos datos para una tarea, pregúntame:

- Mi razón social legal final (sociedad aún en constitución).
- Mi número de WhatsApp Business definitivo.
- Credenciales reales de PAC Facturama (solo sandbox por ahora).
- Subdominios definitivos de cada servicio.
- Decisiones de UI/UX que no estén en wireframes o docs explícitos.
- Pricing comercial — todavía sin validar contra clientes reales.

---

## Contacto del owner

**Jesús David Mora**
Email: jesusmora@estruflow.com
LinkedIn: https://www.linkedin.com/in/jesus-david-mora-garces
Ubicación: Ciudad de México

---

**Versión del documento:** 1.0
**Última actualización:** Mayo 2026
**Próxima revisión:** al final de cada fase del roadmap
