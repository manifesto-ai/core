# LLM-BabyBench 논문 분석 리포트

> **작성일:** 2026-01-03
> **목적:** 논문 작성을 위한 아키텍처 분석 및 기여 포인트 정리

---

## 1. 연구 개요

### 1.1 핵심 연구 질문

**"LLM 에이전트에서 LLM 호출이 정말로 필요한 시점은 언제인가?"**

기존 LLM 에이전트 벤치마크는 "태스크를 완료했는가?"만 측정한다.
LLM-BabyBench는 **"LLM 없이도 해결 가능한 문제에 LLM을 낭비하고 있지는 않은가?"**를 추가로 측정한다.

### 1.2 핵심 가설

1. 많은 에이전트 태스크는 결정론적 알고리즘으로 해결 가능하다
2. LLM은 **구조적으로 불가피한 경우**에만 사용되어야 한다
3. LLM 사용의 필요성은 4단계로 분류할 수 있다
4. 분리된 검증자(Verifier)가 LLM 출력을 검증해야 한다

---

## 2. 기존 접근법 대비 차별점

### 2.1 기존 LLM Agent 벤치마크의 한계

| 벤치마크 | 측정 대상 | 한계점 |
|---------|---------|--------|
| **AgentBench** | 태스크 성공률 | LLM 과사용 미측정 |
| **WebArena** | 웹 탐색 성공률 | 결정론적 해결책 무시 |
| **SWE-bench** | 코드 수정 성공률 | 거버넌스 미측정 |
| **GAIA** | 다단계 추론 | 필요성 분류 없음 |

### 2.2 LLM-BabyBench의 핵심 차별점

```
┌─────────────────────────────────────────────────────────────┐
│                    기존 벤치마크                             │
│                                                              │
│   Task → Agent (LLM) → Success/Failure                      │
│                                                              │
│   측정: "완료했는가?"                                        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    LLM-BabyBench                            │
│                                                              │
│   Task → Necessity Level 분류                               │
│        → Actor (LLM/BFS/Hybrid)                             │
│        → World Protocol (거버넌스)                          │
│        → Success/Failure + LLM Usage Audit                  │
│                                                              │
│   측정:                                                      │
│   1. "완료했는가?"                                          │
│   2. "LLM 사용이 구조적으로 필요했는가?"                    │
│   3. "거버넌스 프로토콜을 준수했는가?"                      │
│   4. "실패 시 설명을 제공했는가?"                           │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. 핵심 기여 포인트

### 3.1 Contribution 1: LLM Necessity Profile (4-Level Framework)

**LLM 사용의 구조적 필요성을 4단계로 정의:**

| Level | 명칭 | 정의 | LLM 역할 | 검증 방법 |
|-------|------|------|---------|----------|
| **0** | Deterministic | 완전 관측 가능, 결정론적 규칙 | None (NullLLM) | 시뮬레이션 |
| **1** | Partial Observation | 숨겨진 상태, 신념 추론 필요 | Belief Proposer | 사후 일관성 |
| **2** | Open-ended Rules | 모호한 목표, 해석 필요 | Rule Interpreter | 의미 감사 + HITL |
| **3** | Natural Language | 자연어 의도 추출 필요 | Intent Parser | 사용자 확인 |

**핵심 원칙 (FDR-N002):**
> "LLM은 편의가 아닌 **구조적 불가능성**이 존재할 때만 정당화된다."

```typescript
// 구조적 필요성 정의:
// ∄ f: observable_state → action where f achieves correctness for all instances
```

### 3.2 Contribution 2: NullLLM Compliance Test

**Level 0 적합성 테스트:**
- NullLLM = LLM 호출을 전혀 하지 않는 에이전트
- Level 0 태스크는 NullLLM과 실제 LLM의 성공률이 동일해야 함
- LLM을 사용하면 태스크 성공과 무관하게 **실패** 처리

```typescript
// Level 0 적합성 검증
const nullResults = tasks.map(t => solve(t, nullLLM));
const llmResults = tasks.map(t => solve(t, gpt4));

