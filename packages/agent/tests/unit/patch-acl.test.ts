/**
 * @manifesto-ai/agent - ACL Validation Tests
 *
 * 테스트 내용:
 * - derived.* 쓰기 차단
 * - writable path prefix 검증
 */

import { describe, it, expect } from 'vitest';
import {
  validatePathAcl,
  validatePathsAcl,
  FORBIDDEN_PATH_PREFIXES,
  isDerivedPath,
  isDataPath,
  isStatePath,
} from '../../src/validation/acl.js';
import { createDefaultConstraints } from '../../src/types/constraints.js';

describe('ACL Validation', () => {
  const constraints = createDefaultConstraints('test');

  describe('validatePathAcl', () => {
    it('should block derived.* paths', () => {
      const result = validatePathAcl('derived.observations', constraints, 'eff_1');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.issue).toBe('Forbidden path');
        expect(result.error.at).toBe('derived.observations');
      }
    });

    it('should block derived.computed paths', () => {
      const result = validatePathAcl('derived.computed.total', constraints, 'eff_2');
      expect(result.ok).toBe(false);
    });

    it('should allow data.* paths', () => {
      const result = validatePathAcl('data.user.name', constraints, 'eff_3');
      expect(result.ok).toBe(true);
    });

    it('should allow state.* paths', () => {
      const result = validatePathAcl('state.phase', constraints, 'eff_4');
      expect(result.ok).toBe(true);
    });

    it('should block paths not in writable prefixes', () => {
      const result = validatePathAcl('other.path', constraints, 'eff_5');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.issue).toBe('Forbidden path');
      }
    });

    it('should include advice in error', () => {
      const result = validatePathAcl('derived.test', constraints, 'eff_6');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.advice).toContain('runtime-managed');
      }
    });
  });

  describe('validatePathsAcl', () => {
    it('should validate multiple paths', () => {
      const result = validatePathsAcl(
        ['data.a', 'data.b', 'state.phase'],
        constraints,
        'eff_7'
      );
      expect(result.ok).toBe(true);
    });

    it('should fail on first invalid path', () => {
      const result = validatePathsAcl(
        ['data.a', 'derived.x', 'data.b'],
        constraints,
        'eff_8'
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.at).toBe('derived.x');
      }
    });
  });

  describe('FORBIDDEN_PATH_PREFIXES', () => {
    it('should include derived.', () => {
      expect(FORBIDDEN_PATH_PREFIXES).toContain('derived.');
    });
  });

  describe('Path type helpers', () => {
    it('isDerivedPath should detect derived paths', () => {
      expect(isDerivedPath('derived.observations')).toBe(true);
      expect(isDerivedPath('data.observations')).toBe(false);
    });

    it('isDataPath should detect data paths', () => {
      expect(isDataPath('data.user.name')).toBe(true);
      expect(isDataPath('state.phase')).toBe(false);
    });

    it('isStatePath should detect state paths', () => {
      expect(isStatePath('state.phase')).toBe(true);
      expect(isStatePath('data.phase')).toBe(false);
    });
  });

  describe('Custom constraints', () => {
    it('should respect custom writable prefixes', () => {
      const customConstraints = {
        ...constraints,
        writablePathPrefixes: ['custom.'],
      };

      const result1 = validatePathAcl('custom.field', customConstraints, 'eff_9');
      expect(result1.ok).toBe(true);

      const result2 = validatePathAcl('data.field', customConstraints, 'eff_10');
      expect(result2.ok).toBe(false);
    });
  });
});
