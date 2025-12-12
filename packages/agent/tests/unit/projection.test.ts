/**
 * @manifesto-ai/agent - Projection Tests
 *
 * 테스트 내용:
 * - ProjectionProvider 생성 및 동작
 * - 경로 기반 필터링
 * - 토큰 예산 관리
 * - 압축 전략
 */

import { describe, it, expect } from 'vitest';
import {
  createSimpleProjectionProvider,
  createIdentityProjectionProvider,
  createDynamicProjectionProvider,
} from '../../src/projection/provider.js';
import type { ProjectionProvider } from '../../src/projection/types.js';

describe('Projection Module', () => {
  // 테스트용 스냅샷
  const testSnapshot = {
    data: {
      user: { name: 'Test', email: 'test@example.com' },
      items: [
        { id: 1, title: 'Item 1' },
        { id: 2, title: 'Item 2' },
        { id: 3, title: 'Item 3' },
      ],
      settings: { theme: 'dark', language: 'ko' },
    },
    state: {
      phase: 'editing',
      isLoading: false,
    },
    derived: {
      itemCount: 3,
      observations: [],
    },
  };

  describe('createSimpleProjectionProvider', () => {
    it('should create a ProjectionProvider', () => {
      const provider = createSimpleProjectionProvider({
        paths: ['data.user', 'state.phase'],
      });

      expect(provider).toBeDefined();
      expect(typeof provider.project).toBe('function');
      expect(typeof provider.getMetadata).toBe('function');
      expect(typeof provider.getConfig).toBe('function');
    });

    it('should project specified paths only', () => {
      const provider = createSimpleProjectionProvider({
        paths: ['data.user.name', 'state.phase'],
      });

      const result = provider.project(testSnapshot);

      expect(result.snapshot.data?.user?.name).toBe('Test');
      expect(result.snapshot.state?.phase).toBe('editing');
      // 다른 경로는 포함되지 않아야 함
      expect(result.snapshot.data?.items).toBeUndefined();
      expect(result.snapshot.data?.settings).toBeUndefined();
    });

    it('should include required paths', () => {
      const provider = createSimpleProjectionProvider({
        paths: ['data.user'],
        config: {
          requiredPaths: ['state.phase'],
        },
      });

      const result = provider.project(testSnapshot);

      expect(result.snapshot.data?.user).toBeDefined();
      expect(result.snapshot.state?.phase).toBe('editing');
    });

    it('should exclude specified paths', () => {
      const provider = createSimpleProjectionProvider({
        paths: ['data.user', 'data.items', 'data.settings'],
        config: {
          excludePaths: ['data.items'],
        },
      });

      const result = provider.project(testSnapshot);

      expect(result.snapshot.data?.user).toBeDefined();
      expect(result.snapshot.data?.settings).toBeDefined();
      expect(result.snapshot.data?.items).toBeUndefined();
    });

    it('should return metadata', () => {
      const provider = createSimpleProjectionProvider({
        paths: ['data.user', 'state.phase'],
      });

      const result = provider.project(testSnapshot);

      expect(result.metadata.isProjected).toBe(true);
      expect(result.metadata.includedPaths).toContain('data.user');
      expect(result.metadata.includedPaths).toContain('state.phase');
      expect(typeof result.metadata.tokenCount).toBe('number');
      expect(result.metadata.tokenCount).toBeGreaterThan(0);
    });

    it('should track metadata after projection', () => {
      const provider = createSimpleProjectionProvider({
        paths: ['data.user'],
      });

      // 초기에는 metadata가 없음
      expect(provider.getMetadata()).toBeUndefined();

      // projection 후 metadata가 있음
      provider.project(testSnapshot);
      const metadata = provider.getMetadata();
      expect(metadata).toBeDefined();
      expect(metadata?.isProjected).toBe(true);
    });

    it('should apply truncate compression when over budget', () => {
      // 많은 아이템이 있는 큰 스냅샷
      const largeSnapshot = {
        data: {
          items: Array.from({ length: 100 }, (_, i) => ({
            id: i,
            title: `Item ${i}`,
            description: `This is a longer description for item number ${i} that takes up more tokens`,
          })),
        },
        state: { phase: 'test' },
        derived: {},
      };

      // 매우 작은 토큰 예산 설정
      const provider = createSimpleProjectionProvider({
        paths: ['data.items'],
        config: {
          tokenBudget: 100,
          compressionStrategy: 'truncate',
        },
      });

      const result = provider.project(largeSnapshot);

      // 압축이 적용되었는지 확인
      expect(result.metadata.compressed).toBe(true);
      expect(result.metadata.compressionStrategy).toBe('truncate');
    });

    it('should respect tokenBudget configuration', () => {
      const config = {
        tokenBudget: 2000,
        compressionStrategy: 'truncate' as const,
      };

      const provider = createSimpleProjectionProvider({
        paths: ['data'],
        config,
      });

      expect(provider.getConfig().tokenBudget).toBe(2000);
    });
  });

  describe('createIdentityProjectionProvider', () => {
    it('should return full snapshot unchanged', () => {
      const provider = createIdentityProjectionProvider();

      const result = provider.project(testSnapshot);

      expect(result.snapshot).toEqual(testSnapshot);
    });

    it('should mark isProjected as false', () => {
      const provider = createIdentityProjectionProvider();

      const result = provider.project(testSnapshot);

      expect(result.metadata.isProjected).toBe(false);
    });

    it('should estimate token count', () => {
      const provider = createIdentityProjectionProvider();

      const result = provider.project(testSnapshot);

      expect(result.metadata.tokenCount).toBeGreaterThan(0);
    });
  });

  describe('createDynamicProjectionProvider', () => {
    it('should resolve paths dynamically based on snapshot', () => {
      const provider = createDynamicProjectionProvider({
        pathResolver: (snapshot: typeof testSnapshot) => {
          const paths = ['state.phase'];
          if (snapshot.state.phase === 'editing') {
            paths.push('data.user');
          }
          return paths;
        },
      });

      const result = provider.project(testSnapshot);

      expect(result.snapshot.state?.phase).toBe('editing');
      expect(result.snapshot.data?.user).toBeDefined();
      expect(result.snapshot.data?.items).toBeUndefined();
    });

    it('should include required paths in addition to dynamic paths', () => {
      const provider = createDynamicProjectionProvider({
        pathResolver: () => ['data.user'],
        config: {
          requiredPaths: ['state.phase'],
        },
      });

      const result = provider.project(testSnapshot);

      expect(result.snapshot.data?.user).toBeDefined();
      expect(result.snapshot.state?.phase).toBe('editing');
    });
  });

  describe('Path extraction', () => {
    it('should handle nested paths', () => {
      const provider = createSimpleProjectionProvider({
        paths: ['data.user.name', 'data.settings.theme'],
      });

      const result = provider.project(testSnapshot);

      expect(result.snapshot.data?.user?.name).toBe('Test');
      expect(result.snapshot.data?.settings?.theme).toBe('dark');
      // email은 포함되지 않아야 함
      expect(result.snapshot.data?.user?.email).toBeUndefined();
    });

    it('should handle array paths', () => {
      const provider = createSimpleProjectionProvider({
        paths: ['data.items.0', 'data.items.1'],
      });

      const result = provider.project(testSnapshot);

      expect(result.snapshot.data?.items?.[0]).toEqual({ id: 1, title: 'Item 1' });
      expect(result.snapshot.data?.items?.[1]).toEqual({ id: 2, title: 'Item 2' });
      // items.2는 포함되지 않아야 함
      expect(result.snapshot.data?.items?.[2]).toBeUndefined();
    });

    it('should handle non-existent paths gracefully', () => {
      const provider = createSimpleProjectionProvider({
        paths: ['data.nonexistent', 'data.user.name'],
      });

      const result = provider.project(testSnapshot);

      // 존재하는 경로만 포함
      expect(result.snapshot.data?.user?.name).toBe('Test');
      // 존재하지 않는 경로는 무시
      expect(result.snapshot.data?.nonexistent).toBeUndefined();
    });
  });

  describe('Token estimation', () => {
    it('should use custom token estimator if provided', () => {
      const customEstimator = (obj: unknown) => {
        const str = JSON.stringify(obj);
        return str.length; // 글자 수 그대로 반환
      };

      const provider = createSimpleProjectionProvider({
        paths: ['data.user'],
        config: {
          tokenEstimator: customEstimator,
        },
      });

      const result = provider.project(testSnapshot);
      const jsonStr = JSON.stringify(result.snapshot);

      // 커스텀 추정기는 문자열 길이를 반환
      expect(result.metadata.tokenCount).toBe(jsonStr.length);
    });
  });
});
