/**
 * Conflict Detector Tests
 *
 * Tests for Principle A: ActionId vs SemanticPath must be separated.
 * Tests for Principle B: All conflicts must be surfaced as Conflict objects.
 */

import { describe, it, expect } from 'vitest';
import {
  detectConflicts,
  detectDuplicatePathProvides,
  detectDuplicateActionIds,
  detectSchemaMismatches,
  detectSemanticMismatches,
  suggestDuplicatePathResolutions,
  suggestDuplicateActionResolutions,
  suggestConflictResolutions,
  filterConflictsByType,
  getBlockingConflicts,
  getNonBlockingConflicts,
  hasPathConflict,
  hasActionConflict,
  getConflictForTarget,
  sortConflicts,
  type ConflictDetectionResult,
} from '../../src/linker/conflict-detector.js';
import type {
  Fragment,
  SchemaFragment,
  ActionFragment,
  DerivedFragment,
} from '../../src/types/fragment.js';
import type { Conflict } from '../../src/types/conflict.js';

// ============================================================================
// Test Helpers
// ============================================================================

function createSchemaFragment(overrides: Partial<SchemaFragment> = {}): SchemaFragment {
  return {
    id: 'schema-1',
    kind: 'SchemaFragment',
    requires: [],
    provides: ['data.count'],
    origin: { artifactId: 'test', location: { kind: 'generated', note: 'test' } },
    evidence: [],
    compilerVersion: '0.1.0',
    namespace: 'data',
    fields: [
      {
        path: 'data.count',
        type: 'number',
        semantic: { type: 'number', description: 'Count' },
      },
    ],
    ...overrides,
  };
}

function createActionFragment(overrides: Partial<ActionFragment> = {}): ActionFragment {
  return {
    id: 'action-1',
    kind: 'ActionFragment',
    requires: ['data.count'],
    provides: ['action:increment'],
    origin: { artifactId: 'test', location: { kind: 'generated', note: 'test' } },
    evidence: [],
    compilerVersion: '0.1.0',
    actionId: 'increment',
    semantic: { verb: 'increment', description: 'Increment count' },
    ...overrides,
  };
}

function createDerivedFragment(overrides: Partial<DerivedFragment> = {}): DerivedFragment {
  return {
    id: 'derived-1',
    kind: 'DerivedFragment',
    requires: ['data.count'],
    provides: ['derived.doubled'],
    origin: { artifactId: 'test', location: { kind: 'generated', note: 'test' } },
    evidence: [],
    compilerVersion: '0.1.0',
    path: 'derived.doubled',
    expr: ['*', ['get', 'data.count'], 2],
    ...overrides,
  };
}

// ============================================================================
// detectConflicts Tests
// ============================================================================

