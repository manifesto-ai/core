/**
 * Pattern Matcher
 *
 * Deterministic pattern matching for common operations.
 * Provides hints to Intent Compiler for better decision making.
 *
 * Architecture: Fast Path는 힌트만 제공, Intent 결정은 항상 Compiler가 담당
 * - 키워드 기반 패턴 매칭으로 가능성 높은 Intent 유형 제안
 * - 태스크 생성 키워드 감지 시 힌트 제공 안 함 (Compiler가 전체 컨텍스트로 판단)
 */

import type { Task } from '@/manifesto';
import type {
  AgentEffect,
  PatchOp,
  ViewMode,
  DateFilter,
} from './types';
import { generateEffectId } from './types';
import { SCHEMA_VERSION } from './prompts/schema';
import type {
  Intent,
  ChangeViewIntent,
  SetDateFilterIntent,
  SelectTaskIntent,
} from './intent';
import { detectLanguage as detectLang } from './language-detector';

/**
 * Matched intent from pattern matching
 */
export interface MatchedIntent {
  type: 'view' | 'mutate' | 'none';
  confidence: number;
  slots: {
    viewMode?: ViewMode;
    dateFilter?: DateFilter | 'clear';
    status?: 'todo' | 'in-progress' | 'review' | 'done';
    taskRef?: string;
    selectedTaskId?: string | 'clear';
  };
  matchedPatterns: string[];
}

/**
 * Pattern definition with regex and value mapping
 */
interface Pattern<T> {
  regex: RegExp;
  value: T;
  name: string;
}

// ============================================
// View Mode Patterns
// ============================================

// NOTE: All patterns are in English only.
// Non-English input is translated to English by the translator layer before reaching here.
const VIEW_MODE_PATTERNS: Pattern<ViewMode>[] = [
  // Kanban patterns
  { regex: /\bkanban\b|\bboard\b|\bcolumns?\b|\bgrid\b/i, value: 'kanban', name: 'kanban' },
  // Table patterns - use word boundary to avoid matching "tomorrow" (contains "row")
  { regex: /\btable\b|\blist\s*view\b|\brows?\s*view\b/i, value: 'table', name: 'table' },
  // Todo patterns - "todo list" should match todo, not table
  { regex: /\btodo\s*list\b|\bto-do\s*list\b|\btodo\b|\bchecklist\b|\bsimple\s*list\b/i, value: 'todo', name: 'todo' },
];

// ============================================
// Date Filter Patterns
// ============================================

// NOTE: English only - non-English input is translated before reaching here
const DATE_FILTER_PATTERNS: Pattern<DateFilter | 'clear'>[] = [
  // Today
  {
    regex: /\btoday\b|\bdue\s*today\b|\btoday'?s?\s*tasks?\b/i,
    value: { field: 'dueDate', type: 'today' },
    name: 'today',
  },
  // This week
  {
    regex: /\bthis\s*week\b|\bdue\s*this\s*week\b|\bweekly\b/i,
    value: { field: 'dueDate', type: 'week' },
    name: 'week',
  },
  // This month
  {
    regex: /\bthis\s*month\b|\bdue\s*this\s*month\b|\bmonthly\b/i,
    value: { field: 'dueDate', type: 'month' },
    name: 'month',
  },
  // Clear filter
  {
    regex: /\ball\s*tasks?\b|\bclear\s*filter\b|\bshow\s*all\b|\bremove\s*filter\b/i,
    value: 'clear',
    name: 'clear-filter',
  },
];

// ============================================
// Status Change Patterns
// ============================================

// NOTE: English only - non-English input is translated before reaching here
const STATUS_PATTERNS: Pattern<'todo' | 'in-progress' | 'review' | 'done'>[] = [
  // Done
  {
    regex: /\bdone\b|\bcomplete\b|\bfinish\b|\bcompleted\b|\bfinished\b/i,
    value: 'done',
    name: 'done',
  },
  // In Progress
  {
    regex: /\bin\s*progress\b|\bprogress\b|\bstart\b|\bworking\b|\bstarted\b/i,
    value: 'in-progress',
    name: 'in-progress',
  },
  // Review
  {
    regex: /\breview\b|\breviewing\b|\bpending\s*review\b/i,
    value: 'review',
    name: 'review',
  },
  // Todo
  {
    regex: /\btodo\b|\breopen\b|\breopened\b|\bpending\b/i,
    value: 'todo',
    name: 'todo',
  },
];

