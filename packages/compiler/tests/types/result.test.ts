/**
 * Result Types Tests
 *
 * Tests for all error constructors and utilities in src/types/result.ts
 */

import { describe, it, expect } from 'vitest';
import type { SemanticPath } from '@manifesto-ai/core';
import {
  // Error constructors
  fragmentNotFound,
  fragmentAlreadyExists,
  invalidFragmentKind,
  pathNotFound,
  invalidPath,
  selfReference,
  depNotFound,
  depAlreadyExists,
  cycleDetected,
  missingDependency,
  conflictNotFound,
  duplicateProvides,
  codebookRequired,
  codebookMismatch,
  aliasNotFound,
  aliasConflict,
  aliasWrongState,
  schemaNotFound,
  fieldNotFound,
  unknownOperation,
  invalidOperation,
  internalError,
  // Utilities
  isCompilerError,
  getErrorMessage,
  errorToString,
} from '../../src/types/result.js';

// ============================================================================
// Fragment Error Constructors
// ============================================================================

describe('Fragment Error Constructors', () => {
  describe('fragmentNotFound', () => {
    it('should create correct error structure', () => {
      const error = fragmentNotFound('frag_123');

      expect(error._tag).toBe('CompilerError');
      expect(error.code).toBe('FRAGMENT_NOT_FOUND');
      expect(error.fragmentId).toBe('frag_123');
      expect(error.message).toContain('frag_123');
    });

    it('should handle empty fragmentId', () => {
      const error = fragmentNotFound('');

      expect(error.code).toBe('FRAGMENT_NOT_FOUND');
      expect(error.fragmentId).toBe('');
    });
  });

  describe('fragmentAlreadyExists', () => {
    it('should create correct error structure', () => {
      const error = fragmentAlreadyExists('frag_456');

      expect(error._tag).toBe('CompilerError');
      expect(error.code).toBe('FRAGMENT_ALREADY_EXISTS');
      expect(error.fragmentId).toBe('frag_456');
      expect(error.message).toContain('frag_456');
    });
  });

  describe('invalidFragmentKind', () => {
    it('should create error with single expected kind', () => {
      const error = invalidFragmentKind('frag_1', 'SchemaFragment', 'SourceFragment');

      expect(error._tag).toBe('CompilerError');
      expect(error.code).toBe('INVALID_FRAGMENT_KIND');
      expect(error.fragmentId).toBe('frag_1');
      expect(error.expected).toBe('SchemaFragment');
      expect(error.actual).toBe('SourceFragment');
      expect(error.message).toContain('SchemaFragment');
      expect(error.message).toContain('SourceFragment');
    });

    it('should create error with array of expected kinds', () => {
      const error = invalidFragmentKind(
        'frag_2',
        ['SchemaFragment', 'SourceFragment'],
        'PolicyFragment'
      );

      expect(error.expected).toEqual(['SchemaFragment', 'SourceFragment']);
      expect(error.actual).toBe('PolicyFragment');
      expect(error.message).toContain('SchemaFragment | SourceFragment');
    });
  });
});

// ============================================================================
// Path Error Constructors
// ============================================================================

describe('Path Error Constructors', () => {
  describe('pathNotFound', () => {
    it('should create correct error structure', () => {
      const error = pathNotFound('data.user.name' as SemanticPath);

      expect(error._tag).toBe('CompilerError');
      expect(error.code).toBe('PATH_NOT_FOUND');
      expect(error.path).toBe('data.user.name');
      expect(error.message).toContain('data.user.name');
    });
  });

  describe('invalidPath', () => {
    it('should create error without reason', () => {
      const error = invalidPath('invalid..path');

      expect(error._tag).toBe('CompilerError');
      expect(error.code).toBe('INVALID_PATH');
      expect(error.path).toBe('invalid..path');
      expect(error.reason).toBeUndefined();
    });

    it('should create error with reason', () => {
      const error = invalidPath('123start', 'path cannot start with number');

      expect(error.path).toBe('123start');
      expect(error.reason).toBe('path cannot start with number');
      expect(error.message).toContain('path cannot start with number');
    });
  });

  describe('selfReference', () => {
    it('should create correct error structure', () => {
      const error = selfReference('derived.total' as SemanticPath);

      expect(error._tag).toBe('CompilerError');
      expect(error.code).toBe('SELF_REFERENCE');
      expect(error.path).toBe('derived.total');
      expect(error.message).toContain('derived.total');
    });
  });
});