describe('detectConflicts', () => {
  it('should return empty result when no conflicts exist', () => {
    const fragments: Fragment[] = [
      createSchemaFragment({ id: 'schema-a', provides: ['data.a'] }),
      createSchemaFragment({ id: 'schema-b', provides: ['data.b'] }),
      createActionFragment({ id: 'action-a', provides: ['action:doA'], actionId: 'doA' }),
    ];

    const result = detectConflicts(fragments);

    expect(result.pathConflicts).toHaveLength(0);
    expect(result.actionConflicts).toHaveLength(0);
    expect(result.schemaConflicts).toHaveLength(0);
    expect(result.allConflicts).toHaveLength(0);
    expect(result.hasBlockingConflicts).toBe(false);
  });

  it('should detect path conflicts (Principle A: separate handling)', () => {
    const fragments: Fragment[] = [
      createSchemaFragment({ id: 'schema-a', provides: ['data.count'] }),
      createSchemaFragment({ id: 'schema-b', provides: ['data.count'] }),
    ];

    const result = detectConflicts(fragments);

    expect(result.pathConflicts).toHaveLength(1);
    expect(result.pathConflicts[0].target).toBe('data.count');
    expect(result.pathConflicts[0].candidates).toContain('schema-a');
    expect(result.pathConflicts[0].candidates).toContain('schema-b');
    expect(result.hasBlockingConflicts).toBe(true);
  });

  it('should detect action conflicts (Principle A: separate handling)', () => {
    const fragments: Fragment[] = [
      createActionFragment({ id: 'action-a', provides: ['action:submit'], actionId: 'submit' }),
      createActionFragment({ id: 'action-b', provides: ['action:submit'], actionId: 'submit' }),
    ];

    const result = detectConflicts(fragments);

    expect(result.actionConflicts).toHaveLength(1);
    expect(result.actionConflicts[0].target).toBe('action:submit');
    expect(result.actionConflicts[0].candidates).toContain('action-a');
    expect(result.actionConflicts[0].candidates).toContain('action-b');
    expect(result.hasBlockingConflicts).toBe(true);
  });

  it('should separate path and action conflicts (Principle A)', () => {
    const fragments: Fragment[] = [
      createSchemaFragment({ id: 'schema-a', provides: ['data.count'] }),
      createSchemaFragment({ id: 'schema-b', provides: ['data.count'] }),
      createActionFragment({ id: 'action-a', provides: ['action:submit'], actionId: 'submit' }),
      createActionFragment({ id: 'action-b', provides: ['action:submit'], actionId: 'submit' }),
    ];

    const result = detectConflicts(fragments);

    expect(result.pathConflicts).toHaveLength(1);
    expect(result.actionConflicts).toHaveLength(1);
    expect(result.allConflicts).toHaveLength(2);

    // Verify path conflicts contain only paths
    expect(result.pathConflicts[0].target).toBe('data.count');
    expect(result.pathConflicts[0].target.startsWith('action:')).toBe(false);

    // Verify action conflicts contain only actions
    expect(result.actionConflicts[0].target).toBe('action:submit');
    expect(result.actionConflicts[0].target.startsWith('action:')).toBe(true);
  });

  it('should combine all conflicts into allConflicts', () => {
    const fragments: Fragment[] = [
      createSchemaFragment({ id: 'schema-a', provides: ['data.x'] }),
      createSchemaFragment({ id: 'schema-b', provides: ['data.x'] }),
      createActionFragment({ id: 'action-a', provides: ['action:y'], actionId: 'y' }),
      createActionFragment({ id: 'action-b', provides: ['action:y'], actionId: 'y' }),
    ];

    const result = detectConflicts(fragments);

    expect(result.allConflicts.length).toBe(
      result.pathConflicts.length +
        result.actionConflicts.length +
        result.schemaConflicts.length +
        result.semanticConflicts.length
    );
  });
});

// ============================================================================
// detectDuplicatePathProvides Tests
// ============================================================================

