"""Unit tests for project_intelligence.actions backend action executors.

These tests exercise the real backend action ``_generate_schedule``
with the real domain services patched out. The goal is to guarantee that:

1. Each action returns an ``ActionResult`` instance (never raises).
2. When the underlying service succeeds, ``ActionResult.success`` is True
   and the data payload carries the service's real identifiers.
3. When the project has no BOQ, each action fails cleanly with a
   descriptive message instead of silently redirecting.
4. When the underlying service raises, each action catches the exception
   and returns ``ActionResult(success=False, ...)``.
"""

from __future__ import annotations

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.modules.project_intelligence.actions import (
    ActionResult,
    _generate_schedule,
)

# ── Helpers ────────────────────────────────────────────────────────────────


def _make_session() -> MagicMock:
    """Return a MagicMock AsyncSession with async commit/rollback stubs."""
    session = MagicMock()
    session.commit = AsyncMock()
    session.rollback = AsyncMock()
    return session


def _make_boq(n_positions: int = 0) -> SimpleNamespace:
    """Build a fake BOQ object with the fields the actions read."""
    return SimpleNamespace(
        id=uuid.uuid4(),
        name="Main BOQ",
        positions=[_make_position() for _ in range(n_positions)],
    )


def _make_position(
    *,
    unit_rate: str = "0",
    quantity: str = "10",
    description: str = "Concrete wall C30/37",
    unit: str = "m3",
) -> SimpleNamespace:
    return SimpleNamespace(
        id=uuid.uuid4(),
        description=description,
        unit=unit,
        quantity=quantity,
        unit_rate=unit_rate,
        total="0",
        classification={},
        metadata_={},
    )


# ── _generate_schedule ─────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_generate_schedule_success() -> None:
    session = _make_session()
    boq = _make_boq()
    new_schedule = SimpleNamespace(id=uuid.uuid4())
    activities = [SimpleNamespace(id=uuid.uuid4()) for _ in range(7)]

    svc_instance = MagicMock()
    svc_instance.list_schedules_for_project = AsyncMock(return_value=([], 0))
    svc_instance.create_schedule = AsyncMock(return_value=new_schedule)
    svc_instance.generate_from_boq = AsyncMock(return_value=activities)

    proj_repo_instance = MagicMock()
    proj_repo_instance.get_by_id = AsyncMock(
        return_value=SimpleNamespace(planned_start_date="2026-05-01", actual_start_date=None)
    )

    with (
        patch(
            "app.modules.project_intelligence.actions._find_project_boq",
            AsyncMock(return_value=boq),
        ),
        patch(
            "app.modules.schedule.service.ScheduleService",
            return_value=svc_instance,
        ),
        patch(
            "app.modules.projects.repository.ProjectRepository",
            return_value=proj_repo_instance,
        ),
    ):
        result = await _generate_schedule(session, str(uuid.uuid4()))

    assert isinstance(result, ActionResult)
    assert result.success is True
    assert result.data["activity_count"] == 7
    assert result.data["schedule_id"] == str(new_schedule.id)
    assert result.data["start_date"] == "2026-05-01"
    svc_instance.create_schedule.assert_awaited_once()
    svc_instance.generate_from_boq.assert_awaited_once()


@pytest.mark.asyncio
async def test_generate_schedule_refuses_if_exists() -> None:
    session = _make_session()
    boq = _make_boq()
    existing = [SimpleNamespace(id=uuid.uuid4())]

    svc_instance = MagicMock()
    svc_instance.list_schedules_for_project = AsyncMock(return_value=(existing, 1))
    svc_instance.create_schedule = AsyncMock()
    svc_instance.generate_from_boq = AsyncMock()

    with (
        patch(
            "app.modules.project_intelligence.actions._find_project_boq",
            AsyncMock(return_value=boq),
        ),
        patch(
            "app.modules.schedule.service.ScheduleService",
            return_value=svc_instance,
        ),
    ):
        result = await _generate_schedule(session, str(uuid.uuid4()))

    assert isinstance(result, ActionResult)
    assert result.success is False
    assert "already exists" in result.message
    svc_instance.create_schedule.assert_not_awaited()
    svc_instance.generate_from_boq.assert_not_awaited()


@pytest.mark.asyncio
async def test_generate_schedule_no_boq() -> None:
    session = _make_session()
    with patch(
        "app.modules.project_intelligence.actions._find_project_boq",
        AsyncMock(return_value=None),
    ):
        result = await _generate_schedule(session, str(uuid.uuid4()))
    assert result.success is False
    assert "No BOQ" in result.message
