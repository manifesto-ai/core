# FDR-Memory v1.0: Memory as Interpreted Recall

> **Status:** Draft  
> **Author:** eggplantiny  
> **Date:** 2026-01-02  
> **Supersedes:** FDR-Memory v0.3.0  
> **Related:** World Protocol SPEC v1.0, Intent & Projection SPEC v1.0

---

## 1. Executive Summary

이 FDR은 Manifesto 시스템에서 **Memory**(과거 World/Snapshot 정보의 검색 및 활용)를 어떻게 다룰지에 대한 설계 근거를 정의한다.

핵심 결정:
- Memory는 **Truth가 아니라 해석**이다
- Memory 선택은 **비결정론적**이며, 이를 숨기지 않고 **추적**한다
- 스펙은 **"무엇을 기록할 것인가"**만 정의하고, **"어떻게 선택할 것인가"**는 구현에 맡긴다
- 책임 추적을 위해 **selector**를 명시적으로 기록한다

---

## 2. Problem Statement

### 2.1 배경

LLM 기반 Agent가 장기 실행되면, context window만으로는 모든 과거 상태를 담을 수 없다. "기억"이 필요하다.

### 2.2 문제

```
┌─────────────────────────────────────────────────────────────┐
│  Memory의 본질적 딜레마                                      │
├─────────────────────────────────────────────────────────────┤
│  1. Memory는 불완전하다 (모든 것을 기억할 수 없다)            │
│  2. Memory 선택은 주관적이다 (무엇이 "관련 있는가"는 해석)     │
│  3. Memory는 왜곡될 수 있다 (summary ≠ original)             │
│  4. 그러나 Agent는 Memory 없이는 장기 작업을 수행할 수 없다   │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 요구사항

| ID | 요구사항 |
|----|----------|
| R-1 | Memory 사용이 World 불변성을 훼손하면 안 된다 |
| R-2 | Memory 선택 과정이 감사 가능해야 한다 |
| R-3 | Memory 기반 결정의 책임 소재가 명확해야 한다 |
| R-4 | Memory의 불완전성이 명시적이어야 한다 |

---

## 3. Design Philosophy

### 3.1 핵심 원칙

> **Memory는 LLM이 "과거를 해석"하는 것이지, "과거를 안다"는 게 아니다.**

Manifesto에서 LLM은 **interpreter**다. LLM이 직접 세계를 바꾸지 않고, semantic space 안에서 해석하고 선택한다. Memory도 이 원칙을 따른다:

| Manifesto 원칙 | Memory에의 적용 |
|----------------|-----------------|
| LLM은 interpreter | Memory 선택도 해석 행위 |
| 모든 선택은 trace로 | Memory 선택도 MemoryTrace로 |
| World는 불변 | Memory는 World를 참조만 함 |

### 3.2 결정론에 대한 정직한 입장

**Memory 선택은 비결정론적이다.** 같은 query, 같은 시점에서 다른 memory가 선택될 수 있다.

이것을 숨기려 하지 않는다. 대신:

```
┌─────────────────────────────────────────────────────────────┐
│  결정론의 경계                                               │
├─────────────────────────────────────────────────────────────┤
│  World → Projection → Snapshot    : 결정론적 (SPEC 보장)     │
│  Intent 생성 (LLM 개입)            : 비결정론적 (허용)        │
│  Memory Selection                  : 비결정론적 (허용)        │
│  Memory Selection의 결과           : Trace로 기록됨           │
└─────────────────────────────────────────────────────────────┘
```

**왜 이게 일관적인가?**

Intent 생성 자체가 이미 LLM의 비결정론적 행위다. Memory 선택은 Intent 생성의 일부이므로, 같은 취급을 받아야 한다. 중요한 건 비결정론을 **숨기는 게 아니라 추적하는 것**이다.

### 3.3 최소주의 (Minimalism)

> **스펙은 "무엇을 기록해야 하는가"만 정의한다.**
> **"어떻게 선택하는가"는 정의하지 않는다.**

과잉 설계를 제거하고 본질만 남긴다. 부족할 때 추가하는 게 과잉 설계를 나중에 제거하는 것보다 낫다.

---

## 4. Core Types

### 4.1 MemoryRef

```typescript
/**
 * 과거 World에 대한 참조.
 * worldId만으로 충분하다. snapshotHash는 불필요.
 */
