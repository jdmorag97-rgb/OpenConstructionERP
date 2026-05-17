"""ERP Chat tool definitions and handlers.

Each tool maps to a real ERP service call. Handlers return a dict with:
    renderer  — frontend component hint (e.g. "projects_grid", "boq_table")
    data      — structured payload for the renderer
    summary   — one-line human-readable summary for the AI

SECURITY: all project-scoped tools MUST call ``_require_project_access``
before touching data, otherwise any user could pass an arbitrary project_id
to enumerate data they don't own. Tool arguments are also validated via
``_parse_uuid`` and ``_parse_str`` helpers so malformed AI output produces
a clean error response instead of crashing the stream.
"""

import logging
import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


# ── Shared authorization + validation helpers ───────────────────────────────


class ToolAuthError(Exception):
    """Raised when a tool handler fails authorization or input validation."""


def _parse_uuid(raw: Any, field_name: str = "id") -> uuid.UUID:
    """Parse a UUID from tool arguments, raising ToolAuthError on failure."""
    if raw is None or raw == "":
        raise ToolAuthError(f"Missing required field '{field_name}'")
    try:
        return uuid.UUID(str(raw))
    except (ValueError, TypeError, AttributeError):
        raise ToolAuthError(f"Invalid UUID for '{field_name}': {raw!r}")


def _parse_str(
    raw: Any,
    field_name: str = "field",
    *,
    required: bool = False,
    max_length: int = 500,
) -> str | None:
    """Parse + sanitize a string arg. Truncates to max_length, rejects types."""
    if raw is None or raw == "":
        if required:
            raise ToolAuthError(f"Missing required field '{field_name}'")
        return None
    if not isinstance(raw, (str, int, float)):
        raise ToolAuthError(f"Invalid type for '{field_name}': expected string")
    s = str(raw).strip()
    if len(s) > max_length:
        s = s[:max_length]
    return s


async def _require_project_access(
    session: AsyncSession,
    project_id: uuid.UUID,
    user_id: str,
) -> None:
    """Verify the user owns or is an admin on the referenced project.

    Raises ToolAuthError if the project doesn't exist or the user has no
    access. Central choke-point for tool authorization — every project-scoped
    tool must call this before querying data.
    """
    try:
        from app.modules.projects.repository import ProjectRepository
        from app.modules.users.repository import UserRepository

        proj_repo = ProjectRepository(session)
        project = await proj_repo.get_by_id(project_id)
        if project is None:
            raise ToolAuthError(f"Project {project_id} not found")

        # Admin bypass
        try:
            user_repo = UserRepository(session)
            user = await user_repo.get_by_id(user_id)
            if user and getattr(user, "role", "") == "admin":
                return
        except Exception:
            pass

        if str(project.owner_id) != str(user_id):
            raise ToolAuthError(
                f"Access denied: you do not own project {project_id}"
            )
    except ToolAuthError:
        raise
    except Exception as exc:
        logger.warning("Project access check failed for %s: %s", project_id, exc)
        raise ToolAuthError(f"Authorization check failed: {exc}")


def _auth_error(msg: str) -> dict[str, Any]:
    """Build a standard error result for tool handlers."""
    return {
        "renderer": "error",
        "data": {"error": msg},
        "summary": f"Error: {msg}",
    }

# ── Tool definitions (Anthropic function-calling format) ─────────────────────

