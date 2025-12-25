/**
 * Counter Domain Definition
 *
 * A simple counter demonstrating Manifesto's core concepts:
 * - Source paths (data.count)
 * - Derived paths (computed values)
 * - Actions (increment, decrement, reset)
 */

import {
  defineDomain,
  z,
  type SemanticPath,
  type Expression,
  type Effect,
} from '@manifesto-ai/core';

// ============================================================================
// Type Definitions
// ============================================================================

export interface CounterData {
  count: number;
}

export interface CounterState {
  step: number;
}

// ============================================================================
// Domain Definition
// ============================================================================

export const counterDomain = defineDomain<CounterData, CounterState>({
  id: 'counter',
  name: 'Counter Example',
  description: 'A simple counter domain',

  // Data schema (source values)
  dataSchema: z.object({
    count: z.number(),
  }),

  // State schema (UI state)
  stateSchema: z.object({
    step: z.number(),
  }),

  // Initial state
  initialState: {
    step: 1,
  },

  // Path definitions
  paths: {
    // Source paths - the raw data
    sources: {
      'data.count': {
        schema: z.number(),
        semantic: { type: 'quantity', description: 'Current count value' },
      },
      'state.step': {
        schema: z.number(),
        semantic: { type: 'setting', description: 'Step size for increment/decrement' },
      },
    },

    // Derived paths - computed from sources
    derived: {
      'derived.doubled': {
        deps: ['data.count'] as SemanticPath[],
        expr: ['*', ['get', 'data.count'], 2] as Expression,
        semantic: { type: 'computed', description: 'Count multiplied by 2' },
      },
      'derived.isPositive': {
        deps: ['data.count'] as SemanticPath[],
        expr: ['>', ['get', 'data.count'], 0] as Expression,
        semantic: { type: 'computed', description: 'Whether count is positive' },
      },
      'derived.isNegative': {
        deps: ['data.count'] as SemanticPath[],
        expr: ['<', ['get', 'data.count'], 0] as Expression,
        semantic: { type: 'computed', description: 'Whether count is negative' },
      },
      'derived.isZero': {
        deps: ['data.count'] as SemanticPath[],
        expr: ['==', ['get', 'data.count'], 0] as Expression,
        semantic: { type: 'computed', description: 'Whether count is zero' },
      },
    },

    // No async paths in this simple example
    async: {},
  },

  // Actions
  actions: {
    increment: {
      deps: ['data.count', 'state.step'] as SemanticPath[],
      semantic: {
        type: 'action',
        description: 'Increase the counter by step amount',
        verb: 'increment',
      },
      effect: {
        _tag: 'SetValue',
        path: 'data.count',
        value: ['+', ['get', 'data.count'], ['get', 'state.step']] as Expression,
        description: 'Increment count by step',
      } as Effect,
    },
    decrement: {
      deps: ['data.count', 'state.step'] as SemanticPath[],
      semantic: {
        type: 'action',
        description: 'Decrease the counter by step amount',
        verb: 'decrement',
      },
      effect: {
        _tag: 'SetValue',
        path: 'data.count',
        value: ['-', ['get', 'data.count'], ['get', 'state.step']] as Expression,
        description: 'Decrement count by step',
      } as Effect,
    },
    reset: {
      deps: [] as SemanticPath[],
      semantic: {
        type: 'action',
        description: 'Reset the counter to zero',
        verb: 'reset',
      },
      effect: {
        _tag: 'SetValue',
        path: 'data.count',
        value: 0,
        description: 'Reset count to zero',
      } as Effect,
    },
    setStep: {
      deps: [] as SemanticPath[],
      semantic: {
        type: 'action',
        description: 'Set the step size for increment/decrement',
        verb: 'configure',
      },
      effect: {
        _tag: 'SetState',
        path: 'state.step',
        value: ['get', '$payload'] as Expression,
        description: 'Set step value',
      } as Effect,
    },
  },
});

// ============================================================================
// Initial Data
// ============================================================================

export function getInitialCounterData(): CounterData {
  return {
    count: 0,
  };
}
