/**
 * @manifesto-ai/agent - Max Effects Tests
 *
 * 테스트 내용:
 * - maxEffectsPerStep 제한
 */

import { describe, it, expect } from 'vitest';
import { createSimpleSession } from '../../src/session/create.js';
import { createMockClient } from '../../src/types/client.js';
import { generateEffectId } from '../../src/types/effect.js';
import type { AgentDecision } from '../../src/index.js';

describe('Max Effects Per Step', () => {
  it('should limit effects to maxEffectsPerStep', async () => {
    // 20개의 effects를 반환하지만, maxEffectsPerStep은 5
    const effects = Array.from({ length: 20 }, (_, i) => ({
      type: 'snapshot.patch' as const,
      id: generateEffectId(),
      ops: [{ op: 'set' as const, path: `data.item${i}`, value: i }],
    }));

    const decisions: AgentDecision[] = [
      { effects },
      { effects: [] },
    ];

    const client = createMockClient(decisions);
    const { session, getSnapshot } = createSimpleSession({
      initialSnapshot: { data: {}, state: {}, derived: {} },
      client,
      policy: { maxSteps: 10, maxEffectsPerStep: 5 },
    });

    const result = await session.step();

    expect(result.effectsExecuted).toBe(5);

    // 처음 5개만 적용됨
    const snapshot = getSnapshot() as any;
    expect(snapshot.data.item0).toBe(0);
    expect(snapshot.data.item4).toBe(4);
    expect(snapshot.data.item5).toBeUndefined();
  });

  it('should use default maxEffectsPerStep of 16', async () => {
    const effects = Array.from({ length: 20 }, (_, i) => ({
      type: 'log.emit' as const,
      id: generateEffectId(),
      level: 'info' as const,
      message: `Log ${i}`,
    }));

    const decisions: AgentDecision[] = [
      { effects },
      { effects: [] },
    ];

    const client = createMockClient(decisions);
    const { session } = createSimpleSession({
      initialSnapshot: { data: {}, state: {}, derived: {} },
      client,
      // maxEffectsPerStep not specified, defaults to 16
    });

    const result = await session.step();

    expect(result.effectsExecuted).toBe(16);
  });

  it('should handle exactly maxEffectsPerStep effects', async () => {
    const effects = Array.from({ length: 5 }, (_, i) => ({
      type: 'snapshot.patch' as const,
      id: generateEffectId(),
      ops: [{ op: 'set' as const, path: `data.item${i}`, value: i }],
    }));

    const decisions: AgentDecision[] = [
      { effects },
      { effects: [] },
    ];

    const client = createMockClient(decisions);
    const { session, getSnapshot } = createSimpleSession({
      initialSnapshot: { data: {}, state: {}, derived: {} },
      client,
      policy: { maxSteps: 10, maxEffectsPerStep: 5 },
    });

    const result = await session.step();

    expect(result.effectsExecuted).toBe(5);

    const snapshot = getSnapshot() as any;
    expect(Object.keys(snapshot.data)).toHaveLength(5);
  });

  it('should handle fewer effects than maxEffectsPerStep', async () => {
    const effects = Array.from({ length: 3 }, (_, i) => ({
      type: 'snapshot.patch' as const,
      id: generateEffectId(),
      ops: [{ op: 'set' as const, path: `data.item${i}`, value: i }],
    }));

    const decisions: AgentDecision[] = [
      { effects },
      { effects: [] },
    ];

    const client = createMockClient(decisions);
    const { session } = createSimpleSession({
      initialSnapshot: { data: {}, state: {}, derived: {} },
      client,
      policy: { maxSteps: 10, maxEffectsPerStep: 10 },
    });

    const result = await session.step();

    expect(result.effectsExecuted).toBe(3);
  });

  it('should count only successfully executed effects', async () => {
    const effects = [
      { type: 'snapshot.patch' as const, id: generateEffectId(), ops: [{ op: 'set' as const, path: 'data.a', value: 1 }] },
      { type: 'snapshot.patch' as const, id: generateEffectId(), ops: [{ op: 'set' as const, path: 'derived.x', value: 2 }] }, // 실패
      { type: 'snapshot.patch' as const, id: generateEffectId(), ops: [{ op: 'set' as const, path: 'data.c', value: 3 }] },
    ];

    const decisions: AgentDecision[] = [
      { effects },
      { effects: [] },
    ];

    const client = createMockClient(decisions);
    const { session } = createSimpleSession({
      initialSnapshot: { data: {}, state: {}, derived: {} },
      client,
      policy: { maxSteps: 10, maxEffectsPerStep: 10 },
    });

    const result = await session.step();

    // 첫 번째만 성공, 두 번째에서 실패 후 중단
    expect(result.effectsExecuted).toBe(1);
    expect(result.errorsEncountered).toBe(1);
  });
});