TOOL_DEFINITIONS: list[dict[str, Any]] = [
    {
        "name": "get_all_projects",
        "description": "List all projects with their names, codes, status, and basic info.",
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
    {
        "name": "get_project_summary",
        "description": "Get detailed summary for a single project including budget, schedule dates, status, and contract value.",
        "input_schema": {
            "type": "object",
            "properties": {
                "project_id": {
                    "type": "string",
                    "description": "UUID of the project",
                },
            },
            "required": ["project_id"],
        },
    },
    {
        "name": "get_boq_items",
        "description": "Get Bill of Quantities items/positions for a project. Returns position descriptions, quantities, unit rates, totals.",
        "input_schema": {
            "type": "object",
            "properties": {
                "project_id": {
                    "type": "string",
                    "description": "UUID of the project",
                },
            },
            "required": ["project_id"],
        },
    },
    {
        "name": "get_schedule",
        "description": "Get schedule/Gantt data for a project including activities, durations, dependencies, and progress.",
        "input_schema": {
            "type": "object",
            "properties": {
                "project_id": {
                    "type": "string",
                    "description": "UUID of the project",
                },
            },
            "required": ["project_id"],
        },
    },
    {
        "name": "get_validation_results",
        "description": "Get validation reports for a project — compliance scores, passed/warning/error rule results.",
        "input_schema": {
            "type": "object",
            "properties": {
                "project_id": {
                    "type": "string",
                    "description": "UUID of the project",
                },
            },
            "required": ["project_id"],
        },
    },
    {
        "name": "get_risk_register",
        "description": "Get risk register for a project — risk items with probability, impact, score, mitigation, and summary stats.",
        "input_schema": {
            "type": "object",
            "properties": {
                "project_id": {
                    "type": "string",
                    "description": "UUID of the project",
                },
            },
            "required": ["project_id"],
        },
    },
    {
        "name": "search_cwicr_database",
        "description": "Search the CWICR construction cost database (55,000+ items) by keyword. Returns matching cost items with codes, descriptions, units, and rates.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Search query (e.g. 'concrete wall', 'rebar', 'excavation')",
                },
                "region": {
                    "type": "string",
                    "description": "Optional region filter (e.g. 'DE_BERLIN', 'UK_LONDON')",
                },
            },
            "required": ["query"],
        },
    },
    {
        "name": "get_cost_model",
        "description": "Get cost model/summary for a project — direct cost, markups, grand total from the first BOQ.",
        "input_schema": {
            "type": "object",
            "properties": {
                "project_id": {
                    "type": "string",
                    "description": "UUID of the project",
                },
            },
            "required": ["project_id"],
        },
    },
    {
        "name": "compare_projects",
        "description": "Compare key metrics (budget, contract value, status, risk exposure) across multiple projects.",
        "input_schema": {
            "type": "object",
            "properties": {
                "project_ids": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of project UUIDs to compare",
                },
            },
            "required": ["project_ids"],
        },
    },
    {
        "name": "run_validation",
        "description": "Trigger a validation run for a project and return the results.",
        "input_schema": {
            "type": "object",
            "properties": {
                "project_id": {
                    "type": "string",
                    "description": "UUID of the project",
                },
            },
            "required": ["project_id"],
        },
    },
    {
        "name": "create_boq_item",
        "description": "Create a new BOQ position in a project's first BOQ. Returns the created item.",
        "input_schema": {
            "type": "object",
            "properties": {
                "project_id": {
                    "type": "string",
                    "description": "UUID of the project",
                },
                "description": {
                    "type": "string",
                    "description": "Position description (e.g. 'Reinforced concrete wall C30/37')",
                },
                "unit": {
                    "type": "string",
                    "description": "Unit of measurement (m, m2, m3, kg, pcs, lsum)",
                },
                "quantity": {
                    "type": "number",
                    "description": "Quantity value",
                },
                "unit_rate": {
                    "type": "number",
                    "description": "Price per unit",
                },
            },
            "required": ["project_id", "description", "unit", "quantity", "unit_rate"],
        },
    },
    # ── Semantic memory tools (vector-backed) ─────────────────────────────
    #
    # These tools let the AI query the cross-module vector store via the
    # unified semantic search layer (``app.modules.search.service``).  Each
    # tool returns a structured list of hits the AI can quote / reason
    # about, and the chat panel renders them as compact result cards.
    {
        "name": "search_boq_positions",
        "description": (
            "Semantic search across BOQ positions — finds positions by meaning, "
            "not exact match.  Use for queries like 'concrete walls 240mm', "
            "'reinforcement Ø12 in slabs', 'waterproofing membrane'.  Optionally "
            "scope to a single project."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Free-text search query"},
                "project_id": {"type": "string", "description": "Optional project UUID filter"},
                "limit": {"type": "integer", "description": "Max hits (1..20)", "default": 10},
            },
            "required": ["query"],
        },
    },
    {
        "name": "search_documents",
        "description": (
            "Semantic search across project documents (drawings, specs, RFIs, "
            "submittals).  Use for queries like 'foundation rebar layout', "
            "'fire rating spec for partition walls', 'RFI about delivery delay'."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Free-text search query"},
                "project_id": {"type": "string", "description": "Optional project UUID filter"},
                "limit": {"type": "integer", "description": "Max hits (1..20)", "default": 10},
            },
            "required": ["query"],
        },
    },
    {
        "name": "search_tasks",
        "description": (
            "Semantic search across project tasks / issues / defects.  Use for "
            "queries like 'water leak in basement', 'incomplete fire stopping', "
            "'open punch list items about doors'."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Free-text search query"},
                "project_id": {"type": "string", "description": "Optional project UUID filter"},
                "limit": {"type": "integer", "description": "Max hits (1..20)", "default": 10},
            },
            "required": ["query"],
        },
    },
    {
        "name": "search_risks",
        "description": (
            "Semantic search across the risk register — including mitigation "
            "strategies and contingency plans.  KEY USE CASE: lessons-learned "
            "reuse across projects.  Query examples: 'soil instability south "
            "retaining wall', 'supplier bankruptcy concrete delivery'."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Free-text search query"},
                "project_id": {
                    "type": "string",
                    "description": (
                        "Optional project UUID filter.  Omit to search ACROSS all "
                        "projects — usually what you want for lessons learned."
                    ),
                },
                "limit": {"type": "integer", "description": "Max hits (1..20)", "default": 10},
            },
            "required": ["query"],
        },
    },
    {
        "name": "search_bim_elements",
        "description": (
            "Semantic search across BIM elements (Walls, Columns, Doors, MEP "
            "fixtures, …) by name, type, category, discipline, storey and "
            "material.  Use for 'load-bearing concrete walls on level 02', "
            "'exterior glazing units', 'fire-rated doors in stair core'."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Free-text search query"},
                "project_id": {"type": "string", "description": "Optional project UUID filter"},
                "limit": {"type": "integer", "description": "Max hits (1..20)", "default": 10},
            },
            "required": ["query"],
        },
    },
    {
        "name": "search_anything",
        "description": (
            "Cross-collection semantic search — fans out to BOQ, documents, "
            "tasks, risks and BIM elements at once and merges the results.  "
            "Use this when the user asks an open-ended question and you don't "
            "know which module the answer lives in (e.g. 'tell me everything "
            "about the basement waterproofing scope')."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Free-text search query"},
                "project_id": {"type": "string", "description": "Optional project UUID filter"},
                "types": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": (
                        "Optional whitelist of module short names: 'boq', "
                        "'documents', 'tasks', 'risks', 'bim'.  Omit to search "
                        "all collections."
                    ),
                },
                "limit": {"type": "integer", "description": "Max final hits (1..50)", "default": 20},
            },
            "required": ["query"],
        },
    },
]


