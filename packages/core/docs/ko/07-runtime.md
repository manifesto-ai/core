# Runtime

```typescript
import { createRuntime, isOk } from '@manifesto-ai/core';

// 런타임 생성
const runtime = createRuntime({
  domain: orderDomain,
  initialData: { items: [], couponCode: '' },
  effectHandler: {
    apiCall: async (request) => {
      const response = await fetch(request.endpoint, {
        method: request.method,
        headers: request.headers,
        body: request.body ? JSON.stringify(request.body) : undefined
      });
      return response.json();
    }
  }
});

// 값 읽기
console.log(runtime.get('data.items'));        // []
console.log(runtime.get('derived.subtotal'));  // 0

// 값 쓰기
runtime.set('data.items', [{ id: '1', name: '상품A', price: 10000, quantity: 2 }]);
console.log(runtime.get('derived.subtotal'));  // 20000 (자동 계산)

// 구독
const unsubscribe = runtime.subscribePath('derived.total', (value) => {
  console.log('총액 변경:', value);
});

// 액션 실행
const result = await runtime.execute('checkout');
if (isOk(result)) {
  console.log('결제 성공');
}
```

## createRuntime()

도메인으로부터 런타임 인스턴스를 생성한다.

### CreateRuntimeOptions

```typescript
type CreateRuntimeOptions<TData, TState> = {
  /** 도메인 정의 */
  domain: ManifestoDomain<TData, TState>;

  /** 초기 데이터 (선택) */
  initialData?: Partial<TData>;

  /** Effect 핸들러 (선택) */
  effectHandler?: Partial<EffectHandler>;
};
```

### 초기화 과정

1. 스냅샷 생성 (initialData + domain.initialState)
2. 의존성 그래프 구축
3. 구독 관리자 초기화
4. Effect 핸들러 설정
5. 초기 derived 값 계산

```typescript
const runtime = createRuntime({
  domain: orderDomain,
  initialData: {
    items: [{ id: '1', name: '상품A', price: 10000, quantity: 1 }]
  },
  effectHandler: {
    apiCall: async (request) => {
      // 커스텀 API 호출 로직
    },
    navigate: (to, mode) => {
      // 커스텀 네비게이션 로직
    }
  }
});
```

---

## DomainRuntime 인터페이스

```typescript
interface DomainRuntime<TData, TState> {
  // Snapshot 접근
  getSnapshot(): DomainSnapshot<TData, TState>;
  get<T = unknown>(path: SemanticPath): T;
  getMany(paths: SemanticPath[]): Record<SemanticPath, unknown>;

  // 값 변경
  set(path: SemanticPath, value: unknown): Result<void, ValidationError>;
  setMany(updates: Record<SemanticPath, unknown>): Result<void, ValidationError>;
  execute(actionId: string, input?: unknown): Promise<Result<void, EffectError>>;

  // Policy & Metadata
  getPreconditions(actionId: string): PreconditionStatus[];
  getFieldPolicy(path: SemanticPath): ResolvedFieldPolicy;
  getSemantic(path: SemanticPath): SemanticMeta | undefined;

  // AI 지원
  explain(path: SemanticPath): ExplanationTree;
  getImpact(path: SemanticPath): SemanticPath[];

  // 구독
  subscribe(listener: SnapshotListener<TData, TState>): Unsubscribe;
  subscribePath(path: SemanticPath, listener: PathListener): Unsubscribe;
  subscribeEvents(channel: string, listener: EventListener): Unsubscribe;
}
```

---

## Snapshot 접근

### getSnapshot()

현재 스냅샷 전체를 반환한다:

```typescript
const snapshot = runtime.getSnapshot();
// {
//   data: { items: [...], couponCode: '' },
//   state: { isSubmitting: false },
//   derived: { subtotal: 20000, hasItems: true, ... },
//   validity: { ... },
//   timestamp: 1704067200000,
//   version: 5
// }
```

### get\<T\>(path)

특정 경로의 값을 반환한다:

```typescript
// data 네임스페이스
const items = runtime.get<Item[]>('data.items');
const coupon = runtime.get<string>('data.couponCode');

// state 네임스페이스
const isSubmitting = runtime.get<boolean>('state.isSubmitting');

// derived 네임스페이스
const subtotal = runtime.get<number>('derived.subtotal');
const canCheckout = runtime.get<boolean>('derived.canCheckout');

// 중첩 경로
const firstItemPrice = runtime.get<number>('data.items.0.price');
```