type MemoryRef = {
  readonly worldId: WorldId;
};
```

**설계 근거:**
- `worldId`는 World Protocol에서 이미 `hash(schemaHash + ':' + snapshotHash)`로 정의됨
- 별도의 `snapshotHash` 필드는 중복
- 단일 필드로 참조의 단순성 확보

### 4.2 SelectedMemory

```typescript
/**
 * 선택된 기억과 그 맥락.
 */
type SelectedMemory = {
  readonly ref: MemoryRef;        // 어떤 World를 참조하는가
  readonly reason: string;        // 왜 이것을 선택했는가
  readonly confidence: number;    // 0-1, 관련성 판단의 확신도
  readonly verified: boolean;     // 원본 존재가 확인되었는가
};
```

**설계 근거:**

| 필드 | 왜 필요한가 |
|------|-------------|
| `ref` | 원본 참조. Memory ≠ Truth 원칙의 핵심. |
| `reason` | 선택 근거. 감사 가능성의 핵심. |
| `confidence` | 선택자의 확신 표현. 0-1 범위로 정규화. |
| `verified` | 원본 존재 확인 여부. boolean으로 충분. |

**왜 4단계 VerificationStatus가 아닌가:**

원래 스펙:
```typescript
type VerificationStatus = 
  | 'unverified' 
  | 'hash_verified' 
  | 'content_loaded' 
  | 'verification_failed';
```

이것의 문제:
1. `hash_verified`와 `content_loaded`의 실질적 차이가 불명확
2. 실패 이유(`verification_failed`)는 구현이 로깅하면 됨
3. 4단계 상태 머신은 구현 복잡도 증가

`verified: boolean`이 충분한 이유:
- 핵심 질문은 "원본을 신뢰할 수 있는가?" → Yes/No
- 실패 세부사항은 trace나 로그의 영역

### 4.3 MemoryTrace

```typescript
/**
 * Memory 선택 과정의 기록.
 * Proposal.trace.context.memory에 첨부된다.
 */
type MemoryTrace = {
  readonly selector: ActorRef;                    // 누가 선택했는가
  readonly query: string;                         // 무엇을 찾으려 했는가
  readonly selectedAt: number;                    // 언제 선택했는가 (timestamp)
  readonly atWorldId: WorldId;                    // 어느 World 시점에서 선택했는가
  readonly selected: readonly SelectedMemory[];  // 무엇을 선택했는가
};
```

**설계 근거:**

| 필드 | 책임 추적 질문 |
|------|----------------|
| `selector` | **누가** 이 선택을 했는가? |
| `query` | **왜** (무엇을 위해) 검색했는가? |
| `selectedAt` | **언제** 선택이 이루어졌는가? |
| `atWorldId` | **어떤 맥락**에서 선택했는가? |
| `selected` | **무엇을** 선택했는가? |

**왜 `selector`가 필수인가:**

```
문제 발생 시 책임 추적:

MemoryTrace.selector    →  "이 memory를 선택한 주체"
Proposal.actor          →  "이 Intent를 제출한 주체"  
DecisionRecord.authority →  "이 Proposal을 승인한 주체"

세 지점이 모두 ActorRef로 기록되면:
- 잘못된 memory 선택    → selector 책임
- memory를 부적절하게 사용 → proposal.actor 책임
- 부적절한 Proposal 승인  → authority 책임
```

`selector`가 없으면 첫 번째 책임 지점이 사라진다.

---

## 5. Rules

### 5.1 Core Rules

| ID | 규칙 | 근거 |
|----|------|------|
| **M-1** | Memory는 Truth가 아니다. `SelectedMemory.ref`로 원본을 확인해야 진실이다. | Memory의 본질적 불완전성 인정 |
| **M-2** | Memory를 사용한 Proposal은 `trace.context.memory: MemoryTrace`를 포함해야 한다. | 감사 가능성 보장 |
| **M-3** | Memory 선택은 Proposal 제출 전에 완료되어야 한다. | Projection 결정론 보호 |
| **M-4** | Authority는 MemoryTrace를 보고 정책 판단할 수 있다. 선택을 다시 수행하지 않는다. | 책임 분리 (Selector ≠ Authority) |

### 5.2 Rule Details

#### M-1: Memory ≠ Truth

```typescript
// ❌ 잘못된 사용
const decision = makeDecision(memory.summary);  // summary를 사실로 취급

