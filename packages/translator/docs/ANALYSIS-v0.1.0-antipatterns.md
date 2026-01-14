# Translator v0.1.0 구현 분석 및 안티패턴 진단

> **Status:** Analysis Document
> **Version:** 1.0
> **Date:** 2026-01-14
> **Purpose:** SPEC v0.2.0 재설계를 위한 기초 분석

---

## 1. 개요

이 문서는 Translator v0.1.0의 SPEC과 구현을 Manifesto 아키텍처 원칙에 따라 분석하고, 발견된 안티패턴을 진단한다. v0.2.0 SPEC 재설계의 근거 문서로 활용된다.

### 1.1 분석 범위

| 대상 | 파일 |
|------|------|
| SPEC v0.1.0 | `docs/SPEC-0.1.0v.md` |
| 구현 코드 | `src/**/*.ts` (~1,472 lines) |
| FDR v0.2.0 | `docs/FDR-0.2.0v.md` |

### 1.2 분석 결론 (요약)

**현재 Translator는 Manifesto가 아니라 "Manifesto 옆에서 동작하는 별도 시스템"이다.**

- Core.compute() 호출 **ZERO**
- World.submitProposal() 호출 **ZERO**
- Host.executeEffect() 호출 **ZERO**
- 별도 TranslatorState 관리 → World Protocol과 40-50% 책임 중복

---

## 2. Manifesto 아키텍처 개요

### 2.1 계층 구조 및 데이터 흐름

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Actor (User/Agent)                            │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │ Natural Language / UI Event
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Translator                    │  Bridge                                │
│  PF → IntentIR → IntentBody    │  SourceEvent → Projection → IntentBody │
└────────────────────────────────┴────────────────────────────────────────┘
                                 │ IntentBody
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        App (Facade Layer)                               │
│  - app.act(type, input) → ActionHandle                                  │
│  - app.getState() → AppState                                            │
│  - app.getDomainSchema() → DomainSchema                                 │
│  - app.subscribe(selector, listener)                                    │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │ Intent submission
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    World Protocol (Governance Layer)                    │
│  - Proposal 생성 및 큐잉                                                │
│  - Authority 평가 (approve/reject/constrain)                            │
│  - Decision 기록                                                        │
│  - Lineage (DAG) 관리                                                   │
│  - intentKey 계산 (createIntentInstance)                                │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │ Approved Intent
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      Host (Execution Layer)                             │
│  - Compute Loop 오케스트레이션                                          │
│  - Effect 실행 (EffectHandler)                                          │
│  - Patch 적용 (apply)                                                   │
│  - Requirement 이행                                                     │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │ compute() calls
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       Core (Pure Computation)                           │
│  - compute(schema, snapshot, intent) → ComputeResult                    │
│  - apply(schema, snapshot, patches) → Snapshot'                         │
│  - Flow 해석                                                            │
│  - Expression 평가                                                      │
│  - Patch/Requirement 생성                                               │
│  - Trace 생성                                                           │
└─────────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          Snapshot (The Truth)                           │
│  - data: 도메인 상태                                                    │
│  - computed: 파생 값                                                    │
│  - system: 시스템 상태                                                  │
│  - meta: 버전, 타임스탬프, 해시                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 각 모듈의 책임

| 모듈 | 핵심 책임 | MUST NOT |
|------|----------|----------|
| **Core** | 순수 의미 계산, Flow 해석, Patch 생성, Trace 생성 | IO, 시간, 효과 실행, 상태 변경 |
| **Host** | Effect 실행, Patch 적용, Compute Loop | 정책 결정, 의미 해석, 효과 억제 |
| **World** | Proposal 관리, Authority 평가, Lineage, intentKey 계산 | Effect 실행, Patch 적용, 숨겨진 채널 |
| **App** | Facade, 오케스트레이션, Schema/State 접근 | 직접 계산, 효과 실행, 거버넌스 |
| **Bridge** | UI↔Domain 양방향 바인딩, Projection | 상태 변경, Patch 적용, 효과 실행 |
| **Builder** | Type-safe DSL, Zod-first Schema 정의 | 실행, compute/apply 호출 |

### 2.3 핵심 원칙: Sovereignty (주권)

```typescript
// Core의 유일한 역할: 순수 계산
core.compute(schema, snapshot, intent, context) → ComputeResult

// Host의 유일한 역할: 효과 실행
host.executeEffect(requirement) → Patch[]

// World의 유일한 역할: 거버넌스
world.submitProposal(actor, intent) → ProposalResult

// App의 유일한 역할: Facade
app.act(type, input) → ActionHandle
```

### 2.4 올바른 Manifesto 데이터 흐름