# ── Tool handlers ────────────────────────────────────────────────────────────


async def handle_get_all_projects(
    session: AsyncSession, args: dict[str, Any], user_id: str
) -> dict[str, Any]:
    """List all projects visible to the current user."""
    try:
        from app.config import get_settings
        from app.modules.projects.service import ProjectService

        svc = ProjectService(session, get_settings())
        projects, total = await svc.list_projects(
            owner_id=None, is_admin=True, limit=50  # type: ignore[arg-type]
        )
        return {
            "renderer": "projects_grid",
            "data": {
                "projects": [
                    {
                        "id": str(p.id),
                        "name": p.name,
                        "code": getattr(p, "project_code", ""),
                        "status": p.status,
                        "region": getattr(p, "region", ""),
                        "currency": getattr(p, "currency", "EUR"),
                        "contract_value": float(getattr(p, "contract_value", 0) or 0),
                    }
                    for p in projects
                ],
                "total": total,
            },
            "summary": f"{total} projects found",
        }
    except Exception as exc:
        logger.exception("handle_get_all_projects failed")
        return {"renderer": "error", "data": {"error": str(exc)}, "summary": f"Error: {exc}"}


async def handle_get_project_summary(
    session: AsyncSession, args: dict[str, Any], user_id: str
) -> dict[str, Any]:
    """Get detailed summary for a single project."""
    try:
        pid = _parse_uuid(args.get("project_id"), "project_id")
        await _require_project_access(session, pid, user_id)
    except ToolAuthError as exc:
        return _auth_error(str(exc))
    try:
        from app.config import get_settings
        from app.modules.projects.service import ProjectService

        svc = ProjectService(session, get_settings())
        p = await svc.get_project(pid)
        return {
            "renderer": "project_summary",
            "data": {
                "id": str(p.id),
                "name": p.name,
                "code": getattr(p, "project_code", ""),
                "status": p.status,
                "region": getattr(p, "region", ""),
                "currency": getattr(p, "currency", "EUR"),
                "contract_value": float(getattr(p, "contract_value", 0) or 0),
                "budget_estimate": float(getattr(p, "budget_estimate", 0) or 0),
                "phase": getattr(p, "phase", ""),
                "project_type": getattr(p, "project_type", ""),
                "planned_start_date": str(getattr(p, "planned_start_date", "") or ""),
                "planned_end_date": str(getattr(p, "planned_end_date", "") or ""),
                "actual_start_date": str(getattr(p, "actual_start_date", "") or ""),
                "actual_end_date": str(getattr(p, "actual_end_date", "") or ""),
                "description": getattr(p, "description", "") or "",
            },
            "summary": f"Project '{p.name}' ({p.status})",
        }
    except Exception as exc:
        logger.exception("handle_get_project_summary failed")
        return {"renderer": "error", "data": {"error": str(exc)}, "summary": f"Error: {exc}"}


