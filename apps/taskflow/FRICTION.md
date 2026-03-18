# Manifesto Friction Log — TaskFlow v2 Rebuild

> This document records real implementation friction discovered while rebuilding
> TaskFlow on top of `@manifesto-ai/sdk`.

This file is more important than the demo app itself.

## Logging Rules

1. Record friction immediately after applying the workaround.
2. Copy exact error output when available.
3. Add a `// FRICTION: F-XXX` comment in workaround code when the workaround remains in source.
4. Do not log speculation as a confirmed issue. Use the seed checklist below until it is reproduced.
5. At the end of each phase, summarize blocker and major patterns before continuing.

## Seed Checks To Validate Early

- [ ] `.mel` import and loader strategy in Next.js is concrete and documented.
- [x] `createManifesto({ schema: melString })` and imported `.mel` both behave as expected. → melString 직접 전달 작동 확인.
- [x] `dispatchAsync` helper boilerplate is acceptable, or its friction is documented. → F-001 기록.
- [x] `getSnapshot().data` and `snapshot.computed[...]` type ergonomics are assessed. → F-002 기록.
- [x] Compiler diagnostics for `filter`, `$item`, nullable fields, and object literals are captured if they fail. → 전부 문제 없이 컴파일됨.
- [x] Any SDK/SPEC drift encountered during setup is documented with exact observed behavior. → F-003 기록.

## Issue Template

Copy this block for each confirmed issue.

```markdown
## F-001: [One-line title]

- **카테고리**: MEL 표현력 | SDK API | SPEC-구현 괴리 | DX | 에러 메시지 | 문서 | 타입 시스템 | 성능
- **심각도**: blocker | major | minor | papercut
- **발견 시점**: Phase N, [작업 항목]
- **재현 경로**: [어떤 코드를 작성하려다가 막혔는지]

### 기대한 것
[SPEC이나 문서에 따르면 이렇게 되어야 했다]

### 실제 동작
[실제로는 이렇게 됐다. 에러 메시지가 있다면 전문 포함]

### Workaround
[우회한 방법. 코드 포함]

### 근본 원인 추정
[왜 이런 문제가 생겼는지에 대한 추정]

### Manifesto에 대한 제안
[프레임워크 레벨에서 어떻게 해결해야 하는지]

---
```

## Confirmed Issues

## F-001: dispatchAsync 유틸을 매번 직접 구현해야 함

- **카테고리**: SDK API
- **심각도**: minor
- **발견 시점**: Phase 1, instance.ts 작성
- **재현 경로**: 테스트에서 dispatch 후 결과 snapshot을 확인하려면 비동기 대기가 필요

### 기대한 것
SDK에 `dispatchAsync()` 또는 `dispatch()` 의 Promise 반환 변형이 내장되어 있을 것으로 기대.

### 실제 동작
SDK SPEC §14.3에서 "convenience utility, not a protocol primitive"로 명시. `dispatch()`는 `void` 반환(fire-and-forget). 비동기 대기가 필요하면 `on('dispatch:completed', ...)` 패턴으로 직접 구현해야 함.

### Workaround
`instance.ts`에 `dispatchAsync()` 헬퍼 구현 (~20줄). `on('dispatch:completed')` + `on('dispatch:failed')` 이벤트를 Promise로 래핑.

### 근본 원인 추정
SDK 설계 원칙상 dispatch는 동기적이고 fire-and-forget이어야 함 (SDK-DISPATCH-3). dispatchAsync는 프로토콜 원시가 아닌 편의 유틸리티라는 의도적 결정.

### Manifesto에 대한 제안
SDK에 `dispatchAsync` 를 공식 편의 유틸로 export하면 모든 앱에서 중복 구현을 없앨 수 있음. `import { dispatchAsync } from '@manifesto-ai/sdk/utils'` 같은 형태.

---

## F-002: snapshot.data와 snapshot.computed의 TypeScript 타입이 전부 unknown

- **카테고리**: 타입 시스템
- **심각도**: major
- **발견 시점**: Phase 1, 테스트 작성
- **재현 경로**: `instance.getSnapshot().data.tasks` 접근 시 타입이 `unknown`

### 기대한 것
MEL에서 `tasks: Array<Task>`로 정의했으므로, `getSnapshot().data.tasks`의 타입이 `Task[]`로 추론되거나 최소한 제네릭으로 타입을 지정할 수 있을 것으로 기대.

### 실제 동작
`Snapshot.data`는 `Record<string, unknown>`, `Snapshot.computed`도 `Record<string, unknown>`. 모든 필드 접근에 `as` 캐스팅이 필요.
```typescript
const tasks = snap.data.tasks as Array<Record<string, unknown>>;  // 매번 캐스트
const count = snap.computed.totalCount as number;                  // 매번 캐스트
```

### Workaround
테스트에서 `as Array<Record<string, unknown>>` 등으로 캐스팅. Phase 2에서는 타입 래퍼 훅을 만들어 한 곳에서만 캐스팅할 예정.