// ============================================================================
// Dependency Error Constructors
// ============================================================================

describe('Dependency Error Constructors', () => {
  describe('depNotFound', () => {
    it('should create correct error structure', () => {
      const error = depNotFound(
        'derived.total' as SemanticPath,
        'data.price' as SemanticPath
      );

      expect(error._tag).toBe('CompilerError');
      expect(error.code).toBe('DEP_NOT_FOUND');
      expect(error.path).toBe('derived.total');
      expect(error.dep).toBe('data.price');
      expect(error.message).toContain('data.price');
      expect(error.message).toContain('derived.total');
    });
  });

  describe('depAlreadyExists', () => {
    it('should create correct error structure', () => {
      const error = depAlreadyExists(
        'derived.sum' as SemanticPath,
        'data.value' as SemanticPath
      );

      expect(error._tag).toBe('CompilerError');
      expect(error.code).toBe('DEP_ALREADY_EXISTS');
      expect(error.path).toBe('derived.sum');
      expect(error.dep).toBe('data.value');
    });
  });

  describe('cycleDetected', () => {
    it('should create error with cycle path', () => {
      const cycle = [
        'derived.a' as SemanticPath,
        'derived.b' as SemanticPath,
        'derived.a' as SemanticPath,
      ];
      const error = cycleDetected(cycle);

      expect(error._tag).toBe('CompilerError');
      expect(error.code).toBe('CYCLE_DETECTED');
      expect(error.cycle).toEqual(cycle);
      expect(error.message).toContain('derived.a -> derived.b -> derived.a');
    });

    it('should handle empty cycle', () => {
      const error = cycleDetected([]);

      expect(error.code).toBe('CYCLE_DETECTED');
      expect(error.cycle).toEqual([]);
    });
  });

  describe('missingDependency', () => {
    it('should create error with missing dependencies', () => {
      const missing = ['data.x' as SemanticPath, 'data.y' as SemanticPath];
      const error = missingDependency('frag_1', missing);

      expect(error._tag).toBe('CompilerError');
      expect(error.code).toBe('MISSING_DEPENDENCY');
      expect(error.fragmentId).toBe('frag_1');
      expect(error.missing).toEqual(missing);
      expect(error.message).toContain('data.x, data.y');
    });

    it('should handle single missing dependency', () => {
      const error = missingDependency('frag_2', ['data.z' as SemanticPath]);

      expect(error.missing).toHaveLength(1);
      expect(error.message).toContain('data.z');
    });
  });
});

// ============================================================================
// Conflict Error Constructors
// ============================================================================

describe('Conflict Error Constructors', () => {
  describe('conflictNotFound', () => {
    it('should create correct error structure', () => {
      const error = conflictNotFound('conflict_123');

      expect(error._tag).toBe('CompilerError');
      expect(error.code).toBe('CONFLICT_NOT_FOUND');
      expect(error.conflictId).toBe('conflict_123');
      expect(error.message).toContain('conflict_123');
    });
  });

  describe('duplicateProvides', () => {
    it('should create error with multiple fragment IDs', () => {
      const fragmentIds = ['frag_1', 'frag_2', 'frag_3'];
      const error = duplicateProvides('data.count' as SemanticPath, fragmentIds);

      expect(error._tag).toBe('CompilerError');
      expect(error.code).toBe('DUPLICATE_PROVIDES');
      expect(error.path).toBe('data.count');
      expect(error.fragmentIds).toEqual(fragmentIds);
      expect(error.message).toContain('frag_1, frag_2, frag_3');
    });
  });
});

// ============================================================================
// Codebook/Alias Error Constructors
// ============================================================================