```
Actor → App.act("translator.translate", { text })
         │
         ▼
       World.submitProposal(actor, intent)
         │
         ├── Authority.evaluate() → approve/reject
         │
         ▼ (approved)
       Host.execute(intent)
         │
         ├── Core.compute(schema, snapshot, intent)
         │     │
         │     ├── Flow 해석 (once, when, patch, effect)
         │     ├── Requirement 생성 { type: "translator.llm.propose", ... }
         │     └── Trace 생성
         │
         ├── Host.executeEffect(requirement)
         │     │
         │     └── LLM 호출 → Patch[] 반환
         │
         └── Core.apply(patches) → Snapshot'
         │
         ▼
       New World (immutable)
```

---

## 3. SPEC v0.1.0 구조 분석

### 3.1 정의된 구조

```
┌─────────────────────────────────────────────────────────────┐
│  7-Stage Pipeline (TypeScript)                              │
│  S1: Normalize → S2: Propose(LLM) → S3: Canonicalize       │
│  → S4: Feature Check → S5: Resolve Refs → S6: Lower        │
│  → S7: Validate ActionBody                                  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  TranslatorState (별도 상태 관리)                            │
│  - schema/schemaHash    ← App과 중복                        │
│  - requests[]           ← World ProposalRecord와 중복       │
│  - learnedEntries{}     ← 휘발성 (영속성 없음)               │
│  - simKey/intentKey     ← World 관심사                      │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 SPEC에서 정의한 TranslatorState (§8.1)

```typescript
type TranslatorState = {
  schema: DomainSchema | null;           // App 중복
  schemaHash: string | null;             // App 중복
  requests: TranslateRequest[];          // World 중복!
  lastRequestId: string | null;
  pendingMappings: PendingMapping[];
  learnedEntries: Record<string, LearnedEntry>;  // 영속성 없음
  config: TranslatorConfig;
};
```

### 3.3 SPEC에서 정의한 Pipeline (§5.1)

| Stage | 역할 | 결정론성 |
|-------|------|----------|
| S1: Normalize | PF 정규화 | 결정론적 |
| S2: Propose | LLM으로 IntentIR 생성 | **비결정론적** |
| S3: Canonicalize | IntentIR 정규화 + simKey 도출 | 결정론적 |
| S4: Feature Check | Lexicon 기반 검증 | 결정론적 |
| S5: Resolve Refs | this/that/last → id | 결정론적 |
| S6: Lower | IntentIR → IntentBody + intentKey | 결정론적 |
| S7: Validate | ActionBody 구조 검증 | 결정론적 |

---

## 4. 현재 구현 분석

### 4.1 파일 구조

```
packages/translator/src/
├── types/           # ~322 lines
│   ├── state.ts         # TranslatorState, TranslateRequest
│   ├── actions.ts       # Action I/O types
│   ├── errors.ts        # TranslatorError
│   ├── lexicon.ts       # LearnedEntry, PendingMapping
│   └── action-body.ts   # ActionBody AST
├── actions/         # ~350 lines
│   ├── translate.ts     # translate action (S1-S7 전체)
│   ├── lower.ts         # lower action (S3-S7)
│   ├── resolve.ts       # resolve action
│   └── learn.ts         # learn action
├── pipeline/        # ~500 lines
│   ├── normalize.ts     # S1
│   ├── propose.ts       # S2
│   ├── canonicalize.ts  # S3
│   ├── feature-check.ts # S4
│   ├── resolve-refs.ts  # S5
│   ├── lower.ts         # S6
│   └── validate-action-body.ts # S7
├── lexicon/         # ~250 lines
│   ├── builtin.ts       # Builtin Operator Lexicon
│   ├── project.ts       # Project Lexicon
│   ├── learned.ts       # Learned Lexicon
│   └── composite.ts     # 3-layer composite
└── keys/            # ~50 lines
    └── sim-key-hex.ts   # SimKey serialization
────────────────────────────────────────
Total: ~1,472 lines (추정)
```

### 4.2 현재 데이터 흐름 (안티패턴)

```
Actor → Translator.translate(text, context)
         │
         ├── normalize(text)           # TypeScript 직접 실행
         ├── propose(text, llmClient)  # LLM 직접 호출 (Host 우회!)
         ├── canonicalize(ir)          # TypeScript 직접 실행
         ├── featureCheck(ir, lexicon) # TypeScript 직접 실행
         ├── resolveReferences(ir)     # TypeScript 직접 실행
         ├── lowerIR(ir, lexicon)      # intentKey 계산 (World 중복!)
         └── validateActionBody(body)  # TypeScript 직접 실행
         │
         ├── TranslatorState.requests.push(request)  # 별도 상태!
         │
         ▼
       TranslateOutput { requestId, result, simKey, intentKey }

       ❌ Core.compute() 호출 ZERO
       ❌ World.submitProposal() 호출 ZERO
       ❌ Host.executeEffect() 호출 ZERO
       ❌ Snapshot 변경 ZERO
