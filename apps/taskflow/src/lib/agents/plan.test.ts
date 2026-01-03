/**
 * Plan Type Tests
 */

import { describe, it, expect } from 'vitest';
import {
  validatePlan,
  extractAllIntentSteps,
  countTotalSteps,
  hasDestructiveIntent,
  hasConfirmStep,
  isIntentStep,
  isQueryStep,
  isIfStep,
  isConfirmStep,
  isNoteStep,
  type Plan,
  type PlanStep,
} from './plan';

describe('Plan Validation', () => {
  it('validates a minimal valid plan', () => {
    const plan: Plan = {
      version: 1,
      goal: 'Create a task',
      steps: [
        {
          kind: 'intent',
          skeleton: {
            kind: 'CreateTask',
            tasks: [{ title: 'Test task' }],
            confidence: 0.9,
            source: 'human',
          },
        },
      ],
    };

    const result = validatePlan(plan);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('validates a plan with multiple steps', () => {
    const plan: Plan = {
      version: 1,
      goal: 'Create and complete task',
      steps: [
        {
          kind: 'intent',
          skeleton: {
            kind: 'CreateTask',
            tasks: [{ title: 'Test task' }],
            confidence: 0.9,
            source: 'human',
          },
        },
        {
          kind: 'intent',
          skeleton: {
            kind: 'ChangeStatus',
            targetHint: 'Test task',
            toStatus: 'done',
            confidence: 0.9,
            source: 'human',
          },
        },
      ],
      risk: 'low',
    };

    const result = validatePlan(plan);
    expect(result.valid).toBe(true);
  });

  it('validates a plan with confirm step', () => {
    const plan: Plan = {
      version: 1,
      goal: 'Delete task with confirmation',
      steps: [
        {
          kind: 'confirm',
          message: 'Delete this task?',
          onApprove: [
            {
              kind: 'intent',
              skeleton: {
                kind: 'DeleteTask',
                targetHint: 'old task',
                confidence: 0.9,
                source: 'human',
              },
            },
          ],
        },
      ],
      risk: 'high',
    };

    const result = validatePlan(plan);
    expect(result.valid).toBe(true);
  });

  it('validates a plan with if step', () => {
    const plan: Plan = {
      version: 1,
      goal: 'Complete task if count > 0',
      steps: [
        {
          kind: 'query',
          query: { kind: 'countTasks', filter: { status: 'todo' } },
          assign: 'todoCount',
        },
        {
          kind: 'if',
          cond: { op: 'gt', left: { var: 'todoCount' }, right: 0 },
          then: [
            {
              kind: 'intent',
              skeleton: {
                kind: 'ChangeStatus',
                targetHint: 'first todo',
                toStatus: 'done',
                confidence: 0.9,
                source: 'human',
              },
            },
          ],
        },
      ],
    };

    const result = validatePlan(plan);
    expect(result.valid).toBe(true);
  });

  it('validates a plan with note step', () => {
    const plan: Plan = {
      version: 1,
      goal: 'Explain something',
      steps: [
        {
          kind: 'note',
          text: 'This is an explanation',
        },
        {
          kind: 'intent',
          skeleton: {
            kind: 'QueryTasks',
            query: 'How many tasks?',
            confidence: 0.9,
            source: 'human',
          },
        },
      ],
    };

    const result = validatePlan(plan);
    expect(result.valid).toBe(true);
  });

  it('rejects plan without version', () => {
    const plan = {
      goal: 'Test',
      steps: [{ kind: 'note', text: 'hi' }],
    };

    const result = validatePlan(plan);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Plan.version must be 1');
  });

  it('rejects plan with wrong version', () => {
    const plan = {
      version: 2,
      goal: 'Test',
      steps: [{ kind: 'note', text: 'hi' }],
    };

    const result = validatePlan(plan);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Plan.version must be 1');
  });

  it('rejects plan without goal', () => {
    const plan = {
      version: 1,
      steps: [{ kind: 'note', text: 'hi' }],
    };

    const result = validatePlan(plan);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Plan.goal is required and must be a string');
  });

  it('rejects plan with empty steps', () => {
    const plan = {
      version: 1,
      goal: 'Test',
      steps: [],
    };

    const result = validatePlan(plan);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Plan.steps must not be empty');
  });

  it('rejects plan with invalid step kind', () => {
    const plan = {
      version: 1,
      goal: 'Test',
      steps: [{ kind: 'invalid' }],
    };

    const result = validatePlan(plan);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('unknown step kind'))).toBe(true);
  });

  it('rejects intent step without skeleton', () => {
    const plan = {
      version: 1,
      goal: 'Test',
      steps: [{ kind: 'intent' }],
    };

    const result = validatePlan(plan);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('must have a "skeleton"'))).toBe(true);
  });

  it('rejects confirm step without message', () => {
    const plan = {
      version: 1,
      goal: 'Test',
      steps: [{ kind: 'confirm', onApprove: [] }],
    };

    const result = validatePlan(plan);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('must have a "message"'))).toBe(true);
  });

  it('warns about invalid risk level', () => {
    const plan = {
      version: 1,
      goal: 'Test',
      steps: [{ kind: 'note', text: 'hi' }],
      risk: 'very-high',
    };

    const result = validatePlan(plan);
    expect(result.valid).toBe(true); // Still valid, just a warning
    expect(result.warnings.some(w => w.includes('risk'))).toBe(true);
  });
});

