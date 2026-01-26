# ADR-TRANSLATOR-002: Translator 산출물 계약 (InvocationPlan, MelCandidate)

> **Status:** Proposed  
> **Date:** 2026-01-26  
> **Deciders:** Manifesto Architecture Team  
> **Scope:** `@manifesto-ai/translator` 산출물 정의  
> **Depends On:** ADR-TRANSLATOR-001, `@manifesto-ai/intent-ir` (v0.1+)

---

> **Note on Language**
>
> This document is written in Korean, the author's native language.
> Machine translation is encouraged—and arguably appropriate,
> given that this ADR concerns a framework for making Intent
> machine-interpretable regardless of its linguistic surface.

## Context

ADR-TRANSLATOR-001에서 Translator의 경계와 Intent Graph 모델이 정의되었다. 본 ADR은 Intent Graph를 Manifesto 소비자가 사용할 수 있는 형태로 변환하는 **산출물 계약**을 정의한다.

Intent IR v0.1 스펙은 다음 lowering 경로를 명시한다:

```
IntentIR → [Resolver] → [Lowering] → IntentBody
```

- **Resolver:** 담화 참조(this/that/last)를 id로 해소
- **Lowering:** `IntentBody(type, input, scopeProposal)`로 변환
- **Lexicon:** `resolveActionType()`, `mapArgsToInput()`, `deriveScopeProposal()` 제공

Translator는 이 경로를 **대체하지 않고**, Intent Graph의 각 노드에 대해 이 경로를 적용한 결과를 **묶어서 제공**하는 convenience layer다.

---

## Decision

### D1. 두 가지 Lowering 경로를 Intent IR 스펙과 정합되게 정의한다

**Path A: Intent IR v0.1 Normative (노드 단위)**

```
IntentIR → Resolver → Lowering → IntentBody
```

이 경로는 Intent IR 스펙에 정의된 그대로이며, Translator가 변경하지 않는다.

**Path B: Translator Convenience (그래프 단위)**

```
IntentGraph → emitForManifesto(ctx) → ManifestoBundle
```

`emitForManifesto`는 "새로운 의미론"이 아니라, **Path A의 결과를 묶는 convenience 함수**다.

---

### D2. ManifestoBundle 구조

```typescript
type ManifestoBundle = {
  /** 실행 가능한 Intent 계획 */
  invocationPlan: InvocationPlan;
  
  /** 도메인 확장이 필요한 경우의 MEL 후보들 */
  melCandidates: MelCandidate[];
  
  /** 번역 메타데이터 */
  meta: {
    sourceText: string;
    translatedAt: string;  // ISO 8601
    graphNodeCount: number;
    resolvedCount: number;
    ambiguousCount: number;
  };
};
```

---

### D3. InvocationPlan은 "Lowerable Plan"이며, IntentBody는 step-wise로 materialize된다

> **크리티컬 설계 결정:** Intent IR v0.1의 lowering에서 discourse ref 해소(`this/that/last → id`)는 **실행 시점의 snapshot/focus/discourse**를 필요로 한다. 따라서 복합 의도에서 "방금 만든 프로젝트"를 참조하는 2번째 노드는, 1번째 Intent 실행 후의 snapshot이 생겨야 id로 해소 가능하다. **모든 step을 한 번에 IntentBody로 확정해서 반환하는 것은 구조적으로 불가능하다.**

**규범:**
- `InvocationPlan.steps`는 **IntentIR 기반 실행 계획**이다 (IntentBody 완성품이 아님)
- 각 step은 항상 `ir`(IntentIR)을 포함한다
- `intentBody`는 **지금 ctx로 lowering이 완료된 경우에만** 존재한다 (optional)
- `lowering.status`가 `"deferred"`인 step은 실행 시점에 최신 snapshot으로 `lower()`를 호출해야 한다
- `steps`는 dependency를 만족하는 **위상정렬 순서**로 제공되어야 한다 (MUST)

**Type Definition:**

