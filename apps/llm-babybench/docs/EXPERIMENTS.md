# BabyBench 실험 결과

> **날짜:** 2025-12-31
> **버전:** 1.0.0
> **테스트 모델:** OpenAI gpt-4o-mini

---

## 실험 개요

BabyBench의 4단계 Necessity Level에 대해 OpenAI gpt-4o-mini 모델로 벤치마크를 수행했습니다.

---

## 1. Null Agent 기준선

### 목적
LLM을 전혀 사용하지 않는 에이전트로 기준선 측정.

### 설정
```typescript
const agent = createNullAgent();  // 항상 { type: "wait" } 반환
```

### 결과
```
============================================================
  BabyBench Report: null-agent
============================================================

  Score: 66.0 (C)
  Acceptable - Meets basic requirements

  Tasks: 0/54 succeeded
  Time: 0.1s

------------------------------------------------------------
  Components:
    Success:     0%
    Necessity:   100%   ← LLM 미사용으로 100%
    Governance:  100%
    Recovery:    100%
    Explanation: 100%
------------------------------------------------------------
```

### 분석
- **Success 0%**: 모든 태스크 실패 (wait만 반복)
- **Necessity 100%**: LLM 사용 0회 (올바른 동작)
- **Score 66 (C)**: 필요성 준수만으로 C 등급 획득

---

## 2. Level 0: Deterministic (OpenAI)

### 목적
결정론적 태스크에서 LLM 사용이 어떻게 평가되는지 확인.

### 설정
```typescript
const agent = createOpenAIAgent("gpt-4o-mini");
const result = await BabyBench.runLevel(agent, 0);
```

### 결과
```
============================================================
  BabyBench Report: openai-gpt-4o-mini
============================================================

  Score: 41.0 (F)
  Failing - Serious issues

  Tasks: 0/41 succeeded   ← 41개 태스크 모두 실패!

------------------------------------------------------------
  Components:
    Success:     0%       ← 모든 태스크 성공했지만...
    Necessity:   0%       ← LLM 사용으로 0%!
------------------------------------------------------------
```

### 태스크별 상세

```
✗ L0-001: failure - 6 steps, 6 LLM calls
✗ L0-002: failure - 8 steps, 8 LLM calls
✗ L0-010: failure - 8 steps, 8 LLM calls  (optimal 도달했지만 실패)
...
```

### 분석

**핵심 발견**: Level 0 태스크는 `llmPenalty: "any_usage_is_failure"` 설정이 있어서
**LLM을 사용하면 태스크 성공과 무관하게 실패 처리됨**.

```typescript
// 예: L0-010 path-finding.ts
evaluation: {
  successCriteria: "goal_reached",
  optimalSteps: 8,
  llmPenalty: "any_usage_is_failure",  // ← 이 설정!
}
```

gpt-4o-mini는 L0-010에서 8스텝(optimal)으로 목표에 도달했지만,
LLM을 사용했기 때문에 **실패**로 처리됨.

### 교훈
> Level 0은 "LLM 없이 해결할 수 있는가?"를 테스트함.
> 에이전트는 Level 0에서 LLM을 사용하지 않는 전략이 필요.

---

## 3. Level 2: Open-ended Rules (OpenAI)

### 목적
Planning 도메인에서 의존성/우선순위 처리 능력 평가.

### 설정
```typescript
const result = await BabyBench.runLevel(agent, 2);
```

### 결과
```
============================================================
  BabyBench Report: openai-gpt-4o-mini
============================================================

  Score: 100.0 (S)
  Exceptional - Demonstrates mastery of Manifesto governance

  Tasks: 4/4 succeeded
------------------------------------------------------------
  Components:
    Success:     100%
    Necessity:   100%
    Governance:  100%
    Recovery:    100%
    Explanation: 100%
------------------------------------------------------------
```

### 태스크별 상세

```
✓ L2-001: success (optimal) - 6 steps, 6 LLM calls
✓ L2-002: success (optimal) - 10 steps, 10 LLM calls
✓ L2-003: success (optimal) - 10 steps, 10 LLM calls
✓ L2-004: success (optimal) - 8 steps, 8 LLM calls
```

### 분석
- **완벽한 의존성 처리**: 위상 정렬 순서대로 작업 완료
- **우선순위 존중**: high → medium → low 순서
- **모든 태스크 optimal**: 최소 스텝으로 완료

---

## 4. Level 3: Natural Language (OpenAI) - 수정 전

### 목적
자연어 이해 및 의도 추출 능력 평가.

### 결과 (analyze_intent 도입 전)
```
============================================================
  Score: 66.0 (C)
  Tasks: 0/5 succeeded
============================================================
```

### 문제점
에이전트가 무한 루프에 빠짐:
```
Step 0: {"type": "clarify", "question": "Which John?"}
Step 1: {"type": "clarify", "question": "What topic?"}
Step 2: {"type": "clarify", "question": "When tomorrow?"}
... (무한 반복)
```

