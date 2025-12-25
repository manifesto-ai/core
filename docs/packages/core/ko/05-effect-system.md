# Effect 시스템

```typescript
import {
  sequence,
  setState,
  apiCall,
  setValue,
  emitEvent,
  catchEffect,
  runEffect,
  isOk,
  isErr
} from '@manifesto-ai/core';

// 주문 제출 Effect 정의
const submitOrderEffect = sequence([
  setState('state.isSubmitting', true, '제출 시작'),
  apiCall({
    method: 'POST',
    endpoint: '/api/orders',
    body: {
      items: ['get', 'data.items'],
      total: ['get', 'derived.total']
    },
    description: '주문 생성'
  }),
  setValue('data.items', [], '장바구니 비우기'),
  setState('state.isSubmitting', false, '제출 완료'),
  emitEvent('ui', { type: 'toast', message: '주문이 완료되었습니다', severity: 'success' }, '성공 알림')
]);

// Effect 실행
const result = await runEffect(submitOrderEffect, {
  handler: effectHandler,
  context: { get: (path) => runtime.get(path) }
});

if (isOk(result)) {
  console.log('주문 성공');
} else {
  console.log('주문 실패:', result.error.cause.message);
}
```

## 핵심 철학

### "Effect는 기술(description)이지 실행이 아니다"

Effect는 "무엇을 할 것인지"를 데이터로 표현한다. 실제 실행은 `runEffect()`를 호출할 때 일어난다:

```typescript
// 이것은 API를 호출하지 않는다 - 단지 "호출하겠다"는 설명
const effect = apiCall({
  method: 'POST',
  endpoint: '/api/orders',
  description: '주문 생성'
});

// 이제야 실제로 API를 호출한다
await runEffect(effect, config);
```

### 왜 이것이 중요한가

**1. 테스트 가능**
```typescript
// Effect 구조만 검증 (실제 API 호출 없음)
expect(submitAction.effect._tag).toBe('Sequence');
expect(submitAction.effect.effects[0]._tag).toBe('SetState');
```

**2. 조합 가능**
```typescript
const withLogging = sequence([
  emitEvent('analytics', { type: 'action_start' }, '시작 로깅'),
  originalEffect,
  emitEvent('analytics', { type: 'action_end' }, '종료 로깅')
]);
```

**3. AI가 이해 가능**
```typescript
// AI가 Effect를 분석하여 "이 액션은 무엇을 하는가" 파악 가능
{
  _tag: 'Sequence',
  effects: [
    { _tag: 'SetState', path: 'state.isSubmitting', description: '제출 시작' },
    { _tag: 'ApiCall', endpoint: '/api/orders', description: '주문 생성' },
    { _tag: 'SetState', path: 'state.isSubmitting', description: '제출 완료' }
  ]
}
```

---

## Result<T, E> 패턴

### 왜 예외 대신 Result인가

예외(Exception)는 코드 흐름을 예측하기 어렵게 만든다:

```typescript
// 예외 방식 - 어디서 에러가 발생할지 불분명
try {
  await step1();
  await step2();  // 여기서 에러?
  await step3();
} catch (e) {
  // 어떤 단계에서 실패했는지 모름
}

// Result 방식 - 명시적 에러 처리
const result1 = await step1();
if (!result1.ok) return result1;

const result2 = await step2();
if (!result2.ok) return result2;

const result3 = await step3();
```

### ok(), err() 생성자

```typescript
import { ok, err } from '@manifesto-ai/core';

// 성공 Result 생성
const success = ok(42);
// { ok: true, value: 42 }

const successData = ok({ orderId: 'ORD-123', status: 'confirmed' });
// { ok: true, value: { orderId: 'ORD-123', status: 'confirmed' } }

// 실패 Result 생성
const failure = err({ code: 'NOT_FOUND', message: '주문을 찾을 수 없습니다' });
// { ok: false, error: { code: 'NOT_FOUND', message: '...' } }
```

### 타입 가드: isOk(), isErr()

