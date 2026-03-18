# TaskFlow Edge Case Test Analysis

**Date**: 2025-12-13
**Test Suite**: Edge Case & Stress Test (60 tests)
**Pass Rate**: 70.0% (42/60)

## Summary

| Category | Pass Rate | Critical? |
|----------|-----------|-----------|
| Status Change Variations | 20% (1/5) | **Critical** |
| View & Filter Combinations | 33% (1/3) | High |
| Multi-Task Commands | 60% (3/5) | Medium |
| Error Cases & Edge Conditions | 60% (3/5) | Medium |
| Date/Time Expressions | 75% (6/8) | Medium |
| Priority Handling | 75% (3/4) | Low |
| Delete Operations | 75% (3/4) | Low |
| Language Mixing | 80% (4/5) | Low |
| Real-World Scenarios | 80% (4/5) | Low |
| Ambiguous Task References | 83% (5/6) | Low |
| Complex Queries | 83% (5/6) | Low |
| **Clarification Follow-ups** | **100% (4/4)** | ✅ |

---

## Root Cause Analysis

### 🔴 Issue 1: Fast Path Too Aggressive (Critical)

**Symptoms:**
- "이번 달 말까지 프로젝트 마무리" → `SetDateFilter` (should be `CreateTask`)
- "긴급한 보고서 작성 오늘까지" → `SetDateFilter` (should be `CreateTask`)
- "테이블로 보여주고 오늘 마감만" → `ChangeView` (ignored date filter part)

**Root Cause:**
Pattern matcher matches date keywords (`today`, `this month`) without considering the intent context. When a user says "add task due today", the "today" keyword triggers `SetDateFilter` instead of being recognized as a due date for task creation.

**Evidence from logs:**
```
Input: "긴급한 보고서 작성 오늘까지"
Translation: "Urgent report writing due today"
→ fastpath:hit → SetDateFilter (matched "today")
```

**Solution Options:**
1. **Action word priority**: Check for action verbs (추가, add, create, 작성, 마무리) before pattern matching date filters
2. **Context-aware matching**: If the sentence structure suggests task creation (verb + noun + time), skip fast path
3. **Negative patterns**: Add patterns to exclude from fast path (e.g., "due today", "by tomorrow")

---

### 🔴 Issue 2: Status Change Not Extracting Status Field (Critical)

**Symptoms:**
- "보고서 끝났어" → `UpdateTask` but `status: undefined`
- "Move report to done" → `RequestClarification` (only one report exists)

**Root Cause:**
1. Intent Compiler generates `UpdateTask` but doesn't include `status` field in updates
2. Even when there's only one matching task, it asks for clarification

**Evidence from logs:**
```
Input: "Move report to done"
→ RequestClarification (reason: "which_task", candidates: ["t4"])
Question: "Which report would you like to move to done?"
```
Note: There's only ONE report task (t4: 보고서 작성), so clarification is unnecessary.

**Solution Options:**
1. **Prompt enhancement**: Add explicit examples of status changes in the Intent Compiler prompt
2. **Single match auto-resolve**: If candidates.length === 1, auto-select instead of asking

---

### 🟡 Issue 3: Partial Task Name Matching (Medium)

**Symptoms:**
- "API 태스크 시작" → `RequestClarification` (should match "API 엔드포인트 구현")
- "API 이제 시작할게" → `RequestClarification` (LLM doesn't find the task)

**Root Cause:**
The LLM doesn't recognize "API" as referring to "API 엔드포인트 구현". The translation loses the connection: "Start API now" doesn't clearly reference any specific task.

**Evidence:**
```
Input: "API 이제 시작할게"
Translation: "Start API now"
→ RequestClarification (reason: "ambiguous_action")
```

**Solution Options:**
1. **Fuzzy matching guidance**: Add examples in prompt showing partial name matching
2. **Pre-processing**: Before compilation, match partial names to full task titles

---

### 🟡 Issue 4: Compound Commands Not Supported (Medium)

**Symptoms:**
- "테이블로 보여주고 오늘 마감만" → Only `ChangeView` (missed `SetDateFilter`)
- "새 태스크 추가하고 테이블로 보여줘" → `ChangeView` (missed `CreateTask`)

**Root Cause:**
The system processes one intent per command. When a user issues compound commands (A + B), only one is processed.

**Possible Solutions:**
1. **Intent splitting**: Detect "and/그리고" patterns and process sequentially
2. **Document limitation**: Accept this as a system constraint (one intent per turn)
3. **Composite intents**: Create a `CompositeIntent` type that bundles multiple operations

---

### 🟢 Issue 5: Edge Cases (Low Priority)

**Empty input:** Returns error (acceptable, but could be more graceful)

**Long input:**
```
Input: "아주 긴 태스크 제목을 가진 새로운 작업..."
→ RequestClarification (LLM confused by verbosity)
```

**Korean slang:**
```
Input: "ㅇㅋ 회의 잡아줘"
Translation: "Schedule a meeting"
→ RequestClarification (should be CreateTask)
```

---

## Recommended Fixes (Priority Order)

### P0: Fast Path Context Awareness
**File:** `pattern-matcher.ts`

Add action word detection before date filter matching:
```typescript
const CREATE_ACTION_PATTERNS = [
  /\b(add|create|make|write|finish|complete)\b/i,
  /추가|작성|마무리|생성|만들/
];

function shouldSkipFastPath(instruction: string): boolean {
  // If instruction contains create-like action + date, skip fast path
  const hasCreateAction = hasAnyMatch(instruction, CREATE_ACTION_PATTERNS);
  const hasDateKeyword = matchPatterns(instruction, DATE_FILTER_PATTERNS);
  return hasCreateAction && hasDateKeyword;
}
```

### P1: Single Candidate Auto-Resolution
**File:** `intent-compiler.ts`

When only one candidate matches, auto-resolve instead of asking:
```typescript
if (candidates.length === 1) {
  return createUpdateTaskIntent(candidates[0], partialUnderstanding);
}
```

### P2: Status Field Extraction
**File:** `prompts/intent-compiler.ts`

Add explicit status change examples:
```
User: "보고서 끝났어" (The report is done)
→ { kind: "UpdateTask", taskId: "t4", updates: [{ field: "status", value: "done" }] }

User: "Move report to done"
→ { kind: "UpdateTask", taskId: "t4", updates: [{ field: "status", value: "done" }] }
```

### P3: Partial Name Matching Examples
Add guidance for partial name matching in prompt.

---

## Test Categories Status

| Status | Category | Notes |
|--------|----------|-------|
| ✅ | Clarification Follow-ups | 100% - Working well |
| ⚠️ | Complex Queries | 83% - Minor issues |
| ⚠️ | Ambiguous Task References | 83% - Working reasonably |
| ⚠️ | Real-World Scenarios | 80% - Acceptable |
| ⚠️ | Language Mixing | 80% - Acceptable |
| ⚠️ | Delete Operations | 75% - Minor issues |
| ⚠️ | Date/Time Expressions | 75% - Fast path issue |
| ⚠️ | Priority Handling | 75% - Minor issues |
| 🔶 | Multi-Task Commands | 60% - Known limitation |
| 🔶 | Error Cases | 60% - Edge cases |
| 🔴 | View & Filter Combinations | 33% - Compound commands |
| 🔴 | Status Change Variations | 20% - Critical fix needed |

---

## Next Steps

1. **Immediate**: Fix fast path to not match date filters when task creation is intended
2. **Short-term**: Improve Intent Compiler prompt for status changes
3. **Medium-term**: Implement single-candidate auto-resolution
4. **Consider**: Document compound command limitation or implement intent splitting
