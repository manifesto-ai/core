/**
 * Compiler Domain Tests
 *
 * Tests for the compiler Manifesto domain definition.
 *
 * PRD 6.8: Compiler Runtime 투명성
 */

import { describe, it, expect } from 'vitest';
import { createRuntime, validateDomain } from '@manifesto-ai/core';
import {
  compilerDomain,
  getInitialCompilerData,
  getInitialCompilerState,
  type CompilerData,
  type CompilerState,
} from '../../src/runtime/domain.js';

// ============================================================================
// Tests
// ============================================================================

describe('compilerDomain', () => {
  describe('Domain Definition', () => {
    it('should have correct id and name', () => {
      expect(compilerDomain.id).toBe('manifesto-compiler');
      expect(compilerDomain.name).toBe('Manifesto Compiler');
    });

    it('should have data schema defined', () => {
      expect(compilerDomain.dataSchema).toBeDefined();
    });

    it('should have state schema defined', () => {
      expect(compilerDomain.stateSchema).toBeDefined();
    });

    it('should have initial state', () => {
      expect(compilerDomain.initialState).toBeDefined();
      expect(compilerDomain.initialState.phase).toBe('idle');
    });

    it('should have paths defined', () => {
      expect(compilerDomain.paths).toBeDefined();
      expect(compilerDomain.paths.sources).toBeDefined();
      expect(compilerDomain.paths.derived).toBeDefined();
    });

    it('should pass Core validateDomain', () => {
      const result = validateDomain(compilerDomain, {
        checkCycles: true,
        checkMissingDeps: true,
      });

      // Debug: Log any issues
      if (!result.valid) {
        console.log('Core validation issues:', result.issues);
      }

      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });
  });

  describe('Runtime Path Access', () => {
    it('should allow reading data.artifacts via runtime', () => {
      const runtime = createRuntime<CompilerData, CompilerState>({
        domain: compilerDomain,
        initialData: getInitialCompilerData(),
      });
      const artifacts = runtime.get('data.artifacts' as any);
      expect(artifacts).toEqual([]);
    });

    it('should allow reading data.fragments via runtime', () => {
      const runtime = createRuntime<CompilerData, CompilerState>({
        domain: compilerDomain,
        initialData: getInitialCompilerData(),
      });
      const fragments = runtime.get('data.fragments' as any);
      expect(fragments).toEqual([]);
    });

    it('should allow reading data.patches via runtime', () => {
      const runtime = createRuntime<CompilerData, CompilerState>({
        domain: compilerDomain,
        initialData: getInitialCompilerData(),
      });
      const patches = runtime.get('data.patches' as any);
      expect(patches).toEqual([]);
    });

    it('should allow reading data.issues via runtime', () => {
      const runtime = createRuntime<CompilerData, CompilerState>({
        domain: compilerDomain,
        initialData: getInitialCompilerData(),
      });
      const issues = runtime.get('data.issues' as any);
      expect(issues).toEqual([]);
    });

    it('should allow reading data.conflicts via runtime', () => {
      const runtime = createRuntime<CompilerData, CompilerState>({
        domain: compilerDomain,
        initialData: getInitialCompilerData(),
      });
      const conflicts = runtime.get('data.conflicts' as any);
      expect(conflicts).toEqual([]);
    });

    it('should allow reading data.domain via runtime', () => {
      const runtime = createRuntime<CompilerData, CompilerState>({
        domain: compilerDomain,
        initialData: getInitialCompilerData(),
      });
      const domain = runtime.get('data.domain' as any);
      expect(domain).toBeNull();
    });
  });
});

describe('getInitialCompilerData', () => {
  it('should return valid initial data', () => {
    const data = getInitialCompilerData();

    expect(data.artifacts).toEqual([]);
    expect(data.fragments).toEqual([]);
    expect(data.patches).toEqual([]);
    expect(data.issues).toEqual([]);
    expect(data.conflicts).toEqual([]);
    expect(data.domain).toBeNull();
  });
});