describe('detectDuplicatePathProvides', () => {
  it('should detect duplicate path provides', () => {
    const fragments: Fragment[] = [
      createSchemaFragment({ id: 'a', provides: ['data.count'] }),
      createSchemaFragment({ id: 'b', provides: ['data.count'] }),
      createSchemaFragment({ id: 'c', provides: ['data.count'] }),
    ];

    const conflicts = detectDuplicatePathProvides(fragments);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].candidates).toHaveLength(3);
    expect(conflicts[0].type).toBe('duplicate_provides');
  });

  it('should detect multiple duplicate paths', () => {
    const fragments: Fragment[] = [
      createSchemaFragment({ id: 'a', provides: ['data.x', 'data.y'] }),
      createSchemaFragment({ id: 'b', provides: ['data.x', 'data.z'] }),
      createSchemaFragment({ id: 'c', provides: ['data.y', 'data.z'] }),
    ];

    const conflicts = detectDuplicatePathProvides(fragments);

    expect(conflicts).toHaveLength(3);
    expect(conflicts.some((c) => c.target === 'data.x')).toBe(true);
    expect(conflicts.some((c) => c.target === 'data.y')).toBe(true);
    expect(conflicts.some((c) => c.target === 'data.z')).toBe(true);
  });

  it('should NOT include action: provides in path conflicts', () => {
    const fragments: Fragment[] = [
      createActionFragment({ id: 'a', provides: ['action:submit'], actionId: 'submit' }),
      createActionFragment({ id: 'b', provides: ['action:submit'], actionId: 'submit' }),
    ];

    const conflicts = detectDuplicatePathProvides(fragments);

    // Action duplicates should NOT appear in path conflicts
    expect(conflicts).toHaveLength(0);
  });

  it('should include suggested resolutions (Principle B)', () => {
    const fragments: Fragment[] = [
      createSchemaFragment({ id: 'a', provides: ['data.count'] }),
      createSchemaFragment({ id: 'b', provides: ['data.count'] }),
    ];

    const conflicts = detectDuplicatePathProvides(fragments);

    expect(conflicts[0].suggestedResolutions).toBeDefined();
    expect(conflicts[0].suggestedResolutions!.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// detectDuplicateActionIds Tests (Principle A)
// ============================================================================

describe('detectDuplicateActionIds', () => {
  it('should detect duplicate action IDs', () => {
    const fragments: Fragment[] = [
      createActionFragment({ id: 'a', provides: ['action:submit'], actionId: 'submit' }),
      createActionFragment({ id: 'b', provides: ['action:submit'], actionId: 'submit' }),
    ];

    const conflicts = detectDuplicateActionIds(fragments);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].target).toBe('action:submit');
    expect(conflicts[0].candidates).toContain('a');
    expect(conflicts[0].candidates).toContain('b');
  });

  it('should detect multiple duplicate action IDs', () => {
    const fragments: Fragment[] = [
      createActionFragment({ id: 'a', provides: ['action:foo'], actionId: 'foo' }),
      createActionFragment({ id: 'b', provides: ['action:foo'], actionId: 'foo' }),
      createActionFragment({ id: 'c', provides: ['action:bar'], actionId: 'bar' }),
      createActionFragment({ id: 'd', provides: ['action:bar'], actionId: 'bar' }),
    ];

    const conflicts = detectDuplicateActionIds(fragments);

    expect(conflicts).toHaveLength(2);
    expect(conflicts.some((c) => c.target === 'action:foo')).toBe(true);
    expect(conflicts.some((c) => c.target === 'action:bar')).toBe(true);
  });

  it('should NOT include path provides in action conflicts', () => {
    const fragments: Fragment[] = [
      createSchemaFragment({ id: 'a', provides: ['data.count'] }),
      createSchemaFragment({ id: 'b', provides: ['data.count'] }),
    ];

    const conflicts = detectDuplicateActionIds(fragments);

    // Path duplicates should NOT appear in action conflicts
    expect(conflicts).toHaveLength(0);
  });

  it('should handle ActionFragment without action: prefix in provides', () => {
    const fragments: Fragment[] = [
      createActionFragment({ id: 'a', provides: ['increment'], actionId: 'increment' }),
      createActionFragment({ id: 'b', provides: ['increment'], actionId: 'increment' }),
    ];

    const conflicts = detectDuplicateActionIds(fragments);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].target).toBe('action:increment');
  });
});

// ============================================================================
// detectSchemaMismatches Tests
// ============================================================================

describe('detectSchemaMismatches', () => {
  it('should detect type mismatches', () => {
    const fragments: Fragment[] = [
      createSchemaFragment({
        id: 'a',
        provides: ['data.count'],
        fields: [{ path: 'data.count', type: 'number', semantic: { type: 'number' } }],
      }),
      createSchemaFragment({
        id: 'b',
        provides: ['data.count'],
        fields: [{ path: 'data.count', type: 'string', semantic: { type: 'string' } }],
      }),
    ];

    const conflicts = detectSchemaMismatches(fragments);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].type).toBe('schema_mismatch');
    expect(conflicts[0].target).toBe('data.count');
    expect(conflicts[0].candidates).toContain('a');
    expect(conflicts[0].candidates).toContain('b');
  });

  it('should not report conflict when types match', () => {
    const fragments: Fragment[] = [
      createSchemaFragment({
        id: 'a',
        provides: ['data.count'],
        fields: [{ path: 'data.count', type: 'number', semantic: { type: 'number' } }],
      }),
      createSchemaFragment({
        id: 'b',
        provides: ['data.count'],
        fields: [{ path: 'data.count', type: 'number', semantic: { type: 'number' } }],
      }),
    ];

    const conflicts = detectSchemaMismatches(fragments);

    expect(conflicts).toHaveLength(0);
  });

  it('should include type context in conflict', () => {
    const fragments: Fragment[] = [
      createSchemaFragment({
        id: 'a',
        fields: [{ path: 'data.x', type: 'number', semantic: {} }],
      }),
      createSchemaFragment({
        id: 'b',
        fields: [{ path: 'data.x', type: 'boolean', semantic: {} }],
      }),
    ];

    const conflicts = detectSchemaMismatches(fragments);

    expect(conflicts[0].context?.types).toBeDefined();
    const types = conflicts[0].context?.types as Record<string, string>;
    expect(types['a']).toBe('number');
    expect(types['b']).toBe('boolean');
  });
});

