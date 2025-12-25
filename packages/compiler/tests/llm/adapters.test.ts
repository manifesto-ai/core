/**
 * LLM Adapters Tests
 *
 * Tests for Anthropic and OpenAI adapters.
 * Uses mocking to avoid actual API calls.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createAnthropicAdapter } from '../../src/llm/anthropic.js';
import { createOpenAIAdapter } from '../../src/llm/openai.js';
import type { LLMAdapter, LLMContext } from '../../src/types/session.js';

// ============================================================================
// Mock Setup
// ============================================================================

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

// Helper to create mock responses
function createAnthropicResponse(content: string) {
  return {
    ok: true,
    json: () =>
      Promise.resolve({
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: content }],
        model: 'claude-sonnet-4-20250514',
        stop_reason: 'end_turn',
        usage: { input_tokens: 100, output_tokens: 200 },
      }),
  };
}

function createOpenAIResponse(content: string) {
  return {
    ok: true,
    json: () =>
      Promise.resolve({
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-4o',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 100, completion_tokens: 200, total_tokens: 300 },
      }),
  };
}

// Valid draft response for testing
const validDraftResponse = JSON.stringify([
  {
    kind: 'SchemaFragment',
    namespace: 'data',
    fields: [{ path: 'user.name', type: 'string' }],
    provisionalRequires: [],
    provisionalProvides: ['data.user.name'],
    status: 'raw',
    origin: { artifactId: 'nl-input', location: { kind: 'llm' } },
    confidence: 0.85,
    reasoning: 'User name field for user management',
  },
]);

// ============================================================================
// Anthropic Adapter Tests
// ============================================================================

describe('createAnthropicAdapter', () => {
  it('should create adapter with default config', () => {
    const adapter = createAnthropicAdapter({ apiKey: 'test-key' });

    expect(adapter.modelId).toBe('claude-sonnet-4-20250514');
    expect(adapter.maxConfidence).toBe(0.9);
  });

  it('should create adapter with custom config', () => {
    const adapter = createAnthropicAdapter({
      apiKey: 'test-key',
      model: 'claude-3-opus',
      maxConfidence: 0.8,
    });

    expect(adapter.modelId).toBe('claude-3-opus');
    expect(adapter.maxConfidence).toBe(0.8);
  });

  it('should implement LLMAdapter interface', () => {
    const adapter = createAnthropicAdapter({ apiKey: 'test-key' });

    expect(typeof adapter.modelId).toBe('string');
    expect(typeof adapter.generateDrafts).toBe('function');
  });

  describe('generateDrafts', () => {
    let adapter: LLMAdapter;

    beforeEach(() => {
      adapter = createAnthropicAdapter({
        apiKey: 'test-key',
        maxRetries: 0, // Disable retries for faster tests
        timeout: 5000,
      });
    });

    it('should generate drafts from API response', async () => {
      mockFetch.mockResolvedValueOnce(createAnthropicResponse(validDraftResponse));

      const drafts = await adapter.generateDrafts('Create user schema', {});

      expect(drafts).toHaveLength(1);
      expect(drafts[0].kind).toBe('SchemaFragment');
      expect(drafts[0].origin.location.kind).toBe('llm');
    });

    it('should cap confidence at maxConfidence', async () => {
      const highConfidenceResponse = JSON.stringify([
        {
          kind: 'SchemaFragment',
          status: 'raw',
          confidence: 0.99,
          provisionalRequires: [],
          provisionalProvides: [],
        },
      ]);

      mockFetch.mockResolvedValueOnce(createAnthropicResponse(highConfidenceResponse));

      const drafts = await adapter.generateDrafts('Create schema', {});

      expect(drafts[0].confidence).toBeLessThanOrEqual(0.9);
    });

    it('should include promptHash in origin', async () => {
      mockFetch.mockResolvedValueOnce(createAnthropicResponse(validDraftResponse));

      const drafts = await adapter.generateDrafts('Create user schema', {});

      const location = drafts[0].origin.location as Record<string, unknown>;
      expect(location.promptHash).toBeDefined();
      expect(typeof location.promptHash).toBe('string');
    });

    it('should skip invalid drafts', async () => {
      const mixedResponse = JSON.stringify([
        { kind: 'SchemaFragment', status: 'raw', confidence: 0.8 },
        { invalid: 'not a draft' },
        { kind: 'SourceFragment', status: 'raw', confidence: 0.7 },
      ]);

      mockFetch.mockResolvedValueOnce(createAnthropicResponse(mixedResponse));

      const drafts = await adapter.generateDrafts('Create something', {});

      expect(drafts).toHaveLength(2);
    });

    it('should throw on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized'),
      });

      await expect(adapter.generateDrafts('Create schema', {})).rejects.toThrow('Anthropic API error');
    });

    it('should throw on invalid JSON response', async () => {
      mockFetch.mockResolvedValueOnce(createAnthropicResponse('Not valid JSON'));

      await expect(adapter.generateDrafts('Create schema', {})).rejects.toThrow('Failed to parse');
    });

    it('should include context in API call', async () => {
      mockFetch.mockResolvedValueOnce(createAnthropicResponse(validDraftResponse));

      const context: LLMContext = {
        existingPaths: ['data.existing'],
        domainDescription: 'Test domain',
      };

      await adapter.generateDrafts('Add field', context);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body);

      expect(body.messages[0].content).toContain('Add field');
    });
  });
});

// ============================================================================
// OpenAI Adapter Tests
// ============================================================================

describe('createOpenAIAdapter', () => {
  it('should create adapter with default config', () => {
    const adapter = createOpenAIAdapter({ apiKey: 'test-key' });

    expect(adapter.modelId).toBe('gpt-4o');
    expect(adapter.maxConfidence).toBe(0.85);
  });

  it('should create adapter with custom config', () => {
    const adapter = createOpenAIAdapter({
      apiKey: 'test-key',
      model: 'gpt-4-turbo',
      maxConfidence: 0.75,
      organization: 'org-123',
    });

    expect(adapter.modelId).toBe('gpt-4-turbo');
    expect(adapter.maxConfidence).toBe(0.75);
  });

  it('should implement LLMAdapter interface', () => {
    const adapter = createOpenAIAdapter({ apiKey: 'test-key' });

    expect(typeof adapter.modelId).toBe('string');
    expect(typeof adapter.generateDrafts).toBe('function');
  });

  describe('generateDrafts', () => {
    let adapter: LLMAdapter;

    beforeEach(() => {
      adapter = createOpenAIAdapter({
        apiKey: 'test-key',
        maxRetries: 0,
        timeout: 5000,
      });
    });

    it('should generate drafts from API response', async () => {
      mockFetch.mockResolvedValueOnce(createOpenAIResponse(validDraftResponse));

      const drafts = await adapter.generateDrafts('Create user schema', {});

      expect(drafts).toHaveLength(1);
      expect(drafts[0].kind).toBe('SchemaFragment');
    });

    it('should cap confidence at maxConfidence', async () => {
      const highConfidenceResponse = JSON.stringify([
        {
          kind: 'SchemaFragment',
          status: 'raw',
          confidence: 0.99,
          provisionalRequires: [],
          provisionalProvides: [],
        },
      ]);

      mockFetch.mockResolvedValueOnce(createOpenAIResponse(highConfidenceResponse));

      const drafts = await adapter.generateDrafts('Create schema', {});

      expect(drafts[0].confidence).toBeLessThanOrEqual(0.85);
    });

    it('should include organization header when provided', async () => {
      const adapterWithOrg = createOpenAIAdapter({
        apiKey: 'test-key',
        organization: 'org-123',
        maxRetries: 0,
      });

      mockFetch.mockResolvedValueOnce(createOpenAIResponse(validDraftResponse));

      await adapterWithOrg.generateDrafts('Create schema', {});

      const [, options] = mockFetch.mock.calls[0];
      expect(options.headers['OpenAI-Organization']).toBe('org-123');
    });

    it('should throw on empty response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'chatcmpl-123',
            choices: [],
          }),
      });

      await expect(adapter.generateDrafts('Create schema', {})).rejects.toThrow('No response');
    });

    it('should throw on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: () => Promise.resolve('Rate limit exceeded'),
      });

      await expect(adapter.generateDrafts('Create schema', {})).rejects.toThrow('OpenAI API error');
    });
  });
});

// ============================================================================
// Cross-Adapter Tests
// ============================================================================

describe('Adapter Compatibility', () => {
  it('both adapters should produce compatible draft formats', async () => {
    const anthropicAdapter = createAnthropicAdapter({ apiKey: 'test', maxRetries: 0 });
    const openaiAdapter = createOpenAIAdapter({ apiKey: 'test', maxRetries: 0 });

    mockFetch
      .mockResolvedValueOnce(createAnthropicResponse(validDraftResponse))
      .mockResolvedValueOnce(createOpenAIResponse(validDraftResponse));

    const anthropicDrafts = await anthropicAdapter.generateDrafts('Create schema', {});
    const openaiDrafts = await openaiAdapter.generateDrafts('Create schema', {});

    // Both should produce valid drafts with same structure
    expect(anthropicDrafts[0].kind).toBe(openaiDrafts[0].kind);
    expect(anthropicDrafts[0].status).toBe(openaiDrafts[0].status);
    expect(typeof anthropicDrafts[0].confidence).toBe('number');
    expect(typeof openaiDrafts[0].confidence).toBe('number');
  });

  it('both adapters should include LLM origin', async () => {
    const anthropicAdapter = createAnthropicAdapter({ apiKey: 'test', maxRetries: 0 });
    const openaiAdapter = createOpenAIAdapter({ apiKey: 'test', maxRetries: 0 });

    mockFetch
      .mockResolvedValueOnce(createAnthropicResponse(validDraftResponse))
      .mockResolvedValueOnce(createOpenAIResponse(validDraftResponse));

    const anthropicDrafts = await anthropicAdapter.generateDrafts('Create schema', {});
    const openaiDrafts = await openaiAdapter.generateDrafts('Create schema', {});

    expect(anthropicDrafts[0].origin.location.kind).toBe('llm');
    expect(openaiDrafts[0].origin.location.kind).toBe('llm');
  });
});
