import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ok, err } from '@manifesto-ai/core';
import type { Result } from '@manifesto-ai/core';
import { ReasoningLoop, createReasoningLoop } from '../../src/loop/loop.js';
import type { LoopDependencies, LoopResult, LoopError } from '../../src/loop/types.js';
import type { ILLMClient, LLMMessage, LLMResponse, LLMError } from '../../src/llm/index.js';
import type { IContextQueryEngine } from '../../src/cqe/index.js';
import type { CompressionTree } from '../../src/sct/index.js';
import type { RetrievedNode, ParsedQuery, ReasoningState } from '../../src/reasoning/index.js';
import { createReasoningState, setQueryStatus } from '../../src/reasoning/index.js';

// ═══════════════════════════════════════════════════════
// Mock 생성 헬퍼
// ═══════════════════════════════════════════════════════

function createMockLLMClient(): ILLMClient {
  return {
    call: vi.fn(),
  };
}

function createMockCQEEngine(): IContextQueryEngine {
  return {
    retrieve: vi.fn(),
    expandNode: vi.fn(),
  };
}

function createMockTree(): CompressionTree {
  return {
    rootId: 'root',
    nodes: new Map([
      [
        'root',
        {
          nodeId: 'root',
          level: 0,
          summary: 'Root summary',
          tokenCount: 50,
          children: ['child-1'],
          parentId: null,
          semanticPath: 'root',
        },
      ],
      [
        'child-1',
        {
          nodeId: 'child-1',
          level: 1,
          summary: 'Child 1 summary with relevant info',
          tokenCount: 100,
          children: [],
          parentId: 'root',
          semanticPath: 'root.child1',
        },
      ],
    ]),
    maxLevel: 1,
    totalTokens: 150,
    schemaVersion: '1.0.0',
    metadata: {
      createdAt: new Date().toISOString(),
      sourceType: 'test',
    },
  };
}

function createMockRetrievedNode(overrides: Partial<RetrievedNode> = {}): RetrievedNode {
  return {
    nodeId: 'test-node',
    level: 1,
    summary: 'Test summary',
    relevance: 0.7,
    tokenCount: 100,
    semanticPaths: ['test.path'],
    ...overrides,
  };
}

