/**
 * @manifesto-ai/agent - Sequential Execution Tests
 *
 * 테스트 내용:
 * - 순차 실행 + stop-on-failure
 */

import { describe, it, expect, vi } from 'vitest';
import { createSimpleSession } from '../../src/session/create.js';
import { createMockClient } from '../../src/types/client.js';
import { generateEffectId } from '../../src/types/effect.js';
import type { Effect, AgentDecision } from '../../src/index.js';

describe('Sequential Execution', () => {
  describe('stop-on-failure', () => {
    it('should stop execution on first error', async () => {
      const effectIds = [generateEffectId(), generateEffectId(), generateEffectId()];

      // 두 번째 effect가 실패하도록 설정
      const decisions: AgentDecision[] = [
        {
          effects: [
            { type: 'snapshot.patch', id: effectIds[0]!, ops: [{ op: 'set', path: 'data.a', value: 1 }] },
            { type: 'snapshot.patch', id: effectIds[1]!, ops: [{ op: 'set', path: 'derived.x', value: 2 }] }, // derived 쓰기 시도 - 실패해야 함
            { type: 'snapshot.patch', id: effectIds[2]!, ops: [{ op: 'set', path: 'data.c', value: 3 }] },
          ],
        },
        { effects: [] }, // 세션 종료
      ];

      const client = createMockClient(decisions);
      const { session, getSnapshot, getErrors } = createSimpleSession({
        initialSnapshot: { data: {}, state: {}, derived: {} },
        client,
      });

      const result = await session.step();

      // 첫 번째 effect만 성공
      expect(result.effectsExecuted).toBe(1);
      expect(result.errorsEncountered).toBe(1);

      // 세 번째 effect는 실행되지 않음
      const snapshot = getSnapshot() as any;
      expect(snapshot.data.a).toBe(1);
      expect(snapshot.data.c).toBeUndefined();

      // 에러 기록 확인 (validation error + handler error may both be recorded)
      const errors = getErrors();
      expect(errors.length).toBeGreaterThanOrEqual(1);
    });

    it('should continue to next step after error', async () => {
      const decisions: AgentDecision[] = [
        {
          effects: [
            { type: 'snapshot.patch', id: generateEffectId(), ops: [{ op: 'set', path: 'derived.x', value: 1 }] }, // 실패
          ],
        },
        {
          effects: [
            { type: 'snapshot.patch', id: generateEffectId(), ops: [{ op: 'set', path: 'data.a', value: 2 }] }, // 성공
          ],
        },
        { effects: [] },
      ];

      const client = createMockClient(decisions);
      const { session, getSnapshot } = createSimpleSession({
        initialSnapshot: { data: {}, state: {}, derived: {} },
        client,
      });

      // 첫 번째 step - 실패
      const result1 = await session.step();
      expect(result1.errorsEncountered).toBe(1);

      // 두 번째 step - 성공
      const result2 = await session.step();
      expect(result2.errorsEncountered).toBe(0);
      expect(result2.effectsExecuted).toBe(1);

      const snapshot = getSnapshot() as any;
      expect(snapshot.data.a).toBe(2);
    });
  });

  describe('effect order', () => {
    it('should execute effects in order', async () => {
      const order: number[] = [];

      const decisions: AgentDecision[] = [
        {
          effects: [
            { type: 'log.emit', id: generateEffectId(), level: 'info', message: '1' },
            { type: 'log.emit', id: generateEffectId(), level: 'info', message: '2' },
            { type: 'log.emit', id: generateEffectId(), level: 'info', message: '3' },
          ],
        },
        { effects: [] },
      ];

      const client = createMockClient(decisions);
      const { session } = createSimpleSession({
        initialSnapshot: { data: {}, state: {}, derived: {} },
        client,
      });

      await session.step();

      // log.emit은 순서대로 실행됨 (로그 확인은 별도 구현 필요)
    });
  });

  describe('empty effects', () => {
    it('should return done=true when effects array is empty', async () => {
      const decisions: AgentDecision[] = [
        { effects: [] },
      ];

      const client = createMockClient(decisions);
      const { session } = createSimpleSession({
        initialSnapshot: { data: {}, state: {}, derived: {} },
        client,
      });

      const result = await session.step();

      expect(result.done).toBe(true);
      expect(result.effectsExecuted).toBe(0);
      expect(result.errorsEncountered).toBe(0);
    });
  });

  describe('run()', () => {
    it('should run until done', async () => {
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
        { effects: [] }, // 종료
      ];

      const client = createMockClient(decisions);
      const { session, getSnapshot } = createSimpleSession({
        initialSnapshot: { data: {}, state: {}, derived: {} },
        client,
      });

      const result = await session.run();

      expect(result.done).toBe(true);
      expect(result.totalSteps).toBe(3);
      expect(result.totalEffects).toBe(2);

      const snapshot = getSnapshot() as any;
      expect(snapshot.data.step).toBe(2);
    });

    it('should stop at maxSteps', async () => {
      // 무한 루프 클라이언트
      const infiniteClient = {
        async decide() {
          return {
            effects: [
              { type: 'log.emit', id: generateEffectId(), level: 'info', message: 'ping' },
            ],
          };
        },
      };

      const { session } = createSimpleSession({
        initialSnapshot: { data: {}, state: {}, derived: {} },
        client: infiniteClient,
        policy: { maxSteps: 5 },
      });

      const result = await session.run();

      expect(result.done).toBe(false);
      expect(result.totalSteps).toBe(5);
      expect(result.reason).toContain('Max steps');
    });

    it('should stop when isDone returns true', async () => {
      const decisions: AgentDecision[] = Array(10).fill({
        effects: [
          { type: 'snapshot.patch', id: generateEffectId(), ops: [{ op: 'set', path: 'state.phase', value: 'done' }] },
        ],
      });

      const client = createMockClient(decisions);
      const { session } = createSimpleSession({
        initialSnapshot: { data: {}, state: { phase: 'init' }, derived: {} },
        client,
        isDone: (snapshot: any) => ({
          done: snapshot.state.phase === 'done',
          reason: 'Phase is done',
        }),
      });

      const result = await session.run();

      expect(result.done).toBe(true);
      expect(result.reason).toBe('Phase is done');
      expect(result.totalSteps).toBe(1); // 첫 step에서 phase가 done으로 변경되고, 두 번째 loop에서 isDone 체크
    });
  });
});