```

---

## 5. 안티패턴 진단

### 5.1 안티패턴 #1: Core 우회 (가장 심각)

**위치:** `actions/translate.ts:68-230`

```typescript
// ❌ 현재 구현
export async function translate(input, context): Promise<TranslateOutput> {
  // S1-S7 파이프라인 직접 실행
  const normalizeResult = normalize(input.text);
  const proposeResult = await propose(...);        // LLM 직접 호출!
  const canonicalizeResult = canonicalize(ir);
  const featureCheckResult = featureCheck(...);
  const resolveResult = resolveReferences(...);
  const lowerResult = lowerIR(...);
  const validateResult = validateActionBody(...);

  // core.compute() 호출 ZERO
  return { requestId, result, simKey, intentKey };
}
```

**위반 원칙:**
- "Core computes. Host executes. These concerns never mix."
- Core가 Trace를 생성할 수 없음 (투명성 상실)
- Flow 해석이 Core 바깥에서 발생 (결정론성 검증 불가)
- Snapshot 기반 상태 관리가 아님 (재현 불가능)

**영향:**
| 측면 | 올바른 구조 | 현재 구현 |
|------|------------|----------|
| Trace 생성 | Core가 자동 생성 | 없음/수동 |
| 결정론성 검증 | Core가 보장 | 검증 불가 |
| 재현성 | Snapshot으로 가능 | 불가능 |

---

### 5.2 안티패턴 #2: World Protocol 우회

**위치:** `pipeline/lower.ts:110`

```typescript
// ❌ 현재 구현: Translator가 intentKey 직접 계산
const intentKey = deriveIntentKeySync(body, schemaHash);

// ✅ 올바른 방식: World가 intentKey 계산
// world/factories.ts
export async function createIntentInstance(opts): Promise<IntentInstance> {
  const intentKey = await computeIntentKey(opts.schemaHash, opts.body);
  return { body, intentId, intentKey, meta };
}
```

**위반 원칙:**
- intentKey는 World의 Identity System
- "World Protocol governs legitimacy, authority, and lineage"

**영향:**
- intentKey 중복 계산 (성능 낭비)
- 알고리즘 불일치 위험 (다른 결과 가능)
- 소유권 혼란 (누가 intentKey를 관리하는가?)

---

### 5.3 안티패턴 #3: 별도 상태 관리

**위치:** `types/state.ts:255-270`

```typescript
// ❌ 현재 구현
export type TranslatorState = {
  readonly schema: unknown | null;           // App.getDomainSchema()와 중복
  readonly schemaHash: string | null;        // App.getDomainSchema().hash와 중복
  readonly requests: readonly TranslateRequest[];  // World.listProposals()와 중복!
  readonly learnedEntries: Record<string, LearnedEntry>;  // 영속성 없음
};

// ✅ 올바른 방식: Snapshot이 유일한 진실
world.listProposals() → ProposalRecord[]
snapshot.data.learnedLexicon → Record<string, LearnedEntry>
```

**위반 원칙:**
- "If it's not in Snapshot, it doesn't exist."
- "Single source of truth"

**영향:**
| 문제 | 결과 |
|------|------|
| 두 개의 진실 소스 | 동기화 로직 필요 → 버그 |
| Translator 재시작 | requests[] 손실 |
| World Lineage | 추적 불가능 |

---

### 5.4 안티패턴 #4: Host 우회 (Effect 직접 실행)

**위치:** `actions/translate.ts:100-107`

```typescript
// ❌ 현재 구현
const proposeResult = await propose(
  { normalizedText, lang, lexicon },
  llmClient  // LLM을 직접 호출!
);

// ✅ 올바른 방식: Host가 Effect 실행
// MEL에서 effect 선언 → Host가 실행
flow.effect("translator.llm.propose", { text: normalizedText })
// Host's EffectExecutor가 LLM 호출
```

**위반 원칙:**
- "Core declares requirements. Host fulfills them. Core never executes IO."

**영향:**
- Host의 Effect 추적/로깅 누락
- Requirement 시스템 우회
- 재시도/에러 핸들링 일관성 없음

---

### 5.5 안티패턴 #5: App Facade 불완전 사용

**위치:** `actions/translate.ts:44-53`

```typescript
// ❌ 현재 구현
interface TranslateContext = {
  readonly app: App;                 // App은 사용하지만...
  readonly llmClient: LLMClient;     // 별도 의존성
  readonly state: TranslatorState;   // 별도 상태!
};

