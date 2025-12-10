import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  runEffect,
  setValue,
  setState,
  apiCall,
  navigate,
  delay,
  sequence,
  parallel,
  conditional,
  catchEffect,
  emitEvent,
  type EffectHandler,
  type EffectRunnerConfig,
} from '../../src/effect/runner.js';
import type { EvaluationContext } from '../../src/expression/types.js';

describe('Effect Runner', () => {
  let handler: EffectHandler;
  let context: EvaluationContext;
  let config: EffectRunnerConfig;
  let contextValues: Record<string, unknown>;

  const createContext = (values: Record<string, unknown>): EvaluationContext => ({
    get: (path) => values[path],
  });

  beforeEach(() => {
    handler = {
      setValue: vi.fn(),
      setState: vi.fn(),
      apiCall: vi.fn().mockResolvedValue({ success: true }),
      navigate: vi.fn(),
      emitEvent: vi.fn(),
    };
    contextValues = {
      'data.name': 'test',
      'data.count': 10,
      'state.loading': false,
    };
    context = createContext(contextValues);
    config = { handler, context };
  });

  describe('runEffect - SetValue', () => {
    it('should set value with literal expression', async () => {
      const effect = setValue('data.name', 'newValue', 'Set name');
      const result = await runEffect(effect, config);

      expect(result.ok).toBe(true);
      expect(handler.setValue).toHaveBeenCalledWith('data.name', 'newValue');
    });

    it('should set value with get expression', async () => {
      const effect = setValue('data.copy', ['get', 'data.name'], 'Copy name');
      const result = await runEffect(effect, config);

      expect(result.ok).toBe(true);
      expect(handler.setValue).toHaveBeenCalledWith('data.copy', 'test');
    });

    it('should set value with computed expression', async () => {
      const effect = setValue('data.doubled', ['+', ['get', 'data.count'], 5], 'Add 5');
      const result = await runEffect(effect, config);

      expect(result.ok).toBe(true);
      expect(handler.setValue).toHaveBeenCalledWith('data.doubled', 15);
    });

    it('should handle undefined values from missing paths', async () => {
      // Note: get with missing path returns undefined, not an error
      const effect = setValue('data.x', ['get', 'nonexistent.path'], 'Get missing');
      const result = await runEffect(effect, config);

      expect(result.ok).toBe(true);
      expect(handler.setValue).toHaveBeenCalledWith('data.x', undefined);
    });

    it('should return error for invalid expression operator', async () => {
      const effect = setValue('data.x', ['unknownOp'], 'Invalid op');
      const result = await runEffect(effect, config);

      expect(result.ok).toBe(false);
    });
  });

  describe('runEffect - SetState', () => {
    it('should set state value', async () => {
      const effect = setState('state.loading', true, 'Set loading');
      const result = await runEffect(effect, config);

      expect(result.ok).toBe(true);
      expect(handler.setState).toHaveBeenCalledWith('state.loading', true);
    });

    it('should set state with expression', async () => {
      const effect = setState('state.count', ['get', 'data.count'], 'Copy count');
      const result = await runEffect(effect, config);

      expect(result.ok).toBe(true);
      expect(handler.setState).toHaveBeenCalledWith('state.count', 10);
    });

    it('should return error for invalid operator in state expression', async () => {
      const effect = setState('state.x', ['unknownOp'], 'Invalid');
      const result = await runEffect(effect, config);

      expect(result.ok).toBe(false);
    });
  });

  describe('runEffect - ApiCall', () => {
    it('should call API with string endpoint', async () => {
      const effect = apiCall({
        endpoint: '/api/users',
        method: 'GET',
        description: 'Fetch users',
      });
      const result = await runEffect(effect, config);

      expect(result.ok).toBe(true);
      expect(handler.apiCall).toHaveBeenCalledWith({
        endpoint: '/api/users',
        method: 'GET',
        body: undefined,
        headers: undefined,
        query: undefined,
        timeout: undefined,
      });
    });

    it('should call API with expression endpoint', async () => {
      contextValues['data.endpoint'] = '/api/items';
      context = createContext(contextValues);
      config = { handler, context };
      const effect = apiCall({
        endpoint: ['get', 'data.endpoint'],
        method: 'GET',
        description: 'Dynamic endpoint',
      });
      const result = await runEffect(effect, config);

      expect(result.ok).toBe(true);
      expect(handler.apiCall).toHaveBeenCalledWith(
        expect.objectContaining({ endpoint: '/api/items' })
      );
    });

    it('should call API with body expressions', async () => {
      const effect = apiCall({
        endpoint: '/api/create',
        method: 'POST',
        body: {
          name: ['get', 'data.name'],
          count: ['get', 'data.count'],
        },
        description: 'Create item',
      });
      const result = await runEffect(effect, config);

      expect(result.ok).toBe(true);
      expect(handler.apiCall).toHaveBeenCalledWith(
        expect.objectContaining({
          body: { name: 'test', count: 10 },
        })
      );
    });

    it('should call API with query expressions', async () => {
      const effect = apiCall({
        endpoint: '/api/search',
        method: 'GET',
        query: {
          q: ['get', 'data.name'],
          limit: 20,
        },
        description: 'Search',
      });
      const result = await runEffect(effect, config);

      expect(result.ok).toBe(true);
      expect(handler.apiCall).toHaveBeenCalledWith(
        expect.objectContaining({
          query: { q: 'test', limit: 20 },
        })
      );
    });

    it('should call API with headers and timeout', async () => {
      const effect = apiCall({
        endpoint: '/api/data',
        method: 'GET',
        headers: { Authorization: 'Bearer token' },
        timeout: 5000,
        description: 'Fetch with auth',
      });
      const result = await runEffect(effect, config);

      expect(result.ok).toBe(true);
      expect(handler.apiCall).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: { Authorization: 'Bearer token' },
          timeout: 5000,
        })
      );
    });

    it('should return error when API call fails', async () => {
      (handler.apiCall as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Network error')
      );
      const effect = apiCall({
        endpoint: '/api/fail',
        method: 'GET',
        description: 'Failing call',
      });
      const result = await runEffect(effect, config);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('API_CALL_FAILED');
      }
    });

    it('should return error for invalid endpoint operator', async () => {
      const effect = apiCall({
        endpoint: ['invalidOp'],
        method: 'GET',
        description: 'Invalid endpoint',
      });
      const result = await runEffect(effect, config);

      expect(result.ok).toBe(false);
    });

    it('should return error for invalid body operator', async () => {
      const effect = apiCall({
        endpoint: '/api/create',
        method: 'POST',
        body: {
          invalid: ['invalidOp'],
        },
        description: 'Invalid body',
      });
      const result = await runEffect(effect, config);

      expect(result.ok).toBe(false);
    });

    it('should return error for invalid query operator', async () => {
      const effect = apiCall({
        endpoint: '/api/search',
        method: 'GET',
        query: {
          invalid: ['invalidOp'],
        },
        description: 'Invalid query',
      });
      const result = await runEffect(effect, config);

      expect(result.ok).toBe(false);
    });
  });

  describe('runEffect - Navigate', () => {
    it('should navigate with string path', async () => {
      const effect = navigate('/home', { description: 'Go home' });
      const result = await runEffect(effect, config);

      expect(result.ok).toBe(true);
      expect(handler.navigate).toHaveBeenCalledWith('/home', undefined);
    });

    it('should navigate with push mode', async () => {
      const effect = navigate('/details', { mode: 'push', description: 'Push' });
      const result = await runEffect(effect, config);

      expect(result.ok).toBe(true);
      expect(handler.navigate).toHaveBeenCalledWith('/details', 'push');
    });

    it('should navigate with replace mode', async () => {
      const effect = navigate('/login', { mode: 'replace', description: 'Replace' });
      const result = await runEffect(effect, config);

      expect(result.ok).toBe(true);
      expect(handler.navigate).toHaveBeenCalledWith('/login', 'replace');
    });

    it('should navigate with expression path', async () => {
      contextValues['data.targetPath'] = '/dashboard';
      context = createContext(contextValues);
      config = { handler, context };
      const effect = navigate(['get', 'data.targetPath']);
      const result = await runEffect(effect, config);

      expect(result.ok).toBe(true);
      expect(handler.navigate).toHaveBeenCalledWith('/dashboard', undefined);
    });

    it('should return error for invalid path operator', async () => {
      const effect = navigate(['invalidOp']);
      const result = await runEffect(effect, config);

      expect(result.ok).toBe(false);
    });
  });

  describe('runEffect - Delay', () => {
    it('should delay execution', async () => {
      vi.useFakeTimers();
      const effect = delay(100, 'Wait 100ms');

      const promise = runEffect(effect, config);
      vi.advanceTimersByTime(100);
      const result = await promise;

      expect(result.ok).toBe(true);
      vi.useRealTimers();
    });

    it('should use default description', () => {
      const effect = delay(50);
      expect(effect.description).toBe('Wait 50ms');
    });
  });

  describe('runEffect - Sequence', () => {
    it('should execute effects in sequence', async () => {
      const effects = [
        setValue('data.a', 1, 'Set a'),
        setValue('data.b', 2, 'Set b'),
        setValue('data.c', 3, 'Set c'),
      ];
      const effect = sequence(effects, 'Sequential');
      const result = await runEffect(effect, config);

      expect(result.ok).toBe(true);
      expect(handler.setValue).toHaveBeenCalledTimes(3);
      expect(handler.setValue).toHaveBeenNthCalledWith(1, 'data.a', 1);
      expect(handler.setValue).toHaveBeenNthCalledWith(2, 'data.b', 2);
      expect(handler.setValue).toHaveBeenNthCalledWith(3, 'data.c', 3);
    });

    it('should stop on first error', async () => {
      const effects = [
        setValue('data.a', 1, 'Set a'),
        setValue('data.b', ['invalidOp'], 'Fail'),
        setValue('data.c', 3, 'Set c'),
      ];
      const effect = sequence(effects);
      const result = await runEffect(effect, config);

      expect(result.ok).toBe(false);
      expect(handler.setValue).toHaveBeenCalledTimes(1);
    });

    it('should return last result on success', async () => {
      (handler.apiCall as ReturnType<typeof vi.fn>).mockResolvedValueOnce('first');
      (handler.apiCall as ReturnType<typeof vi.fn>).mockResolvedValueOnce('second');

      const effects = [
        apiCall({ endpoint: '/a', method: 'GET', description: 'First' }),
        apiCall({ endpoint: '/b', method: 'GET', description: 'Second' }),
      ];
      const effect = sequence(effects);
      const result = await runEffect(effect, config);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe('second');
      }
    });

    it('should handle empty sequence', async () => {
      const effect = sequence([]);
      const result = await runEffect(effect, config);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(undefined);
      }
    });
  });

  describe('runEffect - Parallel', () => {
    it('should execute effects in parallel (waitAll=true)', async () => {
      (handler.apiCall as ReturnType<typeof vi.fn>).mockResolvedValueOnce('a');
      (handler.apiCall as ReturnType<typeof vi.fn>).mockResolvedValueOnce('b');

      const effects = [
        apiCall({ endpoint: '/a', method: 'GET', description: 'A' }),
        apiCall({ endpoint: '/b', method: 'GET', description: 'B' }),
      ];
      const effect = parallel(effects, { waitAll: true });
      const result = await runEffect(effect, config);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual(['a', 'b']);
      }
    });

    it('should return first completed (waitAll=false)', async () => {
      let resolveFirst: (v: unknown) => void;
      let resolveSecond: (v: unknown) => void;

      (handler.apiCall as ReturnType<typeof vi.fn>).mockImplementationOnce(
        () => new Promise((r) => (resolveFirst = r))
      );
      (handler.apiCall as ReturnType<typeof vi.fn>).mockImplementationOnce(
        () => new Promise((r) => (resolveSecond = r))
      );

      const effects = [
        apiCall({ endpoint: '/slow', method: 'GET', description: 'Slow' }),
        apiCall({ endpoint: '/fast', method: 'GET', description: 'Fast' }),
      ];
      const effect = parallel(effects, { waitAll: false });
      const promise = runEffect(effect, config);

      // Resolve second first
      resolveSecond!('fast');
      const result = await promise;

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe('fast');
      }
    });

    it('should return error if any parallel effect fails (waitAll=true)', async () => {
      (handler.apiCall as ReturnType<typeof vi.fn>).mockResolvedValueOnce('success');
      (handler.apiCall as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Failed')
      );

      const effects = [
        apiCall({ endpoint: '/ok', method: 'GET', description: 'OK' }),
        apiCall({ endpoint: '/fail', method: 'GET', description: 'Fail' }),
      ];
      const effect = parallel(effects, { waitAll: true });
      const result = await runEffect(effect, config);

      expect(result.ok).toBe(false);
    });

    it('should default to waitAll=true', async () => {
      (handler.apiCall as ReturnType<typeof vi.fn>).mockResolvedValueOnce('a');
      (handler.apiCall as ReturnType<typeof vi.fn>).mockResolvedValueOnce('b');

      const effects = [
        apiCall({ endpoint: '/a', method: 'GET', description: 'A' }),
        apiCall({ endpoint: '/b', method: 'GET', description: 'B' }),
      ];
      const effect = parallel(effects);
      const result = await runEffect(effect, config);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(Array.isArray(result.value)).toBe(true);
      }
    });
  });

  describe('runEffect - Conditional', () => {
    it('should execute then branch when condition is true', async () => {
      const effect = conditional({
        condition: true,
        then: setValue('data.x', 'then', 'Then'),
        else: setValue('data.x', 'else', 'Else'),
      });
      const result = await runEffect(effect, config);

      expect(result.ok).toBe(true);
      expect(handler.setValue).toHaveBeenCalledWith('data.x', 'then');
    });

    it('should execute else branch when condition is false', async () => {
      const effect = conditional({
        condition: false,
        then: setValue('data.x', 'then', 'Then'),
        else: setValue('data.x', 'else', 'Else'),
      });
      const result = await runEffect(effect, config);

      expect(result.ok).toBe(true);
      expect(handler.setValue).toHaveBeenCalledWith('data.x', 'else');
    });

    it('should return ok when condition is false and no else', async () => {
      const effect = conditional({
        condition: false,
        then: setValue('data.x', 'then', 'Then'),
      });
      const result = await runEffect(effect, config);

      expect(result.ok).toBe(true);
      expect(handler.setValue).not.toHaveBeenCalled();
    });

    it('should evaluate condition expression', async () => {
      const effect = conditional({
        condition: ['>', ['get', 'data.count'], 5],
        then: setValue('data.big', true, 'Big'),
        else: setValue('data.big', false, 'Small'),
      });
      const result = await runEffect(effect, config);

      expect(result.ok).toBe(true);
      expect(handler.setValue).toHaveBeenCalledWith('data.big', true);
    });

    it('should return error for invalid condition operator', async () => {
      const effect = conditional({
        condition: ['invalidOp'],
        then: setValue('data.x', 'y', 'Set'),
      });
      const result = await runEffect(effect, config);

      expect(result.ok).toBe(false);
    });
  });

  describe('runEffect - Catch', () => {
    it('should execute try block on success', async () => {
      const effect = catchEffect({
        try: setValue('data.x', 'success', 'Try'),
        catch: setValue('data.x', 'caught', 'Catch'),
      });
      const result = await runEffect(effect, config);

      expect(result.ok).toBe(true);
      expect(handler.setValue).toHaveBeenCalledWith('data.x', 'success');
      expect(handler.setValue).toHaveBeenCalledTimes(1);
    });

    it('should execute catch block on error', async () => {
      const effect = catchEffect({
        try: setValue('data.x', ['invalidOp'], 'Try'),
        catch: setValue('data.x', 'caught', 'Catch'),
      });
      const result = await runEffect(effect, config);

      expect(result.ok).toBe(true);
      expect(handler.setValue).toHaveBeenCalledWith('data.x', 'caught');
    });

    it('should execute finally block on success', async () => {
      const effect = catchEffect({
        try: setValue('data.x', 'success', 'Try'),
        catch: setValue('data.x', 'caught', 'Catch'),
        finally: setState('state.loading', false, 'Finally'),
      });
      const result = await runEffect(effect, config);

      expect(result.ok).toBe(true);
      expect(handler.setState).toHaveBeenCalledWith('state.loading', false);
    });

    it('should execute finally block on error', async () => {
      const effect = catchEffect({
        try: setValue('data.x', ['invalidOp'], 'Try'),
        catch: setValue('data.x', 'caught', 'Catch'),
        finally: setState('state.loading', false, 'Finally'),
      });
      const result = await runEffect(effect, config);

      expect(result.ok).toBe(true);
      expect(handler.setState).toHaveBeenCalledWith('state.loading', false);
    });

    it('should return catch result when try fails', async () => {
      (handler.apiCall as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('API Error')
      );
      (handler.apiCall as ReturnType<typeof vi.fn>).mockResolvedValueOnce('fallback');

      const effect = catchEffect({
        try: apiCall({ endpoint: '/fail', method: 'GET', description: 'Fail' }),
        catch: apiCall({ endpoint: '/fallback', method: 'GET', description: 'Fallback' }),
      });
      const result = await runEffect(effect, config);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe('fallback');
      }
    });
  });

  describe('runEffect - EmitEvent', () => {
    it('should emit event to UI channel', async () => {
      const effect = emitEvent(
        'ui',
        { type: 'toast', message: 'Hello', severity: 'success' },
        'Show toast'
      );
      const result = await runEffect(effect, config);

      expect(result.ok).toBe(true);
      expect(handler.emitEvent).toHaveBeenCalledWith('ui', {
        type: 'toast',
        message: 'Hello',
        severity: 'success',
      });
    });

    it('should emit event to domain channel', async () => {
      const effect = emitEvent(
        'domain',
        { type: 'orderCreated', data: { id: '123' } },
        'Order created'
      );
      const result = await runEffect(effect, config);

      expect(result.ok).toBe(true);
      expect(handler.emitEvent).toHaveBeenCalledWith('domain', {
        type: 'orderCreated',
        data: { id: '123' },
      });
    });

    it('should emit event to analytics channel', async () => {
      const effect = emitEvent(
        'analytics',
        { type: 'pageView', data: { page: '/home' } },
        'Track page view'
      );
      const result = await runEffect(effect, config);

      expect(result.ok).toBe(true);
      expect(handler.emitEvent).toHaveBeenCalledWith('analytics', {
        type: 'pageView',
        data: { page: '/home' },
      });
    });

    it('should use default description', () => {
      const effect = emitEvent('ui', { type: 'notification' });
      expect(effect.description).toBe('Emit notification event');
    });
  });

  describe('runEffect - Unknown Effect Type', () => {
    it('should return error for unknown effect type', async () => {
      const unknownEffect = { _tag: 'UnknownType', description: 'Unknown' } as any;
      const result = await runEffect(unknownEffect, config);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.cause.message).toContain('Unknown effect type');
      }
    });
  });

  describe('runEffect - Exception Handling', () => {
    it('should catch synchronous exceptions', async () => {
      (handler.setValue as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('Sync error');
      });
      const effect = setValue('data.x', 'value', 'Set');
      const result = await runEffect(effect, config);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.cause.message).toBe('Sync error');
      }
    });

    it('should handle non-Error throws', async () => {
      (handler.setValue as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw 'string error';
      });
      const effect = setValue('data.x', 'value', 'Set');
      const result = await runEffect(effect, config);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.cause.message).toBe('string error');
      }
    });
  });

  describe('Effect Builders', () => {
    it('setValue should create SetValue effect', () => {
      const effect = setValue('data.name', 'value', 'Set name');
      expect(effect._tag).toBe('SetValue');
      expect(effect.path).toBe('data.name');
      expect(effect.value).toBe('value');
      expect(effect.description).toBe('Set name');
    });

    it('setState should create SetState effect', () => {
      const effect = setState('state.loading', true, 'Set loading');
      expect(effect._tag).toBe('SetState');
      expect(effect.path).toBe('state.loading');
      expect(effect.value).toBe(true);
    });

    it('apiCall should create ApiCall effect', () => {
      const effect = apiCall({
        endpoint: '/api/test',
        method: 'POST',
        body: { data: 'test' },
        description: 'Test API',
      });
      expect(effect._tag).toBe('ApiCall');
      expect(effect.endpoint).toBe('/api/test');
      expect(effect.method).toBe('POST');
    });

    it('navigate should create Navigate effect', () => {
      const effect = navigate('/page');
      expect(effect._tag).toBe('Navigate');
      expect(effect.to).toBe('/page');
      expect(effect.description).toBe('Navigate to /page');
    });

    it('navigate with expression should use computed path description', () => {
      const effect = navigate(['get', 'data.path']);
      expect(effect.description).toBe('Navigate to computed path');
    });

    it('delay should create Delay effect', () => {
      const effect = delay(1000, 'Wait 1s');
      expect(effect._tag).toBe('Delay');
      expect(effect.ms).toBe(1000);
      expect(effect.description).toBe('Wait 1s');
    });

    it('sequence should create Sequence effect', () => {
      const effect = sequence([
        setValue('a', 1, 'A'),
        setValue('b', 2, 'B'),
      ]);
      expect(effect._tag).toBe('Sequence');
      expect(effect.effects).toHaveLength(2);
      expect(effect.description).toBe('Sequence of 2 effects');
    });

    it('parallel should create Parallel effect', () => {
      const effect = parallel([
        setValue('a', 1, 'A'),
        setValue('b', 2, 'B'),
      ]);
      expect(effect._tag).toBe('Parallel');
      expect(effect.effects).toHaveLength(2);
      expect(effect.description).toBe('Parallel execution of 2 effects');
    });

    it('conditional should create Conditional effect', () => {
      const effect = conditional({
        condition: true,
        then: setValue('x', 1, 'Set x'),
        description: 'Custom conditional',
      });
      expect(effect._tag).toBe('Conditional');
      expect(effect.description).toBe('Custom conditional');
    });

    it('conditional with default description', () => {
      const effect = conditional({
        condition: true,
        then: setValue('x', 1, 'Set x'),
      });
      expect(effect.description).toBe('Conditional effect');
    });

    it('catchEffect should create Catch effect', () => {
      const effect = catchEffect({
        try: setValue('x', 1, 'Try'),
        catch: setValue('x', 0, 'Catch'),
        finally: setState('done', true, 'Finally'),
        description: 'Try-catch block',
      });
      expect(effect._tag).toBe('Catch');
      expect(effect.finally).toBeDefined();
      expect(effect.description).toBe('Try-catch block');
    });

    it('catchEffect with default description', () => {
      const effect = catchEffect({
        try: setValue('x', 1, 'Try'),
        catch: setValue('x', 0, 'Catch'),
      });
      expect(effect.description).toBe('Try-catch effect');
    });

    it('emitEvent should create EmitEvent effect', () => {
      const effect = emitEvent('ui', { type: 'test', message: 'Hello' });
      expect(effect._tag).toBe('EmitEvent');
      expect(effect.channel).toBe('ui');
      expect(effect.payload.type).toBe('test');
    });
  });

  describe('Complex Effect Compositions', () => {
    it('should handle nested sequences', async () => {
      const innerSequence = sequence([
        setValue('data.a', 1, 'A'),
        setValue('data.b', 2, 'B'),
      ]);
      const outerSequence = sequence([
        innerSequence,
        setValue('data.c', 3, 'C'),
      ]);
      const result = await runEffect(outerSequence, config);

      expect(result.ok).toBe(true);
      expect(handler.setValue).toHaveBeenCalledTimes(3);
    });

    it('should handle parallel inside sequence', async () => {
      const par = parallel([
        setValue('data.a', 1, 'A'),
        setValue('data.b', 2, 'B'),
      ]);
      const seq = sequence([par, setValue('data.c', 3, 'C')]);
      const result = await runEffect(seq, config);

      expect(result.ok).toBe(true);
      expect(handler.setValue).toHaveBeenCalledTimes(3);
    });

    it('should handle conditional inside catch', async () => {
      const effect = catchEffect({
        try: conditional({
          condition: true,
          then: setValue('data.x', ['invalidOp'], 'Fail'),
        }),
        catch: setValue('data.x', 'recovered', 'Recover'),
      });
      const result = await runEffect(effect, config);

      expect(result.ok).toBe(true);
      expect(handler.setValue).toHaveBeenCalledWith('data.x', 'recovered');
    });
  });
});
