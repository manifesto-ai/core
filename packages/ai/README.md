# @manifesto-ai/ai

AI-powered schema generation for Manifesto Engine.

## Features

- **Entity Generator** - 도메인 설명에서 EntitySchema 자동 생성
- **Form Generator** - EntitySchema에서 FormViewSchema 자동 생성
- **List Generator** - EntitySchema에서 ListViewSchema 자동 생성
- **Condition Generator** - 자연어에서 Expression 조건 생성
- **Visibility Planner** - Form 필드 간 의존성 분석 및 visibility 조건 자동 생성
- **Sync Manager** - Entity 변경 감지 및 View 자동 동기화

## Installation

```bash
pnpm add @manifesto-ai/ai
```

### Peer Dependencies

AI Provider 중 하나 이상 설치 필요:

```bash
# OpenAI
pnpm add @ai-sdk/openai

# Anthropic
pnpm add @ai-sdk/anthropic
```

## Quick Start

```typescript
import { openai } from '@ai-sdk/openai'
import {
  createAIClient,
  createProvider,
  registerOpenAIProvider,
  entityGenerator,
  formGenerator,
  listGenerator,
} from '@manifesto-ai/ai'

// 1. Provider 등록
registerOpenAIProvider(openai)

// 2. Provider 및 Client 생성
const provider = createProvider({
  type: 'openai',
  model: 'gpt-4o-mini',
})
const client = createAIClient({ provider })

// 3. Entity 생성
const entityResult = await entityGenerator.generate(
  { domainDescription: 'A customer management system for e-commerce' },
  { industry: { type: 'commerce' } },
  client
)

if (entityResult._tag === 'Ok') {
  const entity = entityResult.value.value

  // 4. Form View 생성
  const formResult = await formGenerator.generate(
    { entity, purpose: 'Customer registration form' },
    {},
    client
  )

  // 5. List View 생성
  const listResult = await listGenerator.generate(
    { entity, purpose: 'Customer list with filtering and sorting' },
    {},
    client
  )
}
```

## API Reference

### Generators

#### Entity Generator

도메인 설명에서 EntitySchema를 생성합니다.

```typescript
import { entityGenerator, generateEntity } from '@manifesto-ai/ai'

// Generator 패턴
const result = await entityGenerator.generate(
  { domainDescription: 'An order management system' },
  { industry: { type: 'commerce' } },
  client
)

// 함수형 API
const result = await generateEntity(
  client,
  { domainDescription: 'An order management system' },
  { industry: { type: 'commerce' } }
)
```

#### Form Generator

EntitySchema에서 FormViewSchema를 생성합니다.

```typescript
import { formGenerator, generateFormView } from '@manifesto-ai/ai'

const result = await formGenerator.generate(
  { entity, purpose: 'Order creation form' },
  {},
  client
)
```

#### List Generator

EntitySchema에서 ListViewSchema를 생성합니다.

```typescript
import { listGenerator, generateListView } from '@manifesto-ai/ai'

const result = await listGenerator.generate(
  { entity, purpose: 'Order list view' },
  {},
  client
)
```

### Sync Manager

Entity 변경을 감지하고 관련 View를 자동으로 업데이트합니다.

#### Basic Usage

```typescript
import { syncViews } from '@manifesto-ai/ai'

const result = syncViews({
  oldEntity,
  newEntity,
  views: [formView, listView],
  config: {
    mode: 'auto-safe',      // 'manual' | 'auto-safe' | 'auto-all'
    includeNewFields: false,
  }
})

// 결과 확인
for (const sync of result.syncResults) {
  console.log('View:', sync.viewId)
  console.log('Applied:', sync.appliedActions.length)
  console.log('Skipped:', sync.skippedActions.length)
  console.log('Updated View:', sync.updatedView)
}
```

#### Sync Modes

| Mode | 설명 |
|------|------|
| `manual` | 모든 변경 사항을 사용자에게 제안만 함 |
| `auto-safe` | 안전한 변경(UPDATE)만 자동 적용, 제거(REMOVE)는 제안 |
| `auto-all` | 모든 변경 자동 적용 |

#### Convenience Functions

```typescript
import {
  syncFormView,
  syncListView,
  analyzeViewImpact,
  applySuggestedActions,
} from '@manifesto-ai/ai'

// FormView만 동기화
const formResult = syncFormView(oldEntity, newEntity, formView, {
  mode: 'auto-safe',
})

// ListView만 동기화
const listResult = syncListView(oldEntity, newEntity, listView, {
  mode: 'auto-safe',
})

// 영향 분석만 수행 (실제 업데이트 없음)
const { changes, viewImpacts } = analyzeViewImpact(
  oldEntity,
  newEntity,
  [formView, listView]
)

// 특정 Action만 선택적으로 적용
const result = applySuggestedActions(
  view,
  changes,
  [0, 2, 3], // 적용할 action 인덱스
)
```

#### Change Detection

감지되는 Entity 변경 유형:

| 변경 유형 | 설명 | Severity |
|----------|------|----------|
| `FIELD_REMOVED` | 필드 삭제 | critical |
| `FIELD_ADDED` | 필드 추가 | info |
| `FIELD_RENAMED` | 필드 이름 변경 | critical |
| `FIELD_TYPE_CHANGED` | 데이터 타입 변경 | warning/critical |
| `FIELD_CONSTRAINT_CHANGED` | 제약조건 변경 | info/warning |
| `FIELD_ENUM_CHANGED` | Enum 값 변경 | warning |
| `FIELD_LABEL_CHANGED` | 라벨 변경 | info |
| `FIELD_REFERENCE_CHANGED` | 참조 엔티티 변경 | critical |

#### Suggested Actions

생성되는 제안 액션 유형:

| Action | 대상 | 설명 |
|--------|------|------|
| `REMOVE_FIELD` | Column, ViewField | 삭제된 필드 참조 제거 |
| `UPDATE_FIELD_ID` | Column, ViewField | 이름 변경된 필드 ID 업데이트 |
| `UPDATE_COMPONENT` | Column, ViewField | 타입 변경에 따른 컴포넌트 변경 |
| `UPDATE_ENUM_OPTIONS` | Column, ViewField | Enum 값 변경 반영 |
| `ADD_FIELD` | Column, ViewField | 새 필드 추가 |
| `REMOVE_FILTER` | FilterField | 삭제된 필드 참조 Filter 제거 |
| `UPDATE_FILTER_FIELD_ID` | FilterField | 이름 변경된 필드 Filter ID 업데이트 |
| `REMOVE_SORT` | SortConfig | 삭제된 필드 참조 Sort 제거 |
| `UPDATE_SORT_FIELD_ID` | SortConfig | 이름 변경된 필드 Sort ID 업데이트 |
| `UPDATE_REACTION` | Reaction | Expression 내 필드 참조 업데이트 |
| `REMOVE_REACTION` | Reaction | 깨진 참조가 있는 Reaction 제거 |

#### Rename Detection

필드 이름 변경은 휴리스틱으로 자동 감지됩니다:

- ID 유사도 (Levenshtein distance)
- 동일한 DataType
- 동일한 Label
- 동일한 Constraints
- 동일한 Description

명시적 힌트 제공도 가능:

```typescript
const result = syncViews({
  oldEntity,
  newEntity,
  views,
  config: {
    mode: 'auto-safe',
    fieldMappingHints: [
      { oldFieldId: 'email', newFieldId: 'emailAddress' },
      { oldFieldId: 'phone', newFieldId: 'phoneNumber' },
    ],
  },
})
```

### Diff Utilities

Entity 비교를 위한 유틸리티 함수들:

```typescript
import {
  diffEntities,
  filterChangesByType,
  filterChangesBySeverity,
  summarizeChanges,
  stringSimilarity,
  getTypeCompatibility,
} from '@manifesto-ai/ai'

// Entity 비교
const changes = diffEntities(oldEntity, newEntity)

// 특정 타입의 변경만 필터링
const removedFields = filterChangesByType(changes.changes, 'FIELD_REMOVED')

// 특정 severity 이상만 필터링
const criticalChanges = filterChangesBySeverity(changes.changes, 'critical')

// 변경 요약 텍스트
const summary = summarizeChanges(changes)

// 문자열 유사도 (0-1)
const similarity = stringSimilarity('email', 'emailAddress')

// 타입 호환성 확인
const compatibility = getTypeCompatibility('string', 'number')
// { level: 'requires-component-change', suggestedComponent: 'number-input', ... }
```

### Type Compatibility Matrix

| Old → New | string | number | boolean | enum | date |
|-----------|--------|--------|---------|------|------|
| string | compatible | requires-change | requires-change | compatible | requires-change |
| number | compatible | compatible | requires-change | requires-change | incompatible |
| boolean | compatible | requires-change | compatible | requires-change | incompatible |
| enum | compatible | requires-change | requires-change | compatible | incompatible |
| date | compatible | incompatible | incompatible | incompatible | compatible |

## Error Handling

모든 Generator는 `Result<T, AIGeneratorError>` 타입을 반환합니다:

```typescript
import { isOk, isErr, fold } from '@manifesto-ai/ai'

const result = await entityGenerator.generate(input, context, client)

// 패턴 매칭
if (isOk(result)) {
  console.log('Success:', result.value)
} else {
  console.error('Error:', result.error)
}

// fold 사용
const message = fold(
  result,
  (value) => `Generated: ${value.value.name}`,
  (error) => `Failed: ${error.message}`
)
```

### Error Types

```typescript
import {
  isProviderError,
  isSchemaValidationError,
  isGenerationFailedError,
  isRateLimitedError,
  isTimeoutError,
  isRetryable,
  getRetryDelay,
} from '@manifesto-ai/ai'

if (isErr(result)) {
  const error = result.error

  if (isRateLimitedError(error)) {
    const delay = getRetryDelay(error)
    // 재시도 대기
  }

  if (isRetryable(error)) {
    // 재시도 가능한 에러
  }
}
```

## License

MIT