describe('getInitialCompilerState', () => {
  it('should return valid initial state', () => {
    const state = getInitialCompilerState();

    expect(state.phase).toBe('idle');
    expect(state.progress.stage).toBe(0);
    expect(state.progress.total).toBe(0);
    expect(state.progress.message).toBe('');
    expect(state.error).toBeNull();
  });
});

describe('Compiler Domain Runtime Integration', () => {
  it('should create runtime with compiler domain', () => {
    const runtime = createRuntime<CompilerData, CompilerState>({
      domain: compilerDomain,
      initialData: getInitialCompilerData(),
    });

    expect(runtime).toBeDefined();
    expect(typeof runtime.getSnapshot).toBe('function');
    expect(typeof runtime.set).toBe('function');
    expect(typeof runtime.subscribePath).toBe('function');
  });

  it('should read initial snapshot', () => {
    const runtime = createRuntime<CompilerData, CompilerState>({
      domain: compilerDomain,
      initialData: getInitialCompilerData(),
    });

    const snapshot = runtime.getSnapshot();
    expect(snapshot.data.artifacts).toEqual([]);
    expect(snapshot.state.phase).toBe('idle');
  });

  it('should update state.phase', () => {
    const runtime = createRuntime<CompilerData, CompilerState>({
      domain: compilerDomain,
      initialData: getInitialCompilerData(),
    });

    runtime.set('state.phase' as any, 'parsing');

    const snapshot = runtime.getSnapshot();
    expect(snapshot.state.phase).toBe('parsing');
  });

  it('should update data.fragments', () => {
    const runtime = createRuntime<CompilerData, CompilerState>({
      domain: compilerDomain,
      initialData: getInitialCompilerData(),
    });

    const testFragments = [
      { id: 'frag-1', kind: 'test', requires: [], provides: [] },
    ];

    runtime.set('data.fragments' as any, testFragments);

    const snapshot = runtime.getSnapshot();
    expect(snapshot.data.fragments).toEqual(testFragments);
  });

  it('should subscribe to path changes', () => {
    const runtime = createRuntime<CompilerData, CompilerState>({
      domain: compilerDomain,
      initialData: getInitialCompilerData(),
    });

    const phases: string[] = [];
    const unsubscribe = runtime.subscribePath('state.phase', (value) => {
      phases.push(value as string);
    });

    runtime.set('state.phase' as any, 'parsing');
    runtime.set('state.phase' as any, 'linking');
    runtime.set('state.phase' as any, 'done');

    unsubscribe();

    expect(phases).toEqual(['parsing', 'linking', 'done']);
  });

  it('should update progress info', () => {
    const runtime = createRuntime<CompilerData, CompilerState>({
      domain: compilerDomain,
      initialData: getInitialCompilerData(),
    });

    runtime.set('state.progress' as any, {
      stage: 2,
      total: 5,
      message: 'Linking fragments...',
    });

    const snapshot = runtime.getSnapshot();
    expect(snapshot.state.progress.stage).toBe(2);
    expect(snapshot.state.progress.total).toBe(5);
    expect(snapshot.state.progress.message).toBe('Linking fragments...');
  });

  it('should handle error state', () => {
    const runtime = createRuntime<CompilerData, CompilerState>({
      domain: compilerDomain,
      initialData: getInitialCompilerData(),
    });

    runtime.set('state.phase' as any, 'error');
    runtime.set('state.error' as any, 'Compilation failed: syntax error');

    const snapshot = runtime.getSnapshot();
    expect(snapshot.state.phase).toBe('error');
    expect(snapshot.state.error).toBe('Compilation failed: syntax error');
  });

  describe('Derived Values', () => {
    it('should compute isComplete as true when phase is done', () => {
      const runtime = createRuntime<CompilerData, CompilerState>({
        domain: compilerDomain,
        initialData: getInitialCompilerData(),
      });

      runtime.set('state.phase' as any, 'done');

      const isComplete = runtime.get('derived.isComplete' as any);
      expect(isComplete).toBe(true);
    });

    it('should compute isComplete as false when phase is not done', () => {
      const runtime = createRuntime<CompilerData, CompilerState>({
        domain: compilerDomain,
        initialData: getInitialCompilerData(),
      });

      runtime.set('state.phase' as any, 'linking');

      const isComplete = runtime.get('derived.isComplete' as any);
      expect(isComplete).toBe(false);
    });

    it('should compute hasError as true when phase is error', () => {
      const runtime = createRuntime<CompilerData, CompilerState>({
        domain: compilerDomain,
        initialData: getInitialCompilerData(),
      });

      runtime.set('state.phase' as any, 'error');

      const hasError = runtime.get('derived.hasError' as any);
      expect(hasError).toBe(true);
    });

    it('should compute fragmentCount from fragments array', () => {
      const runtime = createRuntime<CompilerData, CompilerState>({
        domain: compilerDomain,
        initialData: getInitialCompilerData(),
      });

      runtime.set('data.fragments' as any, [
        { id: '1', kind: 'test', requires: [], provides: [] },
        { id: '2', kind: 'test', requires: [], provides: [] },
        { id: '3', kind: 'test', requires: [], provides: [] },
      ]);

      const count = runtime.get('derived.fragmentCount' as any);
      expect(count).toBe(3);
    });

    it('should compute issueCount from issues array', () => {
      const runtime = createRuntime<CompilerData, CompilerState>({
        domain: compilerDomain,
        initialData: getInitialCompilerData(),
      });

      runtime.set('data.issues' as any, [
        { id: 'i1', code: 'ERR', severity: 'error', message: 'Error 1' },
        { id: 'i2', code: 'WARN', severity: 'warning', message: 'Warning 1' },
      ]);

      const count = runtime.get('derived.issueCount' as any);
      expect(count).toBe(2);
    });

    it('should compute conflictCount from conflicts array', () => {
      const runtime = createRuntime<CompilerData, CompilerState>({
        domain: compilerDomain,
        initialData: getInitialCompilerData(),
      });

      runtime.set('data.conflicts' as any, [
        { id: 'c1', type: 'duplicate', target: 'path.x', candidates: ['a', 'b'], message: 'Conflict' },
      ]);

      const count = runtime.get('derived.conflictCount' as any);
      expect(count).toBe(1);
    });
  });
});

