import { describe, it, expect } from 'vitest';
import {
  matchIntent,
  tryFastPath,
  generateEffectsFromIntent,
  generateMessageFromIntent,
  convertToIntentAST,
  type MatchedIntent,
} from './pattern-matcher';
import { detectLanguage } from './language-detector';
import { isPatchEffect, type AgentEffect, type PatchOp } from './types';

// Helper to get ops from patch effect
function getOps(effects: AgentEffect[] | null): PatchOp[] | undefined {
  if (!effects || effects.length === 0) return undefined;
  const effect = effects[0];
  if (!isPatchEffect(effect)) return undefined;
  return effect.ops;
}

// ============================================
// matchIntent - Pattern Matching
// ============================================

describe('matchIntent', () => {
  describe('view mode patterns', () => {
    it('should match "kanban" keyword', () => {
      const result = matchIntent('show kanban');
      expect(result.slots.viewMode).toBe('kanban');
      expect(result.matchedPatterns.some(p => p.includes('kanban'))).toBe(true);
    });

    it('should match "board" keyword as kanban', () => {
      const result = matchIntent('switch to board view');
      expect(result.slots.viewMode).toBe('kanban');
    });

    it('should match "table" keyword', () => {
      const result = matchIntent('show table');
      expect(result.slots.viewMode).toBe('table');
    });

    it('should match "list view" as table', () => {
      const result = matchIntent('switch to list view');
      expect(result.slots.viewMode).toBe('table');
    });

    it('should match "todo list" as todo view', () => {
      const result = matchIntent('show todo list');
      expect(result.slots.viewMode).toBe('todo');
    });

    it('should match "checklist" as todo', () => {
      const result = matchIntent('display checklist');
      expect(result.slots.viewMode).toBe('todo');
    });
  });

  describe('date filter patterns', () => {
    it('should match "today" filter', () => {
      const result = matchIntent('show tasks due today');
      expect(result.slots.dateFilter).toEqual({ field: 'dueDate', type: 'today' });
    });

    it('should match "this week" filter', () => {
      const result = matchIntent('filter this week');
      expect(result.slots.dateFilter).toEqual({ field: 'dueDate', type: 'week' });
    });

    it('should match "this month" filter', () => {
      const result = matchIntent('show tasks this month');
      expect(result.slots.dateFilter).toEqual({ field: 'dueDate', type: 'month' });
    });

    it('should match "all tasks" as clear filter', () => {
      const result = matchIntent('show all tasks');
      expect(result.slots.dateFilter).toBe('clear');
    });

    it('should match "clear filter"', () => {
      const result = matchIntent('clear filter');
      expect(result.slots.dateFilter).toBe('clear');
    });
  });

  describe('status patterns', () => {
    it('should match "done" status', () => {
      const result = matchIntent('mark as done');
      expect(result.slots.status).toBe('done');
    });

    it('should match "complete" status', () => {
      const result = matchIntent('complete the task');
      expect(result.slots.status).toBe('done');
    });

    it('should match "in progress" status', () => {
      const result = matchIntent('mark as in progress');
      expect(result.slots.status).toBe('in-progress');
    });

    it('should match "start" as in-progress', () => {
      const result = matchIntent('start working');
      expect(result.slots.status).toBe('in-progress');
    });

    it('should match "review" status', () => {
      const result = matchIntent('send to review');
      expect(result.slots.status).toBe('review');
    });

    it('should match "reopen" as todo', () => {
      const result = matchIntent('reopen the task');
      expect(result.slots.status).toBe('todo');
    });
  });

  describe('question patterns - no match', () => {
    it('should not match questions ending with ?', () => {
      const result = matchIntent('What tasks are done?');
      expect(result.type).toBe('none');
    });

    it('should not match "What" questions', () => {
      const result = matchIntent('What should I do today');
      expect(result.type).toBe('none');
    });

    it('should not match "How many" questions', () => {
      const result = matchIntent('How many tasks are done');
      expect(result.type).toBe('none');
    });

    it('should not match "summarize" commands', () => {
      const result = matchIntent('summarize my tasks');
      expect(result.type).toBe('none');
    });
  });

  describe('intent type determination', () => {
    it('should set type to "view" for view mode match', () => {
      const result = matchIntent('show kanban');
      expect(result.type).toBe('view');
    });

    it('should set type to "view" for date filter match', () => {
      const result = matchIntent('filter today');
      expect(result.type).toBe('view');
    });

    it('should set type to "mutate" for status match with action verb', () => {
      const result = matchIntent('mark as done');
      expect(result.type).toBe('mutate');
    });

    it('should have higher confidence with explicit view action', () => {
      const withAction = matchIntent('show kanban');
      const withoutAction = matchIntent('kanban');
      expect(withAction.confidence).toBeGreaterThanOrEqual(withoutAction.confidence);
    });
  });

  describe('matched patterns tracking', () => {
    it('should track viewMode pattern', () => {
      const result = matchIntent('show kanban');
      expect(result.matchedPatterns).toContain('viewMode:kanban');
    });

    it('should track dateFilter pattern', () => {
      const result = matchIntent('filter today');
      expect(result.matchedPatterns).toContain('dateFilter:today');
    });

    it('should track status pattern', () => {
      const result = matchIntent('mark as done');
      expect(result.matchedPatterns).toContain('status:done');
    });

    it('should track multiple patterns', () => {
      const result = matchIntent('show kanban view today');
      expect(result.matchedPatterns.length).toBeGreaterThan(1);
    });
  });
});