```typescript
type LoweringStatus = "ready" | "deferred" | "failed";

type LoweringFailureReason = 
  | "needs_runtime_snapshot"  // discourse ref가 실행 시점 snapshot 필요
  | "action_not_found"        // lexicon.resolveActionType() 실패
  | "role_mapping_failed"     // required role 매핑 불가
  | "type_mismatch";          // selectional restriction 위반

type InvocationStep = {
  /** 원본 IntentNode.id */
  nodeId: IntentNodeId;
  
  /** 항상 포함: 실행 전 의미 구조 (IntentIR v0.1) */
  ir: IntentIR;
  
  /** 
   * 지금 ctx로 lowering이 완료된 경우에만 존재.
   * status="ready"일 때만 유효.
   */
  intentBody?: IntentBody;
  
  /** Lowering 상태 */
  lowering: {
    status: LoweringStatus;
    /** status가 "deferred" 또는 "failed"일 때 이유 */
    reason?: LoweringFailureReason;
  };
  
  /** 이 step의 해소 상태 (원본 노드에서 복사) */
  resolution: {
    status: "Resolved" | "Ambiguous";
    ambiguityScore: number;
    /** Missing θ-roles (Intent IR v0.1 Role enum values only) */
    missing?: Role[];
  };
};

type InvocationPlan = {
  /** 
   * 실행 단계 목록.
   * MUST: dependency를 만족하는 위상정렬 순서로 제공.
   * 
   * 소비자(실행기)는 각 step에 대해:
   * - lowering.status="ready" → intentBody로 즉시 실행
   * - lowering.status="deferred" → 최신 snapshot으로 lower(ir) 호출 후 실행
   * - lowering.status="failed" → 실행 불가, 에러 처리
   */
  steps: InvocationStep[];
  
  /**
   * 원본 그래프의 dependency 정보 (optional).
   * 소비자가 병렬 실행 등을 계획할 때 참조 가능.
   * 
   * Convention: from=dependent, to=dependency
   * 즉, "from이 to에 의존한다"를 의미함.
   */
  dependencyEdges?: Array<{
    /** 의존하는 노드 (dependent) */
    from: IntentNodeId;
    /** 의존 대상 노드 (dependency) */
    to: IntentNodeId;
  }>;
};
```

**소비자(실행기) 동작 예시:**

```typescript
async function executeInvocationPlan(
  plan: InvocationPlan,
  lexicon: Lexicon,
  initialSnapshot: Snapshot
): Promise<ExecutionResult> {
  let currentSnapshot = initialSnapshot;
  const results: StepResult[] = [];
  
  for (const step of plan.steps) {
    // 1. IntentBody 확보
    let intentBody: IntentBody;
    
    if (step.lowering.status === "ready" && step.intentBody) {
      // 이미 lowering 완료
      intentBody = step.intentBody;
    } else if (step.lowering.status === "deferred") {
      // 최신 snapshot으로 resolver 업데이트 후 lowering
      const resolver = createResolver(currentSnapshot, /* focus, discourse */);
      intentBody = lower(step.ir, lexicon, resolver);
    } else {
      // failed: 실행 불가
      throw new ExecutionError(`Step ${step.nodeId} cannot be lowered: ${step.lowering.reason}`);
    }
    
    // 2. 실행
    const result = await execute(intentBody, currentSnapshot);
    
    // 3. snapshot 업데이트
    currentSnapshot = result.newSnapshot;
    results.push({ nodeId: step.nodeId, result });
  }
  
  return { results, finalSnapshot: currentSnapshot };
}
```

**steps 순서 규칙:**
- `steps[i]`가 `steps[j]`에 의존하면, `i > j`여야 한다 (MUST)
- 의존성이 없는 노드들의 상대적 순서는 구현 정의 (MAY)

---

### D4. MelCandidate는 Lowering 실패 시에만 생성된다

**규범:**
- MelCandidate는 IntentIR lowering의 **대체물이 아니다**
- "기존 DomainSchema action invocation으로 커버 불가"한 노드에 대해서만 생성된다
- 한 노드에 대해:
    - `intentBody` 생성 성공 → `InvocationPlan.steps`에 포함, `lowering.status = "ready"`
    - `intentBody` 생성 실패 → `MelCandidate` 생성, `lowering.status = "failed"`

> **Critical:** `resolution.status`(의미 해소 상태)와 `lowering.status`(실행 가능 여부)는 **독립적**이다. 의도가 완전히 명확(Resolved)하더라도 현재 schema가 지원하지 않으면(action_not_found) lowering은 실패할 수 있다. 이 두 상태를 혼동하지 않는다.