```typescript
import { isOk, isErr } from '@manifesto-ai/core';

const result = await runEffect(effect, config);

if (isOk(result)) {
  // TypeScript가 result.value의 타입을 알고 있음
  console.log('성공:', result.value);
}

if (isErr(result)) {
  // TypeScript가 result.error의 타입을 알고 있음
  console.log('실패:', result.error.cause.message);
}
```

### 값 추출: unwrap(), unwrapOr()

```typescript
import { unwrap, unwrapOr, unwrapErr } from '@manifesto-ai/core';

// unwrap: 성공이면 값 반환, 실패면 예외
const value = unwrap(result);  // 실패 시 throw

// unwrapOr: 성공이면 값 반환, 실패면 기본값
const valueOrDefault = unwrapOr(result, 0);

// unwrapErr: 에러 추출 (성공이면 undefined)
const error = unwrapErr(result);
```

### 합성: map(), flatMap(), all()

```typescript
import { map, flatMap, all } from '@manifesto-ai/core';

// map: 성공 값 변환
const doubled = map(result, (x) => x * 2);
// ok(21) → ok(42)
// err(...) → err(...)

// flatMap: 연쇄 연산 (Result를 반환하는 함수)
const chained = flatMap(result, (value) =>
  value > 0 ? ok(value) : err({ code: 'INVALID', message: '양수여야 합니다' })
);

// all: 여러 Result를 하나로 합침 (모두 성공해야 성공)
const combined = all([result1, result2, result3]);
// 모두 ok → ok([value1, value2, value3])
// 하나라도 err → 첫 번째 err 반환
```

---

## Effect 타입 계층

```
Effect
├── 상태 변경
│   ├── SetValueEffect    - data.* 경로 값 설정
│   └── SetStateEffect    - state.* 경로 값 설정
├── 외부 상호작용
│   ├── ApiCallEffect     - HTTP API 호출
│   ├── NavigateEffect    - 페이지 이동
│   └── DelayEffect       - 대기
├── 합성
│   ├── SequenceEffect    - 순차 실행
│   └── ParallelEffect    - 병렬 실행
├── 제어 흐름
│   ├── ConditionalEffect - 조건부 실행
│   └── CatchEffect       - 에러 처리
└── 이벤트
    └── EmitEventEffect   - 이벤트 발행
```

---

## 상태 변경 Effect

### SetValueEffect

`data.*` 네임스페이스의 값을 설정한다:

```typescript
type SetValueEffect = {
  _tag: 'SetValue';
  path: SemanticPath;      // 대상 경로
  value: Expression;       // 설정할 값 (Expression으로 계산 가능)
  description: string;     // 설명
};
```

```typescript
import { setValue } from '@manifesto-ai/core';

// 단순 값 설정
setValue('data.quantity', 5, '수량 설정');

// Expression으로 계산된 값
setValue('data.total', ['*', ['get', 'data.price'], ['get', 'data.quantity']], '총액 계산');

// 배열 조작
setValue('data.items',
  ['concat', ['get', 'data.items'], [['get', 'input']]],
  '상품 추가'
);
```

### SetStateEffect

`state.*` 네임스페이스의 값을 설정한다:

```typescript
type SetStateEffect = {
  _tag: 'SetState';
  path: SemanticPath;
  value: Expression;
  description: string;
};
```

```typescript
import { setState } from '@manifesto-ai/core';

// 로딩 상태
setState('state.isLoading', true, '로딩 시작');

// 선택 상태
setState('state.selectedId', ['get', 'input.id'], '선택 변경');

// 에러 상태
setState('state.error', null, '에러 초기화');
```

---

## 외부 상호작용 Effect

### ApiCallEffect

HTTP API를 호출한다:

```typescript
type ApiCallEffect = {
  _tag: 'ApiCall';
  endpoint: string | Expression;            // 엔드포인트 (동적 가능)
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: Record<string, Expression>;        // 요청 본문
  headers?: Record<string, string>;         // 요청 헤더
  query?: Record<string, Expression>;       // 쿼리 파라미터
  timeout?: number;                          // 타임아웃 (ms)
  description: string;
};
```