### getMany(paths)

여러 경로의 값을 한 번에 가져온다:

```typescript
const values = runtime.getMany([
  'data.items',
  'derived.subtotal',
  'derived.total',
  'state.isSubmitting'
]);
// {
//   'data.items': [...],
//   'derived.subtotal': 20000,
//   'derived.total': 23000,
//   'state.isSubmitting': false
// }
```

---

## 값 변경

### set(path, value)

단일 경로의 값을 설정한다. Zod 스키마 검증 후 성공/실패를 Result로 반환한다:

```typescript
import { isOk, isErr } from '@manifesto-ai/core';

const result = runtime.set('data.quantity', 5);

if (isOk(result)) {
  console.log('설정 성공');
  // derived 값들이 자동으로 재계산됨
  console.log(runtime.get('derived.subtotal'));
} else {
  console.log('검증 실패:', result.error.message);
  console.log('이슈:', result.error.issues);
}
```

### setMany(updates)

여러 경로의 값을 한 번에 설정한다. 첫 번째 검증 실패 시 중단된다:

```typescript
const result = runtime.setMany({
  'data.items': [{ id: '1', name: '상품A', price: 10000, quantity: 2 }],
  'data.couponCode': 'SAVE10'
});

if (isOk(result)) {
  // 모든 derived 값이 한 번에 재계산됨
}
```

### ValidationError

검증 실패 시 반환되는 에러:

```typescript
type ValidationError = {
  _tag: 'ValidationError';
  path: SemanticPath;          // 실패한 경로
  message: string;             // 에러 메시지
  issues: ValidationIssue[];   // 상세 이슈 목록
};
```

---

## 액션 실행

### execute(actionId, input?)

액션을 실행한다. 전제조건 확인 → 입력 검증 → Effect 실행 순서로 진행된다:

```typescript
// 입력 없는 액션
const result = await runtime.execute('clearCart');

// 입력이 있는 액션
const result = await runtime.execute('addItem', {
  id: 'prod-123',
  name: '새 상품',
  price: 15000,
  quantity: 1
});

if (isOk(result)) {
  console.log('액션 성공');
} else {
  const error = result.error;

  if (error.code === 'PRECONDITION_FAILED') {
    console.log('전제조건 실패');
  } else if (error.code === 'INVALID_INPUT') {
    console.log('입력 검증 실패');
  } else if (error.code === 'API_CALL_FAILED') {
    console.log('API 호출 실패');
  }

  console.log('원인:', error.cause.message);
}
```

### 전제조건 평가 과정

```typescript
// 액션 정의
const checkoutAction = defineAction({
  preconditions: [
    { path: 'derived.hasItems', expect: 'true', reason: '장바구니에 상품 필요' },
    { path: 'state.isSubmitting', expect: 'false', reason: '이미 제출 중' }
  ],
  // ...
});

// 런타임에서 전제조건 확인
runtime.getPreconditions('checkout');
// [
//   { path: 'derived.hasItems', expect: 'true', actual: true, satisfied: true, reason: '...' },
//   { path: 'state.isSubmitting', expect: 'false', actual: false, satisfied: true, reason: '...' }
// ]
```

### Effect 실행 흐름

```
execute('checkout')
       │
       ▼
┌─────────────────┐
│ 전제조건 확인    │
└────────┬────────┘
         │ 모두 충족?
    ┌────┴────┐
    No        Yes
    │          │
    ▼          ▼
┌────────┐ ┌─────────────────┐
│ 에러    │ │ 입력 검증        │
│ 반환    │ └────────┬────────┘
└────────┘          │ 유효?
              ┌─────┴─────┐
              No          Yes
              │            │
              ▼            ▼
         ┌────────┐  ┌─────────────────┐
         │ 에러    │  │ Effect 실행     │
         │ 반환    │  └────────┬────────┘
         └────────┘           │
                              ▼
                    ┌─────────────────┐
                    │ 변경 전파        │
                    └────────┬────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ 구독자 알림      │
                    └─────────────────┘
```

---

## DomainSnapshot

특정 시점의 도메인 상태를 나타내는 불변 객체이다.

### 구조

