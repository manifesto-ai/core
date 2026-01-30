# ADR-TRANSLATOR-002: Translator 산출물 계약 (InvocationPlan, MelCandidate)

> **Status:** Accepted  
> **Version:** 0.1.1  
> **Date:** 2026-01-26 (Updated: 2026-01-27)  
> **Deciders:** Manifesto Architecture Team  
> **Scope:** `@manifesto-ai/translator` 산출물 정의  
> **Depends On:** ADR-TRANSLATOR-001, `@manifesto-ai/intent-ir` (v0.2+)

---

> **Note on Language**
>
> This document is written in Korean, the author's native language.
> Machine translation is encouraged—and arguably appropriate,
> given that this ADR concerns a framework for making Intent
> machine-interpretable regardless of its linguistic surface.

> **Alignment Note (2026-01-30)**
>
> This ADR was authored against Intent IR v0.1. The current canonical spec is v0.2.0.
> The lowering contract remains the same; v0.2 adds ListTerm, QuantitySpec, `in`,
> term-level `ext`, and canonicalization refinements. References were updated to v0.2.0
> without changing the original decision.

## Context

ADR-TRANSLATOR-001에서 Translator의 경계와 Intent Graph 모델이 정의되었다. 본 ADR은 Intent Graph를 Manifesto 소비자가 사용할 수 있는 형태로 변환하는 **산출물 계약**을 정의한다.

Intent IR v0.2 스펙은 다음 lowering 경로를 명시한다 (v0.1과 동일한 계약):

```
IntentIR → [Resolver] → [Lowering] → IntentBody
```

- **Resolver:** 담화 참조(this/that/last)를 id로 해소
- **Lowering:** `IntentBody(type, input, scopeProposal)`로 변환
- **Lexicon:** `resolveActionType()`, `mapArgsToInput()`, `deriveScopeProposal()` 제공

Translator는 이 경로를 **대체하지 않고**, Intent Graph의 각 노드에 대해 이 경로를 적용한 결과를 **묶어서 제공**하는 convenience layer다.

> **Note (Decompose Layer):** ADR-TRANSLATOR-003은 Intent Graph 생성의 pipeline 전략(Decompose Layer)을 정의한다. 본 ADR의 산출물 계약(InvocationPlan, MelCandidate)은 **"입력으로 주어진 Intent Graph"**에 대해 정의되며, graph가 단일 패스에서 왔는지, decompose+merge에서 왔는지에 의존하지 않는다.

---

## Decision

### D1. 두 가지 Lowering 경로를 Intent IR 스펙과 정합되게 정의한다

**Path A: Intent IR v0.2 Normative (노드 단위)**

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

> **크리티컬 설계 결정:** Intent IR v0.2의 lowering에서 discourse ref 해소(`this/that/last → id`)는 **실행 시점의 snapshot/focus/discourse**를 필요로 한다. 따라서 복합 의도에서 "방금 만든 프로젝트"를 참조하는 2번째 노드는, 1번째 Intent 실행 후의 snapshot이 생겨야 id로 해소 가능하다. **모든 step을 한 번에 IntentBody로 확정해서 반환하는 것은 구조적으로 불가능하다.**

**규범:**
- `InvocationPlan.steps`는 **IntentIR 기반 실행 계획**이다 (IntentBody 완성품이 아님)
- 각 step은 항상 `ir`(IntentIR)을 포함한다
- `intentBody`는 **지금 ctx로 lowering이 완료된 경우에만** 존재한다 (optional)
- `lowering.status`가 `"deferred"`인 step은 실행 시점에 최신 snapshot으로 `lower()`를 호출해야 한다
- `steps`는 dependency를 만족하는 **위상정렬 순서**로 제공되어야 한다 (MUST)

**Type Definition (aligned with Spec v0.2):**

