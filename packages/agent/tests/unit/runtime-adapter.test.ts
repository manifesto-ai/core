/**
 * @manifesto-ai/agent - Runtime Adapter Tests
 *
 * Tests for createAgentRuntime adapter that wraps DomainRuntime.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createAgentRuntime,
  type DomainRuntimeLike,
} from '../../src/session/adapter.js';
import type { AgentRuntime } from '../../src/types/session.js';
import { generateObservationId } from '../../src/types/observation.js';

describe('createAgentRuntime', () => {
  // Mock DomainRuntime implementation
  function createMockDomainRuntime<TData, TState>(
    initialData: TData,
    initialState: TState
  ): DomainRuntimeLike<TData, TState> & { _snapshot: any } {
    const snapshot = {
      data: JSON.parse(JSON.stringify(initialData)),
      state: JSON.parse(JSON.stringify(initialState)),
      derived: {},
    };

    return {
      _snapshot: snapshot,
      getSnapshot: () => ({
        data: snapshot.data,
        state: snapshot.state,
        derived: { ...snapshot.derived },
      }),
      set: (path: string, value: unknown) => {
        const parts = path.split('.');
        let current: any = snapshot;

        for (let i = 0; i < parts.length - 1; i++) {
          if (!current[parts[i]!]) current[parts[i]!] = {};
          current = current[parts[i]!];
        }

        current[parts[parts.length - 1]!] = value;
        return { ok: true };
      },
    };
  }

  describe('getSnapshot', () => {
    it('should return snapshot with observations', () => {
      const domainRuntime = createMockDomainRuntime(
        { name: 'test' },
        { phase: 'init' }
      );
      const runtime = createAgentRuntime({ domainRuntime });

      const snapshot = runtime.getSnapshot();

      expect(snapshot.data).toEqual({ name: 'test' });
      expect(snapshot.state).toEqual({ phase: 'init' });
      expect(snapshot.derived.observations).toEqual([]);
    });

    it('should include appended observations in snapshot', () => {
      const domainRuntime = createMockDomainRuntime({}, {});
      const runtime = createAgentRuntime({ domainRuntime });

      runtime.appendObservation({
        id: 'obs_1',
        source: 'tool:test',
        content: { result: 'data' },
        ts: Date.now(),
      });

      const snapshot = runtime.getSnapshot();
      expect(snapshot.derived.observations).toHaveLength(1);
      expect((snapshot.derived.observations as any)[0].source).toBe('tool:test');
    });
  });

  describe('applyPatch', () => {
    it('should apply set operation', () => {
      const domainRuntime = createMockDomainRuntime(
        { count: 0 },
        {}
      );
      const runtime = createAgentRuntime({ domainRuntime });

      const result = runtime.applyPatch([
        { op: 'set', path: 'data.count', value: 42 },
      ]);

      expect(result.ok).toBe(true);
      expect(domainRuntime._snapshot.data.count).toBe(42);
    });

    it('should apply multiple set operations', () => {
      const domainRuntime = createMockDomainRuntime(
        { a: 0, b: 0 },
        {}
      );
      const runtime = createAgentRuntime({ domainRuntime });

      const result = runtime.applyPatch([
        { op: 'set', path: 'data.a', value: 1 },
        { op: 'set', path: 'data.b', value: 2 },
      ]);

      expect(result.ok).toBe(true);
      expect(domainRuntime._snapshot.data.a).toBe(1);
      expect(domainRuntime._snapshot.data.b).toBe(2);
    });

    it('should apply append operation', () => {
      const domainRuntime = createMockDomainRuntime(
        { items: ['a', 'b'] },
        {}
      );
      const runtime = createAgentRuntime({ domainRuntime });

      const result = runtime.applyPatch([
        { op: 'append', path: 'data.items', value: 'c' },
      ]);

      expect(result.ok).toBe(true);
      expect(domainRuntime._snapshot.data.items).toEqual(['a', 'b', 'c']);
    });

    it('should fail append on non-array', () => {
      const domainRuntime = createMockDomainRuntime(
        { value: 'not-array' },
        {}
      );
      const runtime = createAgentRuntime({ domainRuntime });

      const result = runtime.applyPatch([
        { op: 'append', path: 'data.value', value: 'x' },
      ]);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.issue).toBe('Type mismatch');
        expect(result.error.advice).toContain('array');
      }
    });
  });

  describe('error management', () => {
    it('should append and retrieve errors', () => {
      const domainRuntime = createMockDomainRuntime({}, {});
      const runtime = createAgentRuntime({ domainRuntime });

      runtime.appendError({
        kind: 'patch_validation_error',
        at: 'data.x',
        issue: 'Test error',
        effectId: 'eff_1',
        ts: Date.now(),
      });

      const errors = runtime.getRecentErrors();
      expect(errors).toHaveLength(1);
      expect(errors[0]!.issue).toBe('Test error');
    });

    it('should respect maxErrors limit', () => {
      const domainRuntime = createMockDomainRuntime({}, {});
      const runtime = createAgentRuntime({
        domainRuntime,
        maxErrors: 3,
      });

      for (let i = 0; i < 5; i++) {
        runtime.appendError({
          kind: 'patch_validation_error',
          at: `data.x${i}`,
          issue: `Error ${i}`,
          effectId: `eff_${i}`,
          ts: Date.now(),
        });
      }

      const errors = runtime.getRecentErrors(10);
      expect(errors).toHaveLength(3);
      expect(errors[0]!.issue).toBe('Error 2');
      expect(errors[2]!.issue).toBe('Error 4');
    });

    it('should clear errors', () => {
      const domainRuntime = createMockDomainRuntime({}, {});
      const runtime = createAgentRuntime({ domainRuntime });

      runtime.appendError({
        kind: 'patch_validation_error',
        at: 'data.x',
        issue: 'Test',
        effectId: 'eff_1',
        ts: Date.now(),
      });

      expect(runtime.getRecentErrors()).toHaveLength(1);

      runtime.clearErrors();

      expect(runtime.getRecentErrors()).toHaveLength(0);
    });

    it('should limit retrieved errors by limit parameter', () => {
      const domainRuntime = createMockDomainRuntime({}, {});
      const runtime = createAgentRuntime({ domainRuntime });

      for (let i = 0; i < 10; i++) {
        runtime.appendError({
          kind: 'patch_validation_error',
          at: `data.x${i}`,
          issue: `Error ${i}`,
          effectId: `eff_${i}`,
          ts: Date.now(),
        });
      }

      const errors = runtime.getRecentErrors(3);
      expect(errors).toHaveLength(3);
      expect(errors[0]!.issue).toBe('Error 7');
    });
  });

  describe('observation management', () => {
    it('should append observations', () => {
      const domainRuntime = createMockDomainRuntime({}, {});
      const runtime = createAgentRuntime({ domainRuntime });

      runtime.appendObservation({
        id: 'obs_1',
        source: 'tool:search',
        content: { results: [] },
        ts: Date.now(),
      });

      const snapshot = runtime.getSnapshot();
      expect(snapshot.derived.observations).toHaveLength(1);
    });

    it('should respect maxObservations limit', () => {
      const domainRuntime = createMockDomainRuntime({}, {});
      const runtime = createAgentRuntime({
        domainRuntime,
        maxObservations: 3,
      });

      for (let i = 0; i < 5; i++) {
        runtime.appendObservation({
          id: `obs_${i}`,
          source: `tool:test${i}`,
          content: { index: i },
          ts: Date.now(),
        });
      }

      const snapshot = runtime.getSnapshot();
      const observations = snapshot.derived.observations as any[];
      expect(observations).toHaveLength(3);
      expect(observations[0].content.index).toBe(2);
    });

    it('should include triggeredBy in observations', () => {
      const domainRuntime = createMockDomainRuntime({}, {});
      const runtime = createAgentRuntime({ domainRuntime });

      runtime.appendObservation({
        id: 'obs_1',
        source: 'tool:calc',
        content: { sum: 42 },
        triggeredBy: 'eff_trigger',
        ts: Date.now(),
      });

      const snapshot = runtime.getSnapshot();
      const obs = (snapshot.derived.observations as any[])[0];
      expect(obs.triggeredBy).toBe('eff_trigger');
    });
  });

  describe('integration scenarios', () => {
    it('should support typical agent session workflow', () => {
      const domainRuntime = createMockDomainRuntime(
        { tasks: [], status: 'idle' },
        { phase: 'planning' }
      );
      const runtime = createAgentRuntime({ domainRuntime });

      // Step 1: Agent updates state
      const patchResult = runtime.applyPatch([
        { op: 'set', path: 'data.status', value: 'processing' },
        { op: 'append', path: 'data.tasks', value: 'task1' },
      ]);
      expect(patchResult.ok).toBe(true);

      // Step 2: Tool observation added
      runtime.appendObservation({
        id: 'obs_1',
        source: 'tool:analyze',
        content: { analysis: 'complete' },
        ts: Date.now(),
      });

      // Step 3: Check final state
      const snapshot = runtime.getSnapshot();
      expect(snapshot.data.status).toBe('processing');
      expect(snapshot.data.tasks).toContain('task1');
      expect(snapshot.derived.observations).toHaveLength(1);
    });

    it('should handle errors without crashing', () => {
      const domainRuntime = createMockDomainRuntime({}, {});
      const runtime = createAgentRuntime({ domainRuntime });

      // Multiple error types
      runtime.appendError({
        kind: 'patch_validation_error',
        at: 'derived.x',
        issue: 'Forbidden path',
        effectId: 'eff_1',
        ts: Date.now(),
      });

      runtime.appendError({
        kind: 'effect_validation_error',
        effectId: 'eff_2',
        issue: 'Invalid effect structure',
        ts: Date.now(),
      } as any);

      const errors = runtime.getRecentErrors(10);
      expect(errors).toHaveLength(2);

      // Clear and continue
      runtime.clearErrors();
      expect(runtime.getRecentErrors()).toHaveLength(0);

      // Can still operate
      const snapshot = runtime.getSnapshot();
      expect(snapshot).toBeDefined();
    });
  });
});
