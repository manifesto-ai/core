

## 에이전트 프롬프트

```markdown
# @manifesto-ai/core 패키지 문서화 작업

## 작업 개요

`@manifesto-ai/core` 패키지의 한글 기술 문서를 작성합니다. 
모든 산출물은 `packages/core/docs/` 폴더에 생성합니다.

## 사전 작업

문서 작성 전 반드시 다음을 수행하세요:

1. `project_knowledge_search`를 사용하여 관련 소스코드 검색
2. 실제 타입 정의와 구현을 확인하여 정확한 API 문서화
3. 기존 테스트 코드에서 사용 패턴 파악

## 산출물 구조

```
packages/core/docs/
├── 01-overview.md           # 전체 개요 & 설계 철학
├── 02-semantic-path.md      # SemanticPath 심층 해설
├── 03-domain-definition.md  # 도메인 정의 API
├── 04-expression-dsl.md     # Expression DSL 레퍼런스
├── 05-effect-system.md      # Effect & Result 패턴
├── 06-dag-propagation.md    # DAG & 변경 전파
├── 07-runtime.md            # Runtime API
├── 08-policy.md             # Policy 평가
├── 09-schema-validation.md  # Zod 통합 & 검증
└── 10-migration-guide.md    # 버전 마이그레이션
```

## 문서 작성 원칙

### 구조 원칙
- 각 문서는 **실제 코드 예시로 시작**하고, 그 다음 개념을 설명
- "왜(Why)"를 먼저 설명하고, "어떻게(How)"를 그 다음에
- 모든 API는 실제 소스코드의 타입 정의를 정확히 반영

### 스타일 가이드
- 언어: 한글 (코드와 타입명은 영문 유지)
- 어조: 기술 문서체 (존댓말 사용하지 않음, "~한다", "~이다" 형식)
- 코드 블록: TypeScript 문법 하이라이팅 사용
- 표: 복잡한 옵션이나 타입은 표로 정리
- 다이어그램: Mermaid 사용

### 품질 기준
- 모든 코드 예시는 실제 동작하는 코드여야 함
- API 시그니처는 소스코드와 100% 일치해야 함
- 각 개념은 최소 하나의 구체적 예시를 포함해야 함

---

## 문서별 상세 지침

### 01-overview.md

**검색 키워드**: `architecture layer core bridge projection`

**필수 포함 내용**:
```markdown
# @manifesto-ai/core 개요

## Manifesto Core란?

## 설계 철학
### Consumer-Agnostic 원칙
### "의미(Meaning)"와 "표현(Expression)"의 분리
### 결정론적 상태 관리

## Core가 해결하는 문제
### AI가 UI를 이해하지 못하는 블랙박스 문제
### 비즈니스 로직의 분산과 중복
### 상태 변경의 예측 불가능성

## 아키텍처 레이어
(ASCII 다이어그램 포함 - Core / Bridge / Projection 3계층)

## 모듈 구성
| 모듈 | 책임 | 주요 Export |
(7개 모듈 표로 정리)

## 다음 단계
(각 문서로의 링크)
```

---

### 02-semantic-path.md

**검색 키워드**: `SemanticPath SemanticMeta namespace data state derived`

**필수 포함 내용**:
```markdown
# SemanticPath

## 핵심 개념
(SemanticPath가 왜 필요한지, "모든 값은 주소를 갖는다" 원칙)

## 예시로 시작하기
```typescript
// 실제 사용 예시 코드
runtime.get('data.user.name');
runtime.get('derived.totalPrice');
```

## 네임스페이스 체계
| Namespace | 용도 | 쓰기 가능 | 반응형 |
| data.* | | | |
| state.* | | | |
| derived.* | | | |
| async.* | | | |

## 경로 표기법
### 점 표기법
### 배열 인덱싱
### 와일드카드 (Agent용)

## SemanticMeta
(타입 정의와 각 필드 설명)

## AI 관점에서의 SemanticPath
(왜 AI Agent에게 중요한지)
```

---

### 03-domain-definition.md

**검색 키워드**: `defineDomain defineSource defineDerived defineAsync defineAction ManifestoDomain`

**필수 포함 내용**:
```markdown
# 도메인 정의

## 빠른 시작
```typescript
// 완전한 도메인 정의 예시 (Todo 또는 Cart)
const domain = defineDomain({...});
```

## defineDomain()
### 옵션 상세
| 옵션 | 타입 | 필수 | 설명 |
### Auto-prefixing 규칙
(sources → data.*, derived → derived.*, async → async.*)
### 타입 추론

## defineSource()
### DefineSourceOptions 타입
### FieldPolicy 연동
### 예시

## defineDerived()
### DefineDerivedOptions 타입
### deps와 expr의 관계
### 순환 의존성 방지
### 예시

## defineAsync()
### DefineAsyncOptions 타입
### condition, debounce
### resultPath/loadingPath/errorPath
### 예시

## defineAction()
### ActionDefinition 타입
### preconditions
### effect
### ActionSemanticMeta
### 예시