function createMockParsedQuery(overrides: Partial<ParsedQuery> = {}): ParsedQuery {
  return {
    intent: 'lookup',
    targetPaths: ['test.path'],
    constraints: [],
    expectedDepth: 1,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════

describe('ReasoningLoop', () => {
  let mockLLM: ILLMClient;
  let mockCQE: IContextQueryEngine;
  let mockTree: CompressionTree;

  beforeEach(() => {
    mockLLM = createMockLLMClient();
    mockCQE = createMockCQEEngine();
    mockTree = createMockTree();
  });

  describe('constructor', () => {
    it('should create instance with dependencies', () => {
      const deps: LoopDependencies = {
        llmClient: mockLLM,
        cqeEngine: mockCQE,
      };

      const loop = new ReasoningLoop(deps);

      expect(loop).toBeInstanceOf(ReasoningLoop);
    });

    it('should merge custom config with defaults', () => {
      const deps: LoopDependencies = {
        llmClient: mockLLM,
        cqeEngine: mockCQE,
        config: {
          maxIterations: 10,
          tokenBudget: 8000,
        },
      };

      const loop = new ReasoningLoop(deps);

      expect(loop).toBeInstanceOf(ReasoningLoop);
    });
  });

  describe('createReasoningLoop factory', () => {
    it('should create IReasoningLoop instance', () => {
      const deps: LoopDependencies = {
        llmClient: mockLLM,
        cqeEngine: mockCQE,
      };

      const loop = createReasoningLoop(deps);

      expect(loop).toBeDefined();
      expect(typeof loop.run).toBe('function');
      expect(typeof loop.continue).toBe('function');
    });
  });

  describe('run', () => {
    it('should complete with answer for high relevance context', async () => {
      // LLM mock: analyze → answer
      const llmCall = vi.fn()
        .mockResolvedValueOnce(
          ok({
            content: JSON.stringify(createMockParsedQuery()),
            usage: { inputTokens: 100, outputTokens: 50 },
          })
        )
        .mockResolvedValueOnce(
          ok({
            content: '2024년 3분기 매출은 100억원입니다.',
            usage: { inputTokens: 200, outputTokens: 100 },
          })
        );
      (mockLLM as { call: typeof llmCall }).call = llmCall;

      // CQE mock: retrieve returns high relevance nodes
      const cqeRetrieve = vi.fn().mockReturnValue(
        ok([
          createMockRetrievedNode({ nodeId: 'a', relevance: 0.8 }),
          createMockRetrievedNode({ nodeId: 'b', relevance: 0.7 }),
        ])
      );
      (mockCQE as { retrieve: typeof cqeRetrieve }).retrieve = cqeRetrieve;

      const loop = createReasoningLoop({
        llmClient: mockLLM,
        cqeEngine: mockCQE,
      });

      const result = await loop.run('2024년 3분기 매출은?', mockTree);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.conclusion.type).toBe('answer');
        expect(result.value.conclusion.content).toContain('100억원');
      }
    });

    it('should conclude not_found for low relevance context after attempts', async () => {
      // LLM mock: analyze only (not_found doesn't call LLM)
      const llmCall = vi.fn().mockResolvedValueOnce(
        ok({
          content: JSON.stringify(createMockParsedQuery()),
          usage: { inputTokens: 100, outputTokens: 50 },
        })
      );
      (mockLLM as { call: typeof llmCall }).call = llmCall;

      // CQE mock: retrieve returns very low relevance nodes
      const cqeRetrieve = vi.fn().mockReturnValue(
        ok([
          createMockRetrievedNode({ nodeId: 'a', relevance: 0.1 }),
          createMockRetrievedNode({ nodeId: 'b', relevance: 0.2 }),
        ])
      );
      // expandNode for first attempt
      const cqeExpand = vi.fn().mockReturnValue(
        ok([createMockRetrievedNode({ nodeId: 'a-1', relevance: 0.15 })])
      );
      (mockCQE as { retrieve: typeof cqeRetrieve }).retrieve = cqeRetrieve;
      (mockCQE as { expandNode: typeof cqeExpand }).expandNode = cqeExpand;

      const loop = createReasoningLoop({
        llmClient: mockLLM,
        cqeEngine: mockCQE,
        config: {
          relevanceThreshold: 0.3,
          minAttemptsForNotFound: 2,
        },
      });

      const result = await loop.run('존재하지 않는 정보', mockTree);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.conclusion.type).toBe('not_found');
        // ★ 핵심: not_found는 LLM 호출 없이 시스템이 결정
        // analyze에서 1번만 호출되어야 함
        expect(llmCall).toHaveBeenCalledTimes(1);
      }
    });

    it('should expand nodes when relevance is low but not not_found', async () => {
      // LLM mock: analyze only
      const llmCall = vi.fn().mockResolvedValueOnce(
        ok({
          content: JSON.stringify(createMockParsedQuery()),
          usage: { inputTokens: 100, outputTokens: 50 },
        })
      ).mockResolvedValueOnce(
        ok({
          content: '확장 후 답변입니다.',
          usage: { inputTokens: 200, outputTokens: 100 },
        })
      );
      (mockLLM as { call: typeof llmCall }).call = llmCall;

      // CQE mock: retrieve returns medium relevance, expand returns higher
      const cqeRetrieve = vi.fn().mockReturnValue(
        ok([createMockRetrievedNode({ nodeId: 'a', relevance: 0.4 })])
      );
      const cqeExpand = vi.fn().mockReturnValue(
        ok([createMockRetrievedNode({ nodeId: 'a-1', relevance: 0.8 })])
      );
      (mockCQE as { retrieve: typeof cqeRetrieve }).retrieve = cqeRetrieve;
      (mockCQE as { expandNode: typeof cqeExpand }).expandNode = cqeExpand;

      const loop = createReasoningLoop({
        llmClient: mockLLM,
        cqeEngine: mockCQE,
        config: {
          expansionThreshold: 0.5,
        },
      });

      const result = await loop.run('확장이 필요한 질문', mockTree);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // expand가 호출되었는지 확인
        expect(cqeExpand).toHaveBeenCalled();
      }
    });

    it('should respect maxIterations', async () => {
      // LLM mock: analyze returns parsed query
      const llmCall = vi.fn().mockResolvedValue(
        ok({
          content: JSON.stringify(createMockParsedQuery()),
          usage: { inputTokens: 100, outputTokens: 50 },
        })
      );
      (mockLLM as { call: typeof llmCall }).call = llmCall;

      // CQE mock: always returns medium relevance (never conclusive)
      const cqeRetrieve = vi.fn().mockReturnValue(
        ok([createMockRetrievedNode({ nodeId: 'a', relevance: 0.45 })])
      );
      const cqeExpand = vi.fn().mockReturnValue(
        ok([createMockRetrievedNode({ nodeId: `a-${Math.random()}`, relevance: 0.45 })])
      );
      (mockCQE as { retrieve: typeof cqeRetrieve }).retrieve = cqeRetrieve;
      (mockCQE as { expandNode: typeof cqeExpand }).expandNode = cqeExpand;

      const loop = createReasoningLoop({
        llmClient: mockLLM,
        cqeEngine: mockCQE,
        config: {
          maxIterations: 3,
          expansionThreshold: 0.5,
          relevanceThreshold: 0.3,
          minAttemptsForNotFound: 10, // 높게 설정하여 not_found 방지
        },
      });

      const result = await loop.run('끝나지 않는 질문', mockTree);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('MAX_ITERATIONS_EXCEEDED');
      }
    });

    it('should return LLM_ERROR when LLM fails', async () => {
      const llmCall = vi.fn().mockResolvedValue(
        err({ code: 'API_ERROR', message: 'API 오류' })
      );
      (mockLLM as { call: typeof llmCall }).call = llmCall;

      const loop = createReasoningLoop({
        llmClient: mockLLM,
        cqeEngine: mockCQE,
      });

      const result = await loop.run('테스트', mockTree);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('LLM_ERROR');
      }
    });

    it('should return CQE_ERROR when CQE fails', async () => {
      const llmCall = vi.fn().mockResolvedValue(
        ok({
          content: JSON.stringify(createMockParsedQuery()),
          usage: { inputTokens: 100, outputTokens: 50 },
        })
      );
      (mockLLM as { call: typeof llmCall }).call = llmCall;

      const cqeRetrieve = vi.fn().mockReturnValue(
        err({ code: 'NOT_FOUND', message: '검색 실패' })
      );
      (mockCQE as { retrieve: typeof cqeRetrieve }).retrieve = cqeRetrieve;

      const loop = createReasoningLoop({
        llmClient: mockLLM,
        cqeEngine: mockCQE,
      });

      const result = await loop.run('테스트', mockTree);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('CQE_ERROR');
      }
    });

    it('should return PARSE_ERROR for invalid LLM JSON response', async () => {
      const llmCall = vi.fn().mockResolvedValue(
        ok({
          content: 'invalid json response',
          usage: { inputTokens: 100, outputTokens: 50 },
        })
      );
      (mockLLM as { call: typeof llmCall }).call = llmCall;

      const loop = createReasoningLoop({
        llmClient: mockLLM,
        cqeEngine: mockCQE,
      });

      const result = await loop.run('테스트', mockTree);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('PARSE_ERROR');
      }
    });
  });

  describe('continue', () => {
    it('should resume from existing state', async () => {
      // 이미 retrieve 완료된 상태에서 시작
      const llmCall = vi.fn().mockResolvedValue(
        ok({
          content: '계속된 답변입니다.',
          usage: { inputTokens: 200, outputTokens: 100 },
        })
      );
      (mockLLM as { call: typeof llmCall }).call = llmCall;

      const loop = createReasoningLoop({
        llmClient: mockLLM,
        cqeEngine: mockCQE,
      });

      // 기존 상태 생성 (이미 분석 및 검색 완료)
      let state = createReasoningState('테스트 질의');
      state = {
        ...state,
        currentQuery: {
          ...state.currentQuery,
          status: 'reasoning',
          parsed: createMockParsedQuery(),
        },
        retrievedContext: [
          createMockRetrievedNode({ nodeId: 'existing', relevance: 0.8 }),
        ],
        reasoningPath: [
          {
            step: 1,
            type: 'analyze',
            target: '테스트 질의',
            relevance: 1,
            result: 'analyzed',
            evidence: [],
          },
          {
            step: 2,
            type: 'retrieve',
            target: 'test.path',
            relevance: 0.8,
            result: 'found',
            evidence: ['existing'],
          },
        ],
      };

      const result = await loop.continue(state, mockTree);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // 분석과 검색은 건너뛰고 바로 답변 생성
        expect(result.value.conclusion.type).toBe('answer');
      }
    });

    it('should immediately return for terminal state', async () => {
      const loop = createReasoningLoop({
        llmClient: mockLLM,
        cqeEngine: mockCQE,
      });

      // 이미 완료된 상태
      let state = createReasoningState('테스트');
      state = setQueryStatus(state, 'complete');
      state = {
        ...state,
        conclusion: {
          type: 'answer',
          content: '이미 완료된 답변',
          confidence: 0.9,
          evidencePaths: [],
        },
      };

      const result = await loop.continue(state, mockTree);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.iterations).toBe(0);
        expect(result.value.conclusion.content).toBe('이미 완료된 답변');
      }
    });
  });

  describe('explainable ignorance', () => {
    it('should not call LLM for not_found conclusion', async () => {
      // analyze에서 1번만 호출
      const llmCall = vi.fn().mockResolvedValueOnce(
        ok({
          content: JSON.stringify(createMockParsedQuery()),
          usage: { inputTokens: 100, outputTokens: 50 },
        })
      );
      (mockLLM as { call: typeof llmCall }).call = llmCall;

      // 매우 낮은 관련성
      const cqeRetrieve = vi.fn().mockReturnValue(
        ok([createMockRetrievedNode({ nodeId: 'a', relevance: 0.1 })])
      );
      const cqeExpand = vi.fn().mockReturnValue(
        ok([createMockRetrievedNode({ nodeId: 'a-1', relevance: 0.1 })])
      );
      (mockCQE as { retrieve: typeof cqeRetrieve }).retrieve = cqeRetrieve;
      (mockCQE as { expandNode: typeof cqeExpand }).expandNode = cqeExpand;

      const loop = createReasoningLoop({
        llmClient: mockLLM,
        cqeEngine: mockCQE,
        config: {
          relevanceThreshold: 0.3,
          minAttemptsForNotFound: 2,
        },
      });

      const result = await loop.run('없는 정보 찾기', mockTree);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.conclusion.type).toBe('not_found');
        // ★ 핵심: analyze에서만 LLM 호출, not_found 결론은 시스템이 결정
        expect(llmCall).toHaveBeenCalledTimes(1);
      }
    });

    it('should include reasoning path in explanation', async () => {
      const llmCall = vi.fn().mockResolvedValueOnce(
        ok({
          content: JSON.stringify(createMockParsedQuery()),
          usage: { inputTokens: 100, outputTokens: 50 },
        })
      );
      (mockLLM as { call: typeof llmCall }).call = llmCall;

      const cqeRetrieve = vi.fn().mockReturnValue(
        ok([createMockRetrievedNode({ nodeId: 'a', relevance: 0.1 })])
      );
      const cqeExpand = vi.fn().mockReturnValue(
        ok([createMockRetrievedNode({ nodeId: 'a-1', relevance: 0.1 })])
      );
      (mockCQE as { retrieve: typeof cqeRetrieve }).retrieve = cqeRetrieve;
      (mockCQE as { expandNode: typeof cqeExpand }).expandNode = cqeExpand;

      const loop = createReasoningLoop({
        llmClient: mockLLM,
        cqeEngine: mockCQE,
        config: {
          relevanceThreshold: 0.3,
          minAttemptsForNotFound: 2,
        },
      });

      const result = await loop.run('없는 정보', mockTree);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // 설명에 추론 경로가 포함되어야 함
        expect(result.value.explanation).toBeDefined();
        const explanation = JSON.parse(result.value.explanation);
        // StructuredExplanation 타입에서 필드명은 reasoningSteps
        expect(explanation.reasoningSteps).toBeDefined();
        expect(Array.isArray(explanation.reasoningSteps)).toBe(true);
      }
    });

    it('should track all search attempts', async () => {
      const llmCall = vi.fn().mockResolvedValueOnce(
        ok({
          content: JSON.stringify(createMockParsedQuery()),
          usage: { inputTokens: 100, outputTokens: 50 },
        })
      );
      (mockLLM as { call: typeof llmCall }).call = llmCall;

      const cqeRetrieve = vi.fn().mockReturnValue(
        ok([createMockRetrievedNode({ nodeId: 'a', relevance: 0.1 })])
      );
      const cqeExpand = vi.fn().mockReturnValue(
        ok([createMockRetrievedNode({ nodeId: 'a-1', relevance: 0.1 })])
      );
      (mockCQE as { retrieve: typeof cqeRetrieve }).retrieve = cqeRetrieve;
      (mockCQE as { expandNode: typeof cqeExpand }).expandNode = cqeExpand;

      const loop = createReasoningLoop({
        llmClient: mockLLM,
        cqeEngine: mockCQE,
        config: {
          relevanceThreshold: 0.3,
          minAttemptsForNotFound: 2,
        },
      });

      const result = await loop.run('추적 테스트', mockTree);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // 모든 시도가 reasoningPath에 기록됨
        const { reasoningPath } = result.value.state;
        expect(reasoningPath.length).toBeGreaterThan(0);

        // analyze, retrieve, expand, not_found 단계들이 기록됨
        const types = reasoningPath.map((s) => s.type);
        expect(types).toContain('analyze');
        expect(types).toContain('retrieve');
      }
    });
  });

  describe('edge cases', () => {
    it('should handle empty retrievedContext', async () => {
      const llmCall = vi.fn().mockResolvedValueOnce(
        ok({
          content: JSON.stringify(createMockParsedQuery()),
          usage: { inputTokens: 100, outputTokens: 50 },
        })
      );
      (mockLLM as { call: typeof llmCall }).call = llmCall;

      // 빈 배열 반환
      const cqeRetrieve = vi.fn().mockReturnValue(ok([]));
      (mockCQE as { retrieve: typeof cqeRetrieve }).retrieve = cqeRetrieve;

      const loop = createReasoningLoop({
        llmClient: mockLLM,
        cqeEngine: mockCQE,
        config: {
          minAttemptsForNotFound: 1,
        },
      });

      const result = await loop.run('빈 컨텍스트', mockTree);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.conclusion.type).toBe('not_found');
      }
    });
  });
});
