/**
 * @manifesto-ai/agent - Mock Tool Integration Tests
 *
 * 테스트 내용:
 * - observations push 검증
 */

import { describe, it, expect, vi } from 'vitest';
import {
  createSimpleSession,
  createMockClient,
  generateEffectId,
  defineTool,
  type AgentDecision,
} from '../../src/index.js';

describe('Mock Tool Integration', () => {
  describe('tool.call with observations', () => {
    it('should push tool result to observations', async () => {
      const searchTool = defineTool(
        'search',
        'Search for information',
        async (input: { query: string }) => {
          return { results: [`Result for: ${input.query}`] };
        }
      );

      const decisions: AgentDecision[] = [
        {
          effects: [
            {
              type: 'tool.call',
              id: generateEffectId(),
              tool: 'search',
              input: { query: 'test query' },
            },
          ],
        },
        { effects: [] },
      ];

      const client = createMockClient(decisions);
      const { session, getSnapshot, getObservations } = createSimpleSession({
        initialSnapshot: { data: {}, state: {}, derived: {} },
        client,
        tools: [searchTool],
      });

      await session.step();

      // observations 확인
      const observations = getObservations();
      expect(observations).toHaveLength(1);
      expect((observations[0] as any).source).toBe('tool:search');
      expect((observations[0] as any).content).toEqual({ results: ['Result for: test query'] });

      // snapshot의 derived.observations에도 추가됨
      const snapshot = getSnapshot() as any;
      expect(snapshot.derived.observations).toHaveLength(1);
    });

    it('should link observation to effect via triggeredBy', async () => {
      const effectId = generateEffectId();
      const echoTool = defineTool(
        'echo',
        'Echo input',
        async (input: unknown) => input
      );

      const decisions: AgentDecision[] = [
        {
          effects: [
            { type: 'tool.call', id: effectId, tool: 'echo', input: { message: 'hello' } },
          ],
        },
        { effects: [] },
      ];

      const client = createMockClient(decisions);
      const { session, getObservations } = createSimpleSession({
        initialSnapshot: { data: {}, state: {}, derived: {} },
        client,
        tools: [echoTool],
      });

      await session.step();

      const observations = getObservations();
      expect((observations[0] as any).triggeredBy).toBe(effectId);
    });

    it('should record error as observation when tool fails', async () => {
      const failingTool = defineTool(
        'failing',
        'A tool that always fails',
        async () => {
          throw new Error('Tool execution failed');
        }
      );

      const decisions: AgentDecision[] = [
        {
          effects: [
            { type: 'tool.call', id: generateEffectId(), tool: 'failing', input: {} },
          ],
        },
        { effects: [] },
      ];

      const client = createMockClient(decisions);
      const { session, getErrors } = createSimpleSession({
        initialSnapshot: { data: {}, state: {}, derived: {} },
        client,
        tools: [failingTool],
      });

      const result = await session.step();

      // 에러 발생
      expect(result.errorsEncountered).toBe(1);

      // 에러 기록 확인
      const errors = getErrors();
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should handle unknown tool', async () => {
      const decisions: AgentDecision[] = [
        {
          effects: [
            { type: 'tool.call', id: generateEffectId(), tool: 'nonexistent', input: {} },
          ],
        },
        { effects: [] },
      ];

      const client = createMockClient(decisions);
      const { session, getErrors } = createSimpleSession({
        initialSnapshot: { data: {}, state: {}, derived: {} },
        client,
        tools: [], // 등록된 tool 없음
      });

      const result = await session.step();

      expect(result.errorsEncountered).toBe(1);

      const errors = getErrors();
      expect((errors[0] as any).issue).toContain('Unknown tool');
    });
  });

  describe('multiple tools', () => {
    it('should execute multiple tool calls in sequence', async () => {
      const callOrder: string[] = [];

      const tool1 = defineTool('tool1', 'First tool', async () => {
        callOrder.push('tool1');
        return 'result1';
      });

      const tool2 = defineTool('tool2', 'Second tool', async () => {
        callOrder.push('tool2');
        return 'result2';
      });

      const decisions: AgentDecision[] = [
        {
          effects: [
            { type: 'tool.call', id: generateEffectId(), tool: 'tool1', input: {} },
            { type: 'tool.call', id: generateEffectId(), tool: 'tool2', input: {} },
          ],
        },
        { effects: [] },
      ];

      const client = createMockClient(decisions);
      const { session, getObservations } = createSimpleSession({
        initialSnapshot: { data: {}, state: {}, derived: {} },
        client,
        tools: [tool1, tool2],
      });

      await session.step();

      expect(callOrder).toEqual(['tool1', 'tool2']);

      const observations = getObservations();
      expect(observations).toHaveLength(2);
    });

    it('should stop on tool failure in sequence', async () => {
      const callOrder: string[] = [];

      const tool1 = defineTool('tool1', 'First tool', async () => {
        callOrder.push('tool1');
        throw new Error('Intentional failure');
      });

      const tool2 = defineTool('tool2', 'Second tool', async () => {
        callOrder.push('tool2');
        return 'result2';
      });

      const decisions: AgentDecision[] = [
        {
          effects: [
            { type: 'tool.call', id: generateEffectId(), tool: 'tool1', input: {} },
            { type: 'tool.call', id: generateEffectId(), tool: 'tool2', input: {} },
          ],
        },
        { effects: [] },
      ];

      const client = createMockClient(decisions);
      const { session } = createSimpleSession({
        initialSnapshot: { data: {}, state: {}, derived: {} },
        client,
        tools: [tool1, tool2],
      });

      const result = await session.step();

      // tool1만 실행됨 (실패로 인해 tool2는 실행되지 않음)
      expect(callOrder).toEqual(['tool1']);
      expect(result.errorsEncountered).toBe(1);
    });
  });

  describe('tool with async operations', () => {
    it('should wait for async tool completion', async () => {
      const asyncTool = defineTool(
        'async',
        'Async tool',
        async (input: { delay: number }) => {
          await new Promise((resolve) => setTimeout(resolve, input.delay));
          return { completed: true, delay: input.delay };
        }
      );

      const decisions: AgentDecision[] = [
        {
          effects: [
            { type: 'tool.call', id: generateEffectId(), tool: 'async', input: { delay: 50 } },
          ],
        },
        { effects: [] },
      ];

      const client = createMockClient(decisions);
      const { session, getObservations } = createSimpleSession({
        initialSnapshot: { data: {}, state: {}, derived: {} },
        client,
        tools: [asyncTool],
      });

      const start = Date.now();
      await session.step();
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(50);

      const observations = getObservations();
      expect((observations[0] as any).content).toEqual({ completed: true, delay: 50 });
    });
  });
});