// ✅ 올바른 사용
const original = await loadWorld(memory.ref.worldId);
const decision = makeDecision(original.snapshot);  // 원본으로 확인
```

Memory의 `summary`, `reason`, `confidence`는 모두 **해석**이다. 유일한 진실은 `ref`가 가리키는 원본 World/Snapshot이다.

#### M-2: Trace 필수

```typescript
const proposal: Proposal = {
  proposalId: 'prop-123',
  actor: callingActor,
  intent: { type: 'order.suggest', input: { ... } },
  baseWorld: 'world-456',
  submittedAt: Date.now(),
  status: 'submitted',
  trace: {
    summary: 'Order suggestion based on historical patterns',
    reasoning: 'Analyzed past order data',
    context: {
      // Memory 사용 시 필수
      memory: {
        selector: { actorId: 'agent-001', kind: 'agent' },
        query: '이전 주문 패턴',
        selectedAt: 1704153600000,
        atWorldId: 'world-456',
        selected: [
          { 
            ref: { worldId: 'world-100' }, 
            reason: '유사 상황의 주문 기록', 
            confidence: 0.85,
            verified: true 
          }
        ]
      } satisfies MemoryTrace
    }
  }
};
```

#### M-3: 선택 시점 제약

```
┌─────────────────────────────────────────────────────────────────┐
│  Actor Reasoning Phase (Memory 선택 허용)                        │
│    1. Memory 검색 요청                                           │
│    2. 선택 수행                                                  │
│    3. Intent 구성                                                │
└─────────────────────────────────────────────────────────────────┘
                              ↓ Proposal 제출
┌─────────────────────────────────────────────────────────────────┐
│  World Protocol Scope (Memory 선택 금지)                         │
│    - Authority 판단                                              │
│    - Projection 실행                                             │
└─────────────────────────────────────────────────────────────────┘
```

**왜 Projection에서 Memory 선택이 금지되는가:**

Projection은 결정론적이어야 한다 (Intent & Projection SPEC). Memory 선택은 비결정론적이다. 따라서 Projection 내에서 Memory를 선택하면 Projection 결정론이 깨진다.

#### M-4: Authority의 역할

Authority는:
- MemoryTrace를 **검토**할 수 있다
- `verified: false`인 memory 기반 고위험 Intent를 **거부**할 수 있다
- 선택을 **다시 수행하지 않는다** (그건 Selector의 역할)

```typescript
// Authority 구현 예시 (스펙 아님)
function evaluateMemoryUsage(trace: MemoryTrace, proposal: Proposal): Decision {
  // 정책은 Authority가 정의
  if (isHighRisk(proposal.intent) && trace.selected.some(m => !m.verified)) {
    return reject("Unverified memory for high-risk intent");
  }
  return approve();
}
```

---

## 6. What This Spec Does NOT Define

### 6.1 의도적 생략 목록

| 생략된 것 | 이유 | 대안 |
|-----------|------|------|
| Hot/Warm/Cold 분류 | 구현 세부사항 | Implementation Guide에서 권장 |
| RetrievalLens | YAGNI. 90%는 "최근 N개"만 사용 | 필요 시 v1.1에서 추가 |
| VerificationStatus 4단계 | boolean으로 충분 | 실패 세부는 로깅 |
| WorldDistance/Staleness | Edge 수 ≠ 의미적 staleness | 잘못된 metric은 없는 게 나음 |
| MemoryBroker 인터페이스 | 구현 재량 | Implementation Guide에서 예시 |
| MemoryGovernancePolicy | Authority 스펙의 영역 | Authority SPEC에 위임 |
| 저장소 구조 | Vector DB, SQL 등은 구현 선택 | Implementation Guide |
| 검색 알고리즘 | Embedding, keyword 등은 구현 선택 | Implementation Guide |

### 6.2 구현자 재량

| 영역 | 자유도 |
|------|--------|
| **저장소** | Vector DB, SQL, 파일 시스템... |
| **검색** | Embedding similarity, keyword matching, hybrid... |
| **Relevance scoring** | LLM 사용 여부, 모델 선택, threshold... |
| **Verification** | Hash 검증, existence 체크, content 비교... |
| **Failure handling** | 재시도, fallback, 사용자 알림... |

스펙은 **기록 형식**만 강제한다. **선택 방법**은 강제하지 않는다.

---

## 7. Integration with World Protocol

### 7.1 Extension Point

Memory는 기존 World Protocol의 확장 지점을 사용한다:

```typescript
// World Protocol의 Proposal.trace.context 활용
type ProposalTrace = {
  summary: string;
  reasoning?: string;
  context?: {
    memory?: MemoryTrace;  // Memory 스펙이 정의하는 부분
    // 다른 context 확장 가능
  };
};
```

새로운 top-level 필드를 추가하지 않는다. **Minimal Invasion** 원칙.

### 7.2 Actor Identity 재사용

`MemoryTrace.selector`는 World Protocol의 `ActorRef`를 그대로 사용한다:

```typescript
type ActorRef = {
  readonly actorId: ActorId;
  readonly kind: ActorKind;
  readonly name?: string;
  readonly meta?: Record<string, unknown>;
};
```

별도의 `BrokerIdentifier` 타입을 만들지 않는다. 기존 타입 시스템 재사용.

### 7.3 WorldId 참조

`MemoryRef.worldId`는 World Protocol의 `WorldId`를 그대로 사용한다:

```typescript
// World Protocol 정의
type WorldId = string;  // hash(schemaHash + ':' + snapshotHash)
```

Memory는 World를 **참조**만 하고, **수정하지 않는다**.

---

## 8. Responsibility Model

### 8.1 책임 지점

```
┌─────────────────────────────────────────────────────────────┐
│  Stage 1: Selection                                         │
│  책임자: MemoryTrace.selector                                │
│  실패 유형: 부적절한 memory 선택, 관련 없는 결과 반환          │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  Stage 2: Usage                                             │
│  책임자: Proposal.actor                                      │
│  실패 유형: Memory를 부적절하게 사용, unverified 신뢰          │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  Stage 3: Approval                                          │
│  책임자: DecisionRecord.authority                            │
│  실패 유형: 위험한 memory 사용 승인, 정책 미적용               │
└─────────────────────────────────────────────────────────────┘
```

### 8.2 selector = actor인 경우

```typescript
// Actor가 직접 선택하고 제출하는 경우
const trace: MemoryTrace = {
  selector: { actorId: 'agent-001', kind: 'agent' },
  // ...
};

