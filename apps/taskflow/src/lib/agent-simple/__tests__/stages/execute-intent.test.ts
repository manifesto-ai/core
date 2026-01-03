/**
 * Execute Intent Stage Unit Tests
 */

import { describe, it, expect } from 'vitest';
import { executeIntentStage } from '../../stages/execute-intent';
import { isOk, isErr } from '../../result';
import type { ParsedIntentContext } from '../../types';
import type { Intent } from '@/lib/agents/intent';
import type { Task } from '@/manifesto';

describe('executeIntentStage', () => {
  const createSnapshot = (tasks: Array<{ id: string; title: string; status: Task['status'] }> = []) => ({
    data: {
      tasks: tasks.map(t => ({
        ...t,
        priority: 'medium' as const,
        tags: [] as string[],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })),
    },
    state: {
      viewMode: 'kanban' as const,
      dateFilter: null,
      selectedTaskId: null,
    },
  });

  const createContext = (intent: Intent, tasks: Array<{ id: string; title: string; status: Task['status'] }> = []): ParsedIntentContext => ({
    input: {
      instruction: 'test',
      snapshot: createSnapshot(tasks),
    },
    intent,
  });

  describe('RequestClarification', () => {
    it('returns empty effects for RequestClarification', () => {
      const result = executeIntentStage(
        createContext({
          kind: 'RequestClarification',
          reason: 'which_task',
          question: 'Which task?',
          originalInput: 'mark it done',
          confidence: 0.5,
          source: 'agent',
        })
      );

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.effects).toEqual([]);
        expect(result.value.intent.kind).toBe('RequestClarification');
      }
    });
  });

  describe('ChangeView', () => {
    it('generates view change effect', () => {
      const result = executeIntentStage(
        createContext({
          kind: 'ChangeView',
          viewMode: 'table',
          confidence: 0.9,
          source: 'human',
        })
      );

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.effects.length).toBe(1);
        expect(result.value.effects[0].type).toBe('snapshot.patch');
      }
    });
  });

  describe('Undo', () => {
    it('generates undo effect', () => {
      const result = executeIntentStage(
        createContext({
          kind: 'Undo',
          confidence: 0.9,
          source: 'human',
        })
      );

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.effects.length).toBe(1);
        expect(result.value.effects[0].type).toBe('snapshot.undo');
      }
    });
  });

  describe('QueryTasks', () => {
    it('returns empty effects for read-only intent', () => {
      const result = executeIntentStage(
        createContext({
          kind: 'QueryTasks',
          query: 'What tasks are due today?',
          confidence: 0.9,
          source: 'human',
        })
      );

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.effects).toEqual([]);
      }
    });
  });

  describe('CreateTask', () => {
    it('generates create task effect', () => {
      const result = executeIntentStage(
        createContext({
          kind: 'CreateTask',
          tasks: [{ title: 'New task' }],
          confidence: 0.9,
          source: 'human',
        })
      );

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.effects.length).toBe(1);
        expect(result.value.effects[0].type).toBe('snapshot.patch');
      }
    });
  });

  describe('ChangeStatus', () => {
    it('generates status change effect for existing task', () => {
      const result = executeIntentStage(
        createContext(
          {
            kind: 'ChangeStatus',
            taskId: 'task-1',
            toStatus: 'done',
            confidence: 0.9,
            source: 'human',
          },
          [{ id: 'task-1', title: 'Test task', status: 'todo' }]
        )
      );

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.effects.length).toBe(1);
        expect(result.value.effects[0].type).toBe('snapshot.patch');
      }
    });

    it('returns error for non-existent task', () => {
      const result = executeIntentStage(
        createContext({
          kind: 'ChangeStatus',
          taskId: 'non-existent',
          toStatus: 'done',
          confidence: 0.9,
          source: 'human',
        })
      );

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.kind).toBe('execution');
      }
    });
  });

  describe('DeleteTask', () => {
    it('generates delete task effect', () => {
      const result = executeIntentStage(
        createContext(
          {
            kind: 'DeleteTask',
            taskId: 'task-1',
            confidence: 0.9,
            source: 'human',
          },
          [{ id: 'task-1', title: 'Test task', status: 'todo' }]
        )
      );

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.effects.length).toBe(1);
        expect(result.value.effects[0].type).toBe('snapshot.patch');
      }
    });
  });
});