**"커버 불가" 판정 기준:**
- `lexicon.resolveActionType(ir.event.lemma)`가 `undefined`를 반환
- 또는 theta frame의 required roles 중 하나라도 매핑 불가

**Type Definition:**

```typescript
type MelCandidate = {
  /** 원본 IntentNode.id */
  nodeId: IntentNodeId;
  
  /** 원본 IntentIR (참조용) */
  ir: IntentIR;
  
  /** 제안되는 MEL 코드 조각 */
  suggestedMel: string;
  
  /** 왜 기존 schema로 커버 불가한지 설명 */
  reason: {
    kind: "action_not_found" | "role_mapping_failed" | "type_mismatch";
    details: string;
  };
  
  /** 이 MEL이 추가되면 해소될 수 있는 의존 노드들 */
  wouldEnable?: IntentNodeId[];
};
```

**근거:** Intent IR 스펙은 "IntentBody로 내리고, 그 이후 MEL/Patch는 downstream compiler concern"이라는 원칙을 가진다. MelCandidate는 lowering이 아니라 "별도 산출물"로 위치시켜야 이 원칙과 충돌하지 않는다.

---

### D5. emitForManifesto의 Context 요구사항

```typescript
/**
 * Snapshot-like 구조. 
 * Translator는 Core에 런타임 의존하지 않으므로 구체 타입 대신 구조적 타입 사용.
 * 실제 Manifesto Core의 Snapshot과 호환되어야 함.
 */
type SnapshotLike = {
  data: Record<string, unknown>;
  computed?: Record<string, unknown>;
};

/**
 * Resolver 최소 인터페이스.
 * Resolver는 snapshot/focus/discourse context를 내부에 캡처하여
 * discourse reference(this/that/last)를 concrete id로 해소한다.
 */
interface Resolver {
  /**
   * IR 내의 discourse references를 id로 해소한다.
   * @param ir - 해소할 IntentIR
   * @returns ResolvedIntentIR (모든 ref가 { kind: "id", id: string } 형태)
   * @throws 해소 불가 시 에러 대신 deferred 표시를 위한 정보 반환 권장
   */
  resolveReferences(ir: IntentIR): ResolvedIntentIR | { deferred: true; reason: string };
}

type EmitContext = {
  /** Lexicon (REQUIRED for lowering) */
  lexicon: Lexicon;
  
  /** Resolver for discourse references (REQUIRED) */
  resolver: Resolver;
  
  /** 
   * 현재 스냅샷 (optional, entity resolution에 사용).
   * 없으면 discourse ref 해소가 제한되어 더 많은 step이 "deferred"가 됨.
   */
  snapshot?: SnapshotLike;
  
  /** Schema hash (intentKey 계산에 사용) */
  schemaHash: string;
};

function emitForManifesto(
  graph: IntentGraph,
  ctx: EmitContext
): ManifestoBundle;
```

**규범:**
- `lexicon`과 `resolver`는 필수다 (MUST)
- `snapshot`이 없으면 discourse ref 해소가 제한되어 더 많은 step이 `lowering.status = "deferred"`가 된다 (MAY)
- Translator 패키지는 `@manifesto-ai/core`에 **런타임 의존하지 않는다** (import type만 허용)
- Resolver는 **stateful**할 수 있다: 이전 실행 결과를 반영한 최신 snapshot을 내부에 유지하여, 복합 의도 실행 시 이전 step 결과를 다음 step의 discourse ref 해소에 활용할 수 있음

---

### D6. Abstract 노드는 InvocationPlan에 포함되지 않는다

**규범:**
- `resolution.status = "Abstract"`인 노드는 아직 실행 가능한 형태가 아니다
- `InvocationPlan.steps`에는 `"Resolved"` 또는 `"Ambiguous"` 노드만 포함된다
- `"Abstract"` 노드는 `melCandidates`로만 표현되거나, 번역 실패로 처리된다

**Abstract의 의미:**
- 의도는 파악되었으나, 구체적 action으로 매핑할 정보가 충분하지 않음
- 예: "나중에 알려줄게" → 어떤 action인지 불명확

