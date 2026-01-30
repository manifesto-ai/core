# ADR-TRANSLATOR-001: Translator 독립 패키지화와 Intent Graph 모델

> **Status:** Accepted  
> **Version:** 0.1.1  
> **Date:** 2026-01-26 (Updated: 2026-01-27)  
> **Deciders:** Manifesto Architecture Team  
> **Scope:** `@manifesto-ai/translator`  
> **Depends On:** `@manifesto-ai/intent-ir` (v0.2+)  
> **Does NOT Depend On:** `@manifesto-ai/core`, `@manifesto-ai/host`, `@manifesto-ai/world`, `@manifesto-ai/app`

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
> The role enum and lowering contract are unchanged; v0.2 adds ListTerm, QuantitySpec,
> `in` predicate support, term-level `ext`, and canonicalization refinements.
> References were updated to v0.2.0 without changing the original decision.

## Context

Manifesto v2는 레이어 분리를 강하게 전제한다. ARCHITECTURE-v2.0.0의 "Does NOT Know" 매트릭스에서 Translator는 다음을 모른다고 명시되어 있다:

| Layer | Does NOT Know |
|-------|---------------|
| **Translator** | Execution, governance, Host internals, World internals |

Host v2.0.1(FDR-H024)에서 Host는 Compiler/Translator와 직접 결합하지 않으며, Translator 출력 처리(lowering/evaluation)는 App 레이어 책임으로 이동했다.

Intent IR v0.2 스펙은 다음을 명시한다 (v0.1과 동일한 규정):
- "IR은 실행 계획이 아니다"
- "IntentIR → IntentBody lowering은 프로토콜 단위로 1:1로 수행된다"
- "Lexicon is the arbiter"

따라서 Translator는 Intent IR 스펙을 **대체하지 않고**, 그 위에 "복합 의도의 조립(그래프)"을 얹는 방식으로 설계되어야 한다.

추가로, Manifesto 내부에는 이미 `Projection(schema, snapshot, intent) → snapshot'` 형태의 상태 투영 개념이 존재하여, Translator가 사용하는 "의미 투영(Semantic Projection)"이라는 표현이 동일 층위로 오해될 위험이 있다.

---

## Decision

### D1. Translator는 Manifesto Runtime과 구현적으로 분리된 독립 패키지다

Translator는 `@manifesto-ai/translator`로 제공한다.

**규범:**
- Manifesto runtime(Core/Host/World/App)에 **직접 의존하지 않는다**
- Translator는 `Proposal`, `Authority`, `ExecutionKey`, `intentId` 같은 "책임 발생 단위"를 **생성하지 않는다**
- Translator는 실행(Host dispatch)이나 거버넌스(World sealing)를 **호출하지 않는다**

**근거:** ARCHITECTURE-v2.0.0 "Does NOT Know" 매트릭스, Host-Compiler decouple 방향(FDR-H024)

---

### D2. Translator의 1차 산출물은 Intent Graph(DAG)이며, cycle은 오류다

Translator는 복잡한 요구를 단일 action으로 억지로 축약하지 않고, **의미적 의존성 그래프(Intent Graph)**를 생성한다.

**규범:**
- Intent Graph는 **DAG(Directed Acyclic Graph)**다
- cycle은 의미 모델 오류로 취급한다(정적 검증 실패)
- 노드 간 엣지는 시간 순서가 아니라 **논리적 의존성(dependency)**을 표현한다

**근거:** Core의 "computed as DAG"가 가진 안정성 논리(termination, determinism, static verification)와 동일한 계열

---

### D2-1. Intent Graph의 노드는 IntentIR 인스턴스를 래핑한다

> 이 결정은 Intent Graph와 Intent IR의 관계를 명시적으로 봉인한다.

**규범:**
- Intent Graph의 각 노드는 **하나의 IntentIR**(v0.2)를 포함한다
- Intent Graph는 Intent IR 스펙을 **대체하지 않고 조합(compose)**한다
- Intent IR v0.2의 lowering 계약(`IntentIR → IntentBody`)은 노드 단위로 그대로 적용된다

**Type Definition (normative):**

```typescript
type IntentNodeId = string;

/** θ-role names from Intent IR v0.2 (roles unchanged from v0.1) */
type Role = "TARGET" | "THEME" | "SOURCE" | "DEST" | "INSTRUMENT" | "BENEFICIARY";

type IntentNode = {
  /** 노드 고유 식별자 */
  id: IntentNodeId;
  
  /** IntentIR v0.2 인스턴스 (MUST) */
  ir: IntentIR;
  
  /** 이 노드가 의존하는 다른 노드들 */
  dependsOn: IntentNodeId[];
  
  /** 해소 상태 및 모호성 측정 */
  resolution: {
    status: "Resolved" | "Ambiguous" | "Abstract";
    ambiguityScore: number;  // 0..1 (클수록 모호)
    missing?: Role[];        // 미바인딩된 required θ-roles (역할명만)
    questions?: string[];    // 권장 명확화 질문
  };
};

type IntentGraph = {
  nodes: IntentNode[];
};
```

