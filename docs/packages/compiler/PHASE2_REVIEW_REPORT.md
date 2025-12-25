# @manifesto-ai/compiler Phase 2 완료 보고서

## 개요

이 보고서는 `@manifesto-ai/compiler` 프로젝트의 Phase 2 완료 시점 형상을 설명합니다.

---

## 1. 패키지 구조

```
packages/
├── core/                        # @manifesto-ai/core (v0.3.0)
│   ├── src/
│   │   ├── domain/              # 도메인 정의 및 검증
│   │   ├── expression/          # DSL 표현식 (파싱, 평가, 분석)
│   │   ├── effect/              # 부수효과 시스템 (Result monad)
│   │   ├── dag/                 # 의존성 그래프 및 전파
│   │   ├── runtime/             # 도메인 실행 엔진
│   │   ├── policy/              # 정책 평가 (Precondition, FieldPolicy)
│   │   ├── schema/              # Zod 통합
│   │   ├── projection/          # [NEW] Agent Context 변환
│   │   ├── agent/               # [NEW] AI Agent 타입 정의
│   │   └── index.ts
│   └── tests/                   # 695개 테스트
│
├── compiler/                    # @manifesto-ai/compiler (v0.1.0)
│   ├── src/
│   │   ├── types/               # Fragment, Provenance, Issue, Patch 타입
│   │   ├── fragment/            # Fragment 생성 헬퍼
│   │   ├── pass/                # Pass 시스템 (7개 Pass)
│   │   └── index.ts
│   └── tests/                   # 364개 테스트
│
└── bridge-react/                # [NEW] @manifesto-ai/bridge-react (v0.1.0)
    ├── src/
    │   ├── context.ts           # RuntimeProvider
    │   ├── hooks/               # 8개 React hooks
    │   ├── types.ts
    │   └── index.ts
    └── tests/                   # 29개 테스트
```

---

## 2. 핵심 모듈 상세

### 2.1 @manifesto-ai/core

#### Domain (`src/domain/`)
| 파일 | 역할 |
|------|------|
| `types.ts` | `SemanticPath`, `ManifestoDomain`, `SourceDefinition`, `DerivedDefinition`, `AsyncDefinition`, `ActionDefinition` |
| `define.ts` | `defineDomain()`, `defineSource()`, `defineDerived()`, `defineAsync()`, `defineAction()` |
| `validate.ts` | `validateDomain()` - 도메인 유효성 검증 |

#### Expression (`src/expression/`)
| 파일 | 역할 |
|------|------|
| `types.ts` | `Expression` 타입 (Literal, Get, Comparison, Logical, Arithmetic, Conditional, Functions) |
| `parser.ts` | `parseExpression()`, `expressionToString()`, `extractPaths()` |
| `evaluator.ts` | `evaluate()` - Expression 평가 |
| `analyzer.ts` | `analyzeExpression()`, `isPureExpression()`, `optimizeExpression()` |

#### Effect (`src/effect/`)
| 파일 | 역할 |
|------|------|
| `types.ts` | `Effect` 타입 (SetValue, ApiCall, Navigate, Sequence, Parallel, Conditional, Catch, EmitEvent) |
| `result.ts` | `Result<T, E>` monad, `ok()`, `err()`, `map()`, `flatMap()` |
| `runner.ts` | `runEffect()`, `EffectHandler` 인터페이스 |

**P0-1 Contract**: `EffectHandler` 메서드가 `Result<void, HandlerError>` 반환

#### DAG (`src/dag/`)
| 파일 | 역할 |
|------|------|
| `graph.ts` | `buildDependencyGraph()`, `getAllDependents()`, `hasCycle()` |
| `topological.ts` | `topologicalSortWithCycleDetection()`, `getAffectedOrder()` |
| `propagation.ts` | `propagate()`, `propagateAsyncResult()`, `analyzeImpact()` |

#### Runtime (`src/runtime/`)
| 파일 | 역할 |
|------|------|
| `snapshot.ts` | `DomainSnapshot`, `createSnapshot()`, `getValueByPath()`, `setValueByPath()` |
| `subscription.ts` | `SubscriptionManager`, `createBatchNotifier()` |
| `runtime.ts` | `DomainRuntime` 인터페이스, `createRuntime()` |