// ============================================
// Action Patterns (to detect intent type)
// ============================================

// NOTE: English only - non-English input is translated before reaching here
const VIEW_ACTION_PATTERNS = [
  /\bshow\b|\bswitch\b|\bchange\s*to\b|\bview\b|\bfilter\b/i,
  /\bopen\b|\bselect\b|\bdisplay\b/i,
];

// NOTE: English only
const MUTATE_ACTION_PATTERNS = [
  /\bmark\b|\bchange\s*status\b|\bmove\s*to\b|\bset\s*to\b/i,
  /\bdone\b|\bcomplete\b|\bfinish\b/i,
];

// Question patterns - should NOT trigger fast path (needs LLM for QueryTasks)
// NOTE: English only - Korean questions are translated to English first
const QUESTION_PATTERNS = [
  /\?$/,                           // Ends with ?
  /^what\s/i,                      // What...
  /^how\s*(many|much|do|can|should)/i, // How many/much/do/can/should...
  /^which\s/i,                     // Which...
  /^when\s/i,                      // When...
  /^where\s/i,                     // Where...
  /^tell\s*me\b/i,                 // Tell me...
  /^summarize\b/i,                 // Summarize...
];

// ============================================
// Task Creation Patterns (to skip fast path)
// ============================================

// When these patterns are detected, fast path should NOT provide hints
// because the user likely wants to CREATE a task, not filter/view
// NOTE: English only - non-English input is translated before reaching here
const CREATE_ACTION_PATTERNS = [
  // "add/create X by/until/due today" - task creation with deadline
  /\b(add|create|make|write|new)\b.*\b(task|todo|item)?\b.*\b(by|until|due|before)\b/i,
  // "task X due today" - implicit creation
  /\b(task|todo)\b.*\b(due|by|until)\b/i,
  // "finish/complete X by today" - creating a task to finish
  /\b(finish|complete)\b.*\b(by|until|due|before)\b/i,
  // "X by end of week/month" - deadline implies creation
  /\bby\s*(end\s*of|the\s*end)\b/i,
  // "urgent X" or "X urgent" - likely task creation
  /\burgent\b.*\b(task|todo|report|document|work)/i,
  // Direct creation keywords
  /^add\s+/i,
  /^create\s+/i,
  /^new\s+task/i,
];

/**
 * Check if instruction contains task creation keywords
 * If so, fast path should NOT provide hints (let Compiler decide)
 */
function hasCreateActionKeywords(instruction: string): boolean {
  const normalized = instruction.toLowerCase().trim();
  return CREATE_ACTION_PATTERNS.some(p => p.test(normalized));
}

// ============================================
// Pattern Matching Functions
// ============================================

function matchPatterns<T>(text: string, patterns: Pattern<T>[]): { value: T; name: string } | null {
  for (const pattern of patterns) {
    if (pattern.regex.test(text)) {
      return { value: pattern.value, name: pattern.name };
    }
  }
  return null;
}

function hasAnyMatch(text: string, patterns: RegExp[]): boolean {
  return patterns.some(p => p.test(text));
}

/**
 * Match patterns against user instruction
 *
 * @param instruction - User's natural language instruction
 * @returns Matched intent with confidence score
 */
export function matchIntent(instruction: string): MatchedIntent {
  const result: MatchedIntent = {
    type: 'none',
    confidence: 0,
    slots: {},
    matchedPatterns: [],
  };

  const normalized = instruction.toLowerCase().trim();

  // Check for questions - should NOT use fast path (needs LLM for QueryTasks)
  const isQuestion = hasAnyMatch(normalized, QUESTION_PATTERNS);
  if (isQuestion) {
    // Return no match for questions - let LLM handle them
    return result;
  }

  // Check for view actions
  const isViewAction = hasAnyMatch(normalized, VIEW_ACTION_PATTERNS);

  // Check for mutate actions
  const isMutateAction = hasAnyMatch(normalized, MUTATE_ACTION_PATTERNS);

  // Match view mode
  const viewModeMatch = matchPatterns(normalized, VIEW_MODE_PATTERNS);
  if (viewModeMatch) {
    result.slots.viewMode = viewModeMatch.value;
    result.matchedPatterns.push(`viewMode:${viewModeMatch.name}`);
  }

  // Match date filter
  const dateFilterMatch = matchPatterns(normalized, DATE_FILTER_PATTERNS);
  if (dateFilterMatch) {
    result.slots.dateFilter = dateFilterMatch.value;
    result.matchedPatterns.push(`dateFilter:${dateFilterMatch.name}`);
  }

  // Match status (for mutations)
  const statusMatch = matchPatterns(normalized, STATUS_PATTERNS);
  if (statusMatch) {
    result.slots.status = statusMatch.value;
    result.matchedPatterns.push(`status:${statusMatch.name}`);
  }

  // Determine intent type and confidence
  if (result.matchedPatterns.length > 0) {
    if (viewModeMatch || dateFilterMatch) {
      result.type = 'view';
      // Higher confidence for explicit view commands
      result.confidence = isViewAction ? 0.9 : 0.7;
    } else if (statusMatch && isMutateAction) {
      result.type = 'mutate';
      result.confidence = 0.6; // Lower because we need task reference
    }
  }

  return result;
}