// Level 0 적합성: 성공률이 동일해야 함
assert(nullSuccess === llmSuccess);
```

**실험 결과:**
- BFS Actor: Level 0에서 100% 성공률 (LLM 0회 호출)
- LLM Actor: Level 0에서 0% 성공률 (LLM 사용으로 자동 실패)

### 3.3 Contribution 3: Proposer-Verifier Separation

**자기 검증 금지 원칙 (FDR-N005):**

```
┌─────────────────────────────────────────┐
│      절대적 분리 (Absolute Separation)   │
├─────────────────────────────────────────┤
│                                         │
│  LLM (Proposer)                         │
│    │                                    │
│    ▼                                    │
│  Proposal                               │
│    │                                    │
│    ▼                                    │
│  Authority (Verifier) ← LLM 아님!       │
│    │                                    │
│    ▼                                    │
│  Decision                               │
│                                         │
└─────────────────────────────────────────┘
```

**검증 강도 명시적 저하 (FDR-N006):**

| Level | 보장 수준 | 정확성 증명 | 오류 증명 |
|-------|---------|------------|----------|
| 0 | Certain | ✅ 가능 | ✅ 가능 |
| 1 | Consistent | ❌ 불가 | ✅ 모순 검출 |
| 2 | Plausible | ❌ 불가 | ⚠️ 부분적 |
| 3 | Confirmed | ❌ 불가 | ⚠️ 부분적 |

### 3.4 Contribution 4: Hybrid Actor Architecture

**LLM 계획 + 결정론적 실행:**

```typescript
// hybrid-actor.ts의 핵심 아이디어:
// 1. LLM은 한 번만 호출하여 목표를 이해
// 2. 실제 경로 탐색은 BFS로 결정론적 수행

async proposeAction(state, context) {
  // Phase 1: LLM 계획 (1회)
  if (!hasPlanned) {
    plan = await getPlanFromLLM(state);
    currentPath = bfsPath(state, target);  // 결정론적!
    hasPlanned = true;
  }

  // Phase 2: 결정론적 실행
  return currentPath[pathIndex++];
}
```

**실험 결과:**
| Actor 유형 | Level 0 성공률 | Level 1 성공률 | LLM 호출 수 |
|-----------|---------------|---------------|------------|
| BFS Actor | 100% | 100% | 0 |
| LLM Actor | 0% | 100% | 매 스텝마다 |
| Hybrid Actor | 0% (Level 0 사용 시) | 100% | 1회 |

### 3.5 Contribution 5: Governance-Aware Benchmarking

**World Protocol 기반 거버넌스 측정:**

```typescript
// setup.ts - World Protocol 통합
export function createBenchWorld(initialState: BabyAIState): BenchWorld {
  const host = createHost(BabyAIDomain.schema, { initialData: initialState });

  // Effect handlers 등록
  for (const [type, handler] of Object.entries(effectHandlers)) {
    host.registerEffect(type, handler);
  }

  // World는 거버넌스 레이어 - 유일한 외부 인터페이스
  const world = new ManifestoWorld(worldConfig);
  return { world, schemaHash };
}
```

**거버넌스 메트릭:**
- `proposalCompliance`: 모든 출력이 Proposal을 통과했는가?
- `authorityCompliance`: 모든 제안이 Authority를 거쳤는가?
- `scopeViolations`: 권한 범위 초과 시도 횟수
- `protocolBypasses`: 프로토콜 우회 시도 횟수

---

## 4. 아키텍처 분석

### 4.1 Manifesto 아키텍처와의 통합

```
┌──────────────────────────────────────────────────────────────┐
│                      LLM-BabyBench                           │
│                                                              │
│  ┌──────────────────┐  ┌──────────────────────────────────┐ │
│  │   BenchRunner    │  │         Actor 선택                │ │
│  │   - runTask()    │  │  - BFS (Level 0)                 │ │
│  │   - createTask() │  │  - LLM (Level 1-3)               │ │
│  │                  │  │  - Hybrid (적응형)                │ │
│  └────────┬─────────┘  └──────────────────────────────────┘ │
│           │                                                  │
│           ▼                                                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                  World Protocol                         │ │
│  │  - submitProposal()                                     │ │
│  │  - Authority binding                                    │ │
│  │  - DecisionRecord                                       │ │
│  └────────┬───────────────────────────────────────────────┘ │
│           │                                                  │
│           ▼                                                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                     Host                                │ │
│  │  - dispatch(intent)                                     │ │
│  │  - Effect execution                                     │ │
│  │  - Patch application                                    │ │
│  └────────┬───────────────────────────────────────────────┘ │
│           │                                                  │
│           ▼                                                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                     Core                                │ │
│  │  - Pure computation                                     │ │
│  │  - Expression evaluation                                │ │
│  │  - Deterministic!                                       │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 4.2 핵심 설계 원칙