---

### D7. v0 공개 범위는 Manifesto 소비처로 제한한다

**v0에서 공식 지원하는 출력:**
- `InvocationPlan`
- `MelCandidate`

**v0에서 문서화하지 않는 확장점:**
- LLVM IR 출력
- PatchOps 직접 출력
- Human-readable plan 출력

이들은 설계 확장점으로만 남기고, 사용자-facing 문서/패키지 표면에서는 다루지 않는다.

---

## Public Contract (User-facing API)

외부 사용자는 아래만 알면 된다:

### 1) 번역

```typescript
function translate(
  text: string,
  options?: TranslateOptions
): TranslateResult;

type TranslateResult = {
  graph: IntentGraph;
  warnings: TranslateWarning[];
};
```

### 2) Manifesto용 산출물 생성

```typescript
function emitForManifesto(
  graph: IntentGraph,
  ctx: EmitContext
): ManifestoBundle;
```

> 내부적으로는 semantic projection이지만, 외부에는 "emit/compile/generate" 같은 단어를 사용한다.

---

## Consequences

### Positive

- **Intent IR과의 정합성:** `emitForManifesto`가 "새로운 의미론"이 아니라 "기존 lowering의 지연 실행 계획"으로 정의됨. discourse ref 해소가 실행 시점 snapshot을 필요로 한다는 스펙과 완전히 일치.
- **실행 가능성 보장:** `steps` 순서가 위상정렬로 보장되어 소비자가 순차 실행 가능
- **구조적 정직함:** "지금 lowering 가능한 것"과 "실행 시점에 lowering해야 하는 것"을 명시적으로 구분하여, 불가능한 계약을 피함
- **확장 경로 명확화:** 기존 schema로 커버 불가 시 MelCandidate로 도메인 확장 가이드 제공

### Negative / Tradeoffs

- **소비자 복잡도 증가:** 소비자(실행기)가 `lowering.status`에 따라 분기 처리하고, deferred인 경우 직접 `lower()`를 호출해야 함
- **Lexicon 의존성:** `emitForManifesto`는 Lexicon 없이 호출 불가
- **두 단계 API:** `translate()` → `emitForManifesto()` 두 번 호출 필요 (단, 이는 관심사 분리의 결과)

---

## Open Questions (Deferred)

| Question | Notes |
|----------|-------|
| MelCandidate 품질 평가 | 제안된 MEL이 실제로 유효한 schema가 되는지 검증 |
| 병렬 실행 힌트 | `dependencyEdges`를 활용한 병렬화 가이드라인 |
| Partial emit | 일부 노드만 emit하는 API 필요성 |
| lower() 함수 표준화 | 소비자가 deferred step을 처리할 때 사용할 `lower()` 함수의 표준 시그니처 |
| Resolver 인터페이스 | discourse ref 해소를 위한 Resolver의 최소 인터페이스 정의 |

---

## Examples

### Example 1: 단순 단일 의도

**Input:** "주문 취소해"

**IntentGraph:**
```json
{
  "nodes": [{
    "id": "n1",
    "ir": {
      "v": "0.1",
      "force": "DO",
      "event": { "lemma": "CANCEL", "class": "CONTROL" },
      "args": {
        "THEME": {
          "kind": "entity",
          "entityType": "Order",
          "ref": { "kind": "this" }
        }
      }
    },
    "dependsOn": [],
    "resolution": {
      "status": "Ambiguous",
      "ambiguityScore": 0.3,
      "missing": ["THEME.ref.id"],
      "questions": ["어떤 주문을 취소할까요?"]
    }
  }]
}
```

**ManifestoBundle:**
```json
{
  "invocationPlan": {
    "steps": [{
      "nodeId": "n1",
      "ir": {
        "v": "0.1",
        "force": "DO",
        "event": { "lemma": "CANCEL", "class": "CONTROL" },
        "args": { "THEME": { "kind": "entity", "entityType": "Order", "ref": { "kind": "this" } } }
      },
      "lowering": {
        "status": "deferred",
        "reason": "needs_runtime_snapshot"
      },
      "resolution": {
        "status": "Ambiguous",
        "ambiguityScore": 0.3,
        "missing": ["THEME.ref.id"]
      }
    }]
  },
  "melCandidates": [],
  "meta": {
    "sourceText": "주문 취소해",
    "translatedAt": "2026-01-26T12:00:00Z",
    "graphNodeCount": 1,
    "resolvedCount": 0,
    "ambiguousCount": 1
  }
}
```