```typescript
type DomainSnapshot<TData, TState> = {
  /** 비즈니스 데이터 */
  data: TData;

  /** UI 상태 */
  state: TState;

  /** 계산된 값들 */
  derived: Record<SemanticPath, unknown>;

  /** 유효성 검증 결과 */
  validity: Record<SemanticPath, ValidationResult>;

  /** 스냅샷 생성 시간 (밀리초) */
  timestamp: number;

  /** 스냅샷 버전 (변경마다 증가) */
  version: number;
};
```

### 불변성

스냅샷은 불변이다. 값이 변경되면 새 스냅샷이 생성된다:

```typescript
const snapshot1 = runtime.getSnapshot();
runtime.set('data.quantity', 5);
const snapshot2 = runtime.getSnapshot();

console.log(snapshot1 === snapshot2);        // false
console.log(snapshot1.version);              // 0
console.log(snapshot2.version);              // 1
```

### createSnapshot(), cloneSnapshot()

스냅샷 생성 및 복제:

```typescript
import { createSnapshot, cloneSnapshot } from '@manifesto-ai/core';

// 빈 스냅샷 생성
const snapshot = createSnapshot(
  { items: [] },           // initialData
  { isSubmitting: false }  // initialState
);

// 스냅샷 복제 (불변성 유지)
const cloned = cloneSnapshot(snapshot);
```

### diffSnapshots()

두 스냅샷 사이의 변경된 경로를 계산한다:

```typescript
import { diffSnapshots } from '@manifesto-ai/core';

const changedPaths = diffSnapshots(oldSnapshot, newSnapshot);
// ['data.items', 'data.items.0.quantity', 'derived.subtotal', 'derived.total']
```

---

## 구독

### subscribe(listener)

전체 스냅샷 변경을 구독한다:

```typescript
const unsubscribe = runtime.subscribe((snapshot, changedPaths) => {
  console.log('변경된 경로:', changedPaths);
  console.log('새 스냅샷 버전:', snapshot.version);
});

// 구독 해제
unsubscribe();
```

### subscribePath(path, listener)

특정 경로의 변경을 구독한다:

```typescript
// 단일 경로 구독
const unsubscribe = runtime.subscribePath('derived.total', (value, path) => {
  console.log(`${path} 변경: ${value}`);
});

// 와일드카드 구독
const unsubscribeAll = runtime.subscribePath('data.items.*', (value, path) => {
  console.log(`${path} 변경: ${JSON.stringify(value)}`);
});
```

### subscribeEvents(channel, listener)

이벤트 채널을 구독한다:

```typescript
// UI 이벤트 구독
const unsubscribe = runtime.subscribeEvents('ui', (event) => {
  if (event.payload.type === 'toast') {
    showToast(event.payload.message, event.payload.severity);
  }
});

// 모든 이벤트 구독
runtime.subscribeEvents('*', (event) => {
  console.log(`[${event.channel}] ${event.payload.type}`);
});
```

---

## SubscriptionManager

내부적으로 구독을 관리하는 클래스이다:

```typescript
class SubscriptionManager<TData, TState> {
  subscribe(listener: SnapshotListener<TData, TState>): Unsubscribe;
  subscribePath(path: SemanticPath, listener: PathListener): Unsubscribe;
  subscribeEvents(channel: string, listener: EventListener): Unsubscribe;
  notifySnapshotChange(snapshot: DomainSnapshot<TData, TState>, changedPaths: SemanticPath[]): void;
  emitEvent(channel: string, payload: unknown): void;
  clear(): void;
  getSubscriptionCount(): { snapshot: number; path: number; event: number; };
}
```

### createBatchNotifier()

여러 변경을 배치로 묶어 알림을 최적화한다:

```typescript
import { createBatchNotifier, SubscriptionManager } from '@manifesto-ai/core';

const manager = new SubscriptionManager();
const batcher = createBatchNotifier(manager, 16); // 16ms 디바운스

// 여러 변경 큐잉
batcher.queue(snapshot1, ['data.items']);
batcher.queue(snapshot2, ['data.quantity']);
batcher.queue(snapshot3, ['derived.total']);

// 16ms 후 한 번에 알림 (또는 즉시 flush)
batcher.flush();
```

---

## AI 지원 인터페이스

### explain(path): ExplanationTree

값이 어떻게 계산되었는지 설명한다:

```typescript
const explanation = runtime.explain('derived.total');
// {
//   path: 'derived.total',
//   value: 27000,
//   semantic: { type: 'currency', description: '주문 총액' },
//   expression: ['-', ['get', 'derived.subtotal'], ['get', 'derived.discount']],
//   dependencies: [
//     {
//       path: 'derived.subtotal',
//       value: 30000,
//       dependencies: [
//         { path: 'data.items', value: [...], dependencies: [] }
//       ]
//     },
//     {
//       path: 'derived.discount',
//       value: 3000,
//       dependencies: [
//         { path: 'data.couponCode', value: 'SAVE10', dependencies: [] }
//       ]
//     }
//   ],
//   explanation: 'derived.total = 27000\n의존성:\n  - derived.subtotal = 30000\n  - derived.discount = 3000'
// }
```

### getImpact(path): SemanticPath[]

경로 변경 시 영향받는 모든 경로를 반환한다:

```typescript
const impact = runtime.getImpact('data.items');
// ['derived.subtotal', 'derived.itemCount', 'derived.hasItems', 'derived.total', 'derived.canCheckout']
```

### getFieldPolicy(path): ResolvedFieldPolicy

현재 상태에서 필드 정책을 평가한다:

```typescript
const policy = runtime.getFieldPolicy('data.couponCode');
// {
//   relevant: true,           // 현재 표시해야 함
//   relevantReason: undefined,
//   editable: true,           // 현재 수정 가능
//   editableReason: undefined,
//   required: false,          // 현재 필수 아님
//   requiredReason: undefined
// }

// 제출 중일 때
runtime.set('state.isSubmitting', true);
const policy2 = runtime.getFieldPolicy('data.couponCode');
// {
//   relevant: true,
//   editable: false,                              // 수정 불가
//   editableReason: '제출 중에는 수정할 수 없다',
//   required: false
// }
```

### getSemantic(path): SemanticMeta | undefined

경로의 Semantic 메타데이터를 반환한다:

```typescript
const semantic = runtime.getSemantic('data.items');
// { type: 'list', description: '주문 상품 목록', readable: true, writable: true }

const actionSemantic = runtime.getSemantic('derived.subtotal');
// { type: 'currency', description: '주문 소계', readable: true, writable: false }
```

---

## 실전 예시: React 통합

```typescript
import { useEffect, useState, useCallback } from 'react';
import { createRuntime, isOk } from '@manifesto-ai/core';

function useRuntime(domain) {
  const [runtime] = useState(() => createRuntime({
    domain,
    effectHandler: {
      apiCall: async (request) => {
        const res = await fetch(request.endpoint, {
          method: request.method,
          body: request.body ? JSON.stringify(request.body) : undefined
        });
        return res.json();
      }
    }
  }));

  return runtime;
}

function useValue<T>(runtime, path: string): T {
  const [value, setValue] = useState(() => runtime.get<T>(path));

  useEffect(() => {
    return runtime.subscribePath(path, (newValue) => {
      setValue(newValue as T);
    });
  }, [runtime, path]);

  return value;
}

function OrderSummary() {
  const runtime = useRuntime(orderDomain);

  const items = useValue<Item[]>(runtime, 'data.items');
  const total = useValue<number>(runtime, 'derived.total');
  const canCheckout = useValue<boolean>(runtime, 'derived.canCheckout');
  const isSubmitting = useValue<boolean>(runtime, 'state.isSubmitting');

  const handleCheckout = useCallback(async () => {
    const result = await runtime.execute('checkout');
    if (!isOk(result)) {
      alert('결제 실패: ' + result.error.cause.message);
    }
  }, [runtime]);

  return (
    <div>
      <h2>주문 요약</h2>
      <ul>
        {items.map(item => (
          <li key={item.id}>{item.name} x {item.quantity}</li>
        ))}
      </ul>
      <p>총액: {total.toLocaleString()}원</p>
      <button
        onClick={handleCheckout}
        disabled={!canCheckout || isSubmitting}
      >
        {isSubmitting ? '처리 중...' : '결제하기'}
      </button>
    </div>
  );
}
```

---

## 다음 단계

- [DAG와 변경 전파](06-dag-propagation.md) - 의존성 추적 원리
- [Policy 평가](08-policy.md) - 전제조건과 필드 정책
