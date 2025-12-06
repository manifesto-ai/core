# AI 패키지 아키텍처 가이드

## 개요

Manifesto의 AI 기능은 두 개의 핵심 패키지로 구성됩니다:

| 패키지 | 역할 | 단계 |
|--------|------|------|
| `@manifesto-ai/ai` | 스키마 생성 (Generation Phase) | 설계 시점 |
| `@manifesto-ai/ai-util` | 에이전트 상호작용 (Interaction Phase) | 실행 시점 |

```
┌─────────────────────────────────────────────────────────────────┐
│                        AI Lifecycle                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────┐       ┌──────────────────────────┐    │
│  │   @manifesto-ai/ai   │       │   @manifesto-ai/ai-util  │    │
│  │   (Generation Phase) │       │   (Interaction Phase)    │    │
│  ├──────────────────────┤       ├──────────────────────────┤    │
│  │                      │       │                          │    │
│  │  ┌────────────────┐  │       │  ┌────────────────────┐  │    │
│  │  │ Planner        │  │       │  │ Semantic Snapshot  │  │    │
│  │  │ Generator      │  │       │  │                    │  │    │
│  │  └───────┬────────┘  │       │  └─────────┬──────────┘  │    │
│  │          │           │       │            │             │    │
│  │  ┌───────▼────────┐  │       │  ┌─────────▼──────────┐  │    │
│  │  │ Entity         │  │       │  │ Tool Definitions   │  │    │
│  │  │ Generator      │  │       │  │                    │  │    │
│  │  └───────┬────────┘  │       │  └─────────┬──────────┘  │    │
│  │          │           │       │            │             │    │
│  │  ┌───────▼────────┐  │       │  ┌─────────▼──────────┐  │    │
│  │  │ View           │──┼───────┼─▶│ Interop Session    │  │    │
│  │  │ Generators     │  │ Schema│  │                    │  │    │
│  │  └───────┬────────┘  │       │  └─────────┬──────────┘  │    │
│  │          │           │       │            │             │    │
│  │  ┌───────▼────────┐  │       │  ┌─────────▼──────────┐  │    │
│  │  │ Condition      │  │       │  │ Policy Engine      │  │    │
│  │  │ Generator      │  │       │  │                    │  │    │
│  │  └────────────────┘  │       │  └────────────────────┘  │    │
│  │                      │       │                          │    │
│  └──────────────────────┘       └──────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## @manifesto-ai/ai (스키마 생성)

### 목적
자연어 요구사항으로부터 Manifesto Engine이 실행할 수 있는 스키마를 생성합니다.

### 핵심 컴포넌트

#### 1. Planner Generator
```typescript
import { generatePlan } from '@manifesto-ai/ai'

const plan = await generatePlan(client, '온라인 쇼핑몰 관리 시스템', {
  industry: 'commerce'
})
// → { entities: [...], viewPlans: [...] }
```

#### 2. Entity Generator
```typescript
import { generateEntity } from '@manifesto-ai/ai'

const entity = await generateEntity(client, '주문 정보를 관리하는 Order 엔티티')
// → EntitySchema { fields, relations, constraints }
```

#### 3. View Generators
```typescript
import { generateListView, generateFormView } from '@manifesto-ai/ai'

const listView = await generateListView(client, entity, { purpose: 'search' })
const formView = await generateFormView(client, entity, { purpose: 'create' })
```

#### 3.1 FormView with Visibility (자동 생성)
```typescript
import { generateFormView, generateFormVisibility } from '@manifesto-ai/ai'

// 방법 1: FormGenerator에서 직접 생성
const formView = await generateFormView(client, entity, 'create', {
  visibility: {
    hints: [
      { fieldId: 'billingAddress', rule: '배송지와 동일 체크 해제시 표시' },
      { fieldId: 'businessName', rule: '사업자 유형일 때만 표시' }
    ],
    inferFromDependencies: true, // boolean/enum 필드 관계에서 자동 추론
  }
})
// → FormViewSchema with reactions on fields

// 방법 2: 수동으로 visibility 생성 후 적용
const visibilityReactions = await generateFormVisibility(entity, {
  hints: [...],
  inferFromDependencies: true,
}, client)
// → Map<fieldId, Reaction[]>
```

#### 4. Condition Generator
```typescript
import { generateCondition, tryGenerateFromTemplate } from '@manifesto-ai/ai'