describe('Codebook/Alias Error Constructors', () => {
  describe('codebookRequired', () => {
    it('should create correct error structure', () => {
      const error = codebookRequired('applyAlias');

      expect(error._tag).toBe('CompilerError');
      expect(error.code).toBe('CODEBOOK_REQUIRED');
      expect(error.operation).toBe('applyAlias');
      expect(error.message).toContain('applyAlias');
    });
  });

  describe('codebookMismatch', () => {
    it('should create correct error structure', () => {
      const error = codebookMismatch('cb_expected', 'cb_actual');

      expect(error._tag).toBe('CompilerError');
      expect(error.code).toBe('CODEBOOK_MISMATCH');
      expect(error.expected).toBe('cb_expected');
      expect(error.actual).toBe('cb_actual');
      expect(error.message).toContain('cb_expected');
      expect(error.message).toContain('cb_actual');
    });
  });

  describe('aliasNotFound', () => {
    it('should create correct error structure', () => {
      const error = aliasNotFound('alias_123');

      expect(error._tag).toBe('CompilerError');
      expect(error.code).toBe('ALIAS_NOT_FOUND');
      expect(error.aliasId).toBe('alias_123');
      expect(error.message).toContain('alias_123');
    });
  });

  describe('aliasConflict', () => {
    it('should create error without reason', () => {
      const error = aliasConflict(
        'user.name' as SemanticPath,
        'data.profile.firstName' as SemanticPath
      );

      expect(error._tag).toBe('CompilerError');
      expect(error.code).toBe('ALIAS_CONFLICT');
      expect(error.aliasPath).toBe('user.name');
      expect(error.canonicalPath).toBe('data.profile.firstName');
      expect(error.reason).toBeUndefined();
    });

    it('should create error with reason', () => {
      const error = aliasConflict(
        'user.email' as SemanticPath,
        'data.contact.email' as SemanticPath,
        'path already exists'
      );

      expect(error.reason).toBe('path already exists');
      expect(error.message).toContain('path already exists');
    });
  });

  describe('aliasWrongState', () => {
    it('should create correct error structure', () => {
      const error = aliasWrongState('alias_1', 'pending', 'applied');

      expect(error._tag).toBe('CompilerError');
      expect(error.code).toBe('ALIAS_WRONG_STATE');
      expect(error.aliasId).toBe('alias_1');
      expect(error.expected).toBe('pending');
      expect(error.actual).toBe('applied');
      expect(error.message).toContain('pending');
      expect(error.message).toContain('applied');
    });
  });
});

// ============================================================================
// Schema Error Constructors
// ============================================================================

describe('Schema Error Constructors', () => {
  describe('schemaNotFound', () => {
    it('should create correct error structure', () => {
      const error = schemaNotFound('data.user' as SemanticPath);

      expect(error._tag).toBe('CompilerError');
      expect(error.code).toBe('SCHEMA_NOT_FOUND');
      expect(error.path).toBe('data.user');
      expect(error.message).toContain('data.user');
    });
  });

  describe('fieldNotFound', () => {
    it('should create error without fragmentId', () => {
      const error = fieldNotFound('data.user.age' as SemanticPath);

      expect(error._tag).toBe('CompilerError');
      expect(error.code).toBe('FIELD_NOT_FOUND');
      expect(error.path).toBe('data.user.age');
      expect(error.fragmentId).toBeUndefined();
    });

    it('should create error with fragmentId', () => {
      const error = fieldNotFound('data.user.name' as SemanticPath, 'schema_1');

      expect(error.path).toBe('data.user.name');
      expect(error.fragmentId).toBe('schema_1');
      expect(error.message).toContain('schema_1');
    });
  });
});

// ============================================================================
// Operation Error Constructors
// ============================================================================

describe('Operation Error Constructors', () => {
  describe('unknownOperation', () => {
    it('should create correct error structure', () => {
      const error = unknownOperation('customOp');

      expect(error._tag).toBe('CompilerError');
      expect(error.code).toBe('UNKNOWN_OPERATION');
      expect(error.operation).toBe('customOp');
      expect(error.message).toContain('customOp');
    });
  });

  describe('invalidOperation', () => {
    it('should create correct error structure', () => {
      const error = invalidOperation('deleteFragment', 'fragment is locked');

      expect(error._tag).toBe('CompilerError');
      expect(error.code).toBe('INVALID_OPERATION');
      expect(error.operation).toBe('deleteFragment');
      expect(error.reason).toBe('fragment is locked');
      expect(error.message).toContain('deleteFragment');
      expect(error.message).toContain('fragment is locked');
    });
  });
});

// ============================================================================
// Internal Error Constructor
// ============================================================================