---

### D2-2. (Optional) Decompose Layer는 Translator 바깥의 pipeline concern이며, 소비자가 조합한다

Extreme complex 입력에서 단일 패스 그래프 생성 정확도가 붕괴하는 문제를 해결하기 위해, Translator 앞단에 `Decompose → translate(chunk) → validate → merge` 형태의 pre-pass를 둘 수 있다.

**규범:**
- Decompose는 Translator core의 책임이 **아니다** (Translator는 decompose를 "모른다")
- Decompose 전략은 소비자(App/Agent/UI)가 구성(composition)한다
- Decompose는 원문 substring 기반 chunk만 생성하며(재작성/요약 금지), chunk 그래프를 merge하여 최종 Intent Graph를 만든다

**Reference:** ADR-TRANSLATOR-003

---

### D3. Intent Graph는 4개의 Minimum Invariants를 만족해야 한다

Translator는 Intent Graph 생성 시 아래 불변식을 강제한다:

| Invariant | Description |
|-----------|-------------|
| **Causal Integrity** | 모든 엣지는 논리적 선후 관계를 위배하지 않으며, 위상정렬이 가능해야 한다 |
| **Referential Identity** | **명시적 Symbolic Reference**가 할당된 동일 엔티티는 그래프 전역에서 동일 ref를 사용한다 (아래 상세) |
| **Conceptual Completeness** | 각 노드의 필수 의미 인자(required semantic args)는 **(a) 바인딩되어 있거나**, **(b) `missing`에 명시되고 `status`가 `Ambiguous` 또는 `Abstract`로 표시되어야 한다** (누락의 무표시 금지) |
| **Intent Statefulness** | 모든 노드는 `Resolved`, `Ambiguous`, `Abstract` 중 하나의 상태를 명시한다 |

**I2. Referential Identity — 상세 (Patched for Decompose Compatibility):**

| Ref Kind | Identity Enforcement | Resolution |
|----------|---------------------|------------|
| `{ kind: "id", id: "..." }` | **MUST:** 동일 ID는 동일 엔티티 | Immediate (translate 시점) |
| `{ kind: "this" \| "that" \| "last" }` | **지연 바인딩:** identity 미확정 | Resolver/실행 시점 |
| 명시적 symbolic (future) | **MUST:** 동일 symbol은 동일 엔티티 | translate 또는 validate 시점 |

**규범:**
- Translator가 `ref: { kind: "id", id: "X" }`를 할당한 경우, 그래프 내 다른 노드에서 같은 ID는 동일 엔티티를 지칭해야 한다 (MUST)
- `ref.kind ∈ { "this", "that", "last" }`는 **담화 참조(discourse reference)**로서 지연 바인딩이며, identity 확정은 Resolver/실행 시점 snapshot에 의해 이루어진다 (MAY)
- identity 미확정 상태는 `resolution.status = "Ambiguous"` 및/또는 `lowering.status = "deferred"`로 표현한다

**Decompose+Merge 호환성:**
- chunk별 translate 후 merge 시, discourse ref는 cross-chunk identity 통합 대상이 **아니다** (각 chunk 내에서만 의미가 있음)
- cross-chunk entity 연결이 필요한 경우, consumer가 merge 후 별도 "entity linking" 패스를 적용할 수 있다 (Translator core 범위 외)

---

### D3-1. Invariant 검증은 2단계로 분리한다

**(A) Structural Validation — `translate()` 반환 시점에 MUST**

Translator는 `translate()` 결과로 구조적으로 유효한 Intent Graph를 반환해야 한다.

| Check | Requirement |
|-------|-------------|
| DAG | cycle이 없어야 한다 |
| Statefulness | 모든 노드가 `resolution.status`를 가진다 |
| Score | 각 노드는 `ambiguityScore`를 가진다 (0..1) |
| Edge Integrity | `dependsOn`의 모든 ID가 node set에 존재한다 |

**(B) Lexicon-Verified Validation — `validate(graph, ctx)` 또는 translate 옵션**

Conceptual Completeness와 일부 Referential Identity는 Lexicon에 의해 규범적으로 결정된다.

| Check | Requirement | 목적 |
|-------|-------------|------|
| Event Resolvable | 각 노드 `ir.event.lemma`에 대해 `lexicon.resolveEvent()`가 성공해야 한다 | 의미/역할 프레임 확보 |
| Required Roles | theta frame의 required roles가 모두 바인딩되거나, 미바인딩 시 `status = "Ambiguous"`, `missing`에 기록 | Conceptual Completeness |

