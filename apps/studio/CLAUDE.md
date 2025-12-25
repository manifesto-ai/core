# Studio AI 지침

## 핵심 원칙: Manifesto로 Manifesto를 만든다

Studio는 Manifesto 프레임워크의 자기 참조적 구현입니다.
코드를 작성하거나 수정할 때 반드시 다음 원칙을 따르세요.

---

## 헌법: Core First 원칙

> **모든 Functional 코드의 Single Source of Truth는 `@manifesto-ai/core`**

이 원칙은 모든 개발의 최우선 규칙입니다:

1. **먼저 검토**: 새로운 기능 개발 시 Core에 해당 기능이 있는지 **먼저 확인**
2. **없으면 제안**: Core에 없으면 추가할지 사용자에게 **제안 먼저**
3. **래퍼만 작성**: Studio 전용 로직은 Core를 래핑하는 형태로만 작성
4. **절대 금지**: Core 코드를 복제하거나 재구현하는 것은 **절대 금지**

```typescript
// ✅ 올바른 방식: Core import 후 래핑
import { evaluate, type Expression, type EvaluationContext } from "@manifesto-ai/core";

export function evaluateExpression(expr: unknown, ctx: StudioContext) {
  const coreCtx = adaptContext(ctx); // 컨텍스트 변환만
  return evaluate(expr as Expression, coreCtx);
}

// ❌ 금지: Core 코드 복제/재구현
const OPERATORS = { ... }; // Core에 이미 있는 연산자들을 다시 구현
```

---

## 필수 규칙

### 1. 상태 관리는 반드시 Manifesto Runtime 사용

```typescript
// ✅ 올바른 방식
import { useValue, useSetValue } from "@manifesto-ai/bridge-react";

function Component() {
  const { value } = useValue("data.sources");
  const { setValue } = useSetValue();

  setValue("data.sources", newSources);
}

// ❌ 금지: Zustand, useState, useReducer로 도메인 상태 관리
const [sources, setSources] = useState({}); // 금지
```

### 2. 새로운 상태는 domain/에 정의

새로운 데이터나 상태가 필요하면:

1. `domain/sources.ts`에 `defineSource` 추가
2. 계산된 값이면 `domain/derived.ts`에 `defineDerived` 추가
3. `domain/studio-domain.ts`의 스키마 업데이트
4. `runtime/hooks.ts`에 타입된 훅 추가

### 3. Expression DSL 지원 연산자

Core에서 지원하는 모든 연산자 사용 가능 (70+ 연산자):

```typescript
// 객체 조작 (불변)
["assoc", obj, "key", value]  // 키-값 추가/수정
["dissoc", obj, "key"]        // 키 제거
["merge", obj1, obj2, ...]    // 객체 병합

// 배열 조작
["concat", arr1, arr2]        // 배열 병합 (다형성: 문자열도 지원)
["append", arr, elem]         // 끝에 추가
["prepend", arr, elem]        // 앞에 추가

// FP 패턴
["map", arr, transform]
["filter", arr, predicate]
["find", arr, predicate]
["groupBy", arr, keyExpr]
```

### 4. 경로 규칙 준수

| 접두사 | 용도 | 예시 |
|--------|------|------|
| `data.` | 영속 데이터 | `data.sources`, `data.domain.name` |
| `state.` | UI 상태 | `state.selectedBlockId` |
| `derived.` | 계산된 값 | `derived.allPaths` |

---

## 파일 구조 규칙

```
src/
├── domain/          # Manifesto 정의만 (순수 선언)
├── runtime/         # Provider + 훅 + 순수 함수
├── components/      # React 컴포넌트
│   └── editor/
│       └── expression/  # Expression 편집기 (순수 로직 분리)
└── app/             # Next.js 라우팅
```

- `domain/`에는 React 코드 금지
- `runtime/`에는 UI 컴포넌트 금지
- 컴포넌트는 `runtime/hooks.ts`의 훅만 사용

---

## 순수 함수 우선 원칙 (Monadic & Atomic)

### 핵심: UI와 로직 분리

```typescript
// ✅ 올바른 방식: 순수 함수로 로직 분리
// runtime/validation.ts
export function validateDomain(input: ValidationInput): ValidationResult {
  // 순수 함수 - 테스트 용이, 재사용 가능
}

// runtime/hooks.ts
export function useStudioValidation() {
  // 훅은 순수 함수를 호출만 함
  const result = validateDomain({ ... });
  setValue("state.validationResult", result);
}

// ❌ 잘못된 방식: 훅 안에 로직 직접 작성
export function useStudioValidation() {
  useEffect(() => {
    // 100줄의 검증 로직... (테스트 불가)
  }, []);
}
```

### 테스트 가능한 구조

| 파일 | 역할 | 테스트 |
|------|------|--------|
| `types.ts` | 타입 가드 함수 | `types.test.ts` |
| `operators.ts` | 연산자 메타데이터 | `operators.test.ts` |
| `useExpressionHistory.ts` | 히스토리 훅 | `useExpressionHistory.test.ts` |
| `validation.ts` | 도메인 검증 | `validation.test.ts` |

### 원칙

1. **UI 연결 불필요한 로직 → 순수 함수**
   - 검증, 변환, 파싱, 계산 등

2. **순수 함수 → 별도 파일로 추출**
   - `validation.ts`, `types.ts`, `operators.ts`

3. **훅은 순수 함수의 조합**
   - 훅 = 순수 함수 호출 + 상태 연결

4. **테스트 먼저 (TDD 권장)**
   - 순수 함수는 vitest로 검증 후 UI 연결

---

## 검증 규칙 추가시

`runtime/validation.ts`의 `validateDomain` 함수에 추가:

```typescript
// 새 규칙 추가 패턴 (순수 함수 내)
if (/* 조건 */) {
  issues.push({
    code: "RULE_CODE",
    message: "사람이 읽을 수 있는 메시지",
    path: "문제가 있는 경로",
    severity: "error" | "warning" | "info" | "suggestion",
    suggestedFix: { description: "수정 설명", value: "수정값" }, // 선택
  });
}
```

**중요**: 새 규칙 추가 시 `validation.test.ts`에 테스트도 함께 작성

---

## 커밋 메시지 규칙

```
feat(studio): 기능 설명
fix(studio): 버그 수정 설명
refactor(studio): 리팩토링 설명
```

---

## 철학적 체크리스트

코드 작성 전 자문하세요:

- [ ] 이 상태는 Semantic Path로 주소화 가능한가?
- [ ] Effect를 통해 안전하게 변경되는가?
- [ ] AI가 이 구조를 이해하고 조작할 수 있는가?
- [ ] Manifesto 철학과 일관성이 있는가?
- [ ] **이 로직은 순수 함수로 분리 가능한가?**
- [ ] **테스트를 먼저 작성했는가?**

> "단순함이 궁극의 정교함이다."

---

## 테스트 명령어

```bash
pnpm test        # watch 모드
pnpm test:run    # 단일 실행
pnpm test:coverage  # 커버리지 포함
```