```typescript
/** θ-role names from Intent IR v0.2 (roles unchanged from v0.1) */
type Role = "TARGET" | "THEME" | "SOURCE" | "DEST" | "INSTRUMENT" | "BENEFICIARY";

/**
 * Lowering failure reason (structured).
 * Note: "needs_runtime_snapshot" is expressed via status="deferred", not "failed".
 */
type LoweringFailureReason = {
  kind: "action_not_found" | "role_mapping_failed" | "type_mismatch";
  details: string;
};

/**
 * Discriminated union for lowering results.
 * This ensures type safety: intentBody exists IFF status="ready".
 */
type LoweringResult =
  | { status: "ready"; intentBody: IntentBody }
  | { status: "deferred"; reason: string }
  | { status: "failed"; reason: LoweringFailureReason };

type InvocationStep = {
  /** 원본 IntentNode.id */
  nodeId: IntentNodeId;
  
  /** 항상 포함: 실행 전 의미 구조 (IntentIR v0.2, v0.1 compatible) */
  ir: IntentIR;
  
  /** 
   * Lowering 결과 (discriminated union).
   * - status="ready": intentBody로 즉시 실행 가능
   * - status="deferred": 런타임 해소 후 lower(ir, lexicon, resolver) 호출 필요
   * - status="failed": 실행 불가, MelCandidate 참조
   */
  lowering: LoweringResult;
  
  /** 이 step의 해소 상태 (원본 노드에서 복사) */
  resolution: {
    status: "Resolved" | "Ambiguous";
    ambiguityScore: number;
    /** Missing θ-roles (Intent IR v0.2 Role enum values only) */
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
   * Steps 간의 dependency 정보 (optional, C-EDGES-1 준수).
   * MUST: from과 to 모두 steps[]에 포함된 nodeId여야 함.
   * 소비자가 병렬 실행 등을 계획할 때 참조 가능.
   * 
   * Convention: from=dependency, to=dependent
   * Edge direction: "from must complete before to" (standard topological sort)
   * 
   * Example: n2가 n1에 의존하면 → { from: "n1", to: "n2" }
   */
  dependencyEdges?: Array<{
    /** 의존 대상 노드 (dependency, 먼저 실행, steps에 포함 MUST) */
    from: IntentNodeId;
    /** 의존하는 노드 (dependent, 나중에 실행, steps에 포함 MUST) */
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
    let intentBody: IntentBody;
    
    // Discriminated union으로 타입 안전하게 분기
    switch (step.lowering.status) {
      case "ready":
        // intentBody가 타입 레벨에서 보장됨
        intentBody = step.lowering.intentBody;
        break;
        
      case "deferred":
        // 최신 snapshot으로 resolver 업데이트 후 lowering
        const resolver = createResolver(currentSnapshot);
        intentBody = lower(step.ir, lexicon, resolver);
        break;
        
      case "failed":
        // 실행 불가 - MelCandidate 참조 필요
        throw new ExecutionError(
          `Step ${step.nodeId} cannot be lowered: ${step.lowering.reason.kind} - ${step.lowering.reason.details}`
        );
    }
    
    // 실행 및 snapshot 업데이트
    const result = await execute(intentBody, currentSnapshot);
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
 * Resolver 인터페이스.
 * 
 * SNAPSHOT RESPONSIBILITY (SPEC §10.4 참조):
 * - Resolver가 snapshot을 내부적으로 소유/관리한다
 * - EmitContext에서 snapshot을 받지 않음 (Resolver로 캡슐화)
 * - Consumer가 step 실행 후 updateSnapshot()으로 갱신
 */
interface Resolver {
  /**
   * IR 내의 discourse references를 id로 해소한다.
   * @param ir - 해소할 IntentIR
   * @returns ResolvedIntentIR (모든 ref가 { kind: "id", id: string } 형태)
   *          또는 { deferred: true, reason: string } (해소 불가 시)
   */
  resolveReferences(ir: IntentIR): ResolvedIntentIR | { deferred: true; reason: string };
  
  /**
   * Step 실행 후 snapshot을 갱신한다 (optional).
   * 다음 step의 discourse ref 해소에 최신 상태 반영.
   */
  updateSnapshot?(snapshot: SnapshotLike): void;
}

type EmitContext = {
  /** Lexicon (REQUIRED for lowering) */
  lexicon: Lexicon;
  
  /** 
   * Resolver for discourse references (REQUIRED).
   * Resolver는 snapshot을 내부적으로 소유한다 (SPEC §10.4 참조).
   */
  resolver: Resolver;
  
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
- **Snapshot 책임은 Resolver에 있다**: Resolver 생성 시 초기 snapshot을 받고, step 실행 후 `updateSnapshot()`으로 갱신
- Resolver가 snapshot을 갖고 있지 않으면 discourse ref 해소가 제한되어 더 많은 step이 `lowering.status = "deferred"`가 된다
- Translator 패키지는 `@manifesto-ai/core`에 **런타임 의존하지 않는다** (import type만 허용)

---

### D6. Abstract 노드는 InvocationPlan에 포함되지 않는다

**규범:**
- `resolution.status = "Abstract"`인 노드는 아직 실행 가능한 형태가 아니다
- `InvocationPlan.steps`에는 `"Resolved"` 또는 `"Ambiguous"` 노드만 포함된다
- `"Abstract"` 노드는 `melCandidates`로만 표현되거나, 번역 실패로 처리된다

**C-ABS-1 (MUST): Abstract 의존성 제약**
- 비-Abstract 노드가 Abstract 노드에 의존(`dependsOn`)하는 것은 **금지**
- 허용되는 방향: Abstract → Concrete (상위 목표가 하위 작업에 의존)
- 금지되는 방향: Concrete → Abstract (실행 플랜이 깨짐)
- 위반 시: `ABSTRACT_DEPENDENCY` 에러 (구조 검증 단계)

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
/**
 * 자연어를 Intent Graph로 변환 (비동기).
 * LLM 호출이 포함되므로 Promise를 반환한다.
 */
function translate(
  text: string,
  options?: TranslateOptions
): Promise<TranslateResult>;

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
      "questions": ["어떤 주문을 취소할까요?"]
    }
  }]
}
```

