/**
 * Transformer Domain Pure Functions Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { SchemaProposal, DomainSummary } from '../../../src/domains/summarizer/types.js';
import type {
  TransformerData,
  TransformerState,
  TransformationTask,
  ManifestoDomainJson,
  ValidationResult,
  SourceMapping,
} from '../../../src/domains/transformer/types.js';
import {
  DEFAULT_TRANSFORMER_CONFIG,
  createInitialData,
  createInitialState,
  createTask,
  addTask,
  updateTaskStatus,
  setTaskSchema,
  setTaskValidation,
  setCurrentTask,
  getNextTask,
  getTasksByStatus,
  createDomainFile,
  addDomainFile,
  markFileWritten,
  createRollbackPoint,
  addRollbackPoint,
  getRollbackPoint,
  cleanupRollbackPoints,
  cacheValidation,
  getCachedValidation,
  incrementAttempts,
  incrementLLMCalls,
  recordFileWritten,
  updateProcessingRate,
  addError,
  calculateDerived,
  createSnapshot,
  isTransformationComplete,
  allTasksSucceeded,
  hasTasksNeedingReview,
  generateId,
} from '../../../src/domains/transformer/transformer.js';

// Test fixtures
function createMockProposal(overrides: Partial<SchemaProposal> = {}): SchemaProposal {
  return {
    id: 'proposal-1',
    domainId: 'domain-1',
    domainName: 'User',
    entities: [],
    state: [],
    intents: [],
    confidence: 0.85,
    alternatives: [],
    reviewNotes: [],
    needsReview: false,
    ...overrides,
  };
}

function createMockSchema(): ManifestoDomainJson {
  return {
    $schema: 'https://manifesto.ai/schema/domain/1.0.0',
    domain: 'User',
    version: '1.0.0',
    entities: {
      Profile: {
        type: 'object',
        fields: {
          name: { type: 'string' },
          email: { type: 'string' },
        },
      },
    },
    state: {
      currentUser: { type: 'Profile | null' },
    },
    intents: {
      login: { type: 'command' },
      logout: { type: 'command' },
    },
    metadata: {
      generatedAt: Date.now(),
      generatedBy: '@manifesto-ai/react-migrate',
      sourceFiles: ['src/components/User.tsx'],
      confidence: 0.85,
    },
  };
}

describe('Transformer Domain Pure Functions', () => {
  describe('createInitialData', () => {
    it('creates initial data with default config', () => {
      const data = createInitialData('summarizer-ref-1');

      expect(data.summarizerRef).toBe('summarizer-ref-1');
      expect(data.tasks).toEqual({});
      expect(data.domainFiles).toEqual({});
      expect(data.config).toEqual(DEFAULT_TRANSFORMER_CONFIG);
    });

    it('creates initial data with custom config', () => {
      const data = createInitialData('summarizer-ref-1', {
        outputDir: './custom-output',
        validateBeforeWrite: false,
      });

      expect(data.config.outputDir).toBe('./custom-output');
      expect(data.config.validateBeforeWrite).toBe(false);
      expect(data.config.schemaVersion).toBe(DEFAULT_TRANSFORMER_CONFIG.schemaVersion);
    });
  });

  describe('createInitialState', () => {
    it('creates initial state', () => {
      const state = createInitialState();

      expect(state.currentTask).toBeNull();
      expect(state.rollbackPoints).toEqual([]);
      expect(state.currentRollbackPoint).toBeNull();
      expect(state.validationCache).toEqual({});
      expect(state.meta.attempts).toBe(0);
      expect(state.meta.llmCallCount).toBe(0);
      expect(state.meta.filesWritten).toBe(0);
      expect(state.meta.lastWrittenFile).toBeNull();
      expect(state.meta.processingRate).toBe(0);
      expect(state.meta.errors).toEqual([]);
    });
  });

  describe('Task Management', () => {
    let data: TransformerData;
    let state: TransformerState;

    beforeEach(() => {
      data = createInitialData('summarizer-ref-1');
      state = createInitialState();
    });

    describe('createTask', () => {
      it('creates a task from proposal', () => {
        const proposal = createMockProposal();
        const task = createTask('domain-1', 'User', proposal);

        expect(task.id).toMatch(/^task-domain-1-\d+$/);
        expect(task.domainId).toBe('domain-1');
        expect(task.domainName).toBe('User');
        expect(task.status).toBe('pending');
        expect(task.proposal).toBe(proposal);
        expect(task.generatedSchema).toBeNull();
        expect(task.validation).toBeNull();
      });
    });

    describe('addTask', () => {
      it('adds a task to data', () => {
        const proposal = createMockProposal();
        const task = createTask('domain-1', 'User', proposal);

        const newData = addTask(data, task);

        expect(newData.tasks[task.id]).toBe(task);
        expect(Object.keys(newData.tasks)).toHaveLength(1);
      });

      it('preserves existing tasks', () => {
        const task1 = createTask('domain-1', 'User', createMockProposal());
        const task2 = createTask('domain-2', 'Product', createMockProposal({ domainId: 'domain-2', domainName: 'Product' }));

        let newData = addTask(data, task1);
        newData = addTask(newData, task2);

        expect(Object.keys(newData.tasks)).toHaveLength(2);
        expect(newData.tasks[task1.id]).toBe(task1);
        expect(newData.tasks[task2.id]).toBe(task2);
      });
    });

    describe('updateTaskStatus', () => {
      it('updates task status', () => {
        const task = createTask('domain-1', 'User', createMockProposal());
        data = addTask(data, task);

        const newData = updateTaskStatus(data, task.id, 'in_progress');

        expect(newData.tasks[task.id]!.status).toBe('in_progress');
        expect(newData.tasks[task.id]!.startedAt).toBeDefined();
      });

      it('sets completedAt when done', () => {
        const task = createTask('domain-1', 'User', createMockProposal());
        data = addTask(data, task);

        const newData = updateTaskStatus(data, task.id, 'done');

        expect(newData.tasks[task.id]!.status).toBe('done');
        expect(newData.tasks[task.id]!.completedAt).toBeDefined();
      });

      it('sets error when failed', () => {
        const task = createTask('domain-1', 'User', createMockProposal());
        data = addTask(data, task);

        const newData = updateTaskStatus(data, task.id, 'failed', 'Test error');

        expect(newData.tasks[task.id]!.status).toBe('failed');
        expect(newData.tasks[task.id]!.error).toBe('Test error');
        expect(newData.tasks[task.id]!.completedAt).toBeDefined();
      });

      it('returns unchanged data for non-existent task', () => {
        const newData = updateTaskStatus(data, 'non-existent', 'done');
        expect(newData).toBe(data);
      });
    });

    describe('setTaskSchema', () => {
      it('sets generated schema on task', () => {
        const task = createTask('domain-1', 'User', createMockProposal());
        data = addTask(data, task);
        const schema = createMockSchema();

        const newData = setTaskSchema(data, task.id, schema);

        expect(newData.tasks[task.id]!.generatedSchema).toBe(schema);
      });
    });

    describe('setTaskValidation', () => {
      it('sets validation result on task', () => {
        const task = createTask('domain-1', 'User', createMockProposal());
        data = addTask(data, task);
        const validation: ValidationResult = {
          valid: true,
          errors: [],
          warnings: [],
        };

        const newData = setTaskValidation(data, task.id, validation);

        expect(newData.tasks[task.id]!.validation).toBe(validation);
      });
    });

    describe('setCurrentTask', () => {
      it('sets current task', () => {
        const newState = setCurrentTask(state, 'task-1');
        expect(newState.currentTask).toBe('task-1');
      });

      it('clears current task', () => {
        state = setCurrentTask(state, 'task-1');
        const newState = setCurrentTask(state, null);
        expect(newState.currentTask).toBeNull();
      });
    });

    describe('getNextTask', () => {
      it('returns first pending task', () => {
        const task1 = createTask('domain-1', 'User', createMockProposal());
        const task2 = createTask('domain-2', 'Product', createMockProposal({ domainId: 'domain-2' }));

        data = addTask(data, task1);
        data = addTask(data, task2);
        data = updateTaskStatus(data, task1.id, 'done');

        const nextTask = getNextTask(data);

        expect(nextTask).toBe(data.tasks[task2.id]);
      });

      it('returns null when no pending tasks', () => {
        const task = createTask('domain-1', 'User', createMockProposal());
        data = addTask(data, task);
        data = updateTaskStatus(data, task.id, 'done');

        const nextTask = getNextTask(data);

        expect(nextTask).toBeNull();
      });
    });

    describe('getTasksByStatus', () => {
      it('filters tasks by status', () => {
        const task1 = createTask('domain-1', 'User', createMockProposal());
        const task2 = createTask('domain-2', 'Product', createMockProposal({ domainId: 'domain-2' }));
        const task3 = createTask('domain-3', 'Order', createMockProposal({ domainId: 'domain-3' }));

        data = addTask(data, task1);
        data = addTask(data, task2);
        data = addTask(data, task3);
        data = updateTaskStatus(data, task1.id, 'done');
        data = updateTaskStatus(data, task2.id, 'review');

        const pendingTasks = getTasksByStatus(data, 'pending');
        const doneTasks = getTasksByStatus(data, 'done');
        const reviewTasks = getTasksByStatus(data, 'review');

        expect(pendingTasks).toHaveLength(1);
        expect(doneTasks).toHaveLength(1);
        expect(reviewTasks).toHaveLength(1);
      });
    });
  });

  describe('Domain File Management', () => {
    let data: TransformerData;

    beforeEach(() => {
      data = createInitialData('summarizer-ref-1');
    });

    describe('createDomainFile', () => {
      it('creates a domain file', () => {
        const schema = createMockSchema();
        const mappings: SourceMapping[] = [];

        const file = createDomainFile('task-1', 'User', schema, mappings, './output');

        expect(file.id).toBe('file-task-1');
        expect(file.name).toBe('User.domain.json');
        expect(file.path).toBe('./output/User.domain.json');
        expect(file.content).toBe(schema);
        expect(file.sourceMappings).toBe(mappings);
        expect(file.writtenAt).toBeNull();
      });
    });

    describe('addDomainFile', () => {
      it('adds a domain file to data', () => {
        const file = createDomainFile('task-1', 'User', createMockSchema(), [], './output');

        const newData = addDomainFile(data, file);

        expect(newData.domainFiles[file.id]).toBe(file);
      });
    });

    describe('markFileWritten', () => {
      it('marks file as written', () => {
        const file = createDomainFile('task-1', 'User', createMockSchema(), [], './output');
        data = addDomainFile(data, file);

        const newData = markFileWritten(data, file.id);

        expect(newData.domainFiles[file.id]!.writtenAt).toBeDefined();
        expect(newData.domainFiles[file.id]!.writtenAt).toBeGreaterThan(0);
      });

      it('returns unchanged data for non-existent file', () => {
        const newData = markFileWritten(data, 'non-existent');
        expect(newData).toBe(data);
      });
    });
  });

  describe('Rollback Management', () => {
    let state: TransformerState;

    beforeEach(() => {
      state = createInitialState();
    });

    describe('createRollbackPoint', () => {
      it('creates a rollback point', () => {
        const files = [
          { path: '/output/User.domain.json', content: '{}' },
          { path: '/output/Product.domain.json', content: null },
        ];

        const rollback = createRollbackPoint('Before write', files);

        expect(rollback.id).toMatch(/^rollback-\d+-[a-z0-9]+$/);
        expect(rollback.timestamp).toBeGreaterThan(0);
        expect(rollback.description).toBe('Before write');
        expect(rollback.files).toBe(files);
      });
    });

    describe('addRollbackPoint', () => {
      it('adds a rollback point', () => {
        const rollback = createRollbackPoint('Test', []);

        const newState = addRollbackPoint(state, rollback);

        expect(newState.rollbackPoints).toHaveLength(1);
        expect(newState.rollbackPoints[0]).toBe(rollback);
        expect(newState.currentRollbackPoint).toBe(rollback.id);
      });
    });

    describe('getRollbackPoint', () => {
      it('retrieves rollback point by id', () => {
        const rollback = createRollbackPoint('Test', []);
        state = addRollbackPoint(state, rollback);

        const found = getRollbackPoint(state, rollback.id);

        expect(found).toBe(rollback);
      });

      it('returns null for non-existent id', () => {
        const found = getRollbackPoint(state, 'non-existent');
        expect(found).toBeNull();
      });
    });

    describe('cleanupRollbackPoints', () => {
      it('removes old rollback points', () => {
        // Add 15 rollback points
        for (let i = 0; i < 15; i++) {
          const rollback = createRollbackPoint(`Test ${i}`, []);
          state = addRollbackPoint(state, rollback);
        }

        expect(state.rollbackPoints).toHaveLength(15);

        const newState = cleanupRollbackPoints(state, 10);

        expect(newState.rollbackPoints).toHaveLength(10);
      });

      it('preserves most recent rollback points', () => {
        // Add 5 rollback points
        for (let i = 0; i < 5; i++) {
          const rollback = createRollbackPoint(`Test ${i}`, []);
          state = addRollbackPoint(state, rollback);
        }

        const newState = cleanupRollbackPoints(state, 10);

        expect(newState.rollbackPoints).toHaveLength(5);
      });
    });
  });

  describe('Validation Cache', () => {
    let state: TransformerState;

    beforeEach(() => {
      state = createInitialState();
    });

    describe('cacheValidation', () => {
      it('caches validation result', () => {
        const validation: ValidationResult = {
          valid: true,
          errors: [],
          warnings: [],
        };

        const newState = cacheValidation(state, 'task-1', validation);

        expect(newState.validationCache['task-1']).toBe(validation);
      });
    });

    describe('getCachedValidation', () => {
      it('retrieves cached validation', () => {
        const validation: ValidationResult = {
          valid: true,
          errors: [],
          warnings: [],
        };
        state = cacheValidation(state, 'task-1', validation);

        const cached = getCachedValidation(state, 'task-1');

        expect(cached).toBe(validation);
      });

      it('returns null for non-cached task', () => {
        const cached = getCachedValidation(state, 'non-existent');
        expect(cached).toBeNull();
      });
    });
  });

  describe('Meta Updates', () => {
    let state: TransformerState;

    beforeEach(() => {
      state = createInitialState();
    });

    describe('incrementAttempts', () => {
      it('increments attempt count', () => {
        const newState = incrementAttempts(state);
        expect(newState.meta.attempts).toBe(1);

        const newerState = incrementAttempts(newState);
        expect(newerState.meta.attempts).toBe(2);
      });
    });

    describe('incrementLLMCalls', () => {
      it('increments LLM call count', () => {
        const newState = incrementLLMCalls(state);
        expect(newState.meta.llmCallCount).toBe(1);
      });
    });

    describe('recordFileWritten', () => {
      it('records file written', () => {
        const newState = recordFileWritten(state, '/output/User.domain.json');

        expect(newState.meta.filesWritten).toBe(1);
        expect(newState.meta.lastWrittenFile).toBe('/output/User.domain.json');
      });
    });

    describe('updateProcessingRate', () => {
      it('calculates processing rate', () => {
        const newState = updateProcessingRate(state, 10, 5); // 10 tasks in 5 seconds

        expect(newState.meta.processingRate).toBe(2); // 2 tasks per second
      });

      it('handles zero elapsed time', () => {
        const newState = updateProcessingRate(state, 10, 0);

        expect(newState.meta.processingRate).toBe(0);
      });
    });

    describe('addError', () => {
      it('adds error to meta', () => {
        const newState = addError(state, 'Test error');

        expect(newState.meta.errors).toHaveLength(1);
        expect(newState.meta.errors[0]!.error).toBe('Test error');
        expect(newState.meta.errors[0]!.timestamp).toBeGreaterThan(0);
      });

      it('adds error with task id', () => {
        const newState = addError(state, 'Test error', 'task-1');

        expect(newState.meta.errors[0]!.taskId).toBe('task-1');
      });
    });
  });

  describe('Derived Calculations', () => {
    let data: TransformerData;
    let state: TransformerState;

    beforeEach(() => {
      data = createInitialData('summarizer-ref-1');
      state = createInitialState();
    });

    describe('calculateDerived', () => {
      it('calculates derived values for empty data', () => {
        const derived = calculateDerived(data, state);

        expect(derived.tasksTotal).toBe(0);
        expect(derived.tasksCompleted).toBe(0);
        expect(derived.tasksFailed).toBe(0);
        expect(derived.tasksNeedingReview).toBe(0);
        expect(derived.filesGenerated).toBe(0);
        expect(derived.filesWritten).toBe(0);
        expect(derived.overallProgress).toBe(0);
      });

      it('calculates derived values for tasks', () => {
        // Add tasks with various statuses
        const task1 = createTask('domain-1', 'User', createMockProposal());
        const task2 = createTask('domain-2', 'Product', createMockProposal({ domainId: 'domain-2' }));
        const task3 = createTask('domain-3', 'Order', createMockProposal({ domainId: 'domain-3' }));
        const task4 = createTask('domain-4', 'Cart', createMockProposal({ domainId: 'domain-4' }));

        data = addTask(data, task1);
        data = addTask(data, task2);
        data = addTask(data, task3);
        data = addTask(data, task4);

        data = updateTaskStatus(data, task1.id, 'done');
        data = updateTaskStatus(data, task2.id, 'done');
        data = updateTaskStatus(data, task3.id, 'failed');
        data = updateTaskStatus(data, task4.id, 'review');

        const derived = calculateDerived(data, state);

        expect(derived.tasksTotal).toBe(4);
        expect(derived.tasksCompleted).toBe(2);
        expect(derived.tasksFailed).toBe(1);
        expect(derived.tasksNeedingReview).toBe(1);
        expect(derived.overallProgress).toBe(50); // 2/4 = 50%
      });

      it('calculates derived values for files', () => {
        const file1 = createDomainFile('task-1', 'User', createMockSchema(), [], './output');
        const file2 = createDomainFile('task-2', 'Product', createMockSchema(), [], './output');

        data = addDomainFile(data, file1);
        data = addDomainFile(data, file2);
        data = markFileWritten(data, file1.id);

        const derived = calculateDerived(data, state);

        expect(derived.filesGenerated).toBe(2);
        expect(derived.filesWritten).toBe(1);
      });
    });
  });

  describe('Snapshot', () => {
    it('creates snapshot', () => {
      const data = createInitialData('summarizer-ref-1');
      const state = createInitialState();

      const snapshot = createSnapshot(data, state);

      expect(snapshot.data).toBe(data);
      expect(snapshot.state).toBe(state);
      expect(snapshot.derived).toBeDefined();
    });
  });

  describe('Utility Functions', () => {
    let data: TransformerData;

    beforeEach(() => {
      data = createInitialData('summarizer-ref-1');
    });

    describe('isTransformationComplete', () => {
      it('returns false for empty data', () => {
        expect(isTransformationComplete(data)).toBe(false);
      });

      it('returns true when all tasks done or failed', () => {
        const task1 = createTask('domain-1', 'User', createMockProposal());
        const task2 = createTask('domain-2', 'Product', createMockProposal({ domainId: 'domain-2' }));

        data = addTask(data, task1);
        data = addTask(data, task2);
        data = updateTaskStatus(data, task1.id, 'done');
        data = updateTaskStatus(data, task2.id, 'failed');

        expect(isTransformationComplete(data)).toBe(true);
      });

      it('returns false when tasks pending', () => {
        const task1 = createTask('domain-1', 'User', createMockProposal());
        const task2 = createTask('domain-2', 'Product', createMockProposal({ domainId: 'domain-2' }));

        data = addTask(data, task1);
        data = addTask(data, task2);
        data = updateTaskStatus(data, task1.id, 'done');

        expect(isTransformationComplete(data)).toBe(false);
      });
    });

    describe('allTasksSucceeded', () => {
      it('returns false for empty data', () => {
        expect(allTasksSucceeded(data)).toBe(false);
      });

      it('returns true when all tasks done', () => {
        const task1 = createTask('domain-1', 'User', createMockProposal());
        const task2 = createTask('domain-2', 'Product', createMockProposal({ domainId: 'domain-2' }));

        data = addTask(data, task1);
        data = addTask(data, task2);
        data = updateTaskStatus(data, task1.id, 'done');
        data = updateTaskStatus(data, task2.id, 'done');

        expect(allTasksSucceeded(data)).toBe(true);
      });

      it('returns false when any task failed', () => {
        const task1 = createTask('domain-1', 'User', createMockProposal());
        const task2 = createTask('domain-2', 'Product', createMockProposal({ domainId: 'domain-2' }));

        data = addTask(data, task1);
        data = addTask(data, task2);
        data = updateTaskStatus(data, task1.id, 'done');
        data = updateTaskStatus(data, task2.id, 'failed');

        expect(allTasksSucceeded(data)).toBe(false);
      });
    });

    describe('hasTasksNeedingReview', () => {
      it('returns false when no review tasks', () => {
        expect(hasTasksNeedingReview(data)).toBe(false);
      });

      it('returns true when review tasks exist', () => {
        const task = createTask('domain-1', 'User', createMockProposal());

        data = addTask(data, task);
        data = updateTaskStatus(data, task.id, 'review');

        expect(hasTasksNeedingReview(data)).toBe(true);
      });
    });

    describe('generateId', () => {
      it('generates unique ids', () => {
        const id1 = generateId();
        const id2 = generateId();

        expect(id1).not.toBe(id2);
      });

      it('generates ids with prefix', () => {
        const id = generateId('test');
        expect(id).toMatch(/^test-[a-z0-9]+-[a-z0-9]+$/);
      });

      it('generates ids without prefix', () => {
        const id = generateId();
        expect(id).toMatch(/^[a-z0-9]+-[a-z0-9]+$/);
      });
    });
  });
});
