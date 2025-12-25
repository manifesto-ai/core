/**
 * P1-2: Effect Sequence Abort Test
 *
 * sequence 효과 중간 실패 시 중단 동작 검증
 * - 실패 시점에서 즉시 중단
 * - 이미 실행된 효과는 롤백되지 않음 (설계상 의도)
 * - 에러 정보 정확히 반환
 */
import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { defineDomain, defineSource } from '../../src/domain/define.js';
import { createRuntime } from '../../src/runtime/runtime.js';
import {
  setValue,
  sequence,
  runEffect,
  type EffectHandler,
  type EffectRunnerConfig,
} from '../../src/effect/runner.js';
import { ok, err, handlerError } from '../../src/effect/result.js';
import type { SemanticPath } from '../../src/index.js';
import type { EvaluationContext } from '../../src/expression/evaluator.js';

describe('Effect Sequence Abort (P1-2)', () => {
  function createTestDomain() {
    return defineDomain({
      id: 'sequence-abort-test',
      name: 'Sequence Abort Test',
      description: 'Testing sequence abort behavior',
      dataSchema: z.object({
        value1: z.number(),
        value2: z.number(),
        value3: z.number(),
      }),
      stateSchema: z.object({
        status: z.string().optional(),
      }),
      initialState: {
        status: 'initial',
      },
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
        derived: {},
      },
      actions: {},
    });
  }

  function createMockHandler(): EffectHandler {
    return {
      setValue: vi.fn().mockReturnValue(ok(undefined)),
      setState: vi.fn().mockReturnValue(ok(undefined)),
      navigate: vi.fn().mockReturnValue(ok(undefined)),
      emitEvent: vi.fn().mockReturnValue(ok(undefined)),
      apiCall: vi.fn().mockResolvedValue(ok({ data: 'test' })),
    };
  }

  function createMockContext(): EvaluationContext {
    return {
      data: { value1: 1, value2: 2, value3: 3 },
      state: { status: 'initial' },
      derived: {},
    };
  }

  function createConfig(handler: EffectHandler): EffectRunnerConfig {
    return {
      handler,
      context: createMockContext(),
    };
  }

  it('should execute all effects in sequence when all succeed', async () => {
    const handler = createMockHandler();

    const effect = sequence([
      setValue('data.value1', 10, 'Set value 1'),
      setValue('data.value2', 20, 'Set value 2'),
      setValue('data.value3', 30, 'Set value 3'),
    ]);

    const result = await runEffect(effect, createConfig(handler));

    expect(result.ok).toBe(true);
    expect(handler.setValue).toHaveBeenCalledTimes(3);
  });

  it('should abort sequence on first failure', async () => {
    const handler = createMockHandler();

    // Second setValue will fail
    (handler.setValue as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(ok(undefined)) // First succeeds
      .mockReturnValueOnce(err(handlerError('data.value2' as SemanticPath, new Error('Validation failed'), 'VALIDATION_ERROR'))) // Second fails
      .mockReturnValueOnce(ok(undefined)); // Third should not be called

    const effect = sequence([
      setValue('data.value1', 10, 'Set value 1'),
      setValue('data.value2', -999, 'Set value 2 - will fail'),
      setValue('data.value3', 30, 'Set value 3 - should not run'),
    ]);

    const result = await runEffect(effect, createConfig(handler));

    expect(result.ok).toBe(false);
    // First two were called, third should not be
    expect(handler.setValue).toHaveBeenCalledTimes(2);
  });

  it('should return error from failed effect', async () => {
    const handler = createMockHandler();
    const errorMessage = 'Value must be positive';

    (handler.setValue as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(ok(undefined))
      .mockReturnValueOnce(err(handlerError('data.value2' as SemanticPath, new Error(errorMessage), 'VALIDATION_ERROR')));

    const effect = sequence([
      setValue('data.value1', 10, 'Set value 1'),
      setValue('data.value2', -1, 'Set value 2'),
    ]);

    const result = await runEffect(effect, createConfig(handler));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.cause.message).toBe(errorMessage);
    }
  });

  it('should not rollback already executed effects', async () => {
    const executionOrder: string[] = [];
    const handler: EffectHandler = {
      setValue: vi.fn((path, value) => {
        executionOrder.push(`setValue:${path}:${value}`);
        if (path === 'data.value2') {
          return err(handlerError(path as SemanticPath, new Error('Failed'), 'HANDLER_ERROR'));
        }
        return ok(undefined);
      }),
      setState: vi.fn().mockReturnValue(ok(undefined)),
      navigate: vi.fn().mockReturnValue(ok(undefined)),
      emitEvent: vi.fn().mockReturnValue(ok(undefined)),
      apiCall: vi.fn().mockResolvedValue(ok({ data: 'test' })),
    };

    const effect = sequence([
      setValue('data.value1', 100, 'First'),
      setValue('data.value2', 200, 'Second - fails'),
      setValue('data.value3', 300, 'Third - should not run'),
    ]);

    await runEffect(effect, createConfig(handler));

    // First effect was executed and NOT rolled back
    expect(executionOrder).toEqual([
      'setValue:data.value1:100',
      'setValue:data.value2:200',
    ]);
    // Third was never called
    expect(executionOrder).not.toContain('setValue:data.value3:300');
  });

  it('should handle async effects in sequence', async () => {
    const executionOrder: string[] = [];
    const handler: EffectHandler = {
      setValue: vi.fn((path, value) => {
        executionOrder.push(`setValue:${path}`);
        return ok(undefined);
      }),
      setState: vi.fn((path, value) => {
        executionOrder.push(`setState:${path}`);
        return ok(undefined);
      }),
      navigate: vi.fn().mockReturnValue(ok(undefined)),
      emitEvent: vi.fn().mockReturnValue(ok(undefined)),
      apiCall: vi.fn(async (request) => {
        executionOrder.push(`apiCall:${request.endpoint}`);
        // Simulate async delay
        await new Promise(resolve => setTimeout(resolve, 10));
        return ok({ data: 'response' });
      }),
    };

    const effect = sequence([
      setValue('data.value1', 1, 'First'),
      {
        _tag: 'ApiCall' as const,
        endpoint: '/api/test',
        method: 'GET' as const,
        description: 'API call',
      },
      setValue('data.value2', 2, 'After API'),
    ]);

    const result = await runEffect(effect, createConfig(handler));

    expect(result.ok).toBe(true);
    // Should execute in order
    expect(executionOrder).toEqual([
      'setValue:data.value1',
      'apiCall:/api/test',
      'setValue:data.value2',
    ]);
  });

  it('should abort sequence when async effect fails', async () => {
    const executionOrder: string[] = [];
    const handler: EffectHandler = {
      setValue: vi.fn((path) => {
        executionOrder.push(`setValue:${path}`);
        return ok(undefined);
      }),
      setState: vi.fn().mockReturnValue(ok(undefined)),
      navigate: vi.fn().mockReturnValue(ok(undefined)),
      emitEvent: vi.fn().mockReturnValue(ok(undefined)),
      apiCall: vi.fn(async (request) => {
        executionOrder.push(`apiCall:${request.endpoint}`);
        return err(handlerError('apiCall' as SemanticPath, new Error('Network error'), 'API_CALL_FAILED'));
      }),
    };

    const effect = sequence([
      setValue('data.value1', 1, 'First'),
      {
        _tag: 'ApiCall' as const,
        endpoint: '/api/failing',
        method: 'POST' as const,
        description: 'Failing API call',
      },
      setValue('data.value2', 2, 'Should not run'),
    ]);

    const result = await runEffect(effect, createConfig(handler));

    expect(result.ok).toBe(false);
    expect(executionOrder).toEqual([
      'setValue:data.value1',
      'apiCall:/api/failing',
    ]);
    // Third effect should not have run
    expect(executionOrder).not.toContain('setValue:data.value2');
  });

  it('should handle empty sequence', async () => {
    const handler = createMockHandler();

    const effect = sequence([]);

    const result = await runEffect(effect, createConfig(handler));

    expect(result.ok).toBe(true);
    expect(handler.setValue).not.toHaveBeenCalled();
  });

  it('should handle single effect in sequence', async () => {
    const handler = createMockHandler();

    const effect = sequence([
      setValue('data.value1', 42, 'Single effect'),
    ]);

    const result = await runEffect(effect, createConfig(handler));

    expect(result.ok).toBe(true);
    expect(handler.setValue).toHaveBeenCalledTimes(1);
  });
});
