import { describe, it, expect, vi } from 'vitest';
import { isOk, isErr } from '@manifesto-ai/core';
import {
  summarizeChunk,
  summarizeGroup,
  hierarchicalSummarize,
  type Chunk,
  type SummaryResult,
  type ILLMClient,
  type LLMResponse,
} from '../../src/index.js';

// Mock LLM 클라이언트 생성
function createMockLLM(options?: { shouldFail?: boolean; response?: string }): ILLMClient {
  return {
    call: vi.fn(async () => {
      if (options?.shouldFail) {
        return {
          ok: false as const,
          error: {
            code: 'API_ERROR' as const,
            message: 'Mock error',
          },
        };
      }

      const response = options?.response ?? JSON.stringify({
        summary: 'This is a test summary.',
        keywords: ['test', 'summary', 'keywords'],
      });

      return {
        ok: true as const,
        value: {
          content: response,
          usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
          model: 'mock-model',
          finishReason: 'stop' as const,
        } as LLMResponse,
      };
    }),
    estimateTokens: vi.fn((text: string) => Math.ceil(text.length / 4)),
    getModelId: vi.fn(() => 'mock-model'),
  };
}

// 샘플 청크 생성
function createSampleChunk(id: string, text: string): Chunk {
  return {
    id,
    text,
    tokenCount: Math.ceil(text.length / 4),
    startOffset: 0,
    endOffset: text.length,
  };
}

