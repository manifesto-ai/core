import { describe, it, expect } from 'vitest';
import type { Effect, SemanticPath } from '@manifesto-ai/core';
import {
  describeEffect,
  describeCompositeEffect,
  predictEffect,
  extractAffectedPaths,
  countSideEffects,
  hasApiCall,
  hasNavigation,
} from '../../src/analyzers/effect-predictor.js';

describe('Effect Predictor', () => {
  describe('describeEffect', () => {
    it('should describe SetValue effect', () => {
      const effect: Effect = {
        _tag: 'SetValue',
        path: 'data.name' as SemanticPath,
        value: 'John',
        description: 'Set user name',
      };
      expect(describeEffect(effect)).toBe('Set user name');
    });

    it('should generate description for SetValue without description', () => {
      const effect: Effect = {
        _tag: 'SetValue',
        path: 'data.name' as SemanticPath,
        value: 'John',
      };
      expect(describeEffect(effect)).toContain('data.name');
    });

    it('should describe SetState effect', () => {
      const effect: Effect = {
        _tag: 'SetState',
        path: 'state.loading' as SemanticPath,
        value: true,
        description: 'Set loading state',
      };
      expect(describeEffect(effect)).toBe('Set loading state');
    });

    it('should describe ApiCall effect', () => {
      const effect: Effect = {
        _tag: 'ApiCall',
        endpoint: '/api/users',
        method: 'POST',
        description: 'Create user',
      };
      expect(describeEffect(effect)).toBe('Create user');
    });

    it('should describe Navigate effect', () => {
      const effect: Effect = {
        _tag: 'Navigate',
        to: '/dashboard',
        description: 'Go to dashboard',
      };
      expect(describeEffect(effect)).toBe('Go to dashboard');
    });

    it('should describe Delay effect', () => {
      const effect: Effect = {
        _tag: 'Delay',
        ms: 1000,
        description: 'Wait 1 second',
      };
      expect(describeEffect(effect)).toBe('Wait 1 second');
    });

    it('should describe EmitEvent effect', () => {
      const effect: Effect = {
        _tag: 'EmitEvent',
        channel: 'notifications',
        payload: { type: 'success' },
        description: 'Show success message',
      };
      expect(describeEffect(effect)).toBe('Show success message');
    });

    it('should describe Sequence effect', () => {
      const effect: Effect = {
        _tag: 'Sequence',
        effects: [
          { _tag: 'SetValue', path: 'data.a' as SemanticPath, value: 1 },
          { _tag: 'SetValue', path: 'data.b' as SemanticPath, value: 2 },
        ],
      };
      expect(describeEffect(effect)).toContain('2 steps');
    });

    it('should describe Parallel effect', () => {
      const effect: Effect = {
        _tag: 'Parallel',
        effects: [
          { _tag: 'SetValue', path: 'data.a' as SemanticPath, value: 1 },
          { _tag: 'SetValue', path: 'data.b' as SemanticPath, value: 2 },
        ],
      };
      expect(describeEffect(effect)).toContain('parallel');
    });
  });

  describe('describeCompositeEffect', () => {
    it('should describe nested effects', () => {
      const effect: Effect = {
        _tag: 'Sequence',
        effects: [
          { _tag: 'SetValue', path: 'data.a' as SemanticPath, value: 1, description: 'Set A' },
          { _tag: 'SetValue', path: 'data.b' as SemanticPath, value: 2, description: 'Set B' },
        ],
      };
      const descriptions = describeCompositeEffect(effect);
      expect(descriptions.length).toBeGreaterThan(1);
      expect(descriptions.some((d) => d.includes('Set A'))).toBe(true);
      expect(descriptions.some((d) => d.includes('Set B'))).toBe(true);
    });
  });

  describe('predictEffect', () => {
    it('should predict SetValue effects', () => {
      const effect: Effect = {
        _tag: 'SetValue',
        path: 'data.name' as SemanticPath,
        value: 'John',
      };
      const predictions = predictEffect(effect);
      expect(predictions).toHaveLength(1);
      expect(predictions[0].sideEffectType).toBe('data');
      expect(predictions[0].affectedPaths).toContain('data.name');
    });

    it('should predict ApiCall effects', () => {
      const effect: Effect = {
        _tag: 'ApiCall',
        endpoint: '/api/users',
        method: 'POST',
        description: 'Create user',
      };
      const predictions = predictEffect(effect);
      expect(predictions).toHaveLength(1);
      expect(predictions[0].sideEffectType).toBe('api');
    });

    it('should predict Navigate effects', () => {
      const effect: Effect = {
        _tag: 'Navigate',
        to: '/dashboard',
        description: 'Go to dashboard',
      };
      const predictions = predictEffect(effect);
      expect(predictions).toHaveLength(1);
      expect(predictions[0].sideEffectType).toBe('navigation');
    });

    it('should skip Delay effects', () => {
      const effect: Effect = {
        _tag: 'Delay',
        ms: 1000,
        description: 'Wait',
      };
      const predictions = predictEffect(effect);
      expect(predictions).toHaveLength(0);
    });
  });

  describe('extractAffectedPaths', () => {
    it('should extract paths from SetValue', () => {
      const effect: Effect = {
        _tag: 'SetValue',
        path: 'data.name' as SemanticPath,
        value: 'John',
      };
      const paths = extractAffectedPaths(effect);
      expect(paths).toContain('data.name');
    });

    it('should extract paths from nested effects', () => {
      const effect: Effect = {
        _tag: 'Sequence',
        effects: [
          { _tag: 'SetValue', path: 'data.a' as SemanticPath, value: 1 },
          { _tag: 'SetValue', path: 'data.b' as SemanticPath, value: 2 },
        ],
      };
      const paths = extractAffectedPaths(effect);
      expect(paths).toContain('data.a');
      expect(paths).toContain('data.b');
    });

    it('should deduplicate paths', () => {
      const effect: Effect = {
        _tag: 'Sequence',
        effects: [
          { _tag: 'SetValue', path: 'data.a' as SemanticPath, value: 1 },
          { _tag: 'SetValue', path: 'data.a' as SemanticPath, value: 2 },
        ],
      };
      const paths = extractAffectedPaths(effect);
      expect(paths).toHaveLength(1);
    });
  });

  describe('countSideEffects', () => {
    it('should count single effects', () => {
      const effect: Effect = {
        _tag: 'SetValue',
        path: 'data.name' as SemanticPath,
        value: 'John',
      };
      expect(countSideEffects(effect)).toBe(1);
    });

    it('should count nested effects', () => {
      const effect: Effect = {
        _tag: 'Sequence',
        effects: [
          { _tag: 'SetValue', path: 'data.a' as SemanticPath, value: 1 },
          { _tag: 'SetValue', path: 'data.b' as SemanticPath, value: 2 },
          { _tag: 'ApiCall', endpoint: '/api', method: 'GET', description: 'Fetch' },
        ],
      };
      expect(countSideEffects(effect)).toBe(3);
    });

    it('should not count Delay effects', () => {
      const effect: Effect = {
        _tag: 'Sequence',
        effects: [
          { _tag: 'SetValue', path: 'data.a' as SemanticPath, value: 1 },
          { _tag: 'Delay', ms: 1000, description: 'Wait' },
        ],
      };
      expect(countSideEffects(effect)).toBe(1);
    });
  });

  describe('hasApiCall', () => {
    it('should detect direct ApiCall', () => {
      const effect: Effect = {
        _tag: 'ApiCall',
        endpoint: '/api',
        method: 'GET',
        description: 'Fetch',
      };
      expect(hasApiCall(effect)).toBe(true);
    });

    it('should detect nested ApiCall', () => {
      const effect: Effect = {
        _tag: 'Sequence',
        effects: [
          { _tag: 'SetValue', path: 'data.a' as SemanticPath, value: 1 },
          { _tag: 'ApiCall', endpoint: '/api', method: 'GET', description: 'Fetch' },
        ],
      };
      expect(hasApiCall(effect)).toBe(true);
    });

    it('should return false when no ApiCall', () => {
      const effect: Effect = {
        _tag: 'SetValue',
        path: 'data.name' as SemanticPath,
        value: 'John',
      };
      expect(hasApiCall(effect)).toBe(false);
    });
  });

  describe('hasNavigation', () => {
    it('should detect direct Navigate', () => {
      const effect: Effect = {
        _tag: 'Navigate',
        to: '/dashboard',
        description: 'Go',
      };
      expect(hasNavigation(effect)).toBe(true);
    });

    it('should detect nested Navigate', () => {
      const effect: Effect = {
        _tag: 'Sequence',
        effects: [
          { _tag: 'SetValue', path: 'data.a' as SemanticPath, value: 1 },
          { _tag: 'Navigate', to: '/dashboard', description: 'Go' },
        ],
      };
      expect(hasNavigation(effect)).toBe(true);
    });

    it('should return false when no Navigate', () => {
      const effect: Effect = {
        _tag: 'SetValue',
        path: 'data.name' as SemanticPath,
        value: 'John',
      };
      expect(hasNavigation(effect)).toBe(false);
    });
  });
});