// ✅ FDR-TAPP-001이 요구하는 방식
// Translator는 App contract만 사용
translate(text: string, app: App): Promise<IntentBody>
// App 내부에서 World → Host → Core 흐름
```

**위반 원칙:**
- FDR-TAPP-001: "Translator App's public API requires only the App interface."
- SPEC §4.2 TAPP-ARCH-1

---

## 6. 중복 분석 상세

### 6.1 World Protocol과의 중복

| TranslatorState 필드 | World Protocol 대응 | 중복률 |
|---------------------|---------------------|--------|
| `requests[]` | `WorldStore.listProposals()` | 100% |
| `intentKey` | `IntentInstance.intentKey` | 100% |
| `simKey` | (World에 저장 필요) | 이동 필요 |
| `schema/schemaHash` | `app.getDomainSchema()` | 100% |

### 6.2 코드 라인 영향

| 컴포넌트 | v0.1.0 Lines | v0.2.0 예상 | 제거 |
|----------|-------------|-------------|------|
| State types | ~320 | ~50 | ~270 |
| Actions | ~350 | ~100 | ~250 |
| Pipeline | ~500 | ~200 (effects) | ~300 |
| Lexicon | ~250 | ~250 (유지) | 0 |
| **Total** | **~1,420** | **~600** | **~820 (58%)** |

---

## 7. 원칙 위반 요약

| Manifesto 원칙 | 올바른 구조 | 현재 Translator | 위반 |
|----------------|------------|-----------------|------|
| "Core computes" | Core.compute()가 모든 계산 | TypeScript 함수가 직접 계산 | ❌ |
| "Host executes" | Host가 Effect 실행 | LLM 직접 호출 | ❌ |
| "World governs" | World가 모든 Intent 관리 | 별도 TranslatorState | ❌ |
| "Snapshot = Truth" | Snapshot이 유일한 상태 | requests[], learnedEntries 별도 | ❌ |
| "Same input → Same output" | Core가 보장 | 검증 불가 | ❌ |
| "Trace everything" | Core가 자동 생성 | 수동 또는 없음 | ❌ |
| "App contract only" | App facade만 사용 | 별도 의존성 (llmClient, state) | ⚠️ |

---

## 8. v0.2.0 재설계 방향

### 8.1 제거 대상

| 컴포넌트 | 이유 |
|----------|------|
| TranslatorState 전체 | World/App으로 대체 |
| requests[] | World.listProposals() |
| schema/schemaHash 저장 | app.getDomainSchema() |
| intentKey 계산 | World가 담당 |
| TypeScript Pipeline | MEL action flow |

### 8.2 유지 대상

| 컴포넌트 | 이유 |
|----------|------|
| Key derivation (Intent IR) | 올바른 위임 |
| Lexicon interface | 올바른 추상화 |
| ActionBody AST | MEL 변환 시 필요 |
| Error types | 에러 모델 유효 |

### 8.3 전환 대상

| v0.1.0 | v0.2.0 |
|--------|--------|
| normalize() 함수 | `effect translator.normalize` |
| propose() 함수 | `effect translator.llm.propose` |
| 7-stage pipeline | MEL action flow |
| TranslatorState | Domain state in Snapshot |
| learnedEntries | `snapshot.data.learnedLexicon` |

---

## 9. 결론

**현재 Translator v0.1.0은 Manifesto 아키텍처와 구조적으로 불일치한다.**

핵심 문제:
1. **TypeScript Pipeline이 Core/Host/World를 완전히 우회**
2. **TranslatorState가 World Protocol과 40-50% 책임 중복**
3. **FDR-TAPP-001 ("App contract only") 사실상 위반**

v0.2.0에서는 Translator를 MEL Domain으로 재설계하여:
- Core가 Flow를 해석
- Host가 Effect를 실행
- World가 상태를 관리
- Snapshot이 유일한 진실

**이렇게 해야 진정한 Manifesto App이 된다.**

---

## Appendix A: 참조 문서

| 문서 | 위치 |
|------|------|
| SPEC v0.1.0 | `docs/SPEC-0.1.0v.md` |
| FDR v0.1.0 | `docs/FDR-0.1.0v.md` |
| FDR v0.2.0 | `docs/FDR-0.2.0v.md` |
| Manifesto Constitution | `/CLAUDE.md` |

---

*Prepared by: Claude (Opus 4.5)*
*Date: 2026-01-14*