// ============================================================================
// detectSemanticMismatches Tests
// ============================================================================

describe('detectSemanticMismatches', () => {
  it('should detect semantic description mismatches', () => {
    const fragments: Fragment[] = [
      createSchemaFragment({
        id: 'a',
        fields: [
          { path: 'data.count', type: 'number', semantic: { type: 'number', description: 'Total count' } },
        ],
      }),
      createSchemaFragment({
        id: 'b',
        fields: [
          {
            path: 'data.count',
            type: 'number',
            semantic: { type: 'number', description: 'Item count' },
          },
        ],
      }),
    ];

    const conflicts = detectSemanticMismatches(fragments);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].type).toBe('semantic_mismatch');
  });

  it('should not report conflict when descriptions match', () => {
    const fragments: Fragment[] = [
      createSchemaFragment({
        id: 'a',
        fields: [
          { path: 'data.count', type: 'number', semantic: { type: 'number', description: 'Count' } },
        ],
      }),
      createSchemaFragment({
        id: 'b',
        fields: [
          { path: 'data.count', type: 'number', semantic: { type: 'number', description: 'Count' } },
        ],
      }),
    ];

    const conflicts = detectSemanticMismatches(fragments);

    expect(conflicts).toHaveLength(0);
  });

  it('should detect action semantic mismatches', () => {
    const fragments: Fragment[] = [
      createActionFragment({
        id: 'a',
        actionId: 'submit',
        provides: ['action:submit'],
        semantic: { verb: 'submit', description: 'Submit the form' },
      }),
      createActionFragment({
        id: 'b',
        actionId: 'submit',
        provides: ['action:submit'],
        semantic: { verb: 'submit', description: 'Send data to server' },
      }),
    ];

    const conflicts = detectSemanticMismatches(fragments);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].target).toBe('action:submit');
  });
});

// ============================================================================
// suggestDuplicatePathResolutions Tests
// ============================================================================