async def handle_get_boq_items(
    session: AsyncSession, args: dict[str, Any], user_id: str
) -> dict[str, Any]:
    """BOQ module removed — not available in Estruflow ERP."""
    return {
        "renderer": "error",
        "data": {"error": "BOQ module not available"},
        "summary": "BOQ module removed (pre-Ola 3)",
    }


async def handle_get_schedule(
    session: AsyncSession, args: dict[str, Any], user_id: str
) -> dict[str, Any]:
    """Get schedule/Gantt data for a project."""
    try:
        from app.modules.schedule.service import ScheduleService

        try:
            pid = _parse_uuid(args.get("project_id"), "project_id")
            await _require_project_access(session, pid, user_id)
        except ToolAuthError as _te:
            return _auth_error(str(_te))
        svc = ScheduleService(session)
        schedules, total = await svc.list_schedules_for_project(pid, limit=5)
        if not schedules:
            return {
                "renderer": "schedule_gantt",
                "data": {"activities": []},
                "summary": "No schedules found for this project",
            }

        schedule = schedules[0]
        gantt = await svc.get_gantt_data(schedule.id)

        activities = []
        for act in gantt.activities:
            activities.append({
                "id": str(act.id),
                "name": act.name,
                "wbs_code": getattr(act, "wbs_code", ""),
                "start_date": str(act.start_date) if act.start_date else "",
                "end_date": str(act.end_date) if act.end_date else "",
                "duration_days": act.duration_days,
                "progress": act.progress,
                "status": getattr(act, "status", ""),
                "is_critical": getattr(act, "is_critical", False),
            })

        summary_data = gantt.summary
        return {
            "renderer": "schedule_gantt",
            "data": {
                "schedule_id": str(schedule.id),
                "schedule_name": schedule.name,
                "activities": activities,
                "summary": {
                    "total_activities": getattr(summary_data, "total_activities", len(activities)),
                    "completed": getattr(summary_data, "completed", 0),
                    "in_progress": getattr(summary_data, "in_progress", 0),
                    "overall_progress": getattr(summary_data, "overall_progress", 0),
                },
            },
            "summary": (
                f"Schedule '{schedule.name}': {len(activities)} activities"
            ),
        }
    except Exception as exc:
        logger.exception("handle_get_schedule failed")
        return {"renderer": "error", "data": {"error": str(exc)}, "summary": f"Error: {exc}"}