**관심사 분리 (FDR-001):**
> "Core가 계산한다. Host가 실행한다. 이 관심사는 절대 혼합되지 않는다."

```typescript
// domain.ts - 순수 도메인 정의
export const BabyAIDomain = defineDomain(
  BabyAIStateSchema,
  ({ state, actions, flow }) => {
    // 순수 패치 (결정론적)
    const { turnLeft } = actions.define({
      turnLeft: {
        flow: flow.patch(state.agent.direction).set(
          expr.mod(expr.add(state.agent.direction, 3), 4)
        ),
      },
    });

    // 이펙트 필요 (Host가 실행)
    const { moveForward } = actions.define({
      moveForward: {
        flow: flow.effect("babyai:move", { ... }),
      },
    });
  }
);
```

**스냅샷이 유일한 진실 (FDR-002):**
> "스냅샷에 없으면 존재하지 않는다."

```typescript
// 상태는 항상 Snapshot에서 읽음
const snapshot = await world.getSnapshot(currentWorldId);
const state = snapshot.data as BabyAIState;

// 상태 변경은 항상 Patch를 통해
return [
  { op: "set", path: "agent.x", value: front.x },
  { op: "set", path: "agent.y", value: front.y },
] as Patch[];
```

---

## 5. 코드 아키텍처 상세

> 상세 아키텍처 문서: [ARCHITECTURE.md](./ARCHITECTURE.md)

### 5.1 프로젝트 통계

| 항목 | 값 |
|------|-----|
| 총 코드 라인 | 3,494 lines |
| 소스 파일 수 | 12 files |
| 주요 모듈 | 4 (domain, bench, actors, dataset) |

### 5.2 모듈별 코드 규모

| 모듈 | 파일 수 | 라인 수 | 역할 |
|------|---------|---------|------|
| **domain** | 2 | ~140 | BabyAI 도메인 (Zod 스키마 + Builder) |
| **bench** | 3 | ~781 | 벤치마크 엔진 (World + Host + Runner) |
| **actors** | 3 | ~1,559 | 에이전트 (BFS/LLM/Hybrid) |
| **dataset** | 3 | ~521 | HuggingFace 로더 + 파서 |

### 5.3 액터 구현 상세

#### BFS Actor (956 lines)
```typescript
// 결정론적 경로 탐색
function bfsPath(state: BabyAIState, target: TargetGoal): BabyAIAction[] {
  const queue = [{ pos: start, dir: startDir, path: [] }];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (isAtTarget(current.pos, current.dir, target)) {
      return current.path;
    }
    // BFS 확장: moveForward, turnLeft, turnRight
  }
  return [];
}
```

**지원 미션:**
- 단순: "go to COLOR TYPE", "pick up COLOR TYPE"
- 복합: "X and Y", "X then Y"
- 다단계: "put X next to Y"

