/**
 * Conflict Types Tests
 *
 * Tests for conflict factory functions and utilities in src/types/conflict.ts
 */

import { describe, it, expect } from 'vitest';
import type { SemanticPath } from '@manifesto-ai/core';
import {
  createConflictId,
  duplicateProvidesConflict,
  schemaMismatchConflict,
  semanticMismatchConflict,
  isBlockingConflict,
  type Conflict,
  type ConflictType,
} from '../../src/types/conflict.js';

// ============================================================================
// createConflictId
// ============================================================================

describe('createConflictId', () => {
  it('should create a conflict ID with correct prefix', () => {
    const id = createConflictId();
    expect(id).toMatch(/^conflict_\d+_[a-z0-9]+$/);
  });

  it('should create unique IDs', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(createConflictId());
    }
    expect(ids.size).toBe(100);
  });

  it('should include timestamp', () => {
    const before = Date.now();
    const id = createConflictId();
    const after = Date.now();

    const timestampPart = id.split('_')[1];
    const timestamp = parseInt(timestampPart, 10);

    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(after);
  });
});

// ============================================================================
// duplicateProvidesConflict
// ============================================================================

describe('duplicateProvidesConflict', () => {
  it('should create conflict with correct type', () => {
    const conflict = duplicateProvidesConflict(
      'data.price',
      ['frag_1', 'frag_2']
    );

    expect(conflict.id).toMatch(/^conflict_/);
    expect(conflict.type).toBe('duplicate_provides');
    expect(conflict.target).toBe('data.price');
    expect(conflict.candidates).toEqual(['frag_1', 'frag_2']);
  });

  it('should include all candidates in message', () => {
    const conflict = duplicateProvidesConflict(
      'derived.total',
      ['schema_1', 'derived_2', 'source_3']
    );

    expect(conflict.message).toContain('derived.total');
    expect(conflict.message).toContain('schema_1');
    expect(conflict.message).toContain('derived_2');
    expect(conflict.message).toContain('source_3');
  });

  it('should include suggested resolutions when provided', () => {
    const resolutions = [
      { description: 'Remove frag_1', patch: { op: 'removeFragment' } },
      { description: 'Remove frag_2', patch: { op: 'removeFragment' } },
    ];
    const conflict = duplicateProvidesConflict(
      'data.field',
      ['frag_1', 'frag_2'],
      resolutions as any
    );

    expect(conflict.suggestedResolutions).toEqual(resolutions);
  });

  it('should work without suggested resolutions', () => {
    const conflict = duplicateProvidesConflict(
      'data.value',
      ['frag_a', 'frag_b']
    );

    expect(conflict.suggestedResolutions).toBeUndefined();
  });
});

// ============================================================================
// schemaMismatchConflict
// ============================================================================

describe('schemaMismatchConflict', () => {
  it('should create conflict with correct type', () => {
    const conflict = schemaMismatchConflict(
      'data.count' as SemanticPath,
      ['frag_1', 'frag_2']
    );

    expect(conflict.id).toMatch(/^conflict_/);
    expect(conflict.type).toBe('schema_mismatch');
    expect(conflict.target).toBe('data.count');
  });

  it('should include type context in message when provided', () => {
    const conflict = schemaMismatchConflict(
      'data.value' as SemanticPath,
      ['frag_1', 'frag_2'],
      { expected: 'number', actual: 'string' }
    );

    expect(conflict.message).toContain('data.value');
    expect(conflict.message).toContain('number');
    expect(conflict.message).toContain('string');
    expect(conflict.context).toEqual({ expected: 'number', actual: 'string' });
  });

  it('should have generic message without context', () => {
    const conflict = schemaMismatchConflict(
      'data.field' as SemanticPath,
      ['frag_1']
    );

    expect(conflict.message).toContain('data.field');
    expect(conflict.context).toBeUndefined();
  });
});

// ============================================================================
// semanticMismatchConflict
// ============================================================================