async def handle_get_validation_results(
    session: AsyncSession, args: dict[str, Any], user_id: str
) -> dict[str, Any]:
    """Validation module removed — not available in Estruflow ERP."""
    return {
        "renderer": "error",
        "data": {"error": "Validation module not available"},
        "summary": "Validation module removed (pre-Ola 2)",
    }


async def handle_get_risk_register(
    session: AsyncSession, args: dict[str, Any], user_id: str
) -> dict[str, Any]:
    """Get risk register with summary for a project."""
    try:
        from app.modules.risk.service import RiskService

        try:
            pid = _parse_uuid(args.get("project_id"), "project_id")
            await _require_project_access(session, pid, user_id)
        except ToolAuthError as _te:
            return _auth_error(str(_te))
        svc = RiskService(session)
        risks, total = await svc.list_risks(pid, limit=50)
        summary_data = await svc.get_summary(pid)

        risk_list = []
        for r in risks:
            risk_list.append({
                "id": str(r.id),
                "code": r.code,
                "title": r.title,
                "category": r.category,
                "probability": float(r.probability) if r.probability else 0,
                "impact_severity": r.impact_severity,
                "risk_score": float(r.risk_score) if r.risk_score else 0,
                "risk_tier": getattr(r, "risk_tier", ""),
                "status": r.status,
                "mitigation_strategy": r.mitigation_strategy or "",
                "owner_name": getattr(r, "owner_name", ""),
            })

        return {
            "renderer": "risk_register",
            "data": {
                "risks": risk_list,
                "total": total,
                "summary": summary_data,
            },
            "summary": f"{total} risks found",
        }
    except Exception as exc:
        logger.exception("handle_get_risk_register failed")
        return {"renderer": "error", "data": {"error": str(exc)}, "summary": f"Error: {exc}"}


async def handle_search_cwicr_database(
    session: AsyncSession, args: dict[str, Any], user_id: str
) -> dict[str, Any]:
    """Cost database module removed — not available in Estruflow ERP."""
    return {
        "renderer": "error",
        "data": {"error": "Cost database module not available"},
        "summary": "Costs module removed (pre-Ola 3)",
    }


async def handle_get_cost_model(
    session: AsyncSession, args: dict[str, Any], user_id: str
) -> dict[str, Any]:
    """BOQ/cost model removed — not available in Estruflow ERP."""
    return {
        "renderer": "error",
        "data": {"error": "BOQ/cost model module not available"},
        "summary": "BOQ module removed (pre-Ola 3)",
    }