```typescript
import { apiCall } from '@manifesto-ai/core';

// GET 요청
apiCall({
  method: 'GET',
  endpoint: '/api/products',
  query: {
    category: ['get', 'data.category'],
    limit: 20
  },
  description: '상품 목록 조회'
});

// POST 요청 (동적 엔드포인트)
apiCall({
  method: 'POST',
  endpoint: ['concat', '/api/orders/', ['get', 'data.orderId'], '/items'],
  body: {
    productId: ['get', 'input.productId'],
    quantity: ['get', 'input.quantity']
  },
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 5000,
  description: '주문에 상품 추가'
});

// DELETE 요청
apiCall({
  method: 'DELETE',
  endpoint: ['concat', '/api/items/', ['get', 'state.selectedId']],
  description: '선택된 상품 삭제'
});
```

### NavigateEffect

페이지를 이동한다:

```typescript
type NavigateEffect = {
  _tag: 'Navigate';
  to: string | Expression;        // 이동할 경로
  mode?: 'push' | 'replace';      // 히스토리 모드
  description: string;
};
```

```typescript
import { navigate } from '@manifesto-ai/core';

// 정적 경로
navigate('/checkout', { description: '결제 페이지로 이동' });

// 동적 경로
navigate(
  ['concat', '/orders/', ['get', 'data.orderId']],
  { description: '주문 상세 페이지로 이동' }
);

// replace 모드 (뒤로가기 방지)
navigate('/login', { mode: 'replace', description: '로그인 페이지로 교체' });
```

### DelayEffect

지정된 시간만큼 대기한다:

```typescript
type DelayEffect = {
  _tag: 'Delay';
  ms: number;           // 대기 시간 (ms)
  description: string;
};
```

```typescript
import { delay } from '@manifesto-ai/core';

delay(1000, '1초 대기');
delay(300, '디바운스');
```

---

## 합성 Effect

### SequenceEffect

Effect들을 순차적으로 실행한다. 하나라도 실패하면 중단된다:

```typescript
type SequenceEffect = {
  _tag: 'Sequence';
  effects: Effect[];
  description: string;
};
```

```typescript
import { sequence, setState, apiCall, setValue } from '@manifesto-ai/core';

const checkoutEffect = sequence([
  setState('state.isSubmitting', true, '제출 시작'),
  apiCall({ method: 'POST', endpoint: '/api/orders', description: '주문 생성' }),
  setValue('data.items', [], '장바구니 비우기'),
  setState('state.isSubmitting', false, '제출 완료')
], '결제 프로세스');
```

### ParallelEffect

Effect들을 병렬로 실행한다:

```typescript
type ParallelEffect = {
  _tag: 'Parallel';
  effects: Effect[];
  waitAll?: boolean;    // 모두 완료 대기 (기본: true)
  description: string;
};
```

```typescript
import { parallel, apiCall } from '@manifesto-ai/core';

// 모든 요청 완료 대기
const fetchAllData = parallel([
  apiCall({ method: 'GET', endpoint: '/api/user', description: '사용자 정보' }),
  apiCall({ method: 'GET', endpoint: '/api/cart', description: '장바구니' }),
  apiCall({ method: 'GET', endpoint: '/api/recommendations', description: '추천 상품' })
], { description: '초기 데이터 로드' });

// 첫 번째 완료만 대기
const raceRequest = parallel([
  apiCall({ method: 'GET', endpoint: '/api/primary', description: '주 서버' }),
  apiCall({ method: 'GET', endpoint: '/api/backup', description: '백업 서버' })
], { waitAll: false, description: '가장 빠른 응답 사용' });
```

---

## 제어 흐름 Effect

### ConditionalEffect

조건에 따라 다른 Effect를 실행한다:

```typescript
type ConditionalEffect = {
  _tag: 'Conditional';
  condition: Expression;
  then: Effect;
  else?: Effect;
  description: string;
};
```

