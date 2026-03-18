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

- [x] `.mel` import and loader strategy in Next.js is concrete and documented. → F-005 기록. Turbopack 비호환.
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

## F-005: Next.js Turbopack에서 .mel 파일 import 불가

- **카테고리**: DX
- **심각도**: major
- **발견 시점**: Phase 2, useTaskFlow 훅 작성
- **재현 경로**: `import melSource from '@/domain/taskflow.mel'`을 Next.js 16 앱에서 시도

### 기대한 것
`mel.d.ts`에 `declare module '*.mel'`이 정의되어 있으므로, `.mel` 파일을 문자열로 import할 수 있을 것으로 기대. webpack의 `asset/source` 또는 Turbopack의 loader 규칙으로 처리 가능할 것.

### 실제 동작
1. webpack 설정 → Next.js 16이 Turbopack 기본이라 `webpack` config만 있으면 빌드 거부 ("This build is using Turbopack, with a `webpack` config and no `turbopack` config")
2. Turbopack `rules` + `raw-loader` → `raw-loader`가 설치되어 있지 않아 resolve 실패
3. Turbopack은 webpack의 `asset/source`에 대응하는 빌트인 메커니즘이 없음

### Workaround
MEL 소스를 TypeScript 문자열 상수(`taskflow-schema.ts`)로 복제. `.mel` 파일과 내용이 중복됨.
```typescript
// domain/taskflow-schema.ts
export const TASKFLOW_MEL = `domain TaskFlow { ... }`;
```
테스트는 `readFileSync`로 `.mel` 파일을 직접 읽음 (Vitest는 Node 환경이라 문제 없음).

### 근본 원인 추정
Next.js 16의 Turbopack은 커스텀 파일 타입 지원이 webpack보다 제한적. `.mel` 같은 비표준 확장자에 대한 raw import는 추가 설정이 필요한데, 그 설정 방법이 명확하지 않음.

### Manifesto에 대한 제안
1. `@manifesto-ai/compiler`에서 빌드 타임에 `.mel` → `.ts` 변환하는 codegen CLI 제공 (`manifesto codegen taskflow.mel → taskflow-schema.ts`)
2. 또는 Vite/Turbopack/webpack 플러그인을 공식으로 제공하여 `.mel` import를 지원
3. 최소한 문서에 프레임워크별 `.mel` import 전략을 명시

---

## F-006: MEL 컴파일 에러 위치 정보가 SDK 레벨에서 개발자에게 도달하지 않음

- **카테고리**: 에러 메시지
- **심각도**: major
- **발견 시점**: Phase 2, 코드 리뷰
- **재현 경로**: MEL 문법 에러가 있는 문자열을 `createManifesto({ schema: melString })`에 전달

### 기대한 것
컴파일러에 `Diagnostic` 타입이 있고, `location.start.line/column`, `suggestion`, `related` 필드가 구현되어 있으므로, MEL 컴파일 에러 시 "line 42, column 7: Expected ')'" 같은 위치 정보가 개발자에게 표시될 것으로 기대.

### 실제 동작
컴파일러 내부적으로는 위치 정보가 완벽하게 추적되지만:
1. `createManifesto()`에서 에러가 발생했을 때 어떤 형태로 표면화되는지 불분명
2. Phase 1~2 개발 중 MEL 문법 오류를 일부러 만들어보지 않아서 직접 재현하지는 못함
3. 하지만 개발 중 에러 위치 보고가 도움이 됐다는 경험이 없음 — 기능이 있다는 것 자체를 모름

### Workaround
없음. 에러 발생 시 MEL 소스를 육안으로 검토.

### 근본 원인 추정
컴파일러의 `Diagnostic`이 풍부한 정보를 담고 있지만, SDK의 `createManifesto()` → `resolveSchema()` → `compileMelDomain()` 파이프라인에서 이 정보가 축약되거나 일반적인 Error로 변환되어 위치 정보가 소실되는 것으로 추정.

### Manifesto에 대한 제안
1. SDK에서 MEL 컴파일 실패 시 `Diagnostic[]`을 그대로 포함한 에러를 throw하거나, 포맷팅된 에러 메시지에 위치 정보 포함
2. `formatDiagnostic(diag: Diagnostic): string` 같은 유틸리티 export — 에러를 사람이 읽기 좋은 형태로 변환
3. CLI에서 컴파일 시 에러 위치를 화살표로 가리키는 출력 (Rust/TypeScript 스타일)