describe('semanticMismatchConflict', () => {
  it('should create conflict with correct type', () => {
    const conflict = semanticMismatchConflict(
      'action:checkout',
      ['action_1', 'action_2'],
      'Conflicting action definitions'
    );

    expect(conflict.id).toMatch(/^conflict_/);
    expect(conflict.type).toBe('semantic_mismatch');
    expect(conflict.target).toBe('action:checkout');
    expect(conflict.candidates).toEqual(['action_1', 'action_2']);
  });

  it('should use provided message directly', () => {
    const customMessage = 'Semantic meaning differs between fragments';
    const conflict = semanticMismatchConflict(
      'data.user',
      ['frag_1'],
      customMessage
    );

    expect(conflict.message).toBe(customMessage);
  });
});

// ============================================================================
// isBlockingConflict
// ============================================================================

describe('isBlockingConflict', () => {
  it('should return true for duplicate_provides', () => {
    const conflict: Conflict = {
      id: 'conflict_1',
      target: 'data.x',
      type: 'duplicate_provides',
      candidates: ['f1', 'f2'],
      message: 'test',
    };
    expect(isBlockingConflict(conflict)).toBe(true);
  });

  it('should return true for schema_mismatch', () => {
    const conflict: Conflict = {
      id: 'conflict_1',
      target: 'data.x',
      type: 'schema_mismatch',
      candidates: ['f1', 'f2'],
      message: 'test',
    };
    expect(isBlockingConflict(conflict)).toBe(true);
  });

  it('should return true for dependency_conflict', () => {
    const conflict: Conflict = {
      id: 'conflict_1',
      target: 'data.x',
      type: 'dependency_conflict',
      candidates: ['f1', 'f2'],
      message: 'test',
    };
    expect(isBlockingConflict(conflict)).toBe(true);
  });

  it('should return false for semantic_mismatch', () => {
    const conflict: Conflict = {
      id: 'conflict_1',
      target: 'data.x',
      type: 'semantic_mismatch',
      candidates: ['f1', 'f2'],
      message: 'test',
    };
    expect(isBlockingConflict(conflict)).toBe(false);
  });

  it('should return false for incompatible_effect', () => {
    const conflict: Conflict = {
      id: 'conflict_1',
      target: 'data.x',
      type: 'incompatible_effect',
      candidates: ['f1', 'f2'],
      message: 'test',
    };
    expect(isBlockingConflict(conflict)).toBe(false);
  });

  it('should return false for unknown', () => {
    const conflict: Conflict = {
      id: 'conflict_1',
      target: 'data.x',
      type: 'unknown',
      candidates: ['f1', 'f2'],
      message: 'test',
    };
    expect(isBlockingConflict(conflict)).toBe(false);
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  it('should handle empty candidates array', () => {
    const conflict = duplicateProvidesConflict('data.x', []);
    expect(conflict.candidates).toEqual([]);
  });

  it('should handle unicode in target paths', () => {
    const conflict = duplicateProvidesConflict(
      '데이터.사용자',
      ['frag_1']
    );
    expect(conflict.target).toBe('데이터.사용자');
    expect(conflict.message).toContain('데이터.사용자');
  });

  it('should handle special characters in fragment IDs', () => {
    const conflict = duplicateProvidesConflict(
      'data.x',
      ['frag-with_special.chars:123', 'frag@#$']
    );
    expect(conflict.candidates).toEqual(['frag-with_special.chars:123', 'frag@#$']);
  });

  it('should work with all conflict types for type completeness', () => {
    const types: ConflictType[] = [
      'duplicate_provides',
      'schema_mismatch',
      'semantic_mismatch',
      'incompatible_effect',
      'dependency_conflict',
      'unknown',
    ];

    for (const type of types) {
      const conflict: Conflict = {
        id: 'c1',
        target: 'x',
        type,
        candidates: [],
        message: 'test',
      };
      // Should not throw
      expect(typeof isBlockingConflict(conflict)).toBe('boolean');
    }
  });
});
