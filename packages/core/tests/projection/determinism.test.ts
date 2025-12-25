/**
 * P1-2: Projection Determinism Test
 *
 * projectAgentContext가 동일 입력에 대해 항상 동일 출력을 생성하는지 검증
 * - 결정론적 순서
 * - 안정적인 출력
 */
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { defineDomain, defineSource, defineDerived, defineAction, condition } from '../../src/domain/define.js';
import { createRuntime } from '../../src/runtime/runtime.js';
import { setValue } from '../../src/effect/runner.js';
import { projectAgentContext } from '../../src/projection/agent-context.js';

describe('Projection Determinism (P1-2)', () => {
  function createTestDomain() {
    return defineDomain({
      id: 'determinism-test',
      name: 'Determinism Test Domain',
      description: 'Domain for testing projection determinism',
      dataSchema: z.object({
        value1: z.number(),
        value2: z.number(),
        value3: z.number(),
      }),
      stateSchema: z.object({}),
      initialState: {},
      paths: {
        sources: {
          'data.value1': defineSource({
            schema: z.number(),
            semantic: { type: 'input', description: 'Value 1' },
          }),
          'data.value2': defineSource({
            schema: z.number(),
            semantic: { type: 'input', description: 'Value 2' },
          }),
          'data.value3': defineSource({
            schema: z.number(),
            semantic: { type: 'input', description: 'Value 3' },
          }),
        },
        derived: {
          'derived.sum': defineDerived({
            deps: ['data.value1', 'data.value2'],
            expr: ['+', ['get', 'data.value1'], ['get', 'data.value2']],
            semantic: { type: 'computed', description: 'Sum' },
          }),
          'derived.isPositive': defineDerived({
            deps: ['derived.sum'],
            expr: ['>', ['get', 'derived.sum'], 0],
            semantic: { type: 'condition', description: 'Is positive' },
          }),
          'derived.total': defineDerived({
            deps: ['derived.sum', 'data.value3'],
            expr: ['+', ['get', 'derived.sum'], ['get', 'data.value3']],
            semantic: { type: 'computed', description: 'Total' },
          }),
        },
      },
      actions: {
        'action.reset': defineAction({
          verb: 'reset',
          label: 'Reset',
          description: 'Reset values',
          deps: ['data.value1', 'data.value2'],
          effect: setValue('data.value1', 0, 'Reset'),
          preconditions: [
            condition('derived.isPositive', { expect: 'true', reason: 'Sum must be positive' }),
          ],
        }),
        'action.increment': defineAction({
          verb: 'increment',
          label: 'Increment',
          description: 'Increment value1',
          deps: ['data.value1'],
          effect: setValue('data.value1', ['+', ['get', 'data.value1'], 1], 'Increment'),
        }),
      },
    });
  }

  it('should produce identical context for identical snapshots', () => {
    const domain = createTestDomain();

    // Create two separate runtimes with identical state
    const runtime1 = createRuntime({
      domain,
      initialData: { value1: 5, value2: 10, value3: 15 },
    });

    const runtime2 = createRuntime({
      domain,
      initialData: { value1: 5, value2: 10, value3: 15 },
    });

    // Project both
    const context1 = projectAgentContext(runtime1, domain);
    const context2 = projectAgentContext(runtime2, domain);

    // Should be deeply equal (excluding metadata.projectedAt timestamp)
    expect(context1.snapshot).toEqual(context2.snapshot);
    expect(context1.availableActions).toEqual(context2.availableActions);
    expect(context1.unavailableActions).toEqual(context2.unavailableActions);
    expect(context1.fieldPolicies).toEqual(context2.fieldPolicies);
  });

  it('should produce consistent order across multiple projections', () => {
    const domain = createTestDomain();
    const runtime = createRuntime({
      domain,
      initialData: { value1: 5, value2: 10, value3: 15 },
    });

    // Project multiple times
    const results: ReturnType<typeof projectAgentContext>[] = [];
    for (let i = 0; i < 10; i++) {
      results.push(projectAgentContext(runtime, domain));
    }

    // All projections should have the same order of actions
    const firstActionOrder = results[0].availableActions.map(a => a.actionId);
    for (let i = 1; i < results.length; i++) {
      const currentActionOrder = results[i].availableActions.map(a => a.actionId);
      expect(currentActionOrder).toEqual(firstActionOrder);
    }
  });

  it('should update deterministically after state change', () => {
    const domain = createTestDomain();
    const runtime = createRuntime({
      domain,
      initialData: { value1: 5, value2: 10, value3: 15 },
    });

    // Initial projection
    const initialContext = projectAgentContext(runtime, domain);

    // Make a state change
    runtime.set('data.value1', 100);

    // New projection
    const afterChangeContext = projectAgentContext(runtime, domain);

    // Snapshot should reflect the change
    expect(afterChangeContext.snapshot.data.value1).toBe(100);
    expect(initialContext.snapshot.data.value1).toBe(5);

    // Derived values should update consistently (keys don't have 'derived.' prefix)
    expect(afterChangeContext.snapshot.derived['sum']).toBe(110); // 100+10
    expect(afterChangeContext.snapshot.derived['total']).toBe(125); // 110+15
  });

  it('should consistently categorize available vs unavailable actions', () => {
    const domain = createTestDomain();

    // Positive sum - action.reset should be available
    const runtimePositive = createRuntime({
      domain,
      initialData: { value1: 5, value2: 10, value3: 15 }, // sum = 15 > 0
    });
    const contextPositive = projectAgentContext(runtimePositive, domain);

    expect(contextPositive.availableActions.some(a => a.actionId === 'action.reset')).toBe(true);
    expect(contextPositive.unavailableActions.some(a => a.actionId === 'action.reset')).toBe(false);

    // Negative sum - action.reset should be unavailable
    const runtimeNegative = createRuntime({
      domain,
      initialData: { value1: -10, value2: -5, value3: 15 }, // sum = -15 < 0
    });
    const contextNegative = projectAgentContext(runtimeNegative, domain);

    expect(contextNegative.availableActions.some(a => a.actionId === 'action.reset')).toBe(false);
    expect(contextNegative.unavailableActions.some(a => a.actionId === 'action.reset')).toBe(true);
  });

  it('should include consistent blocked reasons', () => {
    const domain = createTestDomain();
    const runtime = createRuntime({
      domain,
      initialData: { value1: -10, value2: -5, value3: 15 }, // sum = -15 < 0
    });

    // Project multiple times
    const contexts = [];
    for (let i = 0; i < 5; i++) {
      contexts.push(projectAgentContext(runtime, domain));
    }

    // All should have the same blocked reasons for action.reset
    const firstBlockedReasons = contexts[0].unavailableActions.find(
      a => a.actionId === 'action.reset'
    )?.blockedReasons;

    for (let i = 1; i < contexts.length; i++) {
      const currentBlockedReasons = contexts[i].unavailableActions.find(
        a => a.actionId === 'action.reset'
      )?.blockedReasons;
      expect(currentBlockedReasons).toEqual(firstBlockedReasons);
    }
  });

  it('should serialize to consistent JSON', () => {
    const domain = createTestDomain();
    const runtime = createRuntime({
      domain,
      initialData: { value1: 5, value2: 10, value3: 15 },
    });

    // Project and serialize multiple times
    const serialized1 = JSON.stringify(projectAgentContext(runtime, domain).snapshot);
    const serialized2 = JSON.stringify(projectAgentContext(runtime, domain).snapshot);

    // JSON should be identical
    expect(serialized1).toBe(serialized2);
  });
});