---

## F-007: SDK에 React 바인딩이 없어 매번 커스텀 훅을 직접 작성해야 함

- **카테고리**: SDK API
- **심각도**: minor
- **발견 시점**: Phase 2, useTaskFlow 훅 작성
- **재현 경로**: React 앱에서 Manifesto를 사용하려면 `useEffect` + `subscribe` + `useRef` + `useCallback` 조합을 직접 구현

### 기대한 것
`@manifesto-ai/sdk/react` 또는 별도 패키지에서 `useManifesto(schema)` 같은 공식 React 훅을 제공할 것으로 기대.

### 실제 동작
SDK는 프레임워크 무관. React 연결은 todo-react 예제의 `use-manifesto.ts`를 참고하여 매 앱에서 직접 구현해야 함. 핵심 패턴 (~50줄):
- `useRef`로 인스턴스 관리
- `useEffect`로 생성/구독/정리
- `useCallback`으로 안정적인 dispatch 래퍼
- `useState`로 snapshot을 React 상태에 동기화

### Workaround
todo-react 예제 코드를 복사하여 `useTaskFlow.ts`로 커스터마이징. 앱별 타입 추출 로직(`extractState`)을 추가.

### 근본 원인 추정
의도적 설계 결정 — SDK를 프레임워크 무관하게 유지. 하지만 실질적으로 React가 주 사용 환경이라면 공식 바인딩이 있는 것이 DX에 유리.

### Manifesto에 대한 제안
`@manifesto-ai/react` 패키지를 제공:
```typescript
import { useManifesto } from '@manifesto-ai/react';
const { state, dispatch, ready } = useManifesto({ schema, effects });
```
Zustand의 `useStore`, Jotai의 `useAtom`처럼 한 줄 import로 연결 가능하게.

---

## F-008: subscribe의 identity selector 패턴이 직관적이지 않음

- **카테고리**: SDK API
- **심각도**: papercut
- **발견 시점**: Phase 2, useTaskFlow 훅 작성
- **재현 경로**: 전체 snapshot 변경을 구독하려면 identity selector를 전달해야 함

### 기대한 것
```typescript
instance.subscribe((snapshot) => { /* 전체 snapshot 변경 시 호출 */ });
```

### 실제 동작
```typescript
instance.subscribe(
  (s) => s,           // selector — identity를 명시적으로 전달해야 함
  (snapshot) => { ... } // listener
);
```
selector가 필수 인자라서, 전체 snapshot을 구독하려면 `(s) => s` 같은 의미 없는 함수를 전달해야 함.

### Workaround
`(s) => s` 패턴 사용.

### 근본 원인 추정
selector 기반 구독은 성능 최적화를 위한 의도적 설계. 하지만 "전체 구독"이 가장 흔한 패턴인데 이에 대한 편의 오버로드가 없음.

### Manifesto에 대한 제안
selector 없는 오버로드 추가:
```typescript
// 현재 (유지)
subscribe(selector, listener): Unsubscribe
// 추가
subscribe(listener): Unsubscribe  // selector 생략 시 전체 구독
```

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

**결과**: 성공. React UI가 Manifesto SDK를 통해 모든 상태를 관리. Blocker 없음.

**마찰 통계**:
- blocker: 0
- major: 2 (F-005: Turbopack .mel import, F-006: 에러 위치 정보 미도달)
- minor: 1 (F-007: React 바인딩 부재)
- papercut: 1 (F-008: identity selector)

**긍정적 발견**:
- SDK의 `dispatch → subscribe` 루프가 React와 깔끔하게 연결. 상태 동기화에 race condition 없음.
- Manifesto computed 값(activeTasks, deletedTasks, 각종 count)이 자동으로 재계산되어 React 컴포넌트에서 별도 필터링 로직이 불필요.
- 기존 props-only 컴포넌트(KanbanView, TodoView, TableView)를 변경 없이 그대로 연결 가능.
- fixture 데이터를 seed dispatch로 주입하는 패턴이 간단하고 안정적.
- KanbanView의 드래그앤드롭 → `moveTask` action 연결이 한 줄로 완료.

**가장 큰 개선 필요 영역**: 빌드 도구 통합 (F-005). `.mel` 파일을 Next.js에서 자연스럽게 import할 수 없어 문자열 상수로 복제해야 하는 것은 DX 저하.

### Phase 3 Summary

Pending.

### Phase 4 Summary

Pending.
