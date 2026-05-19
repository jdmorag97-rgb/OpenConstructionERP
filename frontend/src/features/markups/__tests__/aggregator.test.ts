/**
 * Pure-function tests for the unified markup aggregator.
 *
 * These tests cover the contract the Markups hub page depends on:
 *   1. normalisation from each of the two backend shapes
 *   2. cross-source merge (newest-first + deterministic tie-break)
 *   3. filter chips (source / type / file / search) — AND semantics
 *   4. summary derivation (counts + file lookup for the dropdown)
 *
 * No React, no network — pure data transforms, fast.
 */

import { describe, expect, it } from 'vitest';
import {
  applyFilters,
  fromDwgAnnotation,
  fromMarkupsHub,
  mergeUnified,
  summarise,
  type UnifiedMarkup,
} from '../aggregator';
import type { Markup } from '../api';
import type { DwgAnnotation } from '@/features/dwg-takeoff/api';

/* ── Factories ───────────────────────────────────────────────────────── */

function makeHubMarkup(overrides: Partial<Markup> = {}): Markup {
  return {
    id: 'hub-1',
    project_id: 'p1',
    document_id: 'doc-a',
    page: 2,
    type: 'cloud',
    geometry: {},
    text: 'Clash note',
    color: '#ff0000',
    line_width: 2,
    opacity: 1,
    author_id: 'alice',
    status: 'active',
    label: 'Cloud 1',
    measurement_value: null,
    measurement_unit: null,
    stamp_template_id: null,
    linked_boq_position_id: null,
    metadata: {},
    created_by: 'alice',
    created_at: '2026-04-20T10:00:00Z',
    updated_at: '2026-04-20T10:00:00Z',
    ...overrides,
  };
}

function makeDwgAnnotation(overrides: Partial<DwgAnnotation> = {}): DwgAnnotation {
  return {
    id: 'dwg-1',
    drawing_id: 'draw-42',
    type: 'arrow',
    points: [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ],
    text: 'Check dim',
    color: '#00ff00',
    measurement_value: null,
    measurement_unit: null,
    linked_boq_position_id: null,
    created_by: 'bob',
    created_at: '2026-04-21T09:00:00Z',
    updated_at: '2026-04-21T09:00:00Z',
    ...overrides,
  };
}

/* ── 1. Normalisation ────────────────────────────────────────────────── */

describe('aggregator normalisation', () => {
  it('normalises a markups-hub record with document name', () => {
    const u = fromMarkupsHub(makeHubMarkup(), { documentName: 'Site.pdf' });
    expect(u.source).toBe('markups_hub');
    expect(u.id).toBe('hub:hub-1');
    expect(u.nativeId).toBe('hub-1');
    expect(u.sourceFileId).toBe('doc-a');
    expect(u.sourceFileName).toBe('Site.pdf');
    expect(u.page).toBe(2);
    expect(u.type).toBe('cloud');
    expect(u.deepLink).toContain('/markups');
    expect(u.deepLink).toContain('documentId=doc-a');
  });

  it('normalises a DWG annotation — no page, drawing file name, deep link', () => {
    const u = fromDwgAnnotation(makeDwgAnnotation({ type: 'text_pin' }), {
      id: 'draw-42',
      project_id: 'p1',
      name: 'A-101.dxf',
      filename: 'A-101.dxf',
    });
    expect(u.source).toBe('dwg_takeoff');
    expect(u.page).toBeNull();
    expect(u.sourceFileName).toBe('A-101.dxf');
    expect(u.type).toBe('text_pin');
    expect(u.deepLink).toBe('/dwg-takeoff?drawingId=draw-42&annotationId=dwg-1');
  });

  it('reads DWG annotation type from annotation_type when type is missing (backend field name)', () => {
    // The backend serialises the column as ``annotation_type`` — the TS
    // interface calls it ``type``. Make sure the aggregator accepts both.
    const rawFromBackend = {
      id: 'dwg-be',
      drawing_id: 'draw-1',
      annotation_type: 'arrow',
      points: [],
      text: null,
      color: '#000',
      measurement_value: null,
      measurement_unit: null,
      linked_boq_position_id: null,
      created_by: 'x',
      created_at: '2026-04-21T00:00:00Z',
      updated_at: '2026-04-21T00:00:00Z',
      // Deliberately omit `type` — this is what the wire format actually is.
    };
    const u = fromDwgAnnotation(rawFromBackend as unknown as DwgAnnotation, {
      id: 'draw-1',
      project_id: 'p1',
      name: 'x.dxf',
      filename: 'x.dxf',
    });
    expect(u.type).toBe('arrow');
  });
});