> **Note:** `lowering.status = "deferred"`이므로 실행 시점에 snapshot을 기반으로 "this" 참조를 해소한 후 `lower()`를 호출해야 한다.

---

### Example 2: 복합 의도 (의존성 있음, deferred lowering)

**Input:** "새 프로젝트 만들고 거기에 태스크 추가해"

**IntentGraph:**
```json
{
  "nodes": [
    {
      "id": "n1",
      "ir": {
        "v": "0.1",
        "force": "DO",
        "event": { "lemma": "CREATE", "class": "CREATE" },
        "args": {
          "THEME": { "kind": "entity", "entityType": "Project" }
        }
      },
      "dependsOn": [],
      "resolution": { "status": "Resolved", "ambiguityScore": 0.1 }
    },
    {
      "id": "n2",
      "ir": {
        "v": "0.1",
        "force": "DO",
        "event": { "lemma": "ADD", "class": "TRANSFORM" },
        "args": {
          "THEME": { "kind": "entity", "entityType": "Task" },
          "DEST": {
            "kind": "entity",
            "entityType": "Project",
            "ref": { "kind": "that" }
          }
        }
      },
      "dependsOn": ["n1"],
      "resolution": { "status": "Resolved", "ambiguityScore": 0.15 }
    }
  ]
}
```

**ManifestoBundle:**
```json
{
  "invocationPlan": {
    "steps": [
      {
        "nodeId": "n1",
        "ir": { "v": "0.1", "force": "DO", "event": { "lemma": "CREATE", "class": "CREATE" }, "args": { "THEME": { "kind": "entity", "entityType": "Project" } } },
        "intentBody": { "type": "project:create", "input": {} },
        "lowering": { "status": "ready" },
        "resolution": { "status": "Resolved", "ambiguityScore": 0.1 }
      },
      {
        "nodeId": "n2",
        "ir": { "v": "0.1", "force": "DO", "event": { "lemma": "ADD", "class": "TRANSFORM" }, "args": { "THEME": { "kind": "entity", "entityType": "Task" }, "DEST": { "kind": "entity", "entityType": "Project", "ref": { "kind": "that" } } } },
        "lowering": {
          "status": "deferred",
          "reason": "needs_runtime_snapshot"
        },
        "resolution": { "status": "Resolved", "ambiguityScore": 0.15 }
      }
    ],
    "dependencyEdges": [{ "from": "n2", "to": "n1" }]
  },
  "melCandidates": [],
  "meta": {
    "sourceText": "새 프로젝트 만들고 거기에 태스크 추가해",
    "translatedAt": "2026-01-26T12:00:00Z",
    "graphNodeCount": 2,
    "resolvedCount": 2,
    "ambiguousCount": 0
  }
}
```

**실행 흐름:**

1. **Step n1** (`status: "ready"`): `intentBody`가 이미 있으므로 즉시 실행
    - 결과: 새 Project 생성, snapshot 업데이트
2. **Step n2** (`status: "deferred"`):
    - 최신 snapshot으로 resolver 생성
    - `ref: { kind: "that" }`을 방금 생성된 Project의 id로 해소
    - `lower(ir, lexicon, resolver)` 호출 → `intentBody: { type: "task:add", input: { projectId: "proj-123" } }`
    - 실행

> **핵심:** n2의 "that" 참조는 n1 실행 후의 snapshot이 있어야만 해소 가능하므로, `emitForManifesto` 시점에는 `intentBody`를 확정할 수 없다.

---

## References

- [ADR-TRANSLATOR-001](./ADR-TRANSLATOR-001.md) — Translator 경계와 Intent Graph 모델
- [Intent IR v0.1 SPEC](./manifesto-intent-ir__v0_1_0__SPEC.md) — IntentIR 구조, Lowering, Lexicon
- [MEL SPEC v0.4.0](./SPEC-v0_4_0-patch.md) — MEL 구조

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 0.1.0 | 2026-01-26 | Initial proposal |