```typescript
import { conditional, apiCall, navigate } from '@manifesto-ai/core';

const checkoutFlow = conditional({
  condition: ['>', ['get', 'derived.total'], 100000],
  then: apiCall({
    method: 'POST',
    endpoint: '/api/premium-checkout',
    description: '프리미엄 결제'
  }),
  else: apiCall({
    method: 'POST',
    endpoint: '/api/standard-checkout',
    description: '일반 결제'
  }),
  description: '결제 방식 분기'
});
```

### CatchEffect

에러를 처리한다:

```typescript
type CatchEffect = {
  _tag: 'Catch';
  try: Effect;
  catch: Effect;
  finally?: Effect;
  description: string;
};
```

```typescript
import { catchEffect, apiCall, setState, emitEvent } from '@manifesto-ai/core';

const safeApiCall = catchEffect({
  try: apiCall({
    method: 'POST',
    endpoint: '/api/orders',
    description: '주문 생성'
  }),
  catch: sequence([
    setState('state.error', '주문 생성에 실패했습니다', '에러 메시지 설정'),
    emitEvent('ui', {
      type: 'toast',
      message: '주문 생성에 실패했습니다',
      severity: 'error'
    }, '에러 알림')
  ]),
  finally: setState('state.isSubmitting', false, '로딩 종료'),
  description: '안전한 주문 생성'
});
```

---

## 이벤트 Effect

### EmitEventEffect

일회성 이벤트를 발행한다. Snapshot에 저장되지 않고 구독자에게만 전달된다:

```typescript
type EmitEventEffect = {
  _tag: 'EmitEvent';
  channel: 'ui' | 'domain' | 'analytics';
  payload: {
    type: string;
    message?: string;
    data?: unknown;
    severity?: 'success' | 'info' | 'warning' | 'error';
    duration?: number;
  };
  description: string;
};
```

```typescript
import { emitEvent } from '@manifesto-ai/core';

// UI 토스트
emitEvent('ui', {
  type: 'toast',
  message: '저장되었습니다',
  severity: 'success',
  duration: 3000
}, '저장 성공 알림');

// 도메인 이벤트
emitEvent('domain', {
  type: 'orderCreated',
  data: { orderId: ['get', 'data.orderId'] }
}, '주문 생성 이벤트');

// 분석 이벤트
emitEvent('analytics', {
  type: 'checkout_completed',
  data: {
    total: ['get', 'derived.total'],
    itemCount: ['get', 'derived.itemCount']
  }
}, '결제 완료 분석');
```

---

## Effect Builder 함수

| 함수 | 설명 | 시그니처 |
|------|------|---------|
| `setValue` | data 값 설정 | `(path, value, description) => SetValueEffect` |
| `setState` | state 값 설정 | `(path, value, description) => SetStateEffect` |
| `apiCall` | API 호출 | `(options) => ApiCallEffect` |
| `navigate` | 페이지 이동 | `(to, options?) => NavigateEffect` |
| `delay` | 대기 | `(ms, description?) => DelayEffect` |
| `sequence` | 순차 실행 | `(effects, description?) => SequenceEffect` |
| `parallel` | 병렬 실행 | `(effects, options?) => ParallelEffect` |
| `conditional` | 조건부 실행 | `(options) => ConditionalEffect` |
| `catchEffect` | 에러 처리 | `(options) => CatchEffect` |
| `emitEvent` | 이벤트 발행 | `(channel, payload, description?) => EmitEventEffect` |

---

## runEffect()

Effect를 실제로 실행한다:

```typescript
async function runEffect(
  effect: Effect,
  config: EffectRunnerConfig
): Promise<EffectResult>
```

### EffectHandler 인터페이스

Effect 실행을 위한 핸들러:

```typescript
type EffectHandler = {
  setValue: (path: SemanticPath, value: unknown) => void;
  setState: (path: SemanticPath, value: unknown) => void;
  apiCall: (request: {
    endpoint: string;
    method: string;
    body?: unknown;
    headers?: Record<string, string>;
    query?: Record<string, unknown>;
    timeout?: number;
  }) => Promise<unknown>;
  navigate: (to: string, mode?: 'push' | 'replace') => void;
  emitEvent: (channel: string, payload: unknown) => void;
};
```