**DomainRuntime API**:
```typescript
interface DomainRuntime<TData, TState> {
  // Read
  getSnapshot(): DomainSnapshot<TData, TState>;
  get<T>(path: SemanticPath): T;
  getMany(paths: SemanticPath[]): Record<SemanticPath, unknown>;

  // Write (P0-1: Result 반환)
  set(path: SemanticPath, value: unknown): Result<void, SetError>;
  setMany(updates: Record<SemanticPath, unknown>): Result<void, SetError>;
  execute(actionId: string, input?: unknown): Promise<Result<void, EffectError>>;

  // Policy
  getPreconditions(actionId: string): PreconditionStatus[];
  getFieldPolicy(path: SemanticPath): ResolvedFieldPolicy;
  getSemantic(path: SemanticPath): SemanticMeta | undefined;

  // AI Support
  explain(path: SemanticPath): ExplanationTree;
  getImpact(path: SemanticPath): SemanticPath[];

  // Subscription
  subscribe(listener: SnapshotListener): Unsubscribe;
  subscribePath(path: SemanticPath, listener: PathListener): Unsubscribe;
  subscribeEvents(channel: string, listener: EventListener): Unsubscribe;
}
```

#### Projection (`src/projection/`) - **[Phase 2-2 신규]**
| 파일 | 역할 |
|------|------|
| `types.ts` | `AgentContext`, `ProjectedSnapshot`, `BlockedReason`, `ImpactAnalysis` |
| `agent-context.ts` | `projectAgentContext()` - Runtime → AgentContext 변환 |
| `explain.ts` | `explainValue()`, `explainAction()`, `explainField()` |
| `impact.ts` | `analyzeValueImpact()`, `analyzeActionImpact()`, `getImpactMap()` |

**AgentContext 구조**:
```typescript
type AgentContext = {
  snapshot: ProjectedSnapshot;           // data/state/derived/async 네임스페이스
  availableActions: AgentActionInfo[];   // 실행 가능한 액션
  unavailableActions: UnavailableAction[]; // 실행 불가 액션 + 이유
  fieldPolicies: Record<SemanticPath, ResolvedFieldPolicy>;
  fields: FieldInfo[];
  metadata: AgentContextMetadata;        // projectedAt, pathCount, estimatedTokens
};
```

#### Agent (`src/agent/`) - **[Phase 2-3 신규]**
| 파일 | 역할 |
|------|------|
| `types.ts` | `AgentDecision`, `DecisionResult`, `DecisionFeedback` (discriminated union), `AgentDecisionLoop` 인터페이스 |

**DecisionFeedback Discriminated Union**:
```typescript
type DecisionFeedback =
  | ActionSuccessFeedback      // _tag: 'ActionSuccess'
  | ActionFailureFeedback      // _tag: 'ActionFailure'
  | UnavailableActionFeedback  // _tag: 'UnavailableAction'
  | ValidationFailureFeedback; // _tag: 'ValidationFailure'
```

---

### 2.2 @manifesto-ai/compiler

#### Types (`src/types/`)
| 파일 | 역할 |
|------|------|
| `artifact.ts` | `CodeArtifact`, `TextArtifact`, `ManifestoArtifact`, `SelectionSpan` |
| `fragment.ts` | 8개 Fragment 타입 (Schema, Source, Expression, Derived, Policy, Effect, Action, Statement) |
| `provenance.ts` | `Provenance`, `Evidence`, `OriginLocation` |
| `issue.ts` | `Issue`, `IssueCode` |
| `patch.ts` | `PatchOp`, `Patch`, `PatchHint` |

#### Fragment (`src/fragment/`)
| 파일 | 역할 |
|------|------|
| `stable-id.ts` | `generateStableFragmentId()` - 결정론적 ID 생성 |
| `base.ts` | `createFragment()` factory |

#### Pass System (`src/pass/`)
| Pass | 우선순위 | 역할 |
|------|----------|------|
| `code-ast-extractor.ts` | 0 | SWC 기반 AST 추출 → Finding 생성 |
| `schema-pass.ts` | 100 | 변수 → SchemaFragment |
| `expression-lowering.ts` | 200 | 조건식 → ExpressionFragment |
| `effect-lowering.ts` | 300 | 부수효과 → EffectFragment |
| `policy-lowering.ts` | 400 | 정책 패턴 → PolicyFragment |
| `action-pass.ts` | 500 | Effect+Policy → ActionFragment 조립 |
| `nl-extractor-pass.ts` | 900 | 자연어 → FragmentDraft (LLM) |