describe('Compiler Domain State Transitions', () => {
  it('should support full compilation lifecycle', () => {
    const runtime = createRuntime<CompilerData, CompilerState>({
      domain: compilerDomain,
      initialData: getInitialCompilerData(),
    });

    const transitions: string[] = [];
    runtime.subscribePath('state.phase', (phase) => {
      transitions.push(phase as string);
    });

    // Simulate compilation lifecycle
    runtime.set('state.phase' as any, 'parsing');
    runtime.set('state.phase' as any, 'extracting');
    runtime.set('state.phase' as any, 'linking');
    runtime.set('state.phase' as any, 'verifying');
    runtime.set('state.phase' as any, 'done');

    expect(transitions).toEqual([
      'parsing',
      'extracting',
      'linking',
      'verifying',
      'done',
    ]);
  });

  it('should support error recovery', () => {
    const runtime = createRuntime<CompilerData, CompilerState>({
      domain: compilerDomain,
      initialData: getInitialCompilerData(),
    });

    // Go to error state
    runtime.set('state.phase' as any, 'error');
    runtime.set('state.error' as any, 'Failed');

    // Reset to idle
    runtime.set('state.phase' as any, 'idle');
    runtime.set('state.error' as any, null);

    const snapshot = runtime.getSnapshot();
    expect(snapshot.state.phase).toBe('idle');
    expect(snapshot.state.error).toBeNull();
  });
});