describe('summarizer', () => {
  describe('summarizeChunk', () => {
    it('should summarize a single chunk', async () => {
      const mockLLM = createMockLLM();
      const chunk = createSampleChunk('chunk-1', 'This is the content to be summarized.');

      const result = await summarizeChunk(chunk, mockLLM);

      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      expect(result.value.summary).toBe('This is a test summary.');
      expect(result.value.keywords).toContain('test');
      expect(result.value.tokenCount).toBeGreaterThan(0);
      expect(result.value.compressionRatio).toBeGreaterThan(0);
    });

    it('should extract keywords', async () => {
      const mockLLM = createMockLLM({
        response: JSON.stringify({
          summary: 'Summary text',
          keywords: ['keyword1', 'keyword2', 'keyword3'],
        }),
      });
      const chunk = createSampleChunk('chunk-1', 'Content with important keywords.');

      const result = await summarizeChunk(chunk, mockLLM);

      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      expect(result.value.keywords).toHaveLength(3);
      expect(result.value.keywords).toContain('keyword1');
    });

    it('should return error for empty input', async () => {
      const mockLLM = createMockLLM();
      const chunk = createSampleChunk('chunk-1', '');

      const result = await summarizeChunk(chunk, mockLLM);

      expect(isErr(result)).toBe(true);
      if (!isErr(result)) return;

      expect(result.error.code).toBe('EMPTY_INPUT');
    });

    it('should return error for whitespace-only input', async () => {
      const mockLLM = createMockLLM();
      const chunk = createSampleChunk('chunk-1', '   \n\t  ');

      const result = await summarizeChunk(chunk, mockLLM);

      expect(isErr(result)).toBe(true);
    });

    it('should handle LLM errors gracefully', async () => {
      const mockLLM = createMockLLM({ shouldFail: true });
      const chunk = createSampleChunk('chunk-1', 'Some content');

      const result = await summarizeChunk(chunk, mockLLM);

      expect(isErr(result)).toBe(true);
      if (!isErr(result)) return;

      expect(result.error.code).toBe('LLM_ERROR');
    });

    it('should handle invalid JSON response', async () => {
      const mockLLM = createMockLLM({ response: 'not valid json' });
      const chunk = createSampleChunk('chunk-1', 'Some content');

      const result = await summarizeChunk(chunk, mockLLM);

      expect(isErr(result)).toBe(true);
      if (!isErr(result)) return;

      expect(result.error.code).toBe('PARSE_ERROR');
    });

    it('should respect compression ratio', async () => {
      const mockLLM = createMockLLM();
      const longText = 'This is a very long text that needs to be summarized. '.repeat(10);
      const chunk = createSampleChunk('chunk-1', longText);

      const result = await summarizeChunk(chunk, mockLLM);

      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      // 압축률은 원본 대비 요약이 짧아야 함
      expect(result.value.compressionRatio).toBeGreaterThan(1);
    });
  });

  describe('summarizeGroup', () => {
    const summaries: SummaryResult[] = [
      { summary: 'First summary', keywords: ['first'], tokenCount: 10, compressionRatio: 5 },
      { summary: 'Second summary', keywords: ['second'], tokenCount: 10, compressionRatio: 5 },
      { summary: 'Third summary', keywords: ['third'], tokenCount: 10, compressionRatio: 5 },
    ];

    it('should merge multiple summaries', async () => {
      const mockLLM = createMockLLM({
        response: JSON.stringify({
          summary: 'Merged summary of all content.',
          keywords: ['merged', 'content'],
        }),
      });

      const result = await summarizeGroup(summaries, mockLLM);

      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      expect(result.value.summary).toBe('Merged summary of all content.');
    });

    it('should return single summary as-is', async () => {
      const mockLLM = createMockLLM();
      const singleSummary: SummaryResult[] = [
        { summary: 'Only summary', keywords: ['only'], tokenCount: 10, compressionRatio: 5 },
      ];

      const result = await summarizeGroup(singleSummary, mockLLM);

      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      expect(result.value.summary).toBe('Only summary');
      // LLM은 호출되지 않아야 함
      expect(mockLLM.call).not.toHaveBeenCalled();
    });

    it('should return error for empty summaries', async () => {
      const mockLLM = createMockLLM();

      const result = await summarizeGroup([], mockLLM);

      expect(isErr(result)).toBe(true);
      if (!isErr(result)) return;

      expect(result.error.code).toBe('EMPTY_INPUT');
    });

    it('should handle LLM errors gracefully', async () => {
      const mockLLM = createMockLLM({ shouldFail: true });

      const result = await summarizeGroup(summaries, mockLLM);

      expect(isErr(result)).toBe(true);
    });

    it('should calculate compression ratio correctly', async () => {
      const mockLLM = createMockLLM({
        response: JSON.stringify({
          summary: 'Short',
          keywords: [],
        }),
      });

      const result = await summarizeGroup(summaries, mockLLM);

      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      // 원본 총 토큰 (30) 대비 요약 토큰이 작으면 압축률 > 1
      expect(result.value.compressionRatio).toBeGreaterThan(0);
    });
  });

  describe('hierarchicalSummarize', () => {
    it('should create hierarchical summary from chunks', async () => {
      const mockLLM = createMockLLM();
      const chunks: Chunk[] = [
        createSampleChunk('chunk-1', 'First chunk content.'),
        createSampleChunk('chunk-2', 'Second chunk content.'),
        createSampleChunk('chunk-3', 'Third chunk content.'),
      ];

      const result = await hierarchicalSummarize(chunks, mockLLM);

      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      const root = result.value;
      expect(root.path).toBe('root');
      expect(root.depth).toBeGreaterThanOrEqual(0);
    });

    it('should return error for empty chunks', async () => {
      const mockLLM = createMockLLM();

      const result = await hierarchicalSummarize([], mockLLM);

      expect(isErr(result)).toBe(true);
      if (!isErr(result)) return;

      expect(result.error.code).toBe('EMPTY_INPUT');
    });

    it('should handle single chunk', async () => {
      const mockLLM = createMockLLM();
      const chunks = [createSampleChunk('chunk-1', 'Single chunk.')];

      const result = await hierarchicalSummarize(chunks, mockLLM);

      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      // 단일 청크는 그대로 루트가 됨
      expect(result.value).toBeDefined();
    });

    it('should build multi-level tree for many chunks', async () => {
      const mockLLM = createMockLLM();
      const chunks: Chunk[] = Array.from({ length: 15 }, (_, i) =>
        createSampleChunk(`chunk-${i}`, `Content for chunk ${i}.`)
      );

      const result = await hierarchicalSummarize(chunks, mockLLM, { groupSize: 3 });

      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      // 15개 청크를 3개씩 그룹화하면 여러 레벨이 생김
      const root = result.value;
      expect(root.children.length).toBeGreaterThan(0);
    });

    it('should propagate LLM errors', async () => {
      const mockLLM = createMockLLM({ shouldFail: true });
      const chunks = [createSampleChunk('chunk-1', 'Content.')];

      const result = await hierarchicalSummarize(chunks, mockLLM);

      expect(isErr(result)).toBe(true);
    });

    it('should set parent-child relationships', async () => {
      const mockLLM = createMockLLM();
      const chunks: Chunk[] = [
        createSampleChunk('chunk-1', 'First.'),
        createSampleChunk('chunk-2', 'Second.'),
      ];

      const result = await hierarchicalSummarize(chunks, mockLLM);

      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      const root = result.value;

      // 자식이 있으면 parentId가 설정됨
      for (const child of root.children) {
        expect(child.parentId).toBe(root.id);
      }
    });

    it('should preserve original text in leaf nodes', async () => {
      const mockLLM = createMockLLM();
      const originalText = 'Original chunk text here.';
      const chunks = [createSampleChunk('chunk-1', originalText)];

      const result = await hierarchicalSummarize(chunks, mockLLM);

      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      // 단일 청크일 때 원본 텍스트가 보존됨
      expect(result.value.originalText).toBe(originalText);
    });
  });
});