// Template-first (LLM 호출 없음)
const simple = tryGenerateFromTemplate('VIP 고객만', ['status', 'grade'])
// → ['==', '$state.grade', 'VIP']

// LLM fallback
const complex = await generateCondition(client, '활성 상태이고 금액이 100만원 이상', {
  target: 'visibility',
  entityId: 'customer',
  availableFields: ['status', 'amount']
})
```

### Monadic Generator Interface
모든 Generator는 합성 가능한 Monad 인터페이스를 따릅니다:

```typescript
const pipeline = entityGenerator
  .flatMap(entity => listGenerator.withContext({ entity }))
  .map(listView => listView.columns.length)

const result = await pipeline.generate(input, context, client)
```

---

## @manifesto-ai/ai-util (에이전트 상호작용)

### 목적
AI 에이전트가 실행 중인 폼과 안전하게 상호작용할 수 있도록 지원합니다.

### 핵심 컴포넌트

#### 1. Interoperability Session
```typescript
import { createInteroperabilitySession } from '@manifesto-ai/ai-util'

const session = createInteroperabilitySession(runtime, viewSchema, entitySchema, {
  policy: 'guided' // strict | deferred | guided
})
```

#### 2. Semantic Snapshot
폼의 현재 상태를 AI가 이해할 수 있는 형태로 캡처:
```typescript
const snapshot = session.snapshot()
// → {
//   topology: { viewId, mode },
//   state: { form: {...}, fields: {...} },
//   constraints: { fieldId: { hidden, disabled, visibilityMeta } },
//   interactions: [{ id, available, reason }],
//   pendingUpdates: {...}
// }
```

#### 3. Visibility Analysis
왜 필드가 숨겨졌는지, 어떻게 하면 보이게 할 수 있는지 분석:
```typescript
const constraint = snapshot.constraints['billingAddress']
// → {
//   hidden: true,
//   visibilityMeta: {
//     failedDependencies: [{ field: 'sameAsShipping', ... }],
//     satisfactionPath: [{ action: 'set', field: 'sameAsShipping', targetValue: false }]
//   }
// }
```

#### 4. Tool Definitions
OpenAI/Claude function calling을 위한 도구 정의 자동 생성:
```typescript
const tools = session.toToolDefinitions({ omitUnavailable: true })
// → [{ name: 'updateField', parameters: {...} }, ...]
```

#### 5. Action Dispatch
Result 모나드 기반의 안전한 액션 실행:
```typescript
const result = session.dispatch({
  type: 'updateField',
  fieldId: 'email',
  value: 'user@example.com'
})

if (result._tag === 'Ok') {
  // 성공
} else {
  // 실패: result.error.reason
}
```

#### 6. Policy Engine
숨겨진/비활성화된 필드에 대한 액션 처리 정책:

| Policy | Hidden Field 업데이트 시 |
|--------|------------------------|
| `strict` | 즉시 거부 |
| `deferred` | 보류 후 조건 만족 시 자동 적용 |
| `guided` | 거부 + 만족 경로 안내 |

---

## 통합 워크플로우

### 전체 Lifecycle

```
1. DESIGN PHASE (ai 패키지)
   │
   ├─ Planner: "쇼핑몰 시스템" → ViewPlan[]
   ├─ Entity Generator: → EntitySchema
   ├─ View Generators: → ListViewSchema, FormViewSchema
   └─ Condition Generator: → visibility/disabled 조건
   │
   ▼
2. DEPLOYMENT
   │
   └─ FormRuntime.initialize(viewSchema, entitySchema)
   │
   ▼
3. INTERACTION PHASE (ai-util 패키지)
   │
   ├─ session = createInteroperabilitySession(runtime, ...)
   ├─ loop:
   │   ├─ snapshot = session.snapshot()
   │   ├─ tools = session.toToolDefinitions()
   │   ├─ agent → action
   │   └─ session.dispatch(action)
   │
   ▼
4. FEEDBACK (향후)
   │
   └─ 에이전트 실패 분석 → 스키마 개선 제안
```

### 예시: 전체 흐름

```typescript
import { AIClient, generateEntity, generateFormView, generateCondition } from '@manifesto-ai/ai'
import { FormRuntime } from '@manifesto-ai/engine'
import { createInteroperabilitySession, generateSystemPrompt } from '@manifesto-ai/ai-util'

