# Spec vs Implementation Issues

이 문서는 Manifesto 문서(README/SPEC)를 따라 데모 앱을 만들면서 발견한 모든 불일치를 기록합니다.

---

## Summary

| # | Title | Severity | Status |
|---|-------|----------|--------|
| 1 | Expression DSL 형식 불일치 (배열 vs 객체 vs $prefix) | blocker | **Fixed** (README 수정) |
| 2 | 여러 연산자 미지원 (find, and, or, if, not) | blocker | **Fixed** (README 수정) |
| 3 | 객체 리터럴 Expression 불가 | blocker | Documented (Known Limitations) |
| 4 | 빈 객체 {} Expression 불가 | major | Documented (Known Limitations) |
| 5 | createRuntime API 불일치 | minor | **Fixed** (README 수정) |
| 6 | defineTool API 불일치 | major | **Fixed** (README 수정) |
| 7 | case 표현식 형식 불일치 | major | **Fixed** (README 수정) |

---

## Issues

<!--
Template:
## Issue N: [Short Title]
- **Location**: 어디서 발견
- **Expected (from spec)**: 문서가 말하는 것
- **Actual**: 실제로 일어난 것
- **Severity**: blocker | major | minor
- **Recommendation**: 수정 제안
-->

## Issue 1: Expression DSL 형식 불일치 (중대 발견)

- **Location**: `src/domain/tasks.ts`, `packages/core/README.md`
- **Expected (from spec)**:
  - README "Expression DSL" 섹션: `{ $op: [...] }` 형식 사용 (e.g., `{ $filter: [...] }`, `{ $get: 'path' }`)
  - README "Quick Start" 섹션: `['op', ...]` 배열 형식 사용 (e.g., `['filter', [...]]`, `['get', 'path']`)
- **Actual (TypeScript types)**:
  - TypeScript가 `{ filter: [...] }` 형식 제안 (`$` prefix 없음)
  - 에러 메시지: `'$filter' does not exist ... Did you mean to write 'filter'?`
- **Severity**: blocker
- **Root Cause**: README 문서 내에서도 두 가지 다른 형식 사용, 실제 타입은 제3의 형식
- **Recommendation**:
  1. 모든 문서를 실제 TypeScript 타입과 일치시키기
  2. Expression 형식 명확히 문서화: `{ op: [...] }` ($ 없음) 또는 `['op', ...]`
  3. 지원하는 형식이 여러 개면 명시적으로 문서화

---

## Issue 2: 여러 연산자 미지원 또는 다른 이름으로 존재

- **Location**: TypeScript 컴파일 시 `src/domain/tasks.ts`
- **Expected (from spec)**: README에 문서화된 연산자들
  - `$find: [array, predicate]`
  - `$and: [expr1, expr2, ...]`
  - `$or: [expr1, expr2, ...]`
  - `$if: [condition, thenValue, elseValue]`
  - `$not: expr`
- **Actual (TypeScript 에러 메시지에서)**:
  - 지원되는 연산자 목록: `"concat" | "join" | "slice" | "sort" | "indexOf" | "every" | "some" | "map" | "filter" | "includes" | "at" | "all" | "==" | "!=" | ">" | ">=" | "<" | "<=" | "any" | "+" | "-" | "*" | "case" | "match" | "coalesce" | "pick" | "omit" ...`
  - `find` → 목록에 없음
  - `and` → `all`로 대체 가능
  - `or` → `any`로 대체 가능
  - `if` → `case`, `match`, `coalesce`로 대체 필요
  - `not` → 목록에 없음, `!` 사용해야 함?
- **Severity**: blocker
- **Recommendation**:
  1. README에서 실제 지원되는 연산자 이름으로 업데이트 필요
  2. 또는 문서화된 연산자들을 타입/구현에 추가 필요

---

## Issue 3: 복합 Expression 객체 리터럴 타입 오류