**Pass 실행 흐름**:
```
Artifact → PassRegistry → PassExecutor → Fragment[]
           (위상정렬)      (순차실행)
```

---

### 2.3 @manifesto-ai/bridge-react - **[Phase 2-1 신규]**

#### Context (`src/context.ts`)
```typescript
// Provider
function RuntimeProvider({ runtime, children }): ReactNode;

// Hooks
function useRuntimeContext(): RuntimeContextValue;
function useRuntime(): DomainRuntime;
```

#### Hooks (`src/hooks/`)
| Hook | 역할 |
|------|------|
| `useSnapshot()` | 전체 스냅샷 구독 (`useSyncExternalStore` 기반) |
| `useValue(path)` | 단일 경로 값 구독 |
| `useValues(paths)` | 다중 경로 값 구독 |
| `useDerived(path)` | derived 값 구독 (useValue alias) |
| `useSetValue()` | 값 설정 + 에러 상태 관리 |
| `useAction(actionId)` | 액션 실행 + isExecuting + isAvailable |
| `useFieldPolicy(path)` | 필드 정책 조회 (relevant, editable, required) |
| `useActionAvailability(actionId)` | 액션 가용성 + blockedReasons |

---

## 3. P0 Contract 구현

### P0-1: Effect 실행 계약 불일치 해결

**변경 전**:
```typescript
type EffectHandler = {
  setValue: (path, value) => void;  // 에러 무시
};
```

**변경 후**:
```typescript
type EffectHandler = {
  setValue: (path, value) => Result<void, HandlerError>;  // 에러 전파
};

type SetError = ValidationError | PropagationError;  // runtime.set() 반환 타입
```

### P0-2: Async 결과 경로 규약 단일화

**변경 전** (deprecated):
```typescript
defineAsync({
  resultPath: 'async.userData.result',
  loadingPath: 'async.userData.loading',
  errorPath: 'async.userData.error',
  // ...
});
```

**변경 후** (권장):
```typescript
defineAsync('userData', {
  deps: ['data.userId'],
  effect: apiCall(...),
  semantic: { ... },
});
// → 자동 생성: async.userData.result, async.userData.loading, async.userData.error
```

---

## 4. 테스트 현황

| 패키지 | 테스트 파일 | 테스트 수 |
|--------|-------------|----------|
| **@manifesto-ai/core** | 21개 | 695개 |
| ├─ domain/ | 2개 | 55개 |
| ├─ expression/ | 3개 | 143개 |
| ├─ effect/ | 2개 | 86개 |
| ├─ dag/ | 3개 | 47개 |
| ├─ runtime/ | 3개 | 158개 |
| ├─ policy/ | 2개 | 60개 |
| ├─ schema/ | 2개 | 101개 |
| ├─ projection/ | 3개 | 33개 |
| └─ agent/ | 1개 | 12개 |
| **@manifesto-ai/compiler** | 12개 | 364개 |
| **@manifesto-ai/bridge-react** | 6개 | 29개 |
| **Total** | **39개** | **1,088개** |

---

## 5. 의존성 관계

```
@manifesto-ai/core (v0.3.0)
├── dependencies: zod ^3.24.1
└── exports: Domain, Expression, Effect, DAG, Runtime, Policy, Schema, Projection, Agent

@manifesto-ai/compiler (v0.1.0)
├── peerDependencies: @manifesto-ai/core ^0.3.0
├── dependencies: @swc/core ^1.10.0
└── exports: Types, Fragment, Pass

@manifesto-ai/bridge-react (v0.1.0)
├── peerDependencies: @manifesto-ai/core ^0.3.0, react ^18.0.0
└── exports: RuntimeProvider, useRuntime, useValue, useAction, ...
```

---

## 6. 핵심 불변식 (AGENT_README)