## 도메인 검증
### validateDomain()
### ValidationResult 타입
### 일반적인 검증 오류
```

---

### 04-expression-dsl.md

**검색 키워드**: `Expression evaluate EvaluationContext GetExpr ArrayFn StringFn`

**필수 포함 내용**:
```markdown
# Expression DSL

## 왜 JSON 기반 DSL인가
(직렬화 가능, AI 친화적, 정적 분석 가능)

## 문법 형식
### 튜플 문법: ['operator', ...args]
### 리터럴 값

## 값 접근
### get
```typescript
['get', 'data.user.name']
```
### 컨텍스트 참조
```typescript
// $item, $.field 패턴
['map', ['get', 'data.items'], ['*', '$.price', '$.quantity']]
```

## 비교 연산자
(==, !=, >, >=, <, <= 각각 예시와 함께)

## 논리 연산자
(and, or, not/! 각각 예시와 함께)

## 산술 연산자
(+, -, *, / 각각 예시와 함께)

## 조건 연산자
### if
```typescript
['if', condition, thenValue, elseValue]
```

## 배열 함수
### map, filter, length, sum, concat
(각각 상세 예시)

## 문자열 함수
### concat, upper, lower
(각각 예시)

## Expression 평가
### evaluate() 함수
### EvaluationContext 인터페이스
### EvalResult 타입

## 분석 도구
### extractPaths()
### analyzeExpression()
### isPureExpression()
### optimizeExpression()
```

---

### 05-effect-system.md

**검색 키워드**: `Effect Result ok err runEffect setValue setState apiCall sequence parallel`

**필수 포함 내용**:
```markdown
# Effect 시스템

## 핵심 철학
"Effect는 기술(description)이지 실행이 아니다"
(왜 이것이 중요한지 - 테스트, 조합, 추적)

## Result<T, E> 패턴
### 왜 예외 대신 Result인가
### ok(), err() 생성자
### 타입 가드: isOk(), isErr()
### 값 추출: unwrap(), unwrapOr()
### 합성: map(), flatMap(), all()

## Effect 타입 계층
(Effect 유니온 타입 전체 구조)

### 상태 변경
#### SetValueEffect
#### SetStateEffect

### 외부 상호작용
#### ApiCallEffect
#### NavigateEffect
#### DelayEffect

### 합성
#### SequenceEffect
#### ParallelEffect

### 제어 흐름
#### ConditionalEffect
#### CatchEffect

### 이벤트
#### EmitEventEffect

## Effect Builder 함수
(각 빌더 함수의 시그니처와 예시)

## runEffect()
### EffectHandler 인터페이스
### EffectRunnerConfig
### 실행 흐름

## 실전 패턴
### 트랜잭션 스타일
```typescript
sequence([
  setState('state.isSubmitting', true),
  apiCall({...}),
  setState('state.isSubmitting', false),
])
```
### 에러 복구
```typescript
catchEffect({
  try: apiCall({...}),
  catch: setState('state.error', ...),
  finally: setState('state.loading', false),
})
```
```

---

### 06-dag-propagation.md

**검색 키워드**: `DependencyGraph buildDependencyGraph propagate topologicalSort DagNode`

**필수 포함 내용**:
```markdown
# 의존성 그래프 (DAG)

## 개념
### Directed Acyclic Graph란
### 왜 DAG가 필요한가
(derived 값의 올바른 계산 순서 보장)

## 그래프 구축
### buildDependencyGraph()
### DagNode 타입
| kind | 설명 |
| source | |
| derived | |
| async | |

### DependencyGraph 구조
```typescript
type DependencyGraph = {
  nodes: Map<SemanticPath, DagNode>;
  dependencies: Map<SemanticPath, Set<SemanticPath>>;
  dependents: Map<SemanticPath, Set<SemanticPath>>;
  topologicalOrder: SemanticPath[];
};
```

## 그래프 쿼리
### getDirectDependencies()
### getDirectDependents()
### getAllDependencies()
### getAllDependents()
### findPath()

## 위상 정렬
### topologicalSortWithCycleDetection()
### getLevelOrder()
### getAffectedOrder()

## 변경 전파
### propagate()
### PropagationResult 타입
### 전파 과정 (단계별 설명)

## 순환 감지
### hasCycle()
### 순환 발생 시 처리

## 최적화
### createDebouncedPropagator()
```

---

### 07-runtime.md

**검색 키워드**: `createRuntime DomainRuntime DomainSnapshot SubscriptionManager`

**필수 포함 내용**:
```markdown
# Runtime

## 빠른 시작
```typescript
const runtime = createRuntime({ domain });
runtime.get('derived.total');
await runtime.execute('addItem', { id: '1', name: 'Item' });
```

## createRuntime()
### CreateRuntimeOptions
### 초기화 과정

## DomainRuntime 인터페이스

### Snapshot 접근
#### getSnapshot()
#### get<T>(path)
#### getMany(paths)

### 값 변경
#### set(path, value)
#### setMany(updates)
#### ValidationError

