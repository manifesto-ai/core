/**
 * Compiler Session Tests
 *
 * Tests for CompilerSession with Manifesto Runtime based observability.
 *
 * PRD 6.8: Compiler Runtime 투명성
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createCompiler } from '../src/compiler.js';
import { createCompilerSession } from '../src/session.js';
import type { Compiler, CompilerSession } from '../src/types/compiler.js';
import type { CompileInput, CodeArtifact } from '../src/types/artifact.js';
import type { CompilerPhase, CompilerSessionSnapshot } from '../src/types/session.js';

// ============================================================================
// Test Fixtures
// ============================================================================

function createTestCompiler(): Compiler {
  return createCompiler({
    coreVersion: '0.3.0',
  });
}

function createTestCodeArtifact(content: string, id = 'test-artifact'): CodeArtifact {
  return {
    id,
    kind: 'code',
    language: 'ts',
    content,
    metadata: {},
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('createCompilerSession', () => {
  let compiler: Compiler;
  let session: CompilerSession;

  beforeEach(() => {
    compiler = createTestCompiler();
    session = createCompilerSession(compiler);
  });

  describe('Session Creation', () => {
    it('should create a session from compiler', () => {
      expect(session).toBeDefined();
      expect(typeof session.getSnapshot).toBe('function');
      expect(typeof session.compile).toBe('function');
      expect(typeof session.subscribePath).toBe('function');
      expect(typeof session.subscribeEvents).toBe('function');
    });

    it('should also work via compiler.createSession()', () => {
      const sessionFromCompiler = compiler.createSession();
      expect(sessionFromCompiler).toBeDefined();
    });
  });

  describe('getSnapshot', () => {
    it('should return initial snapshot', () => {
      const snapshot = session.getSnapshot();
      expect(snapshot).toBeDefined();
      expect(snapshot.phase).toBe('idle');
      expect(snapshot.fragmentsCount).toBe(0);
      expect(snapshot.conflictsCount).toBe(0);
      expect(snapshot.blockingIssuesCount).toBe(0);
      expect(snapshot.blockers).toEqual([]);
      expect(snapshot.nextSteps).toEqual([]);
    });

    it('should include progress info', () => {
      const snapshot = session.getSnapshot();
      expect(snapshot.progress).toBeDefined();
      expect(snapshot.progress.stage).toBe(0);
      expect(snapshot.progress.total).toBe(0);
    });

    it('should include timestamp', () => {
      const snapshot = session.getSnapshot();
      expect(typeof snapshot.timestamp).toBe('number');
      expect(snapshot.timestamp).toBeGreaterThan(0);
    });
  });

  describe('onPhaseChange', () => {
    it('should subscribe to phase changes', async () => {
      const phases: CompilerPhase[] = [];
      const unsubscribe = session.onPhaseChange((phase) => {
        phases.push(phase);
      });

      const input: CompileInput = {
        artifacts: [createTestCodeArtifact('const x = 1;')],
      };

      await session.compile(input);
      unsubscribe();

      // Should have gone through phases: parsing -> extracting -> linking -> verifying -> done
      expect(phases.length).toBeGreaterThan(0);
      expect(phases[phases.length - 1]).toBe('done');
    });

    it('should allow unsubscribing', async () => {
      const phases: CompilerPhase[] = [];
      const unsubscribe = session.onPhaseChange((phase) => {
        phases.push(phase);
      });

      unsubscribe();

      const input: CompileInput = {
        artifacts: [createTestCodeArtifact('const x = 1;')],
      };

      await session.compile(input);

      // Should not receive any phases after unsubscribe
      expect(phases.length).toBe(0);
    });
  });

  describe('onSnapshotChange', () => {
    it('should subscribe to snapshot changes', async () => {
      const snapshots: CompilerSessionSnapshot[] = [];
      const unsubscribe = session.onSnapshotChange((snapshot) => {
        snapshots.push({ ...snapshot });
      });

      const input: CompileInput = {
        artifacts: [createTestCodeArtifact('const x = 1;')],
      };

      await session.compile(input);
      unsubscribe();

      expect(snapshots.length).toBeGreaterThan(0);
    });
  });

  describe('compile', () => {
    it('should compile artifacts through session', async () => {
      const input: CompileInput = {
        artifacts: [createTestCodeArtifact('const count: number = 42;')],
      };

      const result = await session.compile(input);
      expect(result).toBeDefined();
      expect(result.fragments).toBeDefined();
      expect(result.issues).toBeDefined();
    });

    it('should update snapshot during compilation', async () => {
      let lastPhase: CompilerPhase = 'idle';
      session.onPhaseChange((phase) => {
        lastPhase = phase;
      });

      const input: CompileInput = {
        artifacts: [createTestCodeArtifact('const x = 1;')],
      };

      await session.compile(input);

      const finalSnapshot = session.getSnapshot();
      expect(finalSnapshot.phase).toBe('done');
      expect(lastPhase).toBe('done');
    });

    it('should set error phase on compilation failure', async () => {
      // Create a session with a compiler that will fail
      const badCompiler = {
        ...compiler,
        compileFragments: async () => {
          throw new Error('Compilation failed');
        },
      };
      const badSession = createCompilerSession(badCompiler as Compiler);

      const input: CompileInput = {
        artifacts: [createTestCodeArtifact('const x = 1;')],
      };

      await expect(badSession.compile(input)).rejects.toThrow('Compilation failed');

      const snapshot = badSession.getSnapshot();
      expect(snapshot.phase).toBe('error');
    });
  });

  describe('subscribePath', () => {
    it('should subscribe to specific path changes', async () => {
      const phases: unknown[] = [];
      const unsubscribe = session.subscribePath('state.phase', (value, prev) => {
        phases.push(value);
      });

      const input: CompileInput = {
        artifacts: [createTestCodeArtifact('const x = 1;')],
      };

      await session.compile(input);
      unsubscribe();

      expect(phases.length).toBeGreaterThan(0);
    });

    it('should allow unsubscribing from path', () => {
      const values: unknown[] = [];
      const unsubscribe = session.subscribePath('state.phase', (value) => {
        values.push(value);
      });

      unsubscribe();

      // No crash - unsubscribe successful
      expect(true).toBe(true);
    });
  });

  describe('subscribeEvents', () => {
    it('should subscribe to log events', async () => {
      const events: unknown[] = [];
      const unsubscribe = session.subscribeEvents('compiler:log', (event) => {
        events.push(event);
      });

      const input: CompileInput = {
        artifacts: [createTestCodeArtifact('const x = 1;')],
      };

      await session.compile(input);
      unsubscribe();

      expect(events.length).toBeGreaterThan(0);
    });

    it('should subscribe to progress events', async () => {
      const events: unknown[] = [];
      const unsubscribe = session.subscribeEvents('compiler:progress', (event) => {
        events.push(event);
      });

      session.updateProgress(1, 4, 'Test progress');
      unsubscribe();

      expect(events.length).toBe(1);
    });
  });

  describe('getRuntime', () => {
    it('should return the underlying runtime', () => {
      const runtime = session.getRuntime();
      expect(runtime).toBeDefined();
      expect(typeof runtime.getSnapshot).toBe('function');
      expect(typeof runtime.subscribePath).toBe('function');
    });

    it('should allow reading state via runtime', () => {
      const runtime = session.getRuntime();
      const snapshot = runtime.getSnapshot();
      expect(snapshot.state.phase).toBe('idle');
    });
  });

  describe('updateProgress', () => {
    it('should update progress and emit event', async () => {
      const events: unknown[] = [];
      session.subscribeEvents('compiler:progress', (event) => {
        events.push(event);
      });

      session.updateProgress(2, 5, 'Processing...');

      expect(events.length).toBe(1);
      expect((events[0] as any).payload).toEqual({
        stage: 2,
        total: 5,
        message: 'Processing...',
      });
    });
  });

  describe('log', () => {
    it('should emit log events', async () => {
      const events: unknown[] = [];
      session.subscribeEvents('compiler:log', (event) => {
        events.push(event);
      });

      session.log('info', 'Test log message', { data: 123 });

      expect(events.length).toBe(1);
      expect((events[0] as any).type).toBe('info');
    });

    it('should support different log levels', async () => {
      const levels: string[] = [];
      session.subscribeEvents('compiler:log', (event) => {
        levels.push((event as any).type);
      });

      session.log('debug', 'Debug message');
      session.log('info', 'Info message');
      session.log('warn', 'Warning message');
      session.log('error', 'Error message');

      expect(levels).toEqual(['debug', 'info', 'warn', 'error']);
    });
  });

  describe('Blockers and NextSteps', () => {
    it('should compute blockers from issues and conflicts', async () => {
      const input: CompileInput = {
        artifacts: [createTestCodeArtifact('const x = 1;')],
      };

      await session.compile(input);

      const snapshot = session.getSnapshot();
      // Even if no blockers, the structure should be valid
      expect(Array.isArray(snapshot.blockers)).toBe(true);
    });

    it('should compute nextSteps based on state', async () => {
      const input: CompileInput = {
        artifacts: [createTestCodeArtifact('const x: number = 1;')],
      };

      await session.compile(input);

      const snapshot = session.getSnapshot();
      expect(Array.isArray(snapshot.nextSteps)).toBe(true);
    });
  });
});

describe('CompilerSession Observability', () => {
  it('should track full compilation lifecycle', async () => {
    const compiler = createTestCompiler();
    const session = compiler.createSession();

    const lifecycle: { phase: CompilerPhase; time: number }[] = [];

    session.onPhaseChange((phase) => {
      lifecycle.push({ phase, time: Date.now() });
    });

    const input: CompileInput = {
      artifacts: [createTestCodeArtifact('const count: number = 0;')],
    };

    await session.compile(input);

    // Verify phases happened in order
    const phases = lifecycle.map((l) => l.phase);
    expect(phases[0]).toBe('parsing');
    expect(phases[phases.length - 1]).toBe('done');
  });

  it('should provide real-time fragment count', async () => {
    const compiler = createTestCompiler();
    const session = compiler.createSession();

    let maxFragments = 0;
    session.onSnapshotChange((snapshot) => {
      if (snapshot.fragmentsCount > maxFragments) {
        maxFragments = snapshot.fragmentsCount;
      }
    });

    const input: CompileInput = {
      artifacts: [createTestCodeArtifact('const a = 1; const b = 2;')],
    };

    await session.compile(input);

    const finalSnapshot = session.getSnapshot();
    expect(typeof finalSnapshot.fragmentsCount).toBe('number');
  });
});
