# 버전 마이그레이션

이 문서는 `@manifesto-ai/core` 패키지의 버전 업그레이드 시 필요한 변경사항을 안내한다.

## 현재 버전

```bash
npm info @manifesto-ai/core version
# 0.2.0
```

---

## 버전 히스토리

### v0.2.0 (현재)

**주요 기능**
- 완전한 도메인 정의 시스템 (`defineDomain`, `defineSource`, `defineDerived`, `defineAsync`, `defineAction`)
- Expression DSL (JSON 기반 선언적 표현식)
- Effect 시스템 (부작용 설명)
- Result 패턴 (함수형 에러 처리)
- DAG 기반 변경 전파
- Policy 시스템 (전제조건, 필드 정책)
- Zod 통합 스키마 검증
- Runtime API (`createRuntime`, 스냅샷, 구독)

**의존성**
- `zod`: ^3.24.1

### v0.1.0

**초기 릴리스**
- 기본 도메인 정의
- Expression 평가
- 간단한 런타임

---

## 마이그레이션 가이드

### v0.1.x → v0.2.x

#### Breaking Changes

##### 1. defineDerived의 deps 필드 필수화

```typescript
// v0.1.x (deprecated)
const total = defineDerived({
  expr: ['+', ['get', 'derived.subtotal'], ['get', 'derived.shippingFee']]
});

// v0.2.x (required)
const total = defineDerived({
  deps: ['derived.subtotal', 'derived.shippingFee'],  // 필수
  expr: ['+', ['get', 'derived.subtotal'], ['get', 'derived.shippingFee']]
});
```

**이유**: 의존성을 명시적으로 선언하면 DAG 구축이 더 정확해지고, 순환 의존성을 빌드 타임에 감지할 수 있다.

##### 2. SemanticMeta 타입 변경

```typescript
// v0.1.x
type SemanticMeta = {
  type: string;
  description?: string;
  editable?: boolean;
};

// v0.2.x
type SemanticMeta = {
  type: string;
  description: string;  // 필수
  importance?: 'critical' | 'high' | 'medium' | 'low';
  readable?: boolean;
  writable?: boolean;   // editable → writable로 이름 변경
  examples?: unknown[];
  hints?: Record<string, unknown>;
};
```

**마이그레이션**:
```typescript
// v0.1.x
defineSource({
  schema: z.string(),
  semantic: { type: 'string', editable: true }
});

// v0.2.x
defineSource({
  schema: z.string(),
  semantic: {
    type: 'string',
    description: '설명 필수',  // 추가
    writable: true            // editable → writable
  }
});
```

##### 3. Effect 타입 변경

```typescript
// v0.1.x
type Effect = {
  kind: 'setValue' | 'apiCall' | ...;
  // ...
};

// v0.2.x
type Effect = {
  type: 'SetValue' | 'ApiCall' | ...;  // kind → type, PascalCase
  // ...
};
```

**마이그레이션**:
```typescript
// v0.1.x
const effect = { kind: 'setValue', path: 'data.items', value: [] };

// v0.2.x
const effect = { type: 'SetValue', path: 'data.items', value: [] };

// 또는 빌더 함수 사용 (권장)
import { setValue } from '@manifesto-ai/core';
const effect = setValue('data.items', []);
```

##### 4. Runtime API 변경

```typescript
// v0.1.x
const runtime = createRuntime(domain, initialData);
runtime.getValue('data.items');
runtime.setValue('data.items', [...]);

// v0.2.x
const runtime = createRuntime({ domain, initialData, initialState });
runtime.get('data.items');
runtime.set('data.items', [...]);
```

**마이그레이션**:
```typescript
// v0.1.x
const runtime = createRuntime(orderDomain, { items: [] });
const items = runtime.getValue('data.items');

// v0.2.x
const runtime = createRuntime({
  domain: orderDomain,
  initialData: { items: [] },
  initialState: { isSubmitting: false }
});
const items = runtime.get('data.items');
```

##### 5. 검증 결과 타입 변경

```typescript
// v0.1.x
type ValidationError = {
  field: string;
  message: string;
};

// v0.2.x
type ValidationIssue = {
  code: string;
  message: string;
  path: SemanticPath;
  severity: 'error' | 'warning' | 'suggestion';
  suggestedFix?: { description: string; value: unknown };
};
```

---

## 향후 버전 예정

### v0.3.0 (예정)