| # | 불변식 | 구현 상태 |
|---|--------|----------|
| 1 | 결정론적 코어 | ✅ Linking, validation, conflict detection은 LLM 품질 무관 |
| 2 | LLM은 비신뢰 제안자 | ✅ NL Pass → FragmentDraft (Fragment 아님), Draft Lowering 필요 |
| 3 | 모듈러/부분 컴파일 | ✅ SelectionSpan 기반 부분 컴파일 |
| 4 | 모든 출력에 출처 | ✅ Fragment.provenance 필수 |
| 5 | Effect는 설명 | ✅ 컴파일러는 side effect 실행 금지 |
| 6 | 충돌은 명시적 해결 | 🔄 Phase 3 (conflict-detector) |
| 7 | 의존성은 기계적 추출 | ✅ analyzeExpression() 사용 |
| 8 | 도메인-불가지 | ✅ 특정 업무 도메인 템플릿 없음 |
| 9 | Patch-first 편집 | 🔄 Phase 3 (patch/) |
| 10 | 관측 가능성 | 🔄 Phase 3 (observability) |

---

## 7. Public API 요약

### @manifesto-ai/core
```typescript
// Domain
export { defineDomain, defineSource, defineDerived, defineAsync, defineAction };
export { validateDomain };
export type { ManifestoDomain, SemanticPath, ... };

// Expression
export { evaluate, analyzeExpression, parseExpression, expressionToString };
export type { Expression, EvaluationContext, ... };

// Effect
export { runEffect, setValue, setState, apiCall, navigate, sequence, parallel, ... };
export { ok, err, isOk, isErr, map, flatMap, ... };
export type { Effect, Result, EffectError, HandlerError, PropagationError };

// Runtime
export { createRuntime, createSnapshot, getValueByPath, setValueByPath };
export type { DomainRuntime, DomainSnapshot, SetError };

// Projection [NEW]
export { projectAgentContext, explainValue, explainAction, explainField };
export { analyzeValueImpact, analyzeActionImpact, getImpactMap };
export type { AgentContext, ProjectedSnapshot, BlockedReason, ... };

// Agent [NEW]
export type { AgentDecision, DecisionResult, DecisionFeedback, AgentDecisionLoop };
```

### @manifesto-ai/bridge-react
```typescript
export { RuntimeProvider, useRuntimeContext, useRuntime };
export { useSnapshot, useValue, useValues, useDerived };
export { useSetValue, useAction };
export { useFieldPolicy, useActionAvailability };
```

---

## 8. 데모 시나리오: E2E 흐름

```
1. [Domain 정의]
   defineDomain({ id: 'order', paths: { sources, derived }, actions })

2. [Runtime 생성]
   const runtime = createRuntime({ domain, initialData })

3. [React 연결]
   <RuntimeProvider runtime={runtime}>
     <OrderForm />
   </RuntimeProvider>

4. [UI 구독]
   const { value: total } = useValue('derived.total')  // 자동 갱신
   const { execute, isAvailable } = useAction('checkout')

5. [Agent Context 생성]
   const context = projectAgentContext(runtime, domain)
   // → AI에게 전달: availableActions, unavailableActions, snapshot

6. [Agent 결정]
   const decision: AgentDecision = { actionId: 'checkout', ... }

7. [실행 및 피드백]
   await runtime.execute('checkout')
   // → DAG propagation → subscribers notified → UI 갱신
```

---

## 9. 남은 작업 (Phase 3)

| 모듈 | 설명 |
|------|------|
| `linker/` | Path 정규화, 의존성 분석, Fragment 병합, 충돌 탐지, DomainDraft 빌더 |
| `verifier/` | 정적 검증, DAG 순환 검사, validateDomain 통합 |
| `patch/` | PatchOp 구현, Patch 적용, 증분 re-link/verify |
| `runtime/` | Compiler Domain 정의, Session, Observability |

---

## 10. 결론

Phase 2 완료로 Manifesto는 다음을 달성:

1. **Core 계약 안정화**: P0-1 (Effect 에러 전파), P0-2 (Async 경로 규약)
2. **React 통합**: `bridge-react` 패키지로 React 앱에서 Runtime을 단일 상태 엔진으로 사용 가능
3. **AI 통합 준비**: `projection` 모듈로 AgentContext 생성, `agent` 타입으로 결정 루프 인터페이스 정의
4. **테스트 커버리지**: 1,088개 테스트로 안정성 확보

Phase 3에서는 Linker/Verifier/Patch 시스템을 구현하여 Fragment → Domain 변환 파이프라인을 완성하고, Compiler Runtime Observability를 추가할 예정입니다.