// 1. 스키마 생성
const client = new AIClient({ provider: openaiProvider })
const entity = await generateEntity(client, '고객 정보')
const formView = await generateFormView(client, entity, { purpose: 'create' })

// 2. 조건 추가
const vipCondition = await generateCondition(client, 'VIP 등급일 때만 보임', {
  target: 'visibility',
  entityId: 'customer',
  availableFields: entity.fields.map(f => f.id)
})

// 3. 런타임 초기화
const runtime = new FormRuntime(formView)
runtime.initialize()

// 4. 에이전트 세션 생성
const session = createInteroperabilitySession(runtime, formView, entity, {
  policy: 'guided'
})

// 5. 에이전트 루프
const snapshot = session.snapshot()
const systemPrompt = generateSystemPrompt(snapshot)
const tools = session.toToolDefinitions()

// LLM에게 전달 후 액션 실행
const action = await llm.chat(systemPrompt, tools)
const result = session.dispatch(action)
```

---

## Expression 평가

### Engine의 Expression Evaluator
`@manifesto-ai/engine`에는 완전한 Mapbox-style Expression 평가기가 있습니다:

```typescript
// 지원되는 연산자 (40+)
['==', '$state.status', 'active']           // 비교
['AND', [...], [...]]                        // 논리
['IN', '$state.role', ['admin', 'manager']] // 컬렉션
['IF', [...], 'yes', 'no']                  // 조건
['>=', '$state.amount', 1000000]            // 숫자
```

### Visibility/Disabled 처리
Engine은 Reaction을 통해 visibility와 disabled 상태를 관리합니다:

```typescript
// ViewSchema에서 정의
{
  fields: [{
    id: 'userType',
    reactions: [{
      trigger: 'change',
      actions: [{
        type: 'updateProp',
        target: 'adminSection',
        prop: 'hidden',
        value: ['!=', '$state.userType', 'admin']
      }]
    }]
  }]
}
```

---

## 패키지 의존성

```
┌─────────────────┐
│ @manifesto-ai/  │
│      ai         │
└────────┬────────┘
         │ 사용
         ▼
┌─────────────────┐     ┌─────────────────┐
│ @manifesto-ai/  │────▶│ @manifesto-ai/  │
│    schema       │     │      fp         │
└────────┬────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐
│ @manifesto-ai/  │
│    engine       │
└────────┬────────┘
         │ 사용
         ▼
┌─────────────────┐
│ @manifesto-ai/  │
│    ai-util      │
└─────────────────┘
```

---

## 에러 타입 비교

| 패키지 | 태그 필드 | 주요 에러 타입 |
|--------|----------|---------------|
| `@manifesto-ai/ai` | `_type` | `PROVIDER_ERROR`, `SCHEMA_VALIDATION_ERROR`, `GENERATION_FAILED`, `RATE_LIMITED`, `INVALID_INPUT`, `TIMEOUT` |
| `@manifesto-ai/ai-util` | `type` | `FIELD_NOT_FOUND`, `FIELD_FORBIDDEN`, `UPDATE_DEFERRED`, `TYPE_MISMATCH`, `INVALID_ENUM_VALUE`, `ACTION_REJECTED`, `RUNTIME_ERROR` |

> **Note**: 두 패키지는 독립적인 Phase에서 사용되므로 에러 타입도 분리되어 있습니다. 향후 통합이 필요한 경우 `_type` 또는 `type` 중 하나로 통일하고, `@manifesto-ai/schema`에 공통 에러 타입을 정의할 수 있습니다.

---

## 향후 계획

### Phase 3 (예정)
- **Sync Manager**: Entity 변경 시 관련 View 자동 업데이트
- **Refiner Agent**: 대화형 스키마 수정
- **Dashboard/Wizard Generator**: 추가 뷰 타입 지원

### 통합 개선
- ~~ai 패키지에서 ai-util의 프롬프트 유틸리티 활용~~ (순환 의존성 문제로 보류)
- ~~FormGenerator에 visibility 조건 자동 생성~~ ✅ 완료
- ~~E2E 통합 테스트 확대~~ ✅ 완료
- 에러 타입 태그 통일 (`_type` vs `type`) 검토