> **Note:** `missing` is empty because THEME role IS bound (to an entity with `ref.kind="this"`). The ambiguity comes from the unresolved discourse reference, which is expressed via `questions[]` and `lowering.status="deferred"`, not via `missing[]`.

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
        "reason": "Discourse ref 'this' requires runtime context to resolve to concrete order ID"
      },
      "resolution": {
        "status": "Ambiguous",
        "ambiguityScore": 0.3
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
        "lowering": { 
          "status": "ready", 
          "intentBody": { "type": "project:create", "input": {} } 
        },
        "resolution": { "status": "Resolved", "ambiguityScore": 0.1 }
      },
      {
        "nodeId": "n2",
        "ir": { "v": "0.1", "force": "DO", "event": { "lemma": "ADD", "class": "TRANSFORM" }, "args": { "THEME": { "kind": "entity", "entityType": "Task" }, "DEST": { "kind": "entity", "entityType": "Project", "ref": { "kind": "that" } } } },
        "lowering": {
          "status": "deferred",
          "reason": "Discourse ref 'that' (Project) requires n1 execution result"
        },
        "resolution": { "status": "Resolved", "ambiguityScore": 0.15 }
      }
    ],
    "dependencyEdges": [{ "from": "n1", "to": "n2" }]
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

1. **Step n1** (`lowering.status: "ready"`): `lowering.intentBody`가 있으므로 즉시 실행
    - 결과: 새 Project 생성, snapshot 업데이트
2. **Step n2** (`lowering.status: "deferred"`):
    - 최신 snapshot으로 resolver 생성
    - `ref: { kind: "that" }`을 방금 생성된 Project의 id로 해소
    - `lower(ir, lexicon, resolver)` 호출 → `intentBody: { type: "task:add", input: { projectId: "proj-123" } }`
    - 실행

> **핵심:** n2의 "that" 참조는 n1 실행 후의 snapshot이 있어야만 해소 가능하므로, `emitForManifesto` 시점에는 `intentBody`를 확정할 수 없다.

---

## References

- [ADR-TRANSLATOR-001](./ADR-TRANSLATOR-001.md) — Translator 경계와 Intent Graph 모델
- [Intent IR v0.2 SPEC](../../../intent-ir/docs/SPEC-v0.2.0.md) — IntentIR 구조, Lowering, Lexicon
- [MEL SPEC v0.4.0](./SPEC-v0_4_0-patch.md) — MEL 구조

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 0.1.0 | 2026-01-26 | Initial proposal |