/**
 * Generate effects from matched intent (for view changes only)
 *
 * @param intent - The matched intent
 * @returns Array of effects to apply, or null if not applicable
 */
export function generateEffectsFromIntent(intent: MatchedIntent): AgentEffect[] | null {
  // Only handle high-confidence view changes for now
  if (intent.type !== 'view' || intent.confidence < 0.7) {
    return null;
  }

  const ops: PatchOp[] = [];

  // View mode change
  if (intent.slots.viewMode) {
    ops.push({
      op: 'set',
      path: 'state.viewMode',
      value: intent.slots.viewMode,
    });
  }

  // Date filter change
  if (intent.slots.dateFilter !== undefined) {
    ops.push({
      op: 'set',
      path: 'state.dateFilter',
      value: intent.slots.dateFilter === 'clear' ? null : intent.slots.dateFilter,
    });
  }

  // Task selection
  if (intent.slots.selectedTaskId !== undefined) {
    ops.push({
      op: 'set',
      path: 'state.selectedTaskId',
      value: intent.slots.selectedTaskId === 'clear' ? null : intent.slots.selectedTaskId,
    });
  }

  if (ops.length === 0) {
    return null;
  }

  return [{
    type: 'snapshot.patch',
    id: generateEffectId(),
    ops,
  }];
}

/**
 * Generate a human-readable message for the intent
 */
export function generateMessageFromIntent(intent: MatchedIntent, lang: 'ko' | 'en' = 'en'): string {
  const parts: string[] = [];

  if (intent.slots.viewMode) {
    const viewModeNames = {
      kanban: lang === 'ko' ? '칸반' : 'Kanban',
      table: lang === 'ko' ? '테이블' : 'Table',
      todo: lang === 'ko' ? '투두' : 'Todo',
    };
    parts.push(
      lang === 'ko'
        ? `${viewModeNames[intent.slots.viewMode]} 뷰로 전환했습니다.`
        : `Switched to ${viewModeNames[intent.slots.viewMode]} view.`
    );
  }

  if (intent.slots.dateFilter) {
    if (intent.slots.dateFilter === 'clear') {
      parts.push(
        lang === 'ko'
          ? '필터를 해제했습니다.'
          : 'Cleared filters.'
      );
    } else {
      const filterTypeNames = {
        today: lang === 'ko' ? '오늘' : 'today',
        week: lang === 'ko' ? '이번 주' : 'this week',
        month: lang === 'ko' ? '이번 달' : 'this month',
        custom: lang === 'ko' ? '사용자 지정' : 'custom',
      };
      parts.push(
        lang === 'ko'
          ? `${filterTypeNames[intent.slots.dateFilter.type]} 마감 태스크를 필터링합니다.`
          : `Showing tasks due ${filterTypeNames[intent.slots.dateFilter.type]}.`
      );
    }
  }

  return parts.join(' ') || (lang === 'ko' ? '완료되었습니다.' : 'Done.');
}

// Re-export detectLanguage from language-detector for backwards compatibility
export { detectLanguage } from './language-detector';

/**
 * Fast path hint for Intent Compiler
 * Fast Path는 힌트만 제공, 최종 Intent 결정은 Compiler가 담당
 */
export interface FastPathHint {
  likelyKind: 'view' | 'filter' | 'status';
  confidence: number;
  matchedPatterns: string[];
  slots: {
    viewMode?: ViewMode;
    dateFilter?: DateFilter | 'clear';
    status?: 'todo' | 'in-progress' | 'review' | 'done';
  };
}

/**
 * Fast path result
 * hit=true면 힌트를 Compiler에 전달, hit=false면 Compiler가 자체 판단
 */