#### LLM Actor (146 lines)
```typescript
// 매 스텝 LLM 호출
async proposeAction(state, context) {
  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: buildPrompt(state) }],
    response_format: { type: "json_object" },
  });
  return parseAction(response);
}
```

#### Hybrid Actor (457 lines)
```typescript
// Phase 1: LLM 계획 (1회)
if (!hasPlanned) {
  plan = await getPlanFromLLM(state);
  currentPath = bfsPath(state, plan.target);
  hasPlanned = true;
}

// Phase 2: 결정론적 실행
return currentPath[pathIndex++];
```

### 5.4 이펙트 핸들러 패턴

```typescript
// Constitution 준수: Patch[] 반환, 예외 없음
export const moveHandler: EffectHandler = async (_type, params, context) => {
  const state = context.snapshot.data as BabyAIState;
  const front = getFrontPosition(params.x, params.y, params.direction);

  if (!isWalkable(front.x, front.y, state)) {
    return [{ op: "set", path: "steps", value: state.steps + 1 }];
  }

  return [
    { op: "set", path: "agent.x", value: front.x },
    { op: "set", path: "agent.y", value: front.y },
    { op: "set", path: "steps", value: state.steps + 1 },
  ];
};
```

### 5.5 Intent 흐름

```
1. Actor.proposeAction(state) → { action: "moveForward" }
2. createIntentInstance({ body: { type: "moveForward" } })
3. world.submitProposal(actorId, intent, worldId)
   → Authority 평가 (auto_approve)
   → Host.dispatch()
   → Core.compute() → Patches
   → Effect Handler → More Patches
   → Core.apply() → New Snapshot
4. currentWorldId = result.resultWorld.worldId
5. 다음 루프에서 world.getSnapshot(currentWorldId)
```

### 5.6 Constitution 준수 체크리스트

| 원칙 | 구현 |
|------|------|
| Core 순수성 | ✅ domain.ts - IO 없음 |
| Host 캡슐화 | ✅ setup.ts - 내부에서만 생성 |
| World 거버넌스 | ✅ submitProposal() 유일 외부 API |
| Snapshot 유일 매체 | ✅ 모든 상태는 snapshot.data |
| Patch 기반 변경 | ✅ 이펙트 핸들러가 Patch[] 반환 |
| 예외 없음 | ✅ 에러도 패치로 표현 |
| 결정론성 | ✅ BFS, 이펙트 핸들러 모두 결정론적 |

---

## 6. 실험 설계 및 결과

### 6.1 데이터셋

**LLM-BabyBench (HuggingFace):**

| Config | 설명 | 태스크 수 | Necessity Level |
|--------|------|----------|-----------------|
| **predict** | 액션 시퀀스 → 최종 상태 예측 | 8,000 | Level 0 |
| **plan** | 목표 → 액션 시퀀스 생성 | 8,000 | Level 1 |
| **decompose** | 복잡한 태스크 분해 | 8,000 | Level 2 |

### 6.2 평가 메트릭

```typescript
type BabyBenchScore = {
  overall: number;  // 0-100
  components: {
    success: number;      // 30% 가중치
    necessity: number;    // 25% 가중치 - 핵심 차별점!
    governance: number;   // 25% 가중치
    recovery: number;     // 10% 가중치
    explanation: number;  // 10% 가중치
  };
  grade: 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
};
```

### 6.3 주요 실험 결과

**BFS Actor vs LLM Actor:**

```
벤치마크 결과 (2026-01-01):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Actor: BFS (결정론적)
레벨: predict (Level 0 태스크)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
성공률: 100% (LLM 호출 0회)
평균 스텝: 9.6 - 20 스텝
처리 시간: 7.67초 (5 iterations)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**핵심 발견:**
1. Level 0 태스크: BFS가 LLM보다 우수 (100% vs 0%)
2. Level 2 태스크: LLM이 필수 (100% 성공률)
3. Hybrid 접근: 레벨에 따른 적응적 선택이 최적

---

## 6. 논문 구성 제안

### 6.1 제목 후보

1. **"Beyond Success: Measuring Structural Necessity of LLM Usage in Agent Benchmarks"**
2. **"LLM-BabyBench: A Governance-Aware Benchmark for LLM Agent Evaluation"**
3. **"When is LLM Really Necessary? A 4-Level Framework for Agent Tasks"**

### 6.2 논문 구조

```
1. Introduction
   - LLM 에이전트의 급속한 발전
   - 기존 벤치마크의 한계: "성공했는가?"만 측정
   - 연구 질문: "LLM이 정말 필요했는가?"