const proposal: Proposal = {
  actor: { actorId: 'agent-001', kind: 'agent' },  // 동일
  // ...
};
```

이 경우에도 둘 다 기록한다. 이유:
- 선택 시점과 제출 시점이 다를 수 있음
- 나중에 분리될 가능성
- 명시적 기록 > 암묵적 가정

---

## 9. End-to-End Flow

```
1. Actor가 과거 정보 필요성 인식
   │
   ▼
2. Memory 검색 수행
   ├── query: "이전 주문 패턴"
   ├── 검색 시스템이 candidates 반환 (구현 세부)
   └── Actor/LLM이 relevance 판단하여 선택
   │
   ▼
3. MemoryTrace 생성
   {
     selector: { actorId: 'agent-001', kind: 'agent' },
     query: "이전 주문 패턴",
     selectedAt: 1704153600000,
     atWorldId: "world-456",
     selected: [
       { ref: { worldId: "world-100" }, 
         reason: "유사 상황의 주문 기록", 
         confidence: 0.85,
         verified: true }
     ]
   }
   │
   ▼
4. Intent 구성 (선택된 memory 기반)
   │
   ▼
5. Proposal 생성 (trace.context.memory 포함)
   │
   ▼
6. Authority 검토
   ├── Intent 타당성 검토
   └── MemoryTrace 기반 정책 검토 (선택적)
   │
   ▼