/* ── 2. Merge ordering ───────────────────────────────────────────────── */

describe('mergeUnified', () => {
  it('returns a unified, newest-first list across sources', () => {
    const hub = [fromMarkupsHub(makeHubMarkup(), { documentName: 'Hub.pdf' })]; // 04-20
    const dwg = [
      fromDwgAnnotation(makeDwgAnnotation(), {
        id: 'draw-42',
        project_id: 'p1',
        name: 'Dwg.dxf',
        filename: 'Dwg.dxf',
      }),
    ]; // 04-21

    const merged = mergeUnified(hub, dwg);
    expect(merged.map((m) => m.source)).toEqual([
      'dwg_takeoff',
      'markups_hub',
    ]);
  });

  it('falls back to stable id ordering when createdAt ties', () => {
    const a: UnifiedMarkup = fromMarkupsHub(
      makeHubMarkup({ id: 'a', created_at: '2026-04-20T10:00:00Z' }),
    );
    const b: UnifiedMarkup = fromMarkupsHub(
      makeHubMarkup({ id: 'b', created_at: '2026-04-20T10:00:00Z' }),
    );
    const merged = mergeUnified([b], [a]);
    // `hub:a` sorts before `hub:b` by localeCompare.
    expect(merged[0]!.nativeId).toBe('a');
    expect(merged[1]!.nativeId).toBe('b');
  });
});

/* ── 3. Filter chips ─────────────────────────────────────────────────── */

describe('applyFilters', () => {
  const dataset: UnifiedMarkup[] = [
    fromMarkupsHub(makeHubMarkup({ id: 'h1', type: 'cloud', text: 'clash' }), {
      documentName: 'Plans.pdf',
    }),
    fromDwgAnnotation(makeDwgAnnotation({ id: 'd1', type: 'arrow', text: 'here' }), {
      id: 'draw-1',
      project_id: 'p1',
      name: 'Floor1.dxf',
      filename: 'Floor1.dxf',
    }),
  ];

  it('filters by source', () => {
    const out = applyFilters(dataset, { sources: new Set(['dwg_takeoff']) });
    expect(out).toHaveLength(1);
    expect(out[0]!.source).toBe('dwg_takeoff');
  });

  it('filters by type', () => {
    const out = applyFilters(dataset, { types: new Set(['cloud']) });
    expect(out).toHaveLength(1);
    expect(out[0]!.nativeId).toBe('h1');
  });

  it('filters by file id', () => {
    const out = applyFilters(dataset, { fileIds: new Set(['draw-1']) });
    expect(out).toHaveLength(1);
    expect(out[0]!.source).toBe('dwg_takeoff');
  });

  it('search matches label, text and file name case-insensitively', () => {
    expect(applyFilters(dataset, { search: 'CLASH' })).toHaveLength(1);
    expect(applyFilters(dataset, { search: 'floor1' })).toHaveLength(1);
    expect(applyFilters(dataset, { search: 'plans.pdf' })).toHaveLength(1);
  });
});

/* ── 4. Summary ──────────────────────────────────────────────────────── */

describe('summarise', () => {
  it('counts by source/type and collects unique files', () => {
    const items: UnifiedMarkup[] = [
      fromMarkupsHub(makeHubMarkup({ id: 'h1', type: 'cloud' }), { documentName: 'A.pdf' }),
      fromMarkupsHub(makeHubMarkup({ id: 'h2', type: 'cloud' }), { documentName: 'A.pdf' }),
      fromDwgAnnotation(makeDwgAnnotation({ id: 'd1', type: 'arrow' }), {
        id: 'draw-1',
        project_id: 'p1',
        name: 'B.dxf',
        filename: 'B.dxf',
      }),
    ];
    const s = summarise(items);
    expect(s.total).toBe(3);
    expect(s.bySource.markups_hub).toBe(2);
    expect(s.bySource.dwg_takeoff).toBe(1);
    expect(s.byType.cloud).toBe(2);
    expect(s.byType.arrow).toBe(1);
    expect(s.files).toHaveLength(2);
    // Files are returned sorted by name.
    expect(s.files[0]!.name).toBe('A.pdf');
    expect(s.files[1]!.name).toBe('B.dxf');
  });
});