// ============================================
// tryFastPath
// ============================================

describe('tryFastPath', () => {
  describe('successful hints', () => {
    it('should return hit=true for "show kanban"', () => {
      const result = tryFastPath('show kanban');
      expect(result.hit).toBe(true);
      expect(result.hint).toBeDefined();
    });

    it('should return view hint for kanban', () => {
      const result = tryFastPath('show kanban');
      expect(result.hint?.likelyKind).toBe('view');
      expect(result.hint?.slots.viewMode).toBe('kanban');
    });

    it('should return filter hint for date filter', () => {
      const result = tryFastPath('show tasks due today');
      if (result.hit) {
        expect(result.hint?.likelyKind).toBe('filter');
        expect(result.hint?.slots.dateFilter).toEqual({ field: 'dueDate', type: 'today' });
      }
    });

    it('should include confidence in hint', () => {
      const result = tryFastPath('show kanban');
      expect(result.hint?.confidence).toBeGreaterThan(0);
    });

    it('should include matchedPatterns in hint', () => {
      const result = tryFastPath('show kanban');
      expect(result.hint?.matchedPatterns).toBeDefined();
      expect(result.hint?.matchedPatterns.length).toBeGreaterThan(0);
    });

    it('should include schemaVersion', () => {
      const result = tryFastPath('show kanban');
      expect(result.schemaVersion).toBeDefined();
    });
  });

  describe('no hint cases', () => {
    it('should not return hint for task creation patterns', () => {
      const result = tryFastPath('add task due today');
      expect(result.hit).toBe(false);
    });

    it('should not return hint for "create task"', () => {
      const result = tryFastPath('create new task');
      expect(result.hit).toBe(false);
    });

    it('should not return hint for questions', () => {
      const result = tryFastPath('What tasks are due today?');
      expect(result.hit).toBe(false);
    });

    it('should not return hint for low confidence matches', () => {
      const result = tryFastPath('some random text');
      expect(result.hit).toBe(false);
    });

    it('should not return hint for "finish by today" (creation)', () => {
      const result = tryFastPath('finish report by today');
      expect(result.hit).toBe(false);
    });
  });

  describe('hint structure', () => {
    it('should have likelyKind property', () => {
      const result = tryFastPath('show kanban');
      expect(result.hint?.likelyKind).toBeDefined();
      expect(['view', 'filter', 'status']).toContain(result.hint?.likelyKind);
    });

    it('should have slots property', () => {
      const result = tryFastPath('show kanban');
      expect(result.hint?.slots).toBeDefined();
    });
  });
});

// ============================================
// generateEffectsFromIntent
// ============================================

describe('generateEffectsFromIntent', () => {
  it('should return null for low confidence intent', () => {
    const intent: MatchedIntent = {
      type: 'view',
      confidence: 0.5,
      slots: { viewMode: 'kanban' },
      matchedPatterns: [],
    };
    expect(generateEffectsFromIntent(intent)).toBeNull();
  });

  it('should return null for "none" type', () => {
    const intent: MatchedIntent = {
      type: 'none',
      confidence: 0.9,
      slots: {},
      matchedPatterns: [],
    };
    expect(generateEffectsFromIntent(intent)).toBeNull();
  });

  it('should generate viewMode patch for view change', () => {
    const intent: MatchedIntent = {
      type: 'view',
      confidence: 0.9,
      slots: { viewMode: 'table' },
      matchedPatterns: [],
    };
    const effects = generateEffectsFromIntent(intent);
    expect(effects).not.toBeNull();
    expect(effects?.[0].type).toBe('snapshot.patch');
    expect(getOps(effects)?.some(op => op.path === 'state.viewMode')).toBe(true);
  });

  it('should generate dateFilter patch for filter change', () => {
    const intent: MatchedIntent = {
      type: 'view',
      confidence: 0.9,
      slots: { dateFilter: { field: 'dueDate', type: 'today' } },
      matchedPatterns: [],
    };
    const effects = generateEffectsFromIntent(intent);
    expect(effects).not.toBeNull();
    expect(getOps(effects)?.some(op => op.path === 'state.dateFilter')).toBe(true);
  });

  it('should set dateFilter to null for "clear"', () => {
    const intent: MatchedIntent = {
      type: 'view',
      confidence: 0.9,
      slots: { dateFilter: 'clear' },
      matchedPatterns: [],
    };
    const effects = generateEffectsFromIntent(intent);
    const filterOp = getOps(effects)?.find(op => op.path === 'state.dateFilter');
    expect(filterOp?.value).toBeNull();
  });

  it('should return null for mutate type (no direct effects)', () => {
    const intent: MatchedIntent = {
      type: 'mutate',
      confidence: 0.9,
      slots: { status: 'done' },
      matchedPatterns: [],
    };
    expect(generateEffectsFromIntent(intent)).toBeNull();
  });
});