describe('Plan Type Guards', () => {
  it('identifies intent step', () => {
    const step: PlanStep = {
      kind: 'intent',
      skeleton: {
        kind: 'CreateTask',
        tasks: [{ title: 'Test' }],
        confidence: 0.9,
        source: 'human',
      },
    };
    expect(isIntentStep(step)).toBe(true);
    expect(isQueryStep(step)).toBe(false);
  });

  it('identifies query step', () => {
    const step: PlanStep = {
      kind: 'query',
      query: { kind: 'countTasks' },
      assign: 'count',
    };
    expect(isQueryStep(step)).toBe(true);
    expect(isIntentStep(step)).toBe(false);
  });

  it('identifies if step', () => {
    const step: PlanStep = {
      kind: 'if',
      cond: { op: 'eq', left: { var: 'x' }, right: 1 },
      then: [],
    };
    expect(isIfStep(step)).toBe(true);
  });

  it('identifies confirm step', () => {
    const step: PlanStep = {
      kind: 'confirm',
      message: 'Sure?',
      onApprove: [],
    };
    expect(isConfirmStep(step)).toBe(true);
  });

  it('identifies note step', () => {
    const step: PlanStep = {
      kind: 'note',
      text: 'Hello',
    };
    expect(isNoteStep(step)).toBe(true);
  });
});