describe('suggestDuplicatePathResolutions', () => {
  it('should suggest keeping one and removing others', () => {
    const hints = suggestDuplicatePathResolutions(
      'data.count' as any,
      ['a', 'b'],
      []
    );

    // Should have suggestions for keeping 'a' or keeping 'b'
    const keepASuggestion = hints.find((h) => h.suggestion.includes('keep a'));
    const keepBSuggestion = hints.find((h) => h.suggestion.includes('keep b'));

    expect(keepASuggestion).toBeDefined();
    expect(keepBSuggestion).toBeDefined();
  });

  it('should suggest renaming paths', () => {
    const hints = suggestDuplicatePathResolutions(
      'data.count' as any,
      ['a', 'b'],
      []
    );

    const renameHints = hints.filter((h) => h.suggestion.includes('Rename'));
    expect(renameHints.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// suggestDuplicateActionResolutions Tests
// ============================================================================

describe('suggestDuplicateActionResolutions', () => {
  it('should suggest keeping one and removing others', () => {
    const hints = suggestDuplicateActionResolutions('submit', ['a', 'b'], []);

    const keepASuggestion = hints.find((h) => h.suggestion.includes('keep a'));
    const keepBSuggestion = hints.find((h) => h.suggestion.includes('keep b'));

    expect(keepASuggestion).toBeDefined();
    expect(keepBSuggestion).toBeDefined();
  });

  it('should suggest renaming action IDs', () => {
    const hints = suggestDuplicateActionResolutions('submit', ['a', 'b'], []);

    const renameHints = hints.filter((h) => h.suggestion.includes('Rename'));
    expect(renameHints.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// suggestConflictResolutions Tests
// ============================================================================

describe('suggestConflictResolutions', () => {
  it('should suggest resolutions for path conflicts', () => {
    const conflict: Conflict = {
      id: 'conflict-1',
      target: 'data.count',
      type: 'duplicate_provides',
      candidates: ['a', 'b'],
      message: 'Test',
    };

    const hints = suggestConflictResolutions(conflict, []);

    expect(hints.length).toBeGreaterThan(0);
  });

  it('should suggest resolutions for action conflicts', () => {
    const conflict: Conflict = {
      id: 'conflict-1',
      target: 'action:submit',
      type: 'duplicate_provides',
      candidates: ['a', 'b'],
      message: 'Test',
    };

    const hints = suggestConflictResolutions(conflict, []);

    expect(hints.length).toBeGreaterThan(0);
  });

  it('should suggest manual review for semantic conflicts', () => {
    const conflict: Conflict = {
      id: 'conflict-1',
      target: 'data.count',
      type: 'semantic_mismatch',
      candidates: ['a', 'b'],
      message: 'Test',
    };

    const hints = suggestConflictResolutions(conflict, []);

    expect(hints.some((h) => h.suggestion.includes('manual'))).toBe(true);
  });
});

// ============================================================================
// Utility Function Tests
// ============================================================================

describe('filterConflictsByType', () => {
  it('should filter conflicts by type', () => {
    const conflicts: Conflict[] = [
      { id: '1', target: 'a', type: 'duplicate_provides', candidates: [], message: '' },
      { id: '2', target: 'b', type: 'schema_mismatch', candidates: [], message: '' },
      { id: '3', target: 'c', type: 'duplicate_provides', candidates: [], message: '' },
    ];

    const filtered = filterConflictsByType(conflicts, 'duplicate_provides');

    expect(filtered).toHaveLength(2);
    expect(filtered.every((c) => c.type === 'duplicate_provides')).toBe(true);
  });
});

describe('getBlockingConflicts', () => {
  it('should return only blocking conflicts', () => {
    const conflicts: Conflict[] = [
      { id: '1', target: 'a', type: 'duplicate_provides', candidates: [], message: '' },
      { id: '2', target: 'b', type: 'semantic_mismatch', candidates: [], message: '' },
      { id: '3', target: 'c', type: 'schema_mismatch', candidates: [], message: '' },
    ];

    const blocking = getBlockingConflicts(conflicts);

    expect(blocking).toHaveLength(2);
    expect(blocking.some((c) => c.type === 'duplicate_provides')).toBe(true);
    expect(blocking.some((c) => c.type === 'schema_mismatch')).toBe(true);
    expect(blocking.some((c) => c.type === 'semantic_mismatch')).toBe(false);
  });
});

describe('getNonBlockingConflicts', () => {
  it('should return only non-blocking conflicts', () => {
    const conflicts: Conflict[] = [
      { id: '1', target: 'a', type: 'duplicate_provides', candidates: [], message: '' },
      { id: '2', target: 'b', type: 'semantic_mismatch', candidates: [], message: '' },
    ];

    const nonBlocking = getNonBlockingConflicts(conflicts);

    expect(nonBlocking).toHaveLength(1);
    expect(nonBlocking[0].type).toBe('semantic_mismatch');
  });
});

describe('hasPathConflict', () => {
  it('should return true if path has conflict', () => {
    const result: ConflictDetectionResult = {
      pathConflicts: [
        { id: '1', target: 'data.count', type: 'duplicate_provides', candidates: ['a', 'b'], message: '' },
      ],
      actionConflicts: [],
      schemaConflicts: [],
      semanticConflicts: [],
      allConflicts: [],
      hasBlockingConflicts: true,
    };

    expect(hasPathConflict('data.count' as any, result)).toBe(true);
    expect(hasPathConflict('data.other' as any, result)).toBe(false);
  });
});

describe('hasActionConflict', () => {
  it('should return true if action has conflict', () => {
    const result: ConflictDetectionResult = {
      pathConflicts: [],
      actionConflicts: [
        { id: '1', target: 'action:submit', type: 'duplicate_provides', candidates: ['a', 'b'], message: '' },
      ],
      schemaConflicts: [],
      semanticConflicts: [],
      allConflicts: [],
      hasBlockingConflicts: true,
    };

    expect(hasActionConflict('submit', result)).toBe(true);
    expect(hasActionConflict('other', result)).toBe(false);
  });
});

describe('getConflictForTarget', () => {
  it('should return conflict for target', () => {
    const result: ConflictDetectionResult = {
      pathConflicts: [],
      actionConflicts: [],
      schemaConflicts: [],
      semanticConflicts: [],
      allConflicts: [
        { id: '1', target: 'data.count', type: 'duplicate_provides', candidates: [], message: '' },
        { id: '2', target: 'action:submit', type: 'duplicate_provides', candidates: [], message: '' },
      ],
      hasBlockingConflicts: true,
    };

    expect(getConflictForTarget('data.count', result)).toBeDefined();
    expect(getConflictForTarget('action:submit', result)).toBeDefined();
    expect(getConflictForTarget('data.other', result)).toBeUndefined();
  });
});

describe('sortConflicts', () => {
  it('should sort conflicts deterministically (Principle E)', () => {
    const conflicts: Conflict[] = [
      { id: '1', target: 'data.z', type: 'duplicate_provides', candidates: ['b', 'a'], message: '' },
      { id: '2', target: 'data.a', type: 'duplicate_provides', candidates: ['a', 'b'], message: '' },
      { id: '3', target: 'action:z', type: 'semantic_mismatch', candidates: ['a'], message: '' },
    ];

    const sorted = sortConflicts(conflicts);

    // Should be sorted by type first, then target
    expect(sorted[0].type).toBe('duplicate_provides');
    expect(sorted[0].target).toBe('data.a');
    expect(sorted[1].target).toBe('data.z');
    expect(sorted[2].type).toBe('semantic_mismatch');
  });

  it('should produce identical results regardless of input order (Principle E)', () => {
    const conflicts1: Conflict[] = [
      { id: '1', target: 'a', type: 'duplicate_provides', candidates: ['x'], message: '' },
      { id: '2', target: 'b', type: 'schema_mismatch', candidates: ['y'], message: '' },
    ];

    const conflicts2: Conflict[] = [
      { id: '2', target: 'b', type: 'schema_mismatch', candidates: ['y'], message: '' },
      { id: '1', target: 'a', type: 'duplicate_provides', candidates: ['x'], message: '' },
    ];

    const sorted1 = sortConflicts(conflicts1);
    const sorted2 = sortConflicts(conflicts2);

    expect(sorted1.map((c) => c.target)).toEqual(sorted2.map((c) => c.target));
    expect(sorted1.map((c) => c.type)).toEqual(sorted2.map((c) => c.type));
  });
});

// ============================================================================
// Principle B Tests: No Auto-Resolution
// ============================================================================

describe('Principle B: No Auto-Resolution', () => {
  it('should always surface duplicate provides as conflicts', () => {
    const fragments: Fragment[] = [
      createSchemaFragment({ id: 'a', provides: ['data.count'] }),
      createSchemaFragment({ id: 'b', provides: ['data.count'] }),
    ];

    const result = detectConflicts(fragments);

    // Must NOT silently resolve - must surface as conflict
    expect(result.pathConflicts.length).toBeGreaterThan(0);
    expect(result.hasBlockingConflicts).toBe(true);
  });

  it('should provide PatchHints instead of auto-resolving', () => {
    const fragments: Fragment[] = [
      createSchemaFragment({ id: 'a', provides: ['data.count'] }),
      createSchemaFragment({ id: 'b', provides: ['data.count'] }),
    ];

    const result = detectConflicts(fragments);
    const conflict = result.pathConflicts[0];

    // Should have suggestions, not auto-resolution
    expect(conflict.suggestedResolutions).toBeDefined();
    expect(conflict.suggestedResolutions!.length).toBeGreaterThan(0);

    // Fragments should still be in candidates (not removed)
    expect(conflict.candidates).toContain('a');
    expect(conflict.candidates).toContain('b');
  });
});
