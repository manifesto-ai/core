import { describe, it, expect } from 'vitest';
import {
  estimateTokens,
  estimateTokensByPath,
  rankPathsByTokenCost,
  getValueByPath,
  setValueByPath,
  selectPathsWithinBudget,
} from '../../src/projection/token-estimator.js';
import type { ProjectedSnapshot } from '../../src/projection/types.js';

describe('token-estimator', () => {
  describe('estimateTokens', () => {
    it('should estimate tokens for simple string', () => {
      const tokens = estimateTokens('Hello world');
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThan(10);
    });

    it('should estimate more tokens for Korean text', () => {
      const englishTokens = estimateTokens('Hello');
      const koreanTokens = estimateTokens('안녕하세요');

      // 한글은 영어보다 토큰을 더 많이 사용
      expect(koreanTokens).toBeGreaterThanOrEqual(englishTokens);
    });

    it('should estimate tokens for object', () => {
      const obj = {
        name: 'John',
        age: 30,
        items: ['a', 'b', 'c'],
      };
      const tokens = estimateTokens(obj);
      expect(tokens).toBeGreaterThan(0);
    });

    it('should return 1 for null/undefined', () => {
      expect(estimateTokens(null)).toBe(1);
      expect(estimateTokens(undefined)).toBe(1);
    });

    it('should estimate tokens for nested objects', () => {
      const obj = {
        level1: {
          level2: {
            level3: {
              value: 'deep nested value',
            },
          },
        },
      };
      const tokens = estimateTokens(obj);
      expect(tokens).toBeGreaterThan(10);
    });
  });

  describe('getValueByPath', () => {
    const snapshot: ProjectedSnapshot = {
      data: {
        user: {
          name: 'John',
          age: 30,
        },
      },
      state: {
        loading: false,
        query: 'test query',
      },
      derived: {
        total: 100,
      },
    };

    it('should get value from data namespace', () => {
      const value = getValueByPath(snapshot, 'data.user.name');
      expect(value).toBe('John');
    });

    it('should get value from state namespace', () => {
      const value = getValueByPath(snapshot, 'state.query');
      expect(value).toBe('test query');
    });

    it('should get nested object', () => {
      const value = getValueByPath(snapshot, 'data.user');
      expect(value).toEqual({ name: 'John', age: 30 });
    });

    it('should return undefined for non-existent path', () => {
      const value = getValueByPath(snapshot, 'data.nonexistent');
      expect(value).toBeUndefined();
    });

    it('should return undefined for null object', () => {
      const value = getValueByPath(null, 'any.path');
      expect(value).toBeUndefined();
    });
  });

  describe('setValueByPath', () => {
    it('should set value at path', () => {
      const obj: Record<string, unknown> = {};
      setValueByPath(obj, 'data.user.name', 'John');

      expect(obj).toEqual({
        data: {
          user: {
            name: 'John',
          },
        },
      });
    });

    it('should create nested structure', () => {
      const obj: Record<string, unknown> = {};
      setValueByPath(obj, 'a.b.c.d', 'value');

      expect(obj).toEqual({
        a: {
          b: {
            c: {
              d: 'value',
            },
          },
        },
      });
    });

    it('should preserve existing values', () => {
      const obj: Record<string, unknown> = {
        data: {
          existing: 'value',
        },
      };
      setValueByPath(obj, 'data.new', 'newValue');

      expect(obj.data).toEqual({
        existing: 'value',
        new: 'newValue',
      });
    });
  });

  describe('estimateTokensByPath', () => {
    it('should estimate tokens for specific path', () => {
      const snapshot: ProjectedSnapshot = {
        data: {
          largeArray: Array(100).fill('item'),
        },
        state: {
          small: 'value',
        },
      };

      const largeTokens = estimateTokensByPath(snapshot, 'data.largeArray');
      const smallTokens = estimateTokensByPath(snapshot, 'state.small');

      expect(largeTokens).toBeGreaterThan(smallTokens);
    });

    it('should return 0 for non-existent path', () => {
      const snapshot: ProjectedSnapshot = {};
      const tokens = estimateTokensByPath(snapshot, 'nonexistent');
      expect(tokens).toBe(0);
    });
  });

  describe('rankPathsByTokenCost', () => {
    it('should rank paths by token cost ascending', () => {
      const snapshot: ProjectedSnapshot = {
        data: {
          large: Array(100).fill('item'),
          medium: Array(10).fill('item'),
          small: 'single',
        },
      };

      const paths = ['data.large', 'data.medium', 'data.small'];
      const ranked = rankPathsByTokenCost(snapshot, paths);

      expect(ranked[0].path).toBe('data.small');
      expect(ranked[1].path).toBe('data.medium');
      expect(ranked[2].path).toBe('data.large');

      // 토큰 수가 오름차순인지 확인
      expect(ranked[0].tokens).toBeLessThanOrEqual(ranked[1].tokens);
      expect(ranked[1].tokens).toBeLessThanOrEqual(ranked[2].tokens);
    });
  });

  describe('selectPathsWithinBudget', () => {
    it('should select paths within budget', () => {
      const snapshot: ProjectedSnapshot = {
        data: {
          a: 'short',
          b: Array(100).fill('x'),
          c: 'another short',
        },
      };

      const paths = ['data.a', 'data.b', 'data.c'];
      const result = selectPathsWithinBudget(snapshot, paths, 100);

      // 작은 경로들이 선택되고 큰 경로는 제외됨
      expect(result.selected).toContain('data.a');
      expect(result.selected).toContain('data.c');
      expect(result.excluded).toContain('data.b');
      expect(result.totalTokens).toBeLessThanOrEqual(100);
    });

    it('should include all paths if budget is sufficient', () => {
      const snapshot: ProjectedSnapshot = {
        data: {
          a: 'short',
          b: 'also short',
        },
      };

      const paths = ['data.a', 'data.b'];
      const result = selectPathsWithinBudget(snapshot, paths, 10000);

      expect(result.selected).toHaveLength(2);
      expect(result.excluded).toHaveLength(0);
    });

    it('should return empty selected if budget is too small', () => {
      const snapshot: ProjectedSnapshot = {
        data: {
          large: Array(1000).fill('item'),
        },
      };

      const paths = ['data.large'];
      const result = selectPathsWithinBudget(snapshot, paths, 10);

      // 최소 오버헤드도 못 맞추면 빈 배열
      expect(result.selected).toHaveLength(0);
      expect(result.excluded).toHaveLength(1);
    });
  });
});
