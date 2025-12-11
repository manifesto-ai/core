/**
 * @manifesto-ai/agent - Handler Tests
 *
 * Rigorous tests for effect handlers.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createEffectHandlerRegistry,
  createToolRegistry,
  defineTool,
  type HandlerContext,
  type ToolRegistry,
} from '../../src/handlers/registry.js';
import { createToolCallHandler } from '../../src/handlers/tool-call.js';
import { createSnapshotPatchHandler } from '../../src/handlers/patch.js';
import { createLogEmitHandler, createLogCollector } from '../../src/handlers/log.js';
import { createDefaultConstraints } from '../../src/types/constraints.js';
import { generateEffectId } from '../../src/types/effect.js';
import type { ManifestoCoreLike } from '../../src/types/session.js';

describe('Effect Handlers', () => {
  // Mock ManifestoCoreLike
  function createMockCore<S>(initialSnapshot: S): ManifestoCoreLike<S> & {
    errors: unknown[];
    observations: unknown[];
  } {
    let snapshot = JSON.parse(JSON.stringify(initialSnapshot));
    const errors: unknown[] = [];
    const observations: unknown[] = [];

    return {
      errors,
      observations,
      getSnapshot: () => snapshot,
      applyPatch: (ops) => {
        try {
          for (const op of ops) {
            const path = op.path.split('.');
            let current: any = snapshot;
            for (let i = 0; i < path.length - 1; i++) {
              if (!current[path[i]!]) current[path[i]!] = {};
              current = current[path[i]!];
            }
            const lastKey = path[path.length - 1]!;
            if (op.op === 'set') {
              current[lastKey] = op.value;
            } else if (op.op === 'append' && Array.isArray(current[lastKey])) {
              current[lastKey].push(op.value);
            }
          }
          return { ok: true, snapshot };
        } catch (err) {
          return {
            ok: false,
            error: {
              kind: 'patch_validation_error',
              at: '',
              issue: 'Invalid operation',
              effectId: '',
              ts: Date.now(),
            },
          };
        }
      },
      appendError: (error) => errors.push(error),
      getRecentErrors: (limit = 5) => errors.slice(-limit) as any,
      clearErrors: () => (errors.length = 0),
      appendObservation: (obs) => observations.push(obs),
    };
  }

  describe('EffectHandlerRegistry', () => {
    it('should register and retrieve handlers', () => {
      const registry = createEffectHandlerRegistry();
      const handler = {
        type: 'test.type' as any,
        handle: vi.fn(),
      };

      registry.register(handler);

      expect(registry.get('test.type')).toBe(handler);
    });

    it('should return undefined for unregistered type', () => {
      const registry = createEffectHandlerRegistry();
      expect(registry.get('unknown.type')).toBeUndefined();
    });

    it('should throw when handling unregistered effect type', async () => {
      const registry = createEffectHandlerRegistry();
      const effect = { type: 'unknown', id: 'test' };

      await expect(
        registry.handle(effect as any, {} as any)
      ).rejects.toThrow('No handler registered');
    });

    it('should call handler with correct arguments', async () => {
      const registry = createEffectHandlerRegistry();
      const handler = {
        type: 'log.emit' as const,
        handle: vi.fn().mockResolvedValue(undefined),
      };

      registry.register(handler);

      const effect = {
        type: 'log.emit',
        id: 'test',
        level: 'info',
        message: 'Test',
      };
      const ctx = { core: {}, constraints: {}, tools: {} } as any;

      await registry.handle(effect as any, ctx);

      expect(handler.handle).toHaveBeenCalledWith(effect, ctx);
    });
  });

  describe('ToolRegistry', () => {
    it('should register tools from array', () => {
      const tool1 = defineTool('tool1', 'First tool', async () => 'result1');
      const tool2 = defineTool('tool2', 'Second tool', async () => 'result2');

      const registry = createToolRegistry([tool1, tool2]);

      expect(registry.get('tool1')).toBe(tool1);
      expect(registry.get('tool2')).toBe(tool2);
    });

    it('should return undefined for unknown tool', () => {
      const registry = createToolRegistry([]);
      expect(registry.get('unknown')).toBeUndefined();
    });

    it('should list all tools', () => {
      const tool1 = defineTool('tool1', 'First', async () => {});
      const tool2 = defineTool('tool2', 'Second', async () => {});

      const registry = createToolRegistry([tool1, tool2]);
      const list = registry.list();

      expect(list).toHaveLength(2);
      expect(list).toContain(tool1);
      expect(list).toContain(tool2);
    });

    it('should check if tool exists', () => {
      const tool = defineTool('exists', 'Exists', async () => {});
      const registry = createToolRegistry([tool]);

      expect(registry.has('exists')).toBe(true);
      expect(registry.has('not-exists')).toBe(false);
    });
  });

  describe('createToolCallHandler', () => {
    let core: ReturnType<typeof createMockCore>;
    let tools: ToolRegistry;
    let ctx: HandlerContext;

    beforeEach(() => {
      core = createMockCore({ data: {}, state: {}, derived: {} });
      tools = createToolRegistry([
        defineTool('echo', 'Echo input', async (input: any) => ({ echo: input })),
        defineTool('fail', 'Always fails', async () => {
          throw new Error('Intentional failure');
        }),
      ]);
      ctx = {
        core,
        constraints: createDefaultConstraints(),
        tools,
      };
    });

    it('should execute tool and push observation', async () => {
      const handler = createToolCallHandler();

      await handler.handle(
        {
          type: 'tool.call',
          id: 'eff_1',
          tool: 'echo',
          input: { message: 'hello' },
        },
        ctx
      );

      expect(core.observations).toHaveLength(1);
      expect((core.observations[0] as any).source).toBe('tool:echo');
      expect((core.observations[0] as any).content).toEqual({ echo: { message: 'hello' } });
      expect((core.observations[0] as any).triggeredBy).toBe('eff_1');
    });

    it('should throw on unknown tool', async () => {
      const handler = createToolCallHandler();

      await expect(
        handler.handle(
          {
            type: 'tool.call',
            id: 'eff_1',
            tool: 'unknown',
            input: {},
          },
          ctx
        )
      ).rejects.toThrow('Unknown tool: unknown');
    });

    it('should propagate tool errors', async () => {
      const handler = createToolCallHandler();

      await expect(
        handler.handle(
          {
            type: 'tool.call',
            id: 'eff_1',
            tool: 'fail',
            input: {},
          },
          ctx
        )
      ).rejects.toThrow('Intentional failure');
    });
  });

  describe('createSnapshotPatchHandler', () => {
    let core: ReturnType<typeof createMockCore>;
    let ctx: HandlerContext;

    beforeEach(() => {
      core = createMockCore({ data: { items: [] }, state: {}, derived: {} });
      ctx = {
        core,
        constraints: createDefaultConstraints(),
        tools: createToolRegistry([]),
      };
    });

    it('should apply valid patch', async () => {
      const handler = createSnapshotPatchHandler();

      await handler.handle(
        {
          type: 'snapshot.patch',
          id: 'eff_1',
          ops: [{ op: 'set', path: 'data.name', value: 'test' }],
        },
        ctx
      );

      expect((core.getSnapshot() as any).data.name).toBe('test');
    });

    it('should reject derived path writes', async () => {
      const handler = createSnapshotPatchHandler();

      await expect(
        handler.handle(
          {
            type: 'snapshot.patch',
            id: 'eff_1',
            ops: [{ op: 'set', path: 'derived.computed', value: 123 }],
          },
          ctx
        )
      ).rejects.toThrow();

      expect(core.errors.length).toBeGreaterThan(0);
    });

    it('should apply multiple ops in order', async () => {
      const handler = createSnapshotPatchHandler();

      await handler.handle(
        {
          type: 'snapshot.patch',
          id: 'eff_1',
          ops: [
            { op: 'set', path: 'data.a', value: 1 },
            { op: 'set', path: 'data.b', value: 2 },
          ],
        },
        ctx
      );

      const snapshot = core.getSnapshot() as any;
      expect(snapshot.data.a).toBe(1);
      expect(snapshot.data.b).toBe(2);
    });
  });

  describe('createLogEmitHandler', () => {
    it('should collect logs', async () => {
      const collector = createLogCollector();
      const handler = createLogEmitHandler(collector);
      const ctx = {} as any;

      await handler.handle(
        {
          type: 'log.emit',
          id: 'eff_1',
          level: 'info',
          message: 'Test message',
          data: { extra: 'data' },
        },
        ctx
      );

      const logs = collector.getAll();
      expect(logs).toHaveLength(1);
      expect(logs[0]!.level).toBe('info');
      expect(logs[0]!.message).toBe('Test message');
      expect(logs[0]!.data).toEqual({ extra: 'data' });
    });

    it('should filter logs by level', async () => {
      const collector = createLogCollector();
      const handler = createLogEmitHandler(collector);
      const ctx = {} as any;

      await handler.handle(
        { type: 'log.emit', id: '1', level: 'debug', message: 'Debug' },
        ctx
      );
      await handler.handle(
        { type: 'log.emit', id: '2', level: 'info', message: 'Info' },
        ctx
      );
      await handler.handle(
        { type: 'log.emit', id: '3', level: 'error', message: 'Error' },
        ctx
      );

      expect(collector.getByLevel('debug')).toHaveLength(1);
      expect(collector.getByLevel('info')).toHaveLength(1);
      expect(collector.getByLevel('error')).toHaveLength(1);
      expect(collector.getByLevel('warn')).toHaveLength(0);
    });

    it('should clear logs', async () => {
      const collector = createLogCollector();
      const handler = createLogEmitHandler(collector);
      const ctx = {} as any;

      await handler.handle(
        { type: 'log.emit', id: '1', level: 'info', message: 'Test' },
        ctx
      );

      expect(collector.getAll()).toHaveLength(1);

      collector.clear();

      expect(collector.getAll()).toHaveLength(0);
    });

    it('should respect maxEntries limit', async () => {
      const collector = createLogCollector(3);
      const handler = createLogEmitHandler(collector);
      const ctx = {} as any;

      for (let i = 0; i < 5; i++) {
        await handler.handle(
          { type: 'log.emit', id: `${i}`, level: 'info', message: `Message ${i}` },
          ctx
        );
      }

      const logs = collector.getAll();
      expect(logs).toHaveLength(3);
      expect(logs[0]!.message).toBe('Message 2');
      expect(logs[2]!.message).toBe('Message 4');
    });
  });
});