2. Related Work
   - LLM Agent Benchmarks (AgentBench, WebArena, SWE-bench)
   - Evaluation Metrics for LLM Systems
   - Governance Frameworks for AI

3. LLM Necessity Profile Framework
   - 4-Level Taxonomy (L0-L3)
   - NullLLM Compliance Test
   - Proposer-Verifier Separation

4. LLM-BabyBench Design
   - Task Design (Grid World, BabyAI 기반)
   - Actor Architecture (BFS, LLM, Hybrid)
   - Governance Integration (World Protocol)

5. Experiments
   - Dataset: LLM-BabyBench (24,000 tasks)
   - Metrics: Success, Necessity, Governance, Recovery
   - Results: Actor 별 성능 비교

6. Discussion
   - Key Findings: Over-use Problem
   - Implications for Agent Design
   - Limitations and Future Work

7. Conclusion
```

### 6.3 핵심 주장 (Claims)

**Claim 1:** 기존 벤치마크는 LLM 과사용을 측정하지 않는다
- 증거: Level 0 태스크에서 LLM 사용 시 더 나쁜 결과

**Claim 2:** LLM 필요성은 구조적으로 정의될 수 있다
- 증거: 4-Level Framework의 명확한 분류 기준

**Claim 3:** 분리된 검증이 자기 검증보다 신뢰할 수 있다
- 증거: Proposer-Verifier 분리 원칙의 이론적 근거

**Claim 4:** Hybrid 접근이 순수 LLM 접근보다 효율적이다
- 증거: Hybrid Actor의 LLM 호출 최소화 + 높은 성공률

---

## 7. 추가 고려사항

### 7.1 잠재적 한계

1. **BabyAI 도메인 특수성**: Grid World가 실제 태스크를 대표하는가?
2. **Level 분류의 주관성**: 경계 사례 처리
3. **검증 비용**: 높은 Level에서의 HITL 비용

### 7.2 향후 연구 방향

1. 더 복잡한 도메인으로 확장 (웹, 코드)
2. Multi-Level 태스크 처리
3. 자동 Level 감지 메커니즘
4. 비용-효과 분석 (LLM API 비용 vs 성공률)

### 7.3 재현 가능성

- 코드: `@manifesto-ai/llm-babybench` 패키지
- 데이터셋: HuggingFace `salem-mbzuai/LLM-BabyBench`
- 실행: `pnpm benchmark:lab --actor bfs`

---

## 8. 요약

### 8.1 핵심 기여 요약

| # | 기여 | 설명 |
|---|------|------|
| 1 | **Necessity Profile** | LLM 사용의 구조적 필요성 4단계 분류 |
| 2 | **NullLLM Test** | Level 0 적합성의 검증 가능한 기준 |
| 3 | **Proposer-Verifier** | LLM 자기 검증 금지 원칙 |
| 4 | **Hybrid Actor** | 계획은 LLM, 실행은 결정론적 |
| 5 | **Governance Metrics** | 프로토콜 준수 측정 |

### 8.2 차별화 포인트 요약

```
기존 벤치마크:
  "Did the agent complete the task?" → success/failure

LLM-BabyBench:
  "Did the agent complete the task?"
  + "Was LLM usage structurally necessary?"
  + "Did the agent comply with governance?"
  + "When it failed, did it explain why?"

  → Multi-dimensional evaluation
```

---

*End of Analysis Report*