**예정 기능**
- `defineTaskFlow` - 멀티스텝 태스크 정의
- Bridge 패키지 분리 (`@manifesto-ai/react`, `@manifesto-ai/vue`)
- Projection 패키지 (`@manifesto-ai/projection-agent`)

**예상 Breaking Changes**
- `createRuntime` 반환 타입이 인터페이스에서 클래스로 변경될 수 있음
- Effect 실행 방식 변경 가능

### v1.0.0 (예정)

**안정화**
- API 동결
- 성능 최적화
- 완전한 타입 추론

---

## 버전 호환성 표

| Core 버전 | React Bridge | Vue Bridge | Zod |
|-----------|--------------|------------|-----|
| 0.2.x | 0.2.x | 0.2.x | ^3.24.0 |
| 0.1.x | 0.1.x | - | ^3.22.0 |

---

## 마이그레이션 체크리스트

### v0.1.x → v0.2.x 업그레이드 시

- [ ] `defineDerived`에 `deps` 배열 추가
- [ ] `SemanticMeta`의 `editable` → `writable` 변경
- [ ] `SemanticMeta`에 `description` 필수 추가
- [ ] Effect의 `kind` → `type` 변경 (또는 빌더 함수 사용)
- [ ] `createRuntime` 호출을 객체 형태로 변경
- [ ] `getValue`/`setValue` → `get`/`set`으로 변경
- [ ] 검증 에러 처리 로직 업데이트

---

## 자동 마이그레이션 도구

### codemod (예정)

향후 버전에서는 자동 마이그레이션 도구를 제공할 예정이다.

```bash
# 예정
npx @manifesto-ai/codemod upgrade 0.2
```

---

## 호환성 레이어

### v0.1.x 호환 API (Deprecated)

일부 구 API는 경고와 함께 계속 동작한다.

```typescript
// 내부적으로 경고 출력 후 새 API 호출
import { createRuntime } from '@manifesto-ai/core/compat';

// 사용은 동일하지만 콘솔에 deprecation 경고
const runtime = createRuntime(domain, data);
// Warning: createRuntime(domain, data) is deprecated.
// Use createRuntime({ domain, initialData }) instead.
```

**주의**: 호환 레이어는 v1.0.0에서 제거될 예정이다.

---

## 문제 해결

### 일반적인 마이그레이션 문제

#### 1. TypeScript 타입 에러

```
Type 'string' is not assignable to type 'SemanticPath'
```

**해결**: SemanticPath는 이제 브랜드 타입이다. 문자열 리터럴을 사용하거나 타입 단언을 사용한다.

```typescript
// 방법 1: 리터럴 타입으로 추론
const path = 'data.items' as const;

// 방법 2: 타입 단언
const path = 'data.items' as SemanticPath;
```

#### 2. deps 누락 경고

```
Warning: Expression references paths not listed in deps: ['derived.subtotal']
```

**해결**: `defineDerived`의 `deps` 배열에 모든 참조 경로를 추가한다.

```typescript
defineDerived({
  deps: ['derived.subtotal', 'derived.discount'],  // 누락된 경로 추가
  expr: ['+', ['get', 'derived.subtotal'], ['get', 'derived.discount']]
});
```

#### 3. 순환 의존성 에러

```
Error: Circular dependency detected: derived.a → derived.b → derived.a
```

**해결**: 의존성 구조를 재설계한다.

```typescript
// 잘못된 예
const a = defineDerived({
  deps: ['derived.b'],
  expr: ['get', 'derived.b']
});

const b = defineDerived({
  deps: ['derived.a'],  // 순환!
  expr: ['get', 'derived.a']
});

// 올바른 예: 공통 소스에서 파생
const a = defineDerived({
  deps: ['data.value'],
  expr: ['*', ['get', 'data.value'], 2]
});

const b = defineDerived({
  deps: ['data.value'],
  expr: ['*', ['get', 'data.value'], 3]
});
```

---

## 지원

### 이슈 리포트

마이그레이션 중 문제가 발생하면 GitHub 이슈를 생성한다.

- [GitHub Issues](https://github.com/manifesto-ai/core/issues)

### 라벨

- `migration` - 마이그레이션 관련 이슈
- `breaking-change` - Breaking Change 관련
- `help wanted` - 커뮤니티 도움 요청

---

## 다음 단계

- [Overview](01-overview.md) - 최신 아키텍처 확인
- [도메인 정의](03-domain-definition.md) - 새로운 API 학습
- [Runtime API](07-runtime.md) - 변경된 런타임 API
