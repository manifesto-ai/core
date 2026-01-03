/**
 * Validate Intent Stage Unit Tests
 */

import { describe, it, expect } from 'vitest';
import { validateIntentStage } from '../../stages/validate-intent';
import { isOk, isErr } from '../../result';
import type { ParsedIntentContext } from '../../types';

describe('validateIntentStage', () => {
  const validSnapshot = {
    data: { tasks: [] },
    state: {
      viewMode: 'kanban' as const,
      dateFilter: null,
      selectedTaskId: null,
    },
  };

  const createContext = (intent: unknown): ParsedIntentContext => ({
    input: {
      instruction: 'test',
      snapshot: validSnapshot,
    },
    intent: intent as ParsedIntentContext['intent'],
  });

  describe('valid intents', () => {
    it('validates ChangeView intent', () => {
      const result = validateIntentStage(
        createContext({
          kind: 'ChangeView',
          viewMode: 'kanban',
          confidence: 0.9,
          source: 'human',
        })
      );

      expect(isOk(result)).toBe(true);
    });

    it('validates CreateTask intent', () => {
      const result = validateIntentStage(
        createContext({
          kind: 'CreateTask',
          tasks: [{ title: 'New task' }],
          confidence: 0.9,
          source: 'human',
        })
      );

      expect(isOk(result)).toBe(true);
    });

    it('validates Undo intent', () => {
      const result = validateIntentStage(
        createContext({
          kind: 'Undo',
          confidence: 0.9,
          source: 'human',
        })
      );

      expect(isOk(result)).toBe(true);
    });

    it('validates QueryTasks intent', () => {
      const result = validateIntentStage(
        createContext({
          kind: 'QueryTasks',
          query: 'What tasks are due today?',
          confidence: 0.9,
          source: 'human',
        })
      );

      expect(isOk(result)).toBe(true);
    });

    it('validates RequestClarification intent', () => {
      const result = validateIntentStage(
        createContext({
          kind: 'RequestClarification',
          reason: 'which_task',
          question: 'Which task do you mean?',
          originalInput: 'mark it done',
          confidence: 0.5,
          source: 'agent',
        })
      );

      expect(isOk(result)).toBe(true);
    });
  });

  describe('invalid intents', () => {
    it('rejects intent without kind', () => {
      const result = validateIntentStage(
        createContext({
          viewMode: 'kanban',
          confidence: 0.9,
          source: 'human',
        })
      );

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.kind).toBe('intent_validation');
      }
    });

    it('rejects unknown intent kind', () => {
      const result = validateIntentStage(
        createContext({
          kind: 'UnknownIntent',
          confidence: 0.9,
          source: 'human',
        })
      );

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.kind).toBe('intent_validation');
      }
    });

    it('rejects intent with invalid confidence', () => {
      const result = validateIntentStage(
        createContext({
          kind: 'Undo',
          confidence: 2.0, // Invalid: > 1
          source: 'human',
        })
      );

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.kind).toBe('intent_validation');
      }
    });

    it('rejects CreateTask without tasks', () => {
      const result = validateIntentStage(
        createContext({
          kind: 'CreateTask',
          tasks: [],
          confidence: 0.9,
          source: 'human',
        })
      );

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.kind).toBe('intent_validation');
      }
    });

    it('rejects CreateTask with empty title', () => {
      const result = validateIntentStage(
        createContext({
          kind: 'CreateTask',
          tasks: [{ title: '' }],
          confidence: 0.9,
          source: 'human',
        })
      );

      expect(isErr(result)).toBe(true);
    });
  });
});