async def handle_compare_projects(
    session: AsyncSession, args: dict[str, Any], user_id: str
) -> dict[str, Any]:
    """Compare key metrics across multiple projects."""
    try:
        from app.config import get_settings
        from app.modules.projects.service import ProjectService

        raw_ids = args.get("project_ids") or []
        if not isinstance(raw_ids, list) or not raw_ids:
            return _auth_error("project_ids must be a non-empty list")
        if len(raw_ids) > 20:
            return _auth_error("Cannot compare more than 20 projects at once")

        # Parse + authorize every ID before doing any work
        project_ids: list[uuid.UUID] = []
        for raw in raw_ids:
            try:
                pid = _parse_uuid(raw, "project_id")
                await _require_project_access(session, pid, user_id)
                project_ids.append(pid)
            except ToolAuthError as _te:
                # Skip IDs the user can't access; do not expose the reason
                logger.info("compare_projects: skipping %r (%s)", raw, _te)

        if not project_ids:
            return _auth_error("No accessible projects found in project_ids")

        svc = ProjectService(session, get_settings())
        comparisons = []
        for pid in project_ids:
            try:
                p = await svc.get_project(pid)
                comparisons.append({
                    "id": str(p.id),
                    "name": p.name,
                    "code": getattr(p, "project_code", ""),
                    "status": p.status,
                    "contract_value": float(getattr(p, "contract_value", 0) or 0),
                    "budget_estimate": float(getattr(p, "budget_estimate", 0) or 0),
                    "region": getattr(p, "region", ""),
                    "currency": getattr(p, "currency", "EUR"),
                })
            except Exception:
                comparisons.append({"id": str(pid), "error": "Project not found"})

        return {
            "renderer": "project_comparison",
            "data": {"projects": comparisons},
            "summary": f"Compared {len(comparisons)} projects",
        }
    except Exception as exc:
        logger.exception("handle_compare_projects failed")
        return {"renderer": "error", "data": {"error": str(exc)}, "summary": f"Error: {exc}"}


async def handle_run_validation(
    session: AsyncSession, args: dict[str, Any], user_id: str
) -> dict[str, Any]:
    """Validation module removed — not available in Estruflow ERP."""
    return {
        "renderer": "error",
        "data": {"error": "Validation module not available"},
        "summary": "Validation module removed (pre-Ola 2)",
    }


async def handle_create_boq_item(
    session: AsyncSession, args: dict[str, Any], user_id: str
) -> dict[str, Any]:
    """BOQ module removed — not available in Estruflow ERP."""
    return {
        "renderer": "error",
        "data": {"error": "BOQ module not available"},
        "summary": "BOQ module removed (pre-Ola 3)",
    }


# ── Semantic memory tool handlers ────────────────────────────────────────


async def _generic_collection_search(
    args: dict[str, Any],
    *,
    short_type: str,
    summary_label: str,
) -> dict[str, Any]:
    """Shared implementation for the per-module search tools.

    Forwards to the unified search service with a single ``types`` filter
    so the AI can scope to BOQ / documents / tasks / risks / BIM in one
    call.  Returns a renderer hint the chat UI can use to display the
    matching cards.
    """
    from app.modules.search.service import unified_search_service

    query = _parse_str(args, "query", required=True, max_len=500) or ""
    project_id = args.get("project_id")
    if isinstance(project_id, str) and not project_id.strip():
        project_id = None
    limit_raw = args.get("limit", 10)
    try:
        limit = max(1, min(int(limit_raw), 50))
    except (TypeError, ValueError):
        limit = 10

    response = await unified_search_service(
        query=query,
        types=[short_type],
        project_id=project_id if isinstance(project_id, str) else None,
        limit_per_collection=limit,
        final_limit=limit,
    )
    hits_payload = [
        {
            "id": hit.id,
            "title": hit.title,
            "snippet": hit.snippet,
            "score": hit.score,
            "module": hit.module,
            "collection": hit.collection,
            "project_id": hit.project_id,
            "payload": hit.payload,
        }
        for hit in response.hits
    ]
    return {
        "renderer": "semantic_search",
        "data": {
            "query": query,
            "type": short_type,
            "hits": hits_payload,
            "total": response.total,
            "facets": response.facets,
        },
        "summary": (
            f"{summary_label}: {response.total} match(es) for '{query}'"
            if response.total
            else f"{summary_label}: no matches for '{query}'"
        ),
    }