describe('Plan Utilities', () => {
  describe('extractAllIntentSteps', () => {
    it('extracts intents from flat plan', () => {
      const plan: Plan = {
        version: 1,
        goal: 'Test',
        steps: [
          {
            kind: 'intent',
            skeleton: {
              kind: 'CreateTask',
              tasks: [{ title: 'A' }],
              confidence: 0.9,
              source: 'human',
            },
          },
          {
            kind: 'intent',
            skeleton: {
              kind: 'CreateTask',
              tasks: [{ title: 'B' }],
              confidence: 0.9,
              source: 'human',
            },
          },
        ],
      };

      const intents = extractAllIntentSteps(plan);
      expect(intents).toHaveLength(2);
    });

    it('extracts intents from nested if step', () => {
      const plan: Plan = {
        version: 1,
        goal: 'Test',
        steps: [
          {
            kind: 'if',
            cond: { op: 'eq', left: { var: 'x' }, right: 1 },
            then: [
              {
                kind: 'intent',
                skeleton: {
                  kind: 'CreateTask',
                  tasks: [{ title: 'In if' }],
                  confidence: 0.9,
                  source: 'human',
                },
              },
            ],
            else: [
              {
                kind: 'intent',
                skeleton: {
                  kind: 'CreateTask',
                  tasks: [{ title: 'In else' }],
                  confidence: 0.9,
                  source: 'human',
                },
              },
            ],
          },
        ],
      };

      const intents = extractAllIntentSteps(plan);
      expect(intents).toHaveLength(2);
    });

    it('extracts intents from nested confirm step', () => {
      const plan: Plan = {
        version: 1,
        goal: 'Test',
        steps: [
          {
            kind: 'confirm',
            message: 'Sure?',
            onApprove: [
              {
                kind: 'intent',
                skeleton: {
                  kind: 'DeleteTask',
                  targetHint: 'task',
                  confidence: 0.9,
                  source: 'human',
                },
              },
            ],
            onReject: [
              {
                kind: 'note',
                text: 'Cancelled',
              },
            ],
          },
        ],
      };

      const intents = extractAllIntentSteps(plan);
      expect(intents).toHaveLength(1);
      expect(intents[0]?.skeleton.kind).toBe('DeleteTask');
    });
  });

  describe('countTotalSteps', () => {
    it('counts flat steps', () => {
      const plan: Plan = {
        version: 1,
        goal: 'Test',
        steps: [
          { kind: 'note', text: 'A' },
          { kind: 'note', text: 'B' },
          { kind: 'note', text: 'C' },
        ],
      };

      expect(countTotalSteps(plan)).toBe(3);
    });

    it('counts nested steps', () => {
      const plan: Plan = {
        version: 1,
        goal: 'Test',
        steps: [
          {
            kind: 'if',
            cond: { op: 'eq', left: { var: 'x' }, right: 1 },
            then: [
              { kind: 'note', text: 'In then' },
            ],
            else: [
              { kind: 'note', text: 'In else 1' },
              { kind: 'note', text: 'In else 2' },
            ],
          },
        ],
      };

      expect(countTotalSteps(plan)).toBe(4); // 1 if + 1 then + 2 else
    });
  });

  describe('hasDestructiveIntent', () => {
    it('detects DeleteTask', () => {
      const plan: Plan = {
        version: 1,
        goal: 'Delete',
        steps: [
          {
            kind: 'intent',
            skeleton: {
              kind: 'DeleteTask',
              targetHint: 'task',
              confidence: 0.9,
              source: 'human',
            },
          },
        ],
      };

      expect(hasDestructiveIntent(plan)).toBe(true);
    });

    it('detects RestoreTask', () => {
      const plan: Plan = {
        version: 1,
        goal: 'Restore',
        steps: [
          {
            kind: 'intent',
            skeleton: {
              kind: 'RestoreTask',
              targetHint: 'task',
              confidence: 0.9,
              source: 'human',
            },
          },
        ],
      };

      expect(hasDestructiveIntent(plan)).toBe(true);
    });

    it('returns false for non-destructive plans', () => {
      const plan: Plan = {
        version: 1,
        goal: 'Create',
        steps: [
          {
            kind: 'intent',
            skeleton: {
              kind: 'CreateTask',
              tasks: [{ title: 'Task' }],
              confidence: 0.9,
              source: 'human',
            },
          },
        ],
      };

      expect(hasDestructiveIntent(plan)).toBe(false);
    });

    it('detects destructive intent in nested confirm', () => {
      const plan: Plan = {
        version: 1,
        goal: 'Delete with confirm',
        steps: [
          {
            kind: 'confirm',
            message: 'Sure?',
            onApprove: [
              {
                kind: 'intent',
                skeleton: {
                  kind: 'DeleteTask',
                  targetHint: 'task',
                  confidence: 0.9,
                  source: 'human',
                },
              },
            ],
          },
        ],
      };

      expect(hasDestructiveIntent(plan)).toBe(true);
    });
  });

  describe('hasConfirmStep', () => {
    it('finds confirm step at top level', () => {
      const plan: Plan = {
        version: 1,
        goal: 'Confirm test',
        steps: [
          {
            kind: 'confirm',
            message: 'Sure?',
            onApprove: [],
          },
        ],
      };

      expect(hasConfirmStep(plan)).toBe(true);
    });

    it('finds confirm step nested in if', () => {
      const plan: Plan = {
        version: 1,
        goal: 'Confirm test',
        steps: [
          {
            kind: 'if',
            cond: { op: 'eq', left: { var: 'x' }, right: 1 },
            then: [
              {
                kind: 'confirm',
                message: 'Sure?',
                onApprove: [],
              },
            ],
          },
        ],
      };

      expect(hasConfirmStep(plan)).toBe(true);
    });

    it('returns false when no confirm step', () => {
      const plan: Plan = {
        version: 1,
        goal: 'No confirm',
        steps: [
          { kind: 'note', text: 'Hello' },
          {
            kind: 'intent',
            skeleton: {
              kind: 'CreateTask',
              tasks: [{ title: 'Task' }],
              confidence: 0.9,
              source: 'human',
            },
          },
        ],
      };

      expect(hasConfirmStep(plan)).toBe(false);
    });
  });
});
