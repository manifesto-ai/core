/**
 * @manifesto-ai/agent - Prompt Builder Tests
 *
 * Rigorous tests for prompt generation.
 */

import { describe, it, expect } from 'vitest';
import {
  SYSTEM_PROMPT,
  buildSystemPrompt,
  getFullSystemPrompt,
  buildStepPrompt,
  summarizeSnapshot,
  createSnapshotFilter,
  buildLLMMessages,
} from '../../src/prompt/index.js';
import { createDefaultConstraints, addInvariant, addTypeRule } from '../../src/types/constraints.js';
import { createPatchError } from '../../src/types/errors.js';

describe('Prompt Builders', () => {
  describe('SYSTEM_PROMPT', () => {
    it('should contain Iron Laws', () => {
      expect(SYSTEM_PROMPT).toContain('IRON LAWS');
      expect(SYSTEM_PROMPT).toContain('PURE FUNCTION');
      expect(SYSTEM_PROMPT).toContain('f(snapshot)');
      expect(SYSTEM_PROMPT).toContain('effects[]');
    });

    it('should define output schema', () => {
      expect(SYSTEM_PROMPT).toContain('OUTPUT SCHEMA');
      expect(SYSTEM_PROMPT).toContain('snapshot.patch');
      expect(SYSTEM_PROMPT).toContain('tool.call');
      expect(SYSTEM_PROMPT).toContain('log.emit');
    });

    it('should explain effect types', () => {
      expect(SYSTEM_PROMPT).toContain('EFFECT TYPES');
      expect(SYSTEM_PROMPT).toContain('derived.*');
      expect(SYSTEM_PROMPT).toContain('Runtime');
    });

    it('should warn about failure mode', () => {
      expect(SYSTEM_PROMPT).toContain('FAILURE MODE');
      expect(SYSTEM_PROMPT).toContain('rejected');
      expect(SYSTEM_PROMPT).toContain('errors');
    });
  });

  describe('buildSystemPrompt', () => {
    it('should return base prompt without options', () => {
      const prompt = buildSystemPrompt();
      expect(prompt).toBe(SYSTEM_PROMPT);
    });

    it('should include tool list when provided', () => {
      const prompt = buildSystemPrompt({
        includeToolList: true,
        tools: [
          { name: 'search', description: 'Search the web' },
          { name: 'calculate', description: 'Perform calculations' },
        ],
      });

      expect(prompt).toContain('AVAILABLE TOOLS');
      expect(prompt).toContain('search');
      expect(prompt).toContain('Search the web');
      expect(prompt).toContain('calculate');
    });

    it('should not include tools section if empty', () => {
      const prompt = buildSystemPrompt({
        includeToolList: true,
        tools: [],
      });

      expect(prompt).not.toContain('AVAILABLE TOOLS');
    });

    it('should include additional context', () => {
      const prompt = buildSystemPrompt({
        additionalContext: 'You are working on a todo app.',
      });

      expect(prompt).toContain('ADDITIONAL CONTEXT');
      expect(prompt).toContain('todo app');
    });
  });

  describe('getFullSystemPrompt', () => {
    it('should include effect ID guidance', () => {
      const prompt = getFullSystemPrompt();
      expect(prompt).toContain('EFFECT ID FORMAT');
      expect(prompt).toContain('eff_');
    });
  });

  describe('buildStepPrompt', () => {
    const basicSnapshot = {
      data: { items: ['a', 'b', 'c'], count: 3 },
      state: { phase: 'processing' },
      derived: { total: 3 },
    };

    const basicConstraints = createDefaultConstraints('processing');

    it('should include snapshot JSON', () => {
      const prompt = buildStepPrompt({
        snapshot: basicSnapshot,
        constraints: basicConstraints,
      });

      expect(prompt).toContain('CURRENT SNAPSHOT');
      expect(prompt).toContain('"items"');
      expect(prompt).toContain('"count"');
    });

    it('should include phase rules', () => {
      const prompt = buildStepPrompt({
        snapshot: basicSnapshot,
        constraints: basicConstraints,
      });

      expect(prompt).toContain('PHASE RULES');
      expect(prompt).toContain('processing');
      expect(prompt).toContain('data.');
      expect(prompt).toContain('state.');
    });

    it('should include type rules when present', () => {
      let constraints = createDefaultConstraints('test');
      constraints = addTypeRule(constraints, 'data.count', 'number');
      constraints = addTypeRule(constraints, 'data.name', 'string');

      const prompt = buildStepPrompt({
        snapshot: basicSnapshot,
        constraints,
      });

      expect(prompt).toContain('Type rules');
      expect(prompt).toContain('data.count');
      expect(prompt).toContain('number');
    });

    it('should include invariants when present', () => {
      let constraints = createDefaultConstraints('test');
      constraints = addInvariant(constraints, 'count_positive', 'Count must be positive');

      const prompt = buildStepPrompt({
        snapshot: basicSnapshot,
        constraints,
      });

      expect(prompt).toContain('Invariants');
      expect(prompt).toContain('count_positive');
      expect(prompt).toContain('Count must be positive');
    });

    it('should include recent errors when provided', () => {
      const errors = [
        createPatchError('eff_1', 'data.x', 'Type mismatch', {
          expected: 'string',
          got: 'number',
        }),
      ];

      const prompt = buildStepPrompt({
        snapshot: basicSnapshot,
        constraints: basicConstraints,
        recentErrors: errors,
      });

      expect(prompt).toContain('RECENT ERRORS');
      expect(prompt).toContain('Type mismatch');
      expect(prompt).toContain('data.x');
    });

    it('should limit number of errors shown', () => {
      const errors = Array.from({ length: 10 }, (_, i) =>
        createPatchError(`eff_${i}`, `data.field${i}`, 'Type mismatch')
      );

      const prompt = buildStepPrompt(
        {
          snapshot: basicSnapshot,
          constraints: basicConstraints,
          recentErrors: errors,
        },
        { maxErrors: 3 }
      );

      expect(prompt).toContain('7 more errors');
    });

    it('should include custom instruction', () => {
      const prompt = buildStepPrompt({
        snapshot: basicSnapshot,
        constraints: basicConstraints,
        instruction: 'Process the next item in the queue.',
      });

      expect(prompt).toContain('INSTRUCTION');
      expect(prompt).toContain('Process the next item');
    });

    it('should truncate large snapshots', () => {
      const largeSnapshot = {
        data: { content: 'x'.repeat(100000) },
        state: {},
        derived: {},
      };

      const prompt = buildStepPrompt(
        {
          snapshot: largeSnapshot,
          constraints: basicConstraints,
        },
        { maxSnapshotLength: 1000 }
      );

      expect(prompt).toContain('truncated');
      expect(prompt.length).toBeLessThan(102000);
    });

    it('should apply snapshot filter', () => {
      const filter = createSnapshotFilter(['data.items']);

      const prompt = buildStepPrompt(
        {
          snapshot: basicSnapshot,
          constraints: basicConstraints,
        },
        { snapshotFilter: filter }
      );

      expect(prompt).toContain('items');
      expect(prompt).not.toContain('"count"');
    });
  });

  describe('summarizeSnapshot', () => {
    it('should summarize nested objects', () => {
      const snapshot = {
        data: {
          nested: {
            deep: {
              value: 42,
            },
          },
        },
      };

      const summary = summarizeSnapshot(snapshot, 2);
      expect(summary).toContain('{...}');
    });

    it('should truncate long arrays', () => {
      const snapshot = {
        data: {
          items: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        },
      };

      const summary = summarizeSnapshot(snapshot, 3);
      expect(summary).toContain('more');
    });

    it('should truncate long strings', () => {
      const snapshot = {
        data: {
          text: 'x'.repeat(200),
        },
      };

      const summary = summarizeSnapshot(snapshot, 3);
      expect(summary).toContain('...');
      expect(summary.length).toBeLessThan(300);
    });
  });

  describe('createSnapshotFilter', () => {
    it('should filter to specified paths', () => {
      const snapshot = {
        data: { a: 1, b: 2, c: 3 },
        state: { phase: 'test' },
        derived: { computed: 42 },
      };

      const filter = createSnapshotFilter(['data.a', 'state.phase']);
      const filtered = filter(snapshot) as any;

      expect(filtered.data.a).toBe(1);
      expect(filtered.data.b).toBeUndefined();
      expect(filtered.state.phase).toBe('test');
      expect(filtered.derived).toBeUndefined();
    });

    it('should handle nested paths', () => {
      const snapshot = {
        data: {
          user: {
            name: 'John',
            email: 'john@example.com',
          },
        },
      };

      const filter = createSnapshotFilter(['data.user.name']);
      const filtered = filter(snapshot) as any;

      expect(filtered.data.user.name).toBe('John');
      expect(filtered.data.user.email).toBeUndefined();
    });

    it('should return original for non-object', () => {
      const filter = createSnapshotFilter(['data']);
      expect(filter(null)).toBe(null);
      expect(filter('string')).toBe('string');
    });
  });

  describe('buildLLMMessages', () => {
    it('should return system and user messages', () => {
      const messages = buildLLMMessages(
        SYSTEM_PROMPT,
        {
          snapshot: { data: {} },
          constraints: createDefaultConstraints(),
        }
      );

      expect(messages).toHaveLength(2);
      expect(messages[0]!.role).toBe('system');
      expect(messages[1]!.role).toBe('user');
    });

    it('should include system prompt in system message', () => {
      const messages = buildLLMMessages(
        SYSTEM_PROMPT,
        {
          snapshot: { data: {} },
          constraints: createDefaultConstraints(),
        }
      );

      expect(messages[0]!.content).toContain('IRON LAWS');
    });

    it('should include step prompt in user message', () => {
      const messages = buildLLMMessages(
        SYSTEM_PROMPT,
        {
          snapshot: { data: { test: 'value' } },
          constraints: createDefaultConstraints(),
        }
      );

      expect(messages[1]!.content).toContain('CURRENT SNAPSHOT');
      expect(messages[1]!.content).toContain('test');
    });
  });
});