async def handle_search_boq_positions(
    session: AsyncSession, args: dict[str, Any], user_id: str
) -> dict[str, Any]:
    """BOQ module removed — not available in Estruflow ERP."""
    return {
        "renderer": "error",
        "data": {"error": "BOQ module not available"},
        "summary": "BOQ module removed (pre-Ola 3)",
    }


async def handle_search_documents(
    session: AsyncSession, args: dict[str, Any], user_id: str
) -> dict[str, Any]:
    _ = (session, user_id)
    return await _generic_collection_search(
        args, short_type="documents", summary_label="Documents search"
    )


async def handle_search_tasks(
    session: AsyncSession, args: dict[str, Any], user_id: str
) -> dict[str, Any]:
    _ = (session, user_id)
    return await _generic_collection_search(
        args, short_type="tasks", summary_label="Tasks search"
    )


async def handle_search_risks(
    session: AsyncSession, args: dict[str, Any], user_id: str
) -> dict[str, Any]:
    _ = (session, user_id)
    return await _generic_collection_search(
        args, short_type="risks", summary_label="Risks search"
    )


async def handle_search_bim_elements(
    session: AsyncSession, args: dict[str, Any], user_id: str
) -> dict[str, Any]:
    _ = (session, user_id)
    return await _generic_collection_search(
        args, short_type="bim", summary_label="BIM elements search"
    )


async def handle_search_anything(
    session: AsyncSession, args: dict[str, Any], user_id: str
) -> dict[str, Any]:
    """Cross-collection unified search."""
    _ = (session, user_id)
    from app.modules.search.service import unified_search_service

    query = _parse_str(args, "query", required=True, max_len=500) or ""
    project_id = args.get("project_id")
    if isinstance(project_id, str) and not project_id.strip():
        project_id = None
    types_raw = args.get("types") or []
    types = [str(t) for t in types_raw if isinstance(t, str)] if isinstance(types_raw, list) else None
    limit_raw = args.get("limit", 20)
    try:
        limit = max(1, min(int(limit_raw), 50))
    except (TypeError, ValueError):
        limit = 20

    response = await unified_search_service(
        query=query,
        types=types,
        project_id=project_id if isinstance(project_id, str) else None,
        limit_per_collection=10,
        final_limit=limit,
    )
    hits_payload = [
        {
            "id": hit.id,
            "title": hit.title,
            "snippet": hit.snippet,
            "score": hit.score,
            "module": hit.module,
            "collection": hit.collection,
            "project_id": hit.project_id,
            "payload": hit.payload,
        }
        for hit in response.hits
    ]
    return {
        "renderer": "semantic_search",
        "data": {
            "query": query,
            "type": "all",
            "hits": hits_payload,
            "total": response.total,
            "facets": response.facets,
        },
        "summary": (
            f"Unified search: {response.total} hit(s) across "
            f"{sum(1 for v in response.facets.values() if v > 0)} module(s) for '{query}'"
            if response.total
            else f"Unified search: no matches for '{query}'"
        ),
    }


# ── Tool handler dispatch map ────────────────────────────────────────────────

TOOL_HANDLER_MAP: dict[str, Any] = {
    "get_all_projects": handle_get_all_projects,
    "get_project_summary": handle_get_project_summary,
    "get_boq_items": handle_get_boq_items,
    "get_schedule": handle_get_schedule,
    "get_validation_results": handle_get_validation_results,
    "get_risk_register": handle_get_risk_register,
    "search_cwicr_database": handle_search_cwicr_database,
    "get_cost_model": handle_get_cost_model,
    "compare_projects": handle_compare_projects,
    "run_validation": handle_run_validation,
    "create_boq_item": handle_create_boq_item,
    "search_boq_positions": handle_search_boq_positions,
    "search_documents": handle_search_documents,
    "search_tasks": handle_search_tasks,
    "search_risks": handle_search_risks,
    "search_bim_elements": handle_search_bim_elements,
    "search_anything": handle_search_anything,
}
