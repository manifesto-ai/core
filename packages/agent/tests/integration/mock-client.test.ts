/**
 * @manifesto-ai/agent - Mock Client Integration Tests
 *
 * 테스트 내용:
 * - 고정 effects 반환하는 mock client
 */

import { describe, it, expect } from 'vitest';
import {
  createMockClient,
  createFixedClient,
  createSimpleSession,
  generateEffectId,
  type AgentDecision,
  type Effect,
} from '../../src/index.js';

describe('Mock Client Integration', () => {
  describe('createMockClient', () => {
    it('should return decisions in order', async () => {
      const decisions: AgentDecision[] = [
        {
          effects: [
            { type: 'snapshot.patch', id: generateEffectId(), ops: [{ op: 'set', path: 'data.step', value: 1 }] },
          ],
        },
        {
          effects: [
            { type: 'snapshot.patch', id: generateEffectId(), ops: [{ op: 'set', path: 'data.step', value: 2 }] },
          ],
        },
        { effects: [] },
      ];

      const client = createMockClient(decisions);
      const { session, getSnapshot } = createSimpleSession({
        initialSnapshot: { data: { step: 0 }, state: {}, derived: {} },
        client,
      });

      // Step 1
      await session.step();
      expect((getSnapshot() as any).data.step).toBe(1);

      // Step 2
      await session.step();
      expect((getSnapshot() as any).data.step).toBe(2);

      // Step 3 - empty effects
      const result = await session.step();
      expect(result.done).toBe(true);
    });

    it('should track call count', async () => {
      const decisions: AgentDecision[] = [
        { effects: [] },
      ];

      const client = createMockClient(decisions);
      expect(client.callCount).toBe(0);

      await client.decide({ snapshot: {}, constraints: { phase: 'test', writablePathPrefixes: [], typeRules: [], invariants: [] } });
      expect(client.callCount).toBe(1);

      await client.decide({ snapshot: {}, constraints: { phase: 'test', writablePathPrefixes: [], typeRules: [], invariants: [] } });
      expect(client.callCount).toBe(2);
    });

    it('should return empty effects when decisions exhausted', async () => {
      const decisions: AgentDecision[] = [
        { effects: [{ type: 'log.emit', id: generateEffectId(), level: 'info', message: 'test' }] },
      ];

      const client = createMockClient(decisions);

      const result1 = await client.decide({ snapshot: {}, constraints: { phase: 'test', writablePathPrefixes: [], typeRules: [], invariants: [] } });
      expect(result1.effects).toHaveLength(1);

      const result2 = await client.decide({ snapshot: {}, constraints: { phase: 'test', writablePathPrefixes: [], typeRules: [], invariants: [] } });
      expect(result2.effects).toHaveLength(0);
    });
  });

  describe('createFixedClient', () => {
    it('should always return the same effects', async () => {
      const effects: Effect[] = [
        { type: 'log.emit', id: generateEffectId(), level: 'info', message: 'Fixed message' },
      ];

      const client = createFixedClient(effects);

      const result1 = await client.decide({ snapshot: {}, constraints: { phase: 'test', writablePathPrefixes: [], typeRules: [], invariants: [] } });
      const result2 = await client.decide({ snapshot: {}, constraints: { phase: 'test', writablePathPrefixes: [], typeRules: [], invariants: [] } });

      expect(result1.effects).toEqual(effects);
      expect(result2.effects).toEqual(effects);
    });
  });

  describe('Session with mock client', () => {
    it('should complete a multi-step workflow', async () => {
      const decisions: AgentDecision[] = [
        {
          effects: [
            { type: 'snapshot.patch', id: generateEffectId(), ops: [{ op: 'set', path: 'state.phase', value: 'processing' }] },
            { type: 'snapshot.patch', id: generateEffectId(), ops: [{ op: 'set', path: 'data.items', value: [] }] },
          ],
        },
        {
          effects: [
            { type: 'snapshot.patch', id: generateEffectId(), ops: [{ op: 'append', path: 'data.items', value: 'item1' }] },
            { type: 'snapshot.patch', id: generateEffectId(), ops: [{ op: 'append', path: 'data.items', value: 'item2' }] },
          ],
        },
        {
          effects: [
            { type: 'snapshot.patch', id: generateEffectId(), ops: [{ op: 'set', path: 'state.phase', value: 'complete' }] },
          ],
        },
        { effects: [] },
      ];

      const client = createMockClient(decisions);
      const { session, getSnapshot } = createSimpleSession({
        initialSnapshot: { data: {}, state: { phase: 'init' }, derived: {} },
        client,
      });

      const result = await session.run();

      expect(result.done).toBe(true);
      expect(result.totalSteps).toBe(4);
      expect(result.totalEffects).toBe(5);

      const snapshot = getSnapshot() as any;
      expect(snapshot.state.phase).toBe('complete');
      expect(snapshot.data.items).toEqual(['item1', 'item2']);
    });

    it('should handle error recovery workflow', async () => {
      const decisions: AgentDecision[] = [
        {
          // 첫 시도: derived에 쓰기 시도 (실패)
          effects: [
            { type: 'snapshot.patch', id: generateEffectId(), ops: [{ op: 'set', path: 'derived.error', value: 'bad' }] },
          ],
        },
        {
          // 두 번째 시도: 올바른 경로에 쓰기
          effects: [
            { type: 'snapshot.patch', id: generateEffectId(), ops: [{ op: 'set', path: 'data.value', value: 'good' }] },
          ],
        },
        { effects: [] },
      ];

      const client = createMockClient(decisions);
      const { session, getSnapshot, getErrors } = createSimpleSession({
        initialSnapshot: { data: {}, state: {}, derived: {} },
        client,
      });

      // Step 1: 실패
      const result1 = await session.step();
      expect(result1.errorsEncountered).toBe(1);

      // 에러 확인
      const errors = getErrors();
      expect(errors.length).toBeGreaterThan(0);

      // Step 2: 성공
      const result2 = await session.step();
      expect(result2.errorsEncountered).toBe(0);
      expect(result2.effectsExecuted).toBe(1);

      const snapshot = getSnapshot() as any;
      expect(snapshot.data.value).toBe('good');
    });
  });
});