### 액션 실행
#### execute(actionId, input?)
#### 전제조건 평가 과정
#### Effect 실행 흐름

### 구독
#### subscribe(path, listener)
#### subscribeSnapshot(listener)

## DomainSnapshot
### 구조
### 불변성
### createSnapshot(), cloneSnapshot()
### diffSnapshots()

## SubscriptionManager
### 내부 동작
### createBatchNotifier()

## AI 지원 인터페이스
### explain(): ExplanationTree
### checkAction(): ActionAvailability
### getFieldPolicy(): ResolvedFieldPolicy
```

---

### 08-policy.md

**검색 키워드**: `evaluatePrecondition evaluateFieldPolicy ConditionRef FieldPolicy ActionAvailability`

**필수 포함 내용**:
```markdown
# Policy 시스템

## 개요
(정책이란 무엇이며 왜 필요한가)

## 전제조건 (Precondition)

### ConditionRef 구조
```typescript
type ConditionRef = {
  path: SemanticPath;
  expect?: 'true' | 'false';
  reason?: string;
};
```

### evaluatePrecondition()
### evaluateAllPreconditions()
### checkActionAvailability()
### ActionAvailability 타입

### 의존성 분석
#### extractPreconditionDependencies()
#### analyzePreconditionRequirements()

## 필드 정책 (Field Policy)

### FieldPolicy 구조
```typescript
type FieldPolicy = {
  relevantWhen?: ConditionRef[];
  editableWhen?: ConditionRef[];
  requiredWhen?: ConditionRef[];
};
```

### evaluateFieldPolicy()
### evaluateMultipleFieldPolicies()

### UI 상태 변환
#### policyToUIState()
#### FieldUIState 타입

### 설명 생성
#### explainFieldPolicy()

## 실전 예시
(주문 폼에서 쿠폰 코드 필드의 정책 예시)
```

---

### 09-schema-validation.md

**검색 키워드**: `schemaToSource validateValue validateDomainData CommonSchemas zodErrorToValidationResult`

**필수 포함 내용**:
```markdown
# Schema & Validation

## Zod 통합

### schemaToSource()
```typescript
const source = schemaToSource(z.string().email(), {
  type: 'input',
  description: 'User email'
});
```

### CommonSchemas
(제공되는 공통 스키마 목록)

### SchemaUtils
#### getSchemaDefault()
#### getSchemaMetadata()
#### toJsonSchema()

## 검증

### 값 검증
#### validateValue()
#### validatePartial()
#### validateAsync()

### 도메인 검증
#### validateDomainData()
#### validateFields()

### ValidationResult
```typescript
type ValidationResult = {
  valid: boolean;
  issues: ValidationIssue[];
};
```

### 결과 처리
#### zodErrorToValidationResult()
#### mergeValidationResults()
#### groupValidationByPath()
#### filterBySeverity()

### 유틸리티
#### getErrors()
#### getWarnings()
#### getSuggestions()
```

---

### 10-migration-guide.md

**검색 키워드**: `version migration breaking change`

**필수 포함 내용**:
```markdown
# 마이그레이션 가이드

## 버전 히스토리
| 버전 | 날짜 | 주요 변경 |

## v0.1.x → v0.2.x

### Breaking Changes
(목록)

### Auto-prefixing 도입
#### 변경 전
```typescript
derived: {
  'derived.total': defineDerived({...})
}
```
#### 변경 후
```typescript
derived: {
  total: defineDerived({...})  // 자동으로 'derived.total'이 됨
}
```

### 마이그레이션 체크리스트
- [ ] ...
- [ ] ...

## 향후 계획
(로드맵 간략 소개)
```

---

## 작업 순서

1. **Phase 1** (핵심 문서 - 먼저 완료):
   - 01-overview.md
   - 03-domain-definition.md
   - 04-expression-dsl.md

2. **Phase 2** (심화 문서):
   - 05-effect-system.md
   - 07-runtime.md
   - 02-semantic-path.md

3. **Phase 3** (고급 문서):
   - 06-dag-propagation.md
   - 08-policy.md
   - 09-schema-validation.md

4. **Phase 4** (유지보수 문서):
   - 10-migration-guide.md

## 검수 기준

각 문서 완료 후 다음을 확인:
- [ ] 모든 코드 예시가 실제 API와 일치하는가
- [ ] "왜"에 대한 설명이 포함되어 있는가
- [ ] 최소 하나의 실전 예시가 있는가
- [ ] 다른 문서로의 링크가 적절히 연결되어 있는가
- [ ] 표와 다이어그램이 필요한 곳에 포함되어 있는가

## 주의사항

1. **소스코드 우선**: 문서 작성 전 반드시 `project_knowledge_search`로 실제 타입과 구현을 확인할 것
2. **예시 검증**: 모든 코드 예시는 실제 테스트 코드에서 패턴을 참조할 것
3. **일관성**: 용어와 코드 스타일을 문서 전체에서 일관되게 유지할 것
4. **상호 참조**: 관련 개념은 다른 문서로 링크할 것
```