describe('Internal Error Constructor', () => {
  describe('internalError', () => {
    it('should create error without cause', () => {
      const error = internalError('Something went wrong');

      expect(error._tag).toBe('CompilerError');
      expect(error.code).toBe('INTERNAL_ERROR');
      expect(error.message).toBe('Something went wrong');
      expect(error.cause).toBeUndefined();
    });

    it('should create error with cause', () => {
      const cause = new Error('Original error');
      const error = internalError('Wrapper error', cause);

      expect(error.message).toBe('Wrapper error');
      expect(error.cause).toBe(cause);
      expect(error.cause?.message).toBe('Original error');
    });
  });
});

// ============================================================================
// Error Utilities
// ============================================================================

describe('Error Utilities', () => {
  describe('isCompilerError', () => {
    it('should return true for CompilerError', () => {
      const error = fragmentNotFound('frag_1');
      expect(isCompilerError(error)).toBe(true);
    });

    it('should return true for different error types', () => {
      expect(isCompilerError(pathNotFound('data.x' as SemanticPath))).toBe(true);
      expect(isCompilerError(cycleDetected([]))).toBe(true);
      expect(isCompilerError(internalError('test'))).toBe(true);
    });

    it('should return false for null', () => {
      expect(isCompilerError(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isCompilerError(undefined)).toBe(false);
    });

    it('should return false for plain object', () => {
      expect(isCompilerError({ code: 'SOME_ERROR' })).toBe(false);
    });

    it('should return false for object with wrong _tag', () => {
      expect(isCompilerError({ _tag: 'OtherError', code: 'TEST' })).toBe(false);
    });

    it('should return false for primitives', () => {
      expect(isCompilerError('error')).toBe(false);
      expect(isCompilerError(123)).toBe(false);
      expect(isCompilerError(true)).toBe(false);
    });

    it('should return false for regular Error', () => {
      expect(isCompilerError(new Error('test'))).toBe(false);
    });
  });

  describe('getErrorMessage', () => {
    it('should return message from error', () => {
      const error = fragmentNotFound('frag_123');
      expect(getErrorMessage(error)).toBe('Fragment not found: frag_123');
    });

    it('should return message for different error types', () => {
      const pathError = pathNotFound('data.x' as SemanticPath);
      expect(getErrorMessage(pathError)).toBe('Path not found: data.x');

      const internalErr = internalError('Custom message');
      expect(getErrorMessage(internalErr)).toBe('Custom message');
    });
  });

  describe('errorToString', () => {
    it('should format error with code and message', () => {
      const error = fragmentNotFound('frag_1');
      expect(errorToString(error)).toBe('[FRAGMENT_NOT_FOUND] Fragment not found: frag_1');
    });

    it('should work for all error types', () => {
      const cycleError = cycleDetected(['a' as SemanticPath, 'b' as SemanticPath]);
      expect(errorToString(cycleError)).toBe('[CYCLE_DETECTED] Cycle detected: a -> b');

      const internalErr = internalError('Oops');
      expect(errorToString(internalErr)).toBe('[INTERNAL_ERROR] Oops');
    });
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  it('should handle special characters in fragment IDs', () => {
    const error = fragmentNotFound('frag-with-special_chars.123');
    expect(error.fragmentId).toBe('frag-with-special_chars.123');
  });

  it('should handle very long paths', () => {
    const longPath = 'data.' + 'nested.'.repeat(100) + 'value';
    const error = pathNotFound(longPath as SemanticPath);
    expect(error.path).toBe(longPath);
  });

  it('should handle unicode in messages', () => {
    const error = internalError('에러 발생: 한글 메시지');
    expect(error.message).toBe('에러 발생: 한글 메시지');
  });

  it('should handle empty arrays in cycleDetected', () => {
    const error = cycleDetected([]);
    expect(error.cycle).toEqual([]);
    expect(error.message).toBe('Cycle detected: ');
  });

  it('should handle empty arrays in missingDependency', () => {
    const error = missingDependency('frag_1', []);
    expect(error.missing).toEqual([]);
  });

  it('should handle empty arrays in duplicateProvides', () => {
    const error = duplicateProvides('data.x' as SemanticPath, []);
    expect(error.fragmentIds).toEqual([]);
  });
});
