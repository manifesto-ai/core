import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  defineDomain,
  defineAction,
  defineSource,
  setState,
  isOk,
  isErr,
} from '../../src/index.js';
import { createSnapshot } from '../../src/runtime/snapshot.js';
import { ProjectionEngine, createProjectionEngine } from '../../src/projection/engine.js';

// 테스트용 도메인 정의
const testDataSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
    })
  ),
  metadata: z.object({
    total: z.number(),
    version: z.string(),
  }),
});

const testStateSchema = z.object({
  currentQuery: z.string(),
  loading: z.boolean(),
  results: z.array(z.string()),
});

type TestData = z.infer<typeof testDataSchema>;
type TestState = z.infer<typeof testStateSchema>;

const testDomain = defineDomain<TestData, TestState>({
  id: 'test-domain',
  name: 'Test Domain',
  description: 'Domain for testing projection engine',
  dataSchema: testDataSchema,
  stateSchema: testStateSchema,
  initialState: {
    currentQuery: '',
    loading: false,
    results: [],
  },
  paths: {
    sources: {
      'data.items': defineSource({
        schema: z.array(z.object({ id: z.string(), name: z.string(), description: z.string() })),
        semantic: { type: 'array', description: 'List of items' },
      }),
    },
    derived: {},
    async: {},
  },
  actions: {
    // projectionScope가 있는 액션
    analyzeQuery: defineAction({
      deps: ['state.currentQuery'],
      projectionScope: ['state.currentQuery'],
      effect: setState('state.loading', true, 'Set loading'),
      semantic: {
        type: 'action',
        verb: 'analyze',
        description: 'Analyze current query',
      },
    }),

    // projectionScope가 배열인 액션
    processItems: defineAction({
      deps: ['data.items', 'state.results'],
      projectionScope: ['data.items', 'state.results'],
      effect: setState('state.loading', false, 'Finish processing'),
      semantic: {
        type: 'action',
        verb: 'process',
        description: 'Process items',
      },
    }),

    // projectionScope가 config 객체인 액션
    searchWithBudget: defineAction({
      deps: ['data.items', 'state.currentQuery'],
      projectionScope: {
        paths: ['data.items', 'state.currentQuery'],
        tokenBudget: 500,
        compressionStrategy: 'truncate',
      },
      effect: setState('state.loading', false, 'Finish search'),
      semantic: {
        type: 'action',
        verb: 'search',
        description: 'Search with token budget',
      },
    }),

    // projectionScope가 없는 액션
    noScopeAction: defineAction({
      deps: ['state.loading'],
      effect: setState('state.loading', false, 'No scope'),
      semantic: {
        type: 'action',
        verb: 'toggle',
        description: 'No projection scope',
      },
    }),
  },
});