export interface FastPathResult {
  hit: boolean;
  hint?: FastPathHint;
  schemaVersion: string;
  // Legacy fields for backwards compatibility during transition
  /** @deprecated Fast Path no longer generates effects directly */
  effects?: AgentEffect[];
  /** @deprecated Fast Path no longer generates messages directly */
  message?: string;
  /** @deprecated Use hint instead */
  intent?: MatchedIntent;
  /** @deprecated Fast Path no longer generates Intent AST directly */
  intentAST?: Intent;
}

// ============================================
// MatchedIntent → Intent Conversion
// ============================================

/**
 * MatchedIntent를 ADR Intent AST로 변환
 */
export function convertToIntentAST(matched: MatchedIntent): Intent | null {
  if (matched.type === 'none' || matched.confidence < 0.7) {
    return null;
  }

  // ChangeView Intent
  if (matched.slots.viewMode) {
    const intent: ChangeViewIntent = {
      kind: 'ChangeView',
      viewMode: matched.slots.viewMode,
      confidence: matched.confidence,
      source: 'human',
    };
    return intent;
  }

  // SetDateFilter Intent
  if (matched.slots.dateFilter !== undefined) {
    const filter = matched.slots.dateFilter === 'clear'
      ? null
      : { field: matched.slots.dateFilter.field, type: matched.slots.dateFilter.type };

    const intent: SetDateFilterIntent = {
      kind: 'SetDateFilter',
      filter,
      confidence: matched.confidence,
      source: 'human',
    };
    return intent;
  }

  // SelectTask Intent
  if (matched.slots.selectedTaskId !== undefined) {
    const intent: SelectTaskIntent = {
      kind: 'SelectTask',
      taskId: matched.slots.selectedTaskId === 'clear' ? null : matched.slots.selectedTaskId,
      confidence: matched.confidence,
      source: 'human',
    };
    return intent;
  }

  return null;
}

/**
 * Try fast path for an instruction
 *
 * Architecture Change: Fast Path는 이제 힌트만 제공
 * - Intent 결정권은 항상 Compiler에게 있음
 * - 태스크 생성 키워드 감지 시 힌트도 제공 안 함
 *
 * @param instruction - User's instruction
 * @returns FastPathResult with hint if matched, or hit=false if not
 */
export function tryFastPath(instruction: string): FastPathResult {
  // 1. 태스크 생성 키워드가 있으면 힌트 제공 안 함
  // (예: "보고서 작성 오늘까지" → Compiler가 CreateTask로 판단해야 함)
  if (hasCreateActionKeywords(instruction)) {
    return {
      hit: false,
      schemaVersion: SCHEMA_VERSION,
    };
  }

  // 2. 패턴 매칭
  const matched = matchIntent(instruction);

  // 3. 낮은 confidence면 힌트 제공 안 함
  if (matched.type === 'none' || matched.confidence < 0.8) {
    return {
      hit: false,
      schemaVersion: SCHEMA_VERSION,
    };
  }

  // 4. 힌트만 반환 (Intent 결정은 Compiler가)
  const hint: FastPathHint = {
    likelyKind: matched.type === 'view'
      ? (matched.slots.viewMode ? 'view' : 'filter')
      : 'status',
    confidence: matched.confidence,
    matchedPatterns: matched.matchedPatterns,
    slots: {
      viewMode: matched.slots.viewMode,
      dateFilter: matched.slots.dateFilter,
      status: matched.slots.status,
    },
  };

  return {
    hit: true,
    hint,
    schemaVersion: SCHEMA_VERSION,
  };
}

/**
 * @deprecated Use tryFastPath with hint-based flow instead
 * Legacy function for backwards compatibility during transition
 */
export function tryFastPathLegacy(instruction: string): FastPathResult {
  const matched = matchIntent(instruction);

  if (matched.type === 'none' || matched.confidence < 0.7) {
    return {
      hit: false,
      schemaVersion: SCHEMA_VERSION,
    };
  }

  const effects = generateEffectsFromIntent(matched);

  if (!effects) {
    return {
      hit: false,
      schemaVersion: SCHEMA_VERSION,
    };
  }

  const lang = detectLang(instruction);
  const message = generateMessageFromIntent(matched, lang);
  const intentAST = convertToIntentAST(matched);

  return {
    hit: true,
    effects,
    message,
    intent: matched,
    intentAST: intentAST ?? undefined,
    schemaVersion: SCHEMA_VERSION,
  };
}