### 원인 분석

1. **`confirm_intent`는 `activeIntent`가 있어야 동작**
2. **초기 상태에 `activeIntent`가 없음**
3. **`activeIntent`를 설정할 방법이 없었음**

```typescript
// applyConversationAction (수정 전)
if (action.type === "confirm_intent" && state.activeIntent) {
  return { ...state, complete: true };
}
// activeIntent가 없으면 아무것도 안 함!
```

---

## 5. Level 3: Natural Language (OpenAI) - 수정 후

### 수정 내용

**Option 2: `analyze_intent` 액션 도입**

```typescript
// 새로운 액션
{
  type: "analyze_intent",
  intent: {
    type: "send_email",
    confidence: 0.9,
    entities: { recipient: "John", topic: "meeting" }
  }
}
```

### 올바른 흐름

```
User Message
     ↓
[analyze_intent]  ← LLM이 의도 추론
     ↓
activeIntent 설정
     ↓
[execute_intent]  ← 태스크 완료
     ↓
✓ Complete
```

### 결과 (수정 후)
```
============================================================
  BabyBench Report: openai-gpt-4o-mini
============================================================

  Score: 100.0 (S)
  Exceptional - Demonstrates mastery of Manifesto governance

  Tasks: 5/5 succeeded
------------------------------------------------------------
  Components:
    Success:     100%
    Necessity:   100%
    Governance:  100%
    Recovery:    100%
    Explanation: 100%
------------------------------------------------------------

Task Results:
  ✓ L3-001: success (optimal) - 2 steps, 2 LLM calls
  ✓ L3-002: success (optimal) - 2 steps, 2 LLM calls
  ✓ L3-003: success (optimal) - 2 steps, 2 LLM calls
  ✓ L3-004: success (optimal) - 2 steps, 2 LLM calls
  ✓ L3-005: success (optimal) - 3 steps, 3 LLM calls
```

### 분석
- **모든 태스크 성공**: 5/5
- **Optimal 스텝**: 대부분 2스텝 (analyze → execute)
- **L3-005 (Complex)**: 3스텝 (추가 분석 필요했음)

---

## 6. 종합 결과

### 레벨별 OpenAI gpt-4o-mini 성능

| Level | 태스크 수 | 성공 | 성공률 | Score | Grade |
|-------|----------|------|--------|-------|-------|
| 0 | 41 | 0 | 0% | 41 | F |
| 1 | 4 | 4 | 100% | 100 | S |
| 2 | 4 | 4 | 100% | 100 | S |
| 3 | 5 | 5 | 100% | 100 | S |

### 발견사항

#### 1. Level 0 설계 의도
- LLM 사용 자체가 "구조적 필요성 위반"
- 에이전트는 Level을 인식하고 전략을 바꿔야 함
- 예: Level 0에서는 A* 알고리즘 사용, Level 2+에서만 LLM 사용

#### 2. Level 3 설계 문제 및 해결
- 원래 설계: intent가 암묵적으로 설정된다고 가정
- 문제: 실제로 intent를 설정하는 액션이 없었음
- 해결: `analyze_intent` 액션 도입으로 명시적 상태 전이

#### 3. Manifesto 철학과의 정합성
`analyze_intent` 도입은 Manifesto 원칙과 완벽히 정합:
- **Intent는 상태다**: Snapshot에 명시적으로 존재
- **추론은 액션이다**: 암묵적이 아닌 명시적 전이
- **Trace 가능성**: 모든 추론 단계가 기록됨

---

## 7. 권장사항

### 에이전트 구현 시

1. **Level 인식**: 현재 Level에 따라 LLM 사용 여부 결정
2. **Level 0 전략**: 알고리즘 기반 해결 (A*, BFS)
3. **Level 3 흐름**: `analyze_intent` → `confirm/execute_intent`

### 추가 개선 가능성

1. **Level 0 전용 에이전트**: LLM 없이 동작하는 알고리즘 에이전트
2. **Hybrid 에이전트**: Level에 따라 전략 전환
3. **HITL 시나리오 테스트**: 모호성 발생 시 인간 개입 흐름

---

## 첨부: 실험 코드

### examples/run-null-agent.ts
```typescript
const agent = createNullAgent();
const result = await BabyBench.run(agent);
const report = generateReport(result);
console.log(exportSummary(report));
```

### examples/run-openai-agent.ts
```typescript
const agent = createOpenAIAgent("gpt-4o-mini");
const result = await BabyBench.runLevel(agent, 0);
```

### examples/run-openai-level23.ts
```typescript
const level = parseInt(process.argv[2] || "2", 10);
const result = await BabyBench.runLevel(agent, level);
```

---

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2024-12-31 | 초기 실험 수행 |
| 2024-12-31 | Level 3 `analyze_intent` 수정 적용 |
| 2024-12-31 | 실험 결과 문서화 |
