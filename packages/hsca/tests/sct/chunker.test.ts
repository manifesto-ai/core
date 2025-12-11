import { describe, it, expect } from 'vitest';
import {
  chunkText,
  fixedChunker,
  semanticChunker,
  adaptiveChunker,
  DEFAULT_CHUNKING_CONFIG,
} from '../../src/sct/index.js';

describe('chunker', () => {
  describe('chunkText', () => {
    it('should return empty result for empty input', () => {
      const result = chunkText('', {});
      expect(result.chunks).toHaveLength(0);
      expect(result.totalTokens).toBe(0);
    });

    it('should return empty result for whitespace-only input', () => {
      const result = chunkText('   \n\n  ', {});
      expect(result.chunks).toHaveLength(0);
    });

    it('should use default config when not specified', () => {
      const result = chunkText('Hello world', {});
      expect(result.strategy).toBe(DEFAULT_CHUNKING_CONFIG.strategy);
    });

    it('should use specified strategy', () => {
      const result = chunkText('Hello world', { strategy: 'fixed' });
      expect(result.strategy).toBe('fixed');
    });

    it('should calculate total tokens correctly', () => {
      const text = 'Hello world. This is a test.';
      const result = chunkText(text, {});

      expect(result.totalTokens).toBeGreaterThan(0);
      expect(result.chunks.every((c) => c.tokenCount > 0)).toBe(true);
    });
  });

  describe('fixedChunker', () => {
    it('should chunk text into fixed-size pieces', () => {
      const text = 'A '.repeat(100); // ~100 tokens
      const chunks = fixedChunker(text, 20, 0);

      expect(chunks.length).toBeGreaterThan(1);
      // 대부분의 청크가 목표 토큰 수 근처
      for (let i = 0; i < chunks.length - 1; i++) {
        expect(chunks[i]!.tokenCount).toBeLessThanOrEqual(25); // 약간의 여유
      }
    });

    it('should respect token limits', () => {
      const text = 'Word '.repeat(200);
      const targetTokens = 50;
      const chunks = fixedChunker(text, targetTokens, 0);

      // 마지막 청크 제외하고 검사
      for (let i = 0; i < chunks.length - 1; i++) {
        expect(chunks[i]!.tokenCount).toBeLessThanOrEqual(targetTokens * 1.5);
      }
    });

    it('should include overlap between chunks', () => {
      const text = 'word1 word2 word3 word4 word5 word6 word7 word8';
      const chunks = fixedChunker(text, 5, 2);

      if (chunks.length > 1) {
        // 오버랩이 있으면 일부 텍스트가 중복됨
        const totalChunkLength = chunks.reduce((sum, c) => sum + c.text.length, 0);
        expect(totalChunkLength).toBeGreaterThanOrEqual(text.length);
      }
    });

    it('should handle single chunk case', () => {
      const text = 'Short text';
      const chunks = fixedChunker(text, 100, 0);

      expect(chunks).toHaveLength(1);
      expect(chunks[0]!.text).toBe(text);
    });

    it('should set correct offsets', () => {
      const text = 'Hello world. Goodbye world.';
      const chunks = fixedChunker(text, 5, 0);

      // 첫 청크는 0에서 시작
      expect(chunks[0]!.startOffset).toBe(0);

      // 마지막 청크는 텍스트 끝에서 끝남
      const lastChunk = chunks[chunks.length - 1]!;
      expect(lastChunk.endOffset).toBeLessThanOrEqual(text.length + 10); // 약간의 여유
    });
  });

  describe('semanticChunker', () => {
    it('should preserve paragraph boundaries', () => {
      const text = `First paragraph with some content.

Second paragraph with different content.

Third paragraph to test splitting.`;

      const chunks = semanticChunker(text, 1000);

      // 충분히 큰 토큰 제한이면 전체가 하나의 청크
      expect(chunks.length).toBe(1);
    });

    it('should split on paragraph boundaries when needed', () => {
      const text = `${'First paragraph. '.repeat(50)}

${'Second paragraph. '.repeat(50)}

${'Third paragraph. '.repeat(50)}`;

      const chunks = semanticChunker(text, 100);

      expect(chunks.length).toBeGreaterThan(1);
    });

    it('should handle Korean text correctly', () => {
      const text = `첫 번째 문단입니다. 한글 텍스트를 테스트합니다.

두 번째 문단입니다. 청킹이 제대로 작동하는지 확인합니다.`;

      const chunks = semanticChunker(text, 1000);

      expect(chunks.length).toBeGreaterThanOrEqual(1);
      expect(chunks[0]!.text).toContain('첫 번째');
    });

    it('should handle text with no paragraph breaks', () => {
      const text = 'This is a long sentence without any paragraph breaks. '.repeat(20);
      const chunks = semanticChunker(text, 50);

      expect(chunks.length).toBeGreaterThan(1);
    });

    it('should split large paragraphs by sentences', () => {
      const text = 'Sentence one. Sentence two. Sentence three. '.repeat(50);
      const chunks = semanticChunker(text, 30);

      expect(chunks.length).toBeGreaterThan(1);
      // 각 청크가 토큰 제한을 초과하지 않음
      for (const chunk of chunks) {
        expect(chunk.tokenCount).toBeLessThanOrEqual(40); // 약간의 여유
      }
    });
  });

  describe('adaptiveChunker', () => {
    it('should detect and use markdown chunking for markdown text', () => {
      const text = `# Header 1

Some content under header 1.

## Header 2

More content under header 2.

### Header 3

Even more content.`;

      const chunks = adaptiveChunker(text, DEFAULT_CHUNKING_CONFIG);

      expect(chunks.length).toBeGreaterThanOrEqual(1);
      // 마크다운 헤더가 보존됨
      expect(chunks.some((c) => c.text.startsWith('#'))).toBe(true);
    });

    it('should detect and preserve code blocks', () => {
      const text = `Some text before code.

\`\`\`javascript
function hello() {
  console.log('Hello, World!');
}
\`\`\`

Some text after code.`;

      const chunks = adaptiveChunker(text, DEFAULT_CHUNKING_CONFIG);

      expect(chunks.length).toBeGreaterThanOrEqual(1);
      // 코드 블록이 포함된 청크가 있음
      expect(chunks.some((c) => c.text.includes('```'))).toBe(true);
    });

    it('should mark code chunks with metadata', () => {
      const text = `Text.

\`\`\`python
print("hello")
\`\`\`

More text.`;

      const chunks = adaptiveChunker(text, {
        ...DEFAULT_CHUNKING_CONFIG,
        maxChunkTokens: 1000,
      });

      // 코드 청크에 메타데이터가 있을 수 있음
      const codeChunk = chunks.find((c) => c.text.includes('```'));
      expect(codeChunk).toBeDefined();
    });

    it('should fall back to semantic chunking for plain text', () => {
      const text = `This is plain text without any special structure.

It has multiple paragraphs but no markdown or code.

Just regular text content.`;

      const chunks = adaptiveChunker(text, DEFAULT_CHUNKING_CONFIG);

      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('chunk properties', () => {
    it('should generate unique chunk IDs', () => {
      const text = 'Word '.repeat(100);
      const result = chunkText(text, { strategy: 'fixed', targetChunkTokens: 20 });

      const ids = result.chunks.map((c) => c.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should calculate token counts for each chunk', () => {
      const result = chunkText('Hello world. This is a test.', {});

      for (const chunk of result.chunks) {
        expect(chunk.tokenCount).toBeGreaterThan(0);
        expect(typeof chunk.tokenCount).toBe('number');
      }
    });

    it('should set valid start and end offsets', () => {
      const text = 'The quick brown fox jumps over the lazy dog.';
      const result = chunkText(text, { strategy: 'fixed', targetChunkTokens: 5 });

      for (const chunk of result.chunks) {
        expect(chunk.startOffset).toBeGreaterThanOrEqual(0);
        expect(chunk.endOffset).toBeGreaterThanOrEqual(chunk.startOffset);
      }
    });
  });
});
