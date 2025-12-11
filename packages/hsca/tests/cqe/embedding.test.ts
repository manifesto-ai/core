import { describe, it, expect } from 'vitest';
import {
  MockEmbeddingProvider,
  ControllableMockEmbeddingProvider,
  createMockEmbeddingProvider,
  createControllableMockEmbeddingProvider,
  DEFAULT_OPENAI_EMBEDDING_CONFIG,
} from '../../src/cqe/embedding.js';
import { cosineSimilarity } from '../../src/cqe/semantic.js';

describe('embedding providers', () => {
  describe('MockEmbeddingProvider', () => {
    it('should return vectors of specified dimensions', async () => {
      const provider = new MockEmbeddingProvider(512);

      const embedding = await provider.embed('test text');

      expect(embedding).toHaveLength(512);
      expect(provider.dimensions).toBe(512);
    });

    it('should return default dimensions (1536)', async () => {
      const provider = new MockEmbeddingProvider();

      const embedding = await provider.embed('test text');

      expect(embedding).toHaveLength(1536);
      expect(provider.dimensions).toBe(1536);
    });

    it('should return consistent vectors for same text', async () => {
      const provider = new MockEmbeddingProvider();

      const embedding1 = await provider.embed('test text');
      const embedding2 = await provider.embed('test text');

      expect(embedding1).toEqual(embedding2);
    });

    it('should return different vectors for different text', async () => {
      const provider = new MockEmbeddingProvider();

      const embedding1 = await provider.embed('first text');
      const embedding2 = await provider.embed('second text');

      expect(embedding1).not.toEqual(embedding2);
    });

    it('should handle batch embedding', async () => {
      const provider = new MockEmbeddingProvider();
      const texts = ['text 1', 'text 2', 'text 3'];

      const embeddings = await provider.embedBatch(texts);

      expect(embeddings).toHaveLength(3);
      expect(embeddings[0]).toHaveLength(1536);
      expect(embeddings[1]).toHaveLength(1536);
      expect(embeddings[2]).toHaveLength(1536);
    });

    it('should handle empty batch', async () => {
      const provider = new MockEmbeddingProvider();

      const embeddings = await provider.embedBatch([]);

      expect(embeddings).toHaveLength(0);
    });

    it('should return normalized unit vectors', async () => {
      const provider = new MockEmbeddingProvider();

      const embedding = await provider.embed('test text');
      const magnitude = Math.sqrt(
        embedding.reduce((sum, v) => sum + v * v, 0)
      );

      expect(magnitude).toBeCloseTo(1, 5);
    });
  });

  describe('ControllableMockEmbeddingProvider', () => {
    it('should return preset vectors', async () => {
      const provider = new ControllableMockEmbeddingProvider(3);
      const presetVector = [1, 0, 0];
      provider.setVector('test', presetVector);

      const embedding = await provider.embed('test');

      expect(embedding).toEqual(presetVector);
    });

    it('should throw for mismatched dimensions', () => {
      const provider = new ControllableMockEmbeddingProvider(3);

      expect(() => {
        provider.setVector('test', [1, 0, 0, 0]); // 4 dimensions
      }).toThrow('Vector dimensions mismatch');
    });

    it('should set cosine similarity between two texts', async () => {
      const provider = new ControllableMockEmbeddingProvider(3);
      provider.setCosineSimilarity('query', 'doc', 0.8);

      const queryEmb = await provider.embed('query');
      const docEmb = await provider.embed('doc');
      const similarity = cosineSimilarity(queryEmb, docEmb);

      expect(similarity).toBeCloseTo(0.8, 2);
    });

    it('should set exact similarity of 1.0', async () => {
      const provider = new ControllableMockEmbeddingProvider(3);
      provider.setCosineSimilarity('text1', 'text2', 1.0);

      const emb1 = await provider.embed('text1');
      const emb2 = await provider.embed('text2');
      const similarity = cosineSimilarity(emb1, emb2);

      expect(similarity).toBeCloseTo(1.0, 5);
    });

    it('should set exact similarity of 0.0', async () => {
      const provider = new ControllableMockEmbeddingProvider(3);
      provider.setCosineSimilarity('text1', 'text2', 0.0);

      const emb1 = await provider.embed('text1');
      const emb2 = await provider.embed('text2');
      const similarity = cosineSimilarity(emb1, emb2);

      expect(similarity).toBeCloseTo(0.0, 5);
    });

    it('should return random vectors for unset texts', async () => {
      const provider = new ControllableMockEmbeddingProvider();
      provider.setVector('known', Array(1536).fill(0).map(() => 0.1));

      const unknownEmb = await provider.embed('unknown');

      expect(unknownEmb).toHaveLength(1536);
      // 랜덤 단위 벡터여야 함
      const magnitude = Math.sqrt(
        unknownEmb.reduce((sum, v) => sum + v * v, 0)
      );
      expect(magnitude).toBeCloseTo(1, 3);
    });
  });

  describe('createMockEmbeddingProvider', () => {
    it('should create provider with default dimensions', () => {
      const provider = createMockEmbeddingProvider();

      expect(provider.dimensions).toBe(1536);
    });

    it('should create provider with custom dimensions', () => {
      const provider = createMockEmbeddingProvider(768);

      expect(provider.dimensions).toBe(768);
    });
  });

  describe('createControllableMockEmbeddingProvider', () => {
    it('should create controllable provider', () => {
      const provider = createControllableMockEmbeddingProvider();

      expect(provider).toBeInstanceOf(ControllableMockEmbeddingProvider);
      expect(provider.dimensions).toBe(1536);
    });

    it('should create provider with custom dimensions', () => {
      const provider = createControllableMockEmbeddingProvider(256);

      expect(provider.dimensions).toBe(256);
    });
  });

  describe('DEFAULT_OPENAI_EMBEDDING_CONFIG', () => {
    it('should have valid default values', () => {
      expect(DEFAULT_OPENAI_EMBEDDING_CONFIG.model).toBe(
        'text-embedding-3-small'
      );
      expect(DEFAULT_OPENAI_EMBEDDING_CONFIG.dimensions).toBe(1536);
      expect(DEFAULT_OPENAI_EMBEDDING_CONFIG.batchSize).toBe(100);
    });
  });
});
