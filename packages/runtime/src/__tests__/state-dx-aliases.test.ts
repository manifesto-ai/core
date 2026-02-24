/**
 * DX Aliases - Computed short-key alias tests (App SPEC v2.3.2 COMP-ALIAS-1~3)
 *
 * Verifies that computed fields stored as "computed.<name>" in snapshot.computed
 * are accessible via short alias "<name>" on the AppState.computed object.
 */
import { describe, it, expect } from 'vitest';
import { snapshotToAppState, withDxAliases } from '../state/index.js';
import type { Snapshot } from '@manifesto-ai/core';

function makeSnapshot(computed: Record<string, unknown>): Snapshot {
  return {
    data: {},
    computed,
    system: {
      status: 'idle',
      lastError: null,
      errors: [],
      pendingRequirements: [],
      currentAction: null,
    },
    input: {},
    meta: {
      version: 1,
      timestamp: 0,
      randomSeed: 'seed',
      schemaHash: 'abc',
    },
  };
}

describe('COMP-ALIAS (App SPEC v2.3.2)', () => {
  // COMP-ALIAS-1: short key alias is accessible
  it('COMP-ALIAS-1: exposes short key alias for computed.* fields', () => {
    const snapshot = makeSnapshot({ 'computed.total': 42 });
    const state = snapshotToAppState(snapshot);
    // canonical form still works
    expect(state.computed['computed.total']).toBe(42);
    // short alias also works
    expect((state.computed as Record<string, unknown>)['total']).toBe(42);
  });

  // COMP-ALIAS-2: alias is non-enumerable (doesn't appear in Object.keys)
  it('COMP-ALIAS-2: alias is non-enumerable', () => {
    const snapshot = makeSnapshot({ 'computed.count': 7 });
    const state = snapshotToAppState(snapshot);
    const keys = Object.keys(state.computed);
    expect(keys).toContain('computed.count');
    expect(keys).not.toContain('count');
  });

  // COMP-ALIAS-3: alias reflects canonical value (same reference)
  it('COMP-ALIAS-3: alias getter reflects canonical value', () => {
    const obj = { 'computed.label': 'hello' };
    const aliased = obj as Record<string, unknown>;
    // Manually call addComputedAliases via withDxAliases
    const state = withDxAliases({ data: {}, computed: obj, system: { status: 'idle', lastError: null, errors: [], pendingRequirements: [], currentAction: null }, meta: { version: 0, timestamp: 0, randomSeed: '', schemaHash: '' } });
    expect((state.computed as Record<string, unknown>)['label']).toBe('hello');
  });

  it('does not create alias if short key collides with existing canonical key', () => {
    // Both 'computed.x' and 'x' already exist
    const computed = { 'computed.x': 10, x: 99 };
    const state = snapshotToAppState(makeSnapshot(computed as Record<string, unknown>));
    // 'x' should remain the original value (no override)
    expect((state.computed as Record<string, unknown>)['x']).toBe(99);
  });

  it('does not create alias for non-identifier keys', () => {
    const computed = { 'computed.my-field': 5, 'computed.123bad': 9 };
    const state = snapshotToAppState(makeSnapshot(computed));
    // Hyphens and leading digits are invalid identifiers — no alias
    const desc1 = Object.getOwnPropertyDescriptor(state.computed, 'my-field');
    const desc2 = Object.getOwnPropertyDescriptor(state.computed, '123bad');
    expect(desc1).toBeUndefined();
    expect(desc2).toBeUndefined();
  });

  it('multiple computed fields all get aliases', () => {
    const snapshot = makeSnapshot({
      'computed.total': 100,
      'computed.activeCount': 3,
      'computed.label': 'test',
    });
    const state = snapshotToAppState(snapshot);
    const c = state.computed as Record<string, unknown>;
    expect(c['total']).toBe(100);
    expect(c['activeCount']).toBe(3);
    expect(c['label']).toBe('test');
  });

  it('STATE-ALIAS: state getter aliases data', () => {
    const snapshot = makeSnapshot({});
    const state = snapshotToAppState(snapshot);
    // state should be an alias of data
    expect(state.state).toBe(state.data);
    // state is non-enumerable
    expect(Object.keys(state)).not.toContain('state');
  });
});