describe('ProjectionEngine', () => {
  const engine = new ProjectionEngine(testDomain);

  // 테스트 스냅샷
  const snapshot = createSnapshot<TestData, TestState>(
    {
      items: [
        { id: '1', name: 'Item 1', description: 'First item' },
        { id: '2', name: 'Item 2', description: 'Second item' },
        { id: '3', name: 'Item 3', description: 'Third item' },
      ],
      metadata: { total: 3, version: '1.0' },
    },
    {
      currentQuery: 'test query',
      loading: false,
      results: ['result1', 'result2'],
    }
  );

  describe('createLLMContext', () => {
    it('should project snapshot to specified paths only', () => {
      const result = engine.createLLMContext('analyzeQuery', snapshot);

      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      const { snapshot: projected, projectionScope } = result.value;

      // projectionScope에 지정된 경로만 포함
      expect(projectionScope).toEqual(['state.currentQuery']);
      expect(projected.state?.currentQuery).toBe('test query');

      // 포함되지 않은 경로는 없어야 함
      expect(projected.data).toBeUndefined();
      expect(projected.state?.loading).toBeUndefined();
    });

    it('should estimate token count correctly', () => {
      const result = engine.createLLMContext('analyzeQuery', snapshot);

      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      expect(result.value.tokenCount).toBeGreaterThan(0);
      expect(result.value.tokenCount).toBeLessThan(100); // 짧은 query만 포함
    });

    it('should handle multiple paths', () => {
      const result = engine.createLLMContext('processItems', snapshot);

      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      expect(result.value.snapshot.data?.items).toHaveLength(3);
      expect(result.value.snapshot.state?.results).toHaveLength(2);
    });

    it('should return error for unknown action', () => {
      const result = engine.createLLMContext('unknownAction', snapshot);

      expect(isErr(result)).toBe(true);
      if (!isErr(result)) return;

      expect(result.error.code).toBe('UNKNOWN_ACTION');
    });

    it('should handle empty projectionScope with warning', () => {
      // warnOnMissingScope: false로 설정한 엔진
      const silentEngine = new ProjectionEngine(testDomain, {
        warnOnMissingScope: false,
      });

      const result = silentEngine.createLLMContext('noScopeAction', snapshot);

      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      expect(result.value.projectionScope).toHaveLength(0);
      expect(result.value.tokenCount).toBe(0);
      expect(Object.keys(result.value.snapshot)).toHaveLength(0);
    });

    it('should support both array and config formats', () => {
      // 배열 형식
      const arrayResult = engine.createLLMContext('processItems', snapshot);
      expect(isOk(arrayResult)).toBe(true);

      // 설정 객체 형식
      const configResult = engine.createLLMContext('searchWithBudget', snapshot);
      expect(isOk(configResult)).toBe(true);
    });
  });

  describe('compression', () => {
    // 대용량 데이터로 스냅샷 생성
    const largeSnapshot = createSnapshot<TestData, TestState>(
      {
        items: Array(1000)
          .fill(null)
          .map((_, i) => ({
            id: `id-${i}`,
            name: `Item ${i}`,
            description: `This is a very long description for item ${i} that takes up many tokens`,
          })),
        metadata: { total: 1000, version: '1.0' },
      },
      {
        currentQuery: 'test',
        loading: false,
        results: [],
      }
    );

    it('should compress when over budget', () => {
      const result = engine.createLLMContext('searchWithBudget', largeSnapshot);

      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      // 압축이 적용됨
      expect(result.value.compressed).toBe(true);
      expect(result.value.compressionMetadata).toBeDefined();
      expect(result.value.tokenCount).toBeLessThanOrEqual(500);
    });

    it('should track compression metadata', () => {
      const result = engine.createLLMContext('searchWithBudget', largeSnapshot);

      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      const meta = result.value.compressionMetadata;
      expect(meta).toBeDefined();
      expect(meta!.originalTokenCount).toBeGreaterThan(500);
      expect(meta!.strategy).toBe('truncate');
      expect(meta!.itemsRemoved).toBeGreaterThan(0);
    });
  });

  describe('createLLMContextBatch', () => {
    it('should create contexts for multiple actions', () => {
      const results = engine.createLLMContextBatch(
        ['analyzeQuery', 'processItems'],
        snapshot
      );

      expect(results.size).toBe(2);
      expect(isOk(results.get('analyzeQuery')!)).toBe(true);
      expect(isOk(results.get('processItems')!)).toBe(true);
    });

    it('should include errors for unknown actions', () => {
      const results = engine.createLLMContextBatch(
        ['analyzeQuery', 'unknownAction'],
        snapshot
      );

      expect(results.size).toBe(2);
      expect(isOk(results.get('analyzeQuery')!)).toBe(true);
      expect(isErr(results.get('unknownAction')!)).toBe(true);
    });
  });

  describe('projectPaths', () => {
    it('should project specific paths directly', () => {
      const result = engine.projectPaths(snapshot, ['data.metadata', 'state.loading']);

      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      expect(result.value.snapshot.data?.metadata).toEqual({
        total: 3,
        version: '1.0',
      });
      expect(result.value.snapshot.state?.loading).toBe(false);
      expect(result.value.actionId).toBe('__direct__');
    });

    it('should return error for empty paths', () => {
      const result = engine.projectPaths(snapshot, []);

      expect(isErr(result)).toBe(true);
      if (!isErr(result)) return;

      expect(result.error.code).toBe('EMPTY_PROJECTION');
    });
  });

  describe('estimateActionTokens', () => {
    it('should estimate tokens for action with sample snapshot', () => {
      const tokens = engine.estimateActionTokens('analyzeQuery', snapshot);
      expect(tokens).toBeGreaterThan(0);
    });

    it('should return rough estimate without snapshot', () => {
      const tokens = engine.estimateActionTokens('processItems');
      // 경로당 100토큰 추정
      expect(tokens).toBe(200); // 2 paths * 100
    });

    it('should return -1 for unknown action', () => {
      const tokens = engine.estimateActionTokens('unknownAction');
      expect(tokens).toBe(-1);
    });

    it('should return 0 for action with empty scope', () => {
      const tokens = engine.estimateActionTokens('noScopeAction');
      expect(tokens).toBe(0);
    });
  });

  describe('validateAllScopes', () => {
    it('should identify actions with empty scope', () => {
      const result = engine.validateAllScopes();

      expect(result.valid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);

      const emptyIssue = result.issues.find((i) =>
        i.issue.includes('Empty projectionScope')
      );
      expect(emptyIssue).toBeDefined();
      expect(emptyIssue!.actionId).toBe('noScopeAction');
    });
  });

  describe('createProjectionEngine helper', () => {
    it('should create engine with default config', () => {
      const engine = createProjectionEngine(testDomain);
      expect(engine).toBeInstanceOf(ProjectionEngine);
    });

    it('should create engine with custom config', () => {
      const engine = createProjectionEngine(testDomain, {
        defaultTokenBudget: 2000,
        warnOnMissingScope: false,
      });

      // 엔진이 올바르게 생성됨
      const result = engine.createLLMContext('analyzeQuery', snapshot);
      expect(isOk(result)).toBe(true);
    });
  });
});