// ============================================
// generateMessageFromIntent
// ============================================

describe('generateMessageFromIntent', () => {
  it('should generate English message by default', () => {
    const intent: MatchedIntent = {
      type: 'view',
      confidence: 0.9,
      slots: { viewMode: 'kanban' },
      matchedPatterns: [],
    };
    const message = generateMessageFromIntent(intent);
    expect(message).toContain('Kanban');
    expect(message).toContain('view');
  });

  it('should generate Korean message when lang is ko', () => {
    const intent: MatchedIntent = {
      type: 'view',
      confidence: 0.9,
      slots: { viewMode: 'kanban' },
      matchedPatterns: [],
    };
    const message = generateMessageFromIntent(intent, 'ko');
    expect(message).toContain('칸반');
    expect(message).toContain('뷰');
  });

  it('should generate message for table view', () => {
    const intent: MatchedIntent = {
      type: 'view',
      confidence: 0.9,
      slots: { viewMode: 'table' },
      matchedPatterns: [],
    };
    const message = generateMessageFromIntent(intent, 'en');
    expect(message).toContain('Table');
  });

  it('should generate message for filter', () => {
    const intent: MatchedIntent = {
      type: 'view',
      confidence: 0.9,
      slots: { dateFilter: { field: 'dueDate', type: 'today' } },
      matchedPatterns: [],
    };
    const message = generateMessageFromIntent(intent, 'en');
    expect(message).toContain('today');
  });

  it('should generate message for clear filter', () => {
    const intent: MatchedIntent = {
      type: 'view',
      confidence: 0.9,
      slots: { dateFilter: 'clear' },
      matchedPatterns: [],
    };
    const message = generateMessageFromIntent(intent, 'en');
    expect(message).toContain('Cleared');
  });

  it('should return default message for empty slots', () => {
    const intent: MatchedIntent = {
      type: 'none',
      confidence: 0,
      slots: {},
      matchedPatterns: [],
    };
    const message = generateMessageFromIntent(intent, 'en');
    expect(message).toBe('Done.');
  });
});

// ============================================
// convertToIntentAST
// ============================================

describe('convertToIntentAST', () => {
  it('should return null for low confidence', () => {
    const intent: MatchedIntent = {
      type: 'view',
      confidence: 0.5,
      slots: { viewMode: 'kanban' },
      matchedPatterns: [],
    };
    expect(convertToIntentAST(intent)).toBeNull();
  });

  it('should return null for "none" type', () => {
    const intent: MatchedIntent = {
      type: 'none',
      confidence: 0.9,
      slots: {},
      matchedPatterns: [],
    };
    expect(convertToIntentAST(intent)).toBeNull();
  });

  it('should convert viewMode to ChangeViewIntent', () => {
    const intent: MatchedIntent = {
      type: 'view',
      confidence: 0.9,
      slots: { viewMode: 'kanban' },
      matchedPatterns: [],
    };
    const ast = convertToIntentAST(intent);
    expect(ast?.kind).toBe('ChangeView');
    expect((ast as any).viewMode).toBe('kanban');
  });

  it('should convert dateFilter to SetDateFilterIntent', () => {
    const intent: MatchedIntent = {
      type: 'view',
      confidence: 0.9,
      slots: { dateFilter: { field: 'dueDate', type: 'today' } },
      matchedPatterns: [],
    };
    const ast = convertToIntentAST(intent);
    expect(ast?.kind).toBe('SetDateFilter');
    expect((ast as any).filter).toEqual({ field: 'dueDate', type: 'today' });
  });

  it('should convert "clear" filter to null', () => {
    const intent: MatchedIntent = {
      type: 'view',
      confidence: 0.9,
      slots: { dateFilter: 'clear' },
      matchedPatterns: [],
    };
    const ast = convertToIntentAST(intent);
    expect(ast?.kind).toBe('SetDateFilter');
    expect((ast as any).filter).toBeNull();
  });

  it('should include confidence and source in AST', () => {
    const intent: MatchedIntent = {
      type: 'view',
      confidence: 0.85,
      slots: { viewMode: 'table' },
      matchedPatterns: [],
    };
    const ast = convertToIntentAST(intent);
    expect(ast?.confidence).toBe(0.85);
    expect(ast?.source).toBe('human');
  });
});

// ============================================
// detectLanguage
// ============================================

describe('detectLanguage', () => {
  it('should detect Korean', () => {
    expect(detectLanguage('보고서 작성')).toBe('ko');
  });

  it('should detect English', () => {
    expect(detectLanguage('create report')).toBe('en');
  });

  it('should return "en" for mixed text with mostly English', () => {
    // detectLanguage checks for Korean characters
    expect(detectLanguage('hello world')).toBe('en');
  });

  it('should detect Korean for mixed text with Korean', () => {
    expect(detectLanguage('보고서 report 작성')).toBe('ko');
  });
});