### 근본 원인 추정
SDK의 `Snapshot` 타입이 DomainSchema와 연결된 제네릭을 사용하지 않음. MEL 컴파일 결과가 런타임 값이므로 컴파일 타임에 타입을 추론할 방법이 없음.

### Manifesto에 대한 제안
1. `@manifesto-ai/codegen`으로 MEL에서 TypeScript 타입을 생성하여 `Snapshot<TaskFlowData>`처럼 사용할 수 있게 하기
2. 또는 `createManifesto<TData, TComputed>()`에 제네릭 파라미터를 받아 타입을 오버라이드할 수 있게 하기

---

## F-003: 초기 snapshot.data가 빈 객체 — state default 값이 표시되지 않음

- **카테고리**: DX
- **심각도**: papercut
- **발견 시점**: Phase 1, SDK 인스턴스 테스트
- **재현 경로**: `createManifesto()` 직후 `getSnapshot().data` 확인

### 기대한 것
MEL에서 `tasks: Array<Task> = []`, `viewMode: "kanban" | ... = "kanban"` 등 default가 정의되어 있으므로, 초기 snapshot.data에 `{ tasks: [], selectedTaskId: null, viewMode: "kanban", assistantOpen: true }` 가 나올 것으로 기대.

### 실제 동작
`getSnapshot().data`가 `{}` (빈 객체). 하지만 computed는 정상 동작 (빈 배열 기반으로 올바르게 계산). dispatch 이후에는 `data.tasks`가 정상적으로 나타남.

### Workaround
첫 dispatch 전에 data를 직접 읽지 않고 computed 값을 활용. 또는 초기화 action을 dispatch하여 default 값을 명시적으로 설정.

### 근본 원인 추정
Host/Core가 snapshot.data를 lazily populate하는 것으로 보임. Patch가 적용되기 전까지는 data 경로에 기본값이 물리적으로 존재하지 않지만, computed expression 평가 시에는 schema default를 참조하여 올바르게 계산.

### Manifesto에 대한 제안
초기 snapshot 생성 시 schema의 default 값을 data에 eagerly populate하면 디버깅이 쉬워짐.

---

## F-004: MEL map+cond 패턴에서 객체 전체 필드 나열 boilerplate

- **카테고리**: MEL 표현력
- **심각도**: minor
- **발견 시점**: Phase 1, taskflow.mel 작성
- **재현 경로**: `updateTask`, `moveTask`, `softDeleteTask`, `restoreTask` 작성 시

### 기대한 것
배열 내 객체의 한 필드만 변경하는 spread 연산자 (`{ ...$item, status: newStatus }`) 같은 문법이 있을 것.

### 실제 동작
객체의 모든 11개 필드를 일일이 나열해야 함. `updateTask` action 하나에 13줄의 객체 리터럴이 필요.
```mel
cond(eq($item.id, id),
  {
    id: $item.id, title: $item.title, description: $item.description,
    status: newStatus, priority: $item.priority, assignee: $item.assignee,
    dueDate: $item.dueDate, tags: $item.tags, createdAt: $item.createdAt,
    updatedAt: $item.updatedAt, deletedAt: $item.deletedAt
  },
  $item
)
```

### Workaround
필드를 전부 나열. 4개 action에서 동일 패턴 반복.

### 근본 원인 추정
MEL은 JSON-serializable expression language로 설계되어 spread 연산자 같은 구조적 편의 문법이 없음.

### Manifesto에 대한 제안
MEL에 `merge($item, { status: newStatus })` 또는 `{ ...$item, status: newStatus }` 문법을 추가하면 array-of-objects 도메인에서 boilerplate를 대폭 줄일 수 있음. 이것은 가장 빈번하게 발생하는 패턴이므로 우선순위가 높음.

---

## Phase Summaries

### Phase 1 Summary

**결과**: 성공. 모든 9개 테스트 통과. Blocker 없음.

**마찰 통계**:
- blocker: 0
- major: 1 (F-002: 타입 안전성)
- minor: 2 (F-001: dispatchAsync, F-004: map+cond boilerplate)
- papercut: 1 (F-003: 초기 data 빈 객체)

**긍정적 발견**:
- MEL 컴파일러가 기대 이상으로 잘 작동. `filter`, `map`, `cond`, `isNull`, `isNotNull`, `append`, `coalesce`, `$item`, union type, nullable 타입 모두 에러 없이 컴파일.
- computed에서 다른 computed를 참조하는 패턴 (`filter(activeTasks, eq(...))`) 이 문제 없이 작동.
- SDK의 dispatch → on(completed) 사이클이 안정적.
- MEL string을 `createManifesto({ schema: melString })`에 직접 전달하는 패턴이 간편하고 정상 작동.

**가장 큰 개선 필요 영역**: 타입 시스템 (F-002). Phase 2에서 React 연결 시 모든 컴포넌트에서 캐스팅이 필요해질 것으로 예상.

### Phase 2 Summary

Pending.

### Phase 3 Summary

Pending.

### Phase 4 Summary

Pending.