7. 승인 → World 진행
```

---

## 10. Comparison with Previous Design

### 10.1 정량적 비교

| 측면 | v0.3.0 (이전) | v1.0 (현재) |
|------|--------------|-------------|
| 타입 수 | ~25개 | 3개 |
| 규칙 수 | ~100개 | 4개 |
| 섹션 수 | 17개 | 10개 |

### 10.2 삭제된 것들

| 삭제 | v0.3.0 정의 | v1.0 결정 | 근거 |
|------|------------|-----------|------|
| Hot/Warm/Cold | 3-tier 명세 | 생략 | 구현 세부 |
| RetrievalLens | 복잡한 옵션 | 생략 | YAGNI |
| VerificationStatus | 4단계 enum | boolean | 단순화 |
| WorldDistance | edges + LCA | 생략 | 잘못된 metric |
| MemoryBroker | 인터페이스 정의 | 생략 | 구현 재량 |
| MemoryGovernancePolicy | 정책 타입 | 생략 | Authority 영역 |

### 10.3 유지된 것들

| 유지 | 이유 |
|------|------|
| Memory ≠ Truth 원칙 | 본질적으로 옳음 |
| Trace 필수 | 감사 가능성의 핵심 |
| Proposal 제출 전 선택 | Projection 결정론 보호 |
| Selector/Authority 분리 | 책임 분리 원칙 |
| trace.context.memory 통합 | Minimal Invasion |

---

## 11. Open Questions

### 11.1 향후 고려 사항

| 질문 | 현재 입장 | 재검토 조건 |
|------|----------|-------------|
| RetrievalLens 필요한가? | 불필요 | 실제 사용에서 "최근 N개" 외 패턴 발견 시 |
| Staleness metric 필요한가? | 불필요 | 의미적 staleness 정의 가능 시 |
| 실패 세부 타입 필요한가? | 로깅으로 충분 | 실패 패턴 분류 필요 시 |

### 11.2 확장 가능성

```typescript
// v1.1에서 추가될 수 있는 것들 (예시)
type SelectedMemory = {
  // v1.0
  readonly ref: MemoryRef;
  readonly reason: string;
  readonly confidence: number;
  readonly verified: boolean;
  
  // v1.1 후보 (필요 시)
  readonly verificationDetail?: VerificationDetail;
  readonly contentSummary?: string;
};
```

현재 스펙은 확장에 열려 있다. 필드 추가는 backward-compatible.

---

## 12. Conformance

### 12.1 필수 요구사항

| ID | 요구사항 |
|----|----------|
| C-1 | Memory 사용 Proposal은 `trace.context.memory: MemoryTrace`를 포함해야 한다 |
| C-2 | `MemoryTrace.selector`는 유효한 ActorRef여야 한다 |
| C-3 | `MemoryTrace.selected`의 모든 항목은 `ref.worldId`가 유효해야 한다 |
| C-4 | Memory 선택은 Proposal 제출 전에 완료되어야 한다 |
| C-5 | Projection 구현은 Memory 선택을 수행하면 안 된다 |

### 12.2 검증 방법

```typescript
function validateMemoryTrace(trace: MemoryTrace): ValidationResult {
  const errors: string[] = [];
  
  // C-2: selector 검증
  if (!isValidActorRef(trace.selector)) {
    errors.push('Invalid selector ActorRef');
  }
  
  // C-3: worldId 검증
  for (const memory of trace.selected) {
    if (!isValidWorldId(memory.ref.worldId)) {
      errors.push(`Invalid worldId: ${memory.ref.worldId}`);
    }
  }
  
  // confidence 범위 검증
  for (const memory of trace.selected) {
    if (memory.confidence < 0 || memory.confidence > 1) {
      errors.push(`Confidence out of range: ${memory.confidence}`);
    }
  }
  
  return errors.length === 0 
    ? { valid: true } 
    : { valid: false, errors };
}
```

---

## 13. Appendix

### A. Type Summary

```typescript
type MemoryRef = {
  readonly worldId: WorldId;
};

type SelectedMemory = {
  readonly ref: MemoryRef;
  readonly reason: string;
  readonly confidence: number;  // 0-1
  readonly verified: boolean;
};

type MemoryTrace = {
  readonly selector: ActorRef;
  readonly query: string;
  readonly selectedAt: number;
  readonly atWorldId: WorldId;
  readonly selected: readonly SelectedMemory[];
};
```

### B. Cross-Reference

| 참조 타입 | 출처 |
|----------|------|
| `WorldId` | World Protocol SPEC §4.1 |
| `ActorRef` | Intent & Projection SPEC §3.1 |
| `Proposal` | World Protocol SPEC §6.2 |
| `ProposalTrace` | World Protocol SPEC §6.2 |

### C. Revision History

| Version | Date | Changes |
|---------|------|---------|
| 0.3.0 | - | Initial comprehensive design |
| 1.0.0 | 2026-01-02 | Radical simplification: 3 types, 4 rules |

---

*End of FDR-Memory v1.0*