### EffectRunnerConfig

```typescript
type EffectRunnerConfig = {
  handler: EffectHandler;
  context: EvaluationContext;
};
```

### 사용 예시

```typescript
const result = await runEffect(effect, {
  handler: {
    setValue: (path, value) => runtime.set(path, value),
    setState: (path, value) => runtime.set(path, value),
    apiCall: async (request) => {
      const response = await fetch(request.endpoint, {
        method: request.method,
        headers: request.headers,
        body: request.body ? JSON.stringify(request.body) : undefined
      });
      if (!response.ok) throw new Error(response.statusText);
      return response.json();
    },
    navigate: (to, mode) => {
      if (mode === 'replace') window.history.replaceState({}, '', to);
      else window.history.pushState({}, '', to);
    },
    emitEvent: (channel, payload) => {
      eventBus.emit(channel, payload);
    }
  },
  context: {
    get: (path) => runtime.get(path)
  }
});
```

---

## 실전 패턴

### 트랜잭션 스타일

여러 상태 변경을 원자적으로 처리한다:

```typescript
const submitOrder = sequence([
  // 1. 로딩 시작
  setState('state.isSubmitting', true, '제출 시작'),

  // 2. API 호출
  apiCall({
    method: 'POST',
    endpoint: '/api/orders',
    body: {
      items: ['get', 'data.items'],
      shippingAddress: ['get', 'data.shippingAddress'],
      paymentMethod: ['get', 'data.paymentMethod']
    },
    description: '주문 생성'
  }),

  // 3. 성공 처리
  setValue('data.items', [], '장바구니 비우기'),
  emitEvent('ui', { type: 'toast', message: '주문이 완료되었습니다', severity: 'success' }, '성공 알림'),

  // 4. 로딩 종료
  setState('state.isSubmitting', false, '제출 완료')
]);
```

### 에러 복구

```typescript
const safeSubmit = catchEffect({
  try: sequence([
    setState('state.isSubmitting', true, '제출 시작'),
    apiCall({ method: 'POST', endpoint: '/api/orders', description: '주문 생성' }),
    setValue('data.items', [], '장바구니 비우기'),
    navigate('/order/success', { description: '성공 페이지로 이동' })
  ]),
  catch: sequence([
    setState('state.error', '주문에 실패했습니다. 다시 시도해주세요.', '에러 설정'),
    emitEvent('ui', {
      type: 'toast',
      message: '주문에 실패했습니다',
      severity: 'error'
    }, '에러 알림'),
    emitEvent('analytics', {
      type: 'order_failed',
      data: { reason: 'api_error' }
    }, '실패 분석')
  ]),
  finally: setState('state.isSubmitting', false, '로딩 종료'),
  description: '안전한 주문 제출'
});
```

### 낙관적 업데이트

```typescript
const optimisticDelete = sequence([
  // 1. UI에서 즉시 제거 (낙관적)
  setValue('data.items',
    ['filter', ['get', 'data.items'], ['!=', '$.id', ['get', 'input.itemId']]],
    '항목 제거 (낙관적)'
  ),

  // 2. 서버에 삭제 요청
  catchEffect({
    try: apiCall({
      method: 'DELETE',
      endpoint: ['concat', '/api/items/', ['get', 'input.itemId']],
      description: '항목 삭제'
    }),
    catch: sequence([
      // 실패 시 원상복구
      setValue('data.items',
        ['concat', ['get', 'data.items'], [['get', 'input.deletedItem']]],
        '항목 복구'
      ),
      emitEvent('ui', {
        type: 'toast',
        message: '삭제에 실패했습니다',
        severity: 'error'
      }, '실패 알림')
    ]),
    description: '삭제 롤백'
  })
]);
```

---

## 다음 단계

- [Runtime API](07-runtime.md) - Effect 실행 환경
- [DAG와 변경 전파](06-dag-propagation.md) - 상태 변경 전파