- **Location**: `src/domain/tasks.ts` - createTask effect 내부
- **Expected (from spec)**: README Quick Start (line 82)에서 다음 패턴 사용:
  ```typescript
  ['concat', ['get', 'data.items'], [{ id: ['get', 'input.id'], title: ['get', 'input.title'], completed: false }]]
  ```
  - 배열 내부에 객체 리터럴을 사용하여 새 객체 생성
- **Actual**: 동일 패턴 사용 시 TypeScript 에러 발생
  ```
  Type '{ id: string[]; title: string[]; ... }' is not assignable to type '"concat" | "all" | ...'
  ```
- **Severity**: blocker
- **Impact**: 새 항목 생성하는 모든 action이 작동 불가
- **Workaround Applied**: createTask를 placeholder로 단순화
- **Recommendation**: Quick Start 예제와 실제 타입 간의 불일치 해결 필요

---

## Issue 4: 빈 객체 `{}` Expression 지원 불가

- **Location**: `src/domain/tasks.ts` - clearFilter action
- **Expected**: 필터를 초기화하기 위해 빈 객체 `{}` 설정 가능
- **Actual**: `{}` 는 Expression 타입에 할당 불가
  ```
  Type '{}' is not assignable to parameter of type 'Expression'.
  Type '{}' is not assignable to type 'null'.
  ```
- **Severity**: major
- **Impact**: 필드를 빈 객체로 리셋하는 기능 불가
- **Workaround Applied**: 현재 값을 그대로 유지하는 placeholder 사용
- **Recommendation**: 리터럴 값(객체, 배열, null 등)을 Expression으로 사용하는 방법 문서화 필요

---

## Issue 5: createRuntime API 불일치

- **Location**: `src/store/useTasksStore.ts`, `packages/core/README.md`
- **Expected (from spec)**: README에서 `createRuntime(domain)` 형식 사용
  ```typescript
  const runtime = createRuntime(todosDomain);
  ```
- **Actual**: TypeScript 에러 - `{ domain: ... }` 형식 필요
  ```
  Property 'domain' is missing in type 'ManifestoDomain...' but required in type 'CreateRuntimeOptions'
  ```
- **Severity**: minor
- **Fix Applied**: `createRuntime({ domain: tasksDomain })` 사용
- **Recommendation**: README에서 올바른 API 형식 문서화

---

## Issue 6: defineTool API 불일치

- **Location**: `src/agent/session.ts`, `packages/agent/README.md`
- **Expected (from spec)**: README에서 단일 객체 인자로 defineTool 호출
  ```typescript
  const searchTool = defineTool({
    name: 'search',
    description: 'Search the web',
    execute: async (input: { query: string }) => { ... },
  });
  ```
- **Actual**: TypeScript 에러 - 3개 인자 필요
  ```
  Expected 3 arguments, but got 1.
  ```
- **Severity**: major
- **Impact**: Tool 정의가 문서대로 작동하지 않음
- **Recommendation**: README의 defineTool 예제를 실제 API와 일치시키기
- **Status**: ✅ Fixed - README 수정됨 (`defineTool(name, inputSchema, execute)`)

---

## Issue 7: case 표현식 형식 불일치

- **Location**: `src/domain/tasks.ts`, `packages/core/README.md`
- **Expected (from updated README)**:
  ```typescript
  ['case',
    condition1, value1,
    condition2, value2,
    defaultValue
  ]
  ```
- **Actual**: TypeScript 에러 - CaseClause가 2개 요소만 허용
  ```
  Type at positions 1 through 2 in source is not compatible with type at position 1 in target.
  Source has 3 element(s) but target allows only 2.
  ```
- **Severity**: major
- **Impact**: 조건부 표현식 사용 불가
- **Root Cause**: `case` 표현식 형식이 `['case', [cond, val], [cond, val], default]` 형태
- **Status**: ✅ Fixed - README 수정 및 데모 앱에서 검증 완료
- **Correct Format**:
  ```typescript
  ['case',
    [condition1, value1],
    [condition2, value2],
    defaultValue
  ]
  ```

