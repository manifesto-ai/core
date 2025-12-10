import { describe, it, expect, beforeEach } from 'vitest';
import { MockLLMProvider, createMockProvider } from '../../src/llm/providers/mock.js';

describe('LLM Providers', () => {
  describe('MockLLMProvider', () => {
    let provider: MockLLMProvider;

    beforeEach(() => {
      provider = new MockLLMProvider();
    });

    it('should return default response', async () => {
      const result = await provider.complete([
        { role: 'user', content: 'Hello' },
      ]);

      expect(result.content).toBe('{ "result": "mock response" }');
      expect(result.model).toBe('mock-model');
      expect(result.finishReason).toBe('stop');
    });

    it('should return custom default response', async () => {
      provider.setDefaultResponse('Custom response');

      const result = await provider.complete([
        { role: 'user', content: 'Hello' },
      ]);

      expect(result.content).toBe('Custom response');
    });

    it('should match pattern responses', async () => {
      provider.setResponses([
        { pattern: /hello/i, response: 'Hello back!' },
        { pattern: /analyze/, response: '{ "analysis": "done" }' },
      ]);

      const helloResult = await provider.complete([
        { role: 'user', content: 'Hello world' },
      ]);
      expect(helloResult.content).toBe('Hello back!');

      const analyzeResult = await provider.complete([
        { role: 'user', content: 'Please analyze this code' },
      ]);
      expect(analyzeResult.content).toBe('{ "analysis": "done" }');
    });

    it('should record call history', async () => {
      await provider.complete([{ role: 'user', content: 'First' }]);
      await provider.complete([{ role: 'user', content: 'Second' }]);

      const history = provider.getCallHistory();
      expect(history).toHaveLength(2);
      expect(history[0]?.messages[0]?.content).toBe('First');
      expect(history[1]?.messages[0]?.content).toBe('Second');
    });

    it('should check if pattern was called', async () => {
      await provider.complete([{ role: 'user', content: 'Analyze this code' }]);

      expect(provider.wasCalledWith(/analyze/i)).toBe(true);
      expect(provider.wasCalledWith(/unknown/i)).toBe(false);
    });

    it('should simulate failure mode', async () => {
      provider.setFailure(true, new Error('Simulated error'));

      await expect(
        provider.complete([{ role: 'user', content: 'Hello' }])
      ).rejects.toThrow('Simulated error');
    });

    it('should always be available', async () => {
      expect(await provider.isAvailable()).toBe(true);
    });

    it('should estimate tokens', () => {
      const tokens = provider.estimateTokens('Hello world');
      expect(tokens).toBeGreaterThan(0);
    });
  });

  describe('createMockProvider', () => {
    it('should create provider with default response', () => {
      const provider = createMockProvider('Custom default');

      expect(provider.name).toBe('mock');
    });

    it('should create provider with responses', () => {
      const provider = createMockProvider(undefined, [
        { pattern: /test/, response: 'Test response' },
      ]);

      expect(provider.name).toBe('mock');
    });
  });
});