> **Note:** `lexicon.resolveActionType()`은 여기서 사용하지 않는다. ActionType 해소는 **emit/lowering 단계**에서 "invocation 가능성 판단"으로 사용되며, 실패 시 MelCandidate 경로로 분기한다. 의미가 완전(Resolved)하더라도 현재 schema가 지원하지 않을 수 있다.

**호출 방식:**
- 분리 호출: `const graph = translate(text); const result = validate(graph, { lexicon });`
- 통합 호출: `translate(text, { validateWith: lexicon })` (구현 선택 사항)

**근거:** Intent IR 스펙 §14 "Lexicon is the arbiter", theta frame의 required roles는 Lexicon이 결정

---

### D4. ambiguityScore는 측정값이며, triage 결정은 소비자가 한다

**규범:**
- 각 노드는 `ambiguityScore: 0..1`을 가진다 (클수록 모호)
- `auto / ask / reject` 결정은 Translator가 아니라 **소비자 정책**(App/UI/Agent)이 수행한다

**권장 triage 규칙 (소비자 측, non-normative):**

| Condition | Action |
|-----------|--------|
| `score < T_auto` | auto (자동 실행) |
| `T_auto ≤ score < T_reject` | ask (사용자 확인) |
| `score ≥ T_reject` | reject (거부) |

**근거:** 소비자마다 다른 tolerance threshold를 가질 수 있어야 함. Agent는 낮은 threshold로 aggressive하게 auto 실행, Safety-critical App은 높은 threshold로 보수적 운영.

---

### D4-1. ambiguityScore와 resolution.status는 일관성을 유지해야 한다

**규범:**
- `resolution.status = "Resolved"`이면 `missing`은 비어 있어야 한다 (MUST)
- `missing`이 존재하면 `status`는 최소 `"Ambiguous"`여야 한다 (MUST)

---

### D5. "Semantic Projection"은 내부 개념으로 유지하고, 외부에 노출하지 않는다

**규범:**
- 내부 구현/설계 문서에서는 Intent Graph → Manifesto 산출물 변환을 "Semantic Projection"이라 부를 수 있다
- 그러나 **exported API**, **exported error name**, **public docs**에 "SemanticProjection"이라는 단어를 **사용하지 않는다**
- 내부 예외는 외부로 나갈 때 `TranslatorError` 또는 `EmitError`로 매핑한다

**Error Message 규칙:**
- ✅ `"Cannot generate invocation plan: missing DEST role"`
- ❌ `"SemanticProjectionError: target mismatch"`

**근거:** Manifesto 내부의 `Projection(schema, snapshot, intent)`와 용어 충돌 방지, 외부 사용자는 고급 개념을 몰라도 Translator를 사용할 수 있어야 함

---

## Consequences

### Positive

- **레이어 경계 명확화:** Translator가 실행/거버넌스 책임을 오염시키지 않는다
- **Intent IR과의 정합성:** "노드 = IntentIR, lowering = 노드 단위 1:1"로 봉인되어 구현 혼선이 줄어든다
- **재사용성:** 같은 Translator를 다른 정책(tolerance threshold)으로 재사용 가능
- **진입장벽 감소:** 외부 사용자는 "Translator"와 "Intent IR" 개념만 익히면 된다

### Negative / Tradeoffs

- **구현 복잡도:** Intent Graph + 상태성 + 점수 모델을 내부적으로 유지해야 한다
- **Lexicon 의존성:** Conceptual Completeness 검증에 Lexicon이 필요하므로, 도메인 정의 없이는 완전한 검증이 불가능하다

---

## Open Questions (Deferred to ADR-TRANSLATOR-002 or later)

| Question | Notes |
|----------|-------|
| Entity symbolic ref 포맷 | 동일성 불변식은 closed, 문자열 포맷은 open |
| ambiguityScore 산출 알고리즘 | 피처 누락, 다중 후보 분산, 리졸버 불확실성 등 |
| Invocation vs MEL 필요 판정 규칙 | Coverage analysis |

---

## References

- [ARCHITECTURE-v2.0.0](./ARCHITECTURE-v2_0_0.md) — "Does NOT Know" 매트릭스
- [Intent IR v0.2 SPEC](../../../intent-ir/docs/SPEC-v0.2.0.md) — IntentIR 구조, Lowering, Lexicon
- [ADR-001 Layer Separation](./ADR-001-layer-seperation.md) — 레이어 분리 원칙
- [Host FDR-H024](./host-FDR-v2_0_2.md) — Host-Compiler decouple

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 0.1.0 | 2026-01-26 | Initial proposal |
