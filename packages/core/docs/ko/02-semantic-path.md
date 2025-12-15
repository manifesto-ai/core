# SemanticPath

```typescript
import { createRuntime } from '@manifesto-ai/core';

const runtime = createRuntime({ domain: orderDomain });

// 모든 값은 SemanticPath로 주소를 갖는다
runtime.get('data.items');           // 사용자 입력 데이터
runtime.get('state.isSubmitting');   // UI 상태
runtime.get('derived.subtotal');     // 계산된 값
runtime.get('async.shippingRates');  // 비동기 데이터

// AI가 특정 값을 정확히 참조할 수 있다
const total = runtime.get('derived.total');
const items = runtime.get('data.items');
```

## 핵심 개념

### "모든 값은 주소를 갖는다"

Manifesto에서 도메인의 모든 값은 고유한 주소인 **SemanticPath**를 통해 접근된다. 이는 단순한 기술적 선택이 아니라 핵심 설계 원칙이다.

```typescript
// 전통적 접근: 값이 어디서 오는지 불분명
const total = calculateTotal(cart, discount, shipping);

// Manifesto 접근: 모든 값의 출처가 명확
runtime.get('derived.total');           // 총액
runtime.get('derived.subtotal');        // 소계
runtime.get('derived.discount');        // 할인액
runtime.get('derived.shippingFee');     // 배송비
```

### AI가 값을 참조할 수 있다

AI Agent가 "장바구니 총액이 얼마인가요?"라는 질문에 정확히 답하려면, 해당 값의 위치를 알아야 한다:

```typescript
// AI가 이해할 수 있는 대화
// User: "총액이 얼마야?"
// AI: "derived.total을 확인하겠습니다."
const total = runtime.get('derived.total');

// AI가 값을 변경할 수 있다
// User: "수량을 3개로 바꿔줘"
// AI: "data.items.0.quantity를 3으로 설정하겠습니다."
runtime.set('data.items.0.quantity', 3);
```

---

## 네임스페이스 체계

SemanticPath는 네임스페이스 접두사로 값의 성격을 구분한다:

| Namespace | 용도 | 쓰기 가능 | 반응형 |
|-----------|------|-----------|--------|
| `data.*` | 사용자 입력/비즈니스 데이터 | Yes | Yes |
| `state.*` | UI/시스템 상태 | Yes | Yes |
| `derived.*` | 계산된 값 | No (자동) | Yes |
| `async.*` | 비동기 외부 데이터 | No (자동) | Yes |

### data.* (사용자 입력 데이터)

영속적인 비즈니스 데이터를 담는다. 사용자가 직접 입력하거나 외부에서 주입된 값이다.

```typescript
// 주문의 핵심 데이터
'data.items'           // 주문 상품 목록
'data.couponCode'      // 쿠폰 코드
'data.shippingAddress' // 배송 주소
'data.paymentMethod'   // 결제 수단

// 읽기/쓰기 모두 가능
runtime.get('data.items');
runtime.set('data.items', [...]);
```

### state.* (UI/시스템 상태)

일시적인 UI 상태를 담는다. 새로고침하면 초기화되는 값이다.

```typescript
// UI 상태
'state.isSubmitting'    // 제출 중 여부
'state.selectedItemId'  // 선택된 상품 ID
'state.activeTab'       // 활성 탭
'state.error'           // 에러 메시지

// 읽기/쓰기 모두 가능
runtime.get('state.isSubmitting');
runtime.set('state.isSubmitting', true);
```

### derived.* (계산된 값)

다른 경로의 값으로부터 계산되는 읽기 전용 값이다. Expression으로 정의된다.

```typescript
// 계산 값
'derived.subtotal'      // 소계 = sum(items.price * items.quantity)
'derived.discount'      // 할인액 = 쿠폰 적용 시 계산
'derived.total'         // 총액 = subtotal - discount + shipping
'derived.itemCount'     // 상품 수 = items.length
'derived.hasItems'      // 상품 존재 여부 = itemCount > 0
'derived.canCheckout'   // 결제 가능 여부 = hasItems && !isSubmitting

// 읽기만 가능 (자동 계산)
runtime.get('derived.total');  // 값 읽기
// runtime.set('derived.total', 100);  // 에러! 쓰기 불가
```

### async.* (비동기 데이터)

외부 API로부터 비동기적으로 가져오는 데이터이다.

```typescript
// 비동기 데이터
'async.shippingRates'   // 배송 옵션 목록
'async.stockStatus'     // 재고 상태
'async.recommendations' // 추천 상품

// 읽기만 가능 (자동 갱신)
runtime.get('async.shippingRates');
// runtime.set('async.shippingRates', [...]);  // 에러! 쓰기 불가
```

---

## 경로 표기법

### 점 표기법

가장 기본적인 경로 표기법이다:

```typescript
'data.user.name'           // data > user > name
'data.items.0.price'       // data > items > [0] > price
'derived.user.fullName'    // derived > user > fullName
```

### 배열 인덱싱

배열 요소에 접근할 때 숫자 인덱스를 사용한다:

```typescript
'data.items.0'            // 첫 번째 항목
'data.items.0.name'       // 첫 번째 항목의 이름
'data.items.0.quantity'   // 첫 번째 항목의 수량

// 마지막 항목 접근은 표현식으로
['at', ['get', 'data.items'], -1]
```

### 대괄호 표기법

특수 문자가 포함된 키에 사용한다:

```typescript
'data.options["my-key"]'   // 하이픈 포함 키
'data.settings["ui.theme"]' // 점 포함 키
```

### 와일드카드 (Agent용)

구독 시 와일드카드로 여러 경로를 매칭할 수 있다:

```typescript
// data.items 하위의 모든 변경 구독
runtime.subscribePath('data.items.*', (value, path) => {
  console.log(`${path} 변경됨`);
});

// 'data.items.0' 변경 → 콜백 호출
// 'data.items.1.quantity' 변경 → 콜백 호출
// 'data.couponCode' 변경 → 콜백 호출 안 됨
```

---

## SemanticMeta

각 경로에는 AI가 이해할 수 있는 메타데이터가 연결된다:

```typescript
type SemanticMeta = {
  /** 의미 유형 (예: 'input', 'currency', 'boolean') */
  type: string;

  /** 자연어 설명 */
  description: string;

  /** 중요도 */
  importance?: 'critical' | 'high' | 'medium' | 'low';

  /** AI가 값을 읽을 수 있는지 */
  readable?: boolean;

  /** AI가 값을 변경할 수 있는지 */
  writable?: boolean;

  /** 값 예시 */
  examples?: unknown[];

  /** 추가 힌트 */
  hints?: Record<string, unknown>;
};
```

### 사용 예시

```typescript
const itemsSource = defineSource({
  schema: z.array(itemSchema),
  semantic: {
    type: 'list',
    description: '주문할 상품 목록. 각 항목은 ID, 이름, 가격, 수량을 포함한다.',
    importance: 'critical',
    readable: true,
    writable: true,
    examples: [
      { id: '1', name: '노트북', price: 1500000, quantity: 1 }
    ],
    hints: {
      maxItems: 99,
      minQuantity: 1
    }
  }
});

const totalDerived = defineDerived({
  deps: ['derived.subtotal', 'derived.discount', 'derived.shippingFee'],
  expr: ['+', ['-', ['get', 'derived.subtotal'], ['get', 'derived.discount']], ['get', 'derived.shippingFee']],
  semantic: {
    type: 'currency',
    description: '주문 총액. 소계에서 할인을 빼고 배송비를 더한 값이다.',
    importance: 'critical',
    readable: true,
    writable: false  // derived는 항상 false
  }
});
```

### 런타임에서 메타데이터 조회

```typescript
const semantic = runtime.getSemantic('data.items');
// {
//   type: 'list',
//   description: '주문할 상품 목록...',
//   importance: 'critical',
//   readable: true,
//   writable: true
// }
```

---

## AI 관점에서의 SemanticPath

### 컨텍스트 생성

AI Agent에게 현재 상태를 설명할 때 SemanticPath 기반 컨텍스트를 생성한다:

```typescript
// projection-agent 패키지 사용
import { projectAgentContext } from '@manifesto-ai/projection-agent';

const context = projectAgentContext(runtime, domain);
// {
//   summary: '주문 진행 중. 총 3개 상품, 45,000원',
//   paths: {
//     'data.items': {
//       value: [...],
//       semantic: { type: 'list', description: '...' },
//       editable: true,
//       formatted: '상품 3개'
//     },
//     'derived.total': {
//       value: 45000,
//       semantic: { type: 'currency', description: '...' },
//       editable: false,
//       formatted: '45,000원'
//     }
//   },
//   availableActions: ['addItem', 'removeItem', 'checkout'],
//   suggestions: [{ action: 'checkout', confidence: 0.8 }]
// }
```

### 액션 가능성 분석

AI가 "결제할 수 있나요?"를 판단하려면 전제조건 경로들을 확인해야 한다:

```typescript
// 액션의 전제조건들
const checkoutAction = defineAction({
  preconditions: [
    { path: 'derived.hasItems', expect: 'true', reason: '장바구니에 상품이 있어야 한다' },
    { path: 'derived.isNotSubmitting', expect: 'true', reason: '이미 제출 중이 아니어야 한다' },
    { path: 'derived.hasShippingAddress', expect: 'true', reason: '배송지가 입력되어야 한다' }
  ],
  // ...
});

// AI가 전제조건 상태 확인
const preconditions = runtime.getPreconditions('checkout');
// [
//   { path: 'derived.hasItems', actual: true, satisfied: true },
//   { path: 'derived.isNotSubmitting', actual: true, satisfied: true },
//   { path: 'derived.hasShippingAddress', actual: false, satisfied: false, reason: '배송지가 입력되어야 한다' }
// ]

// AI 응답: "배송지를 입력하시면 결제할 수 있습니다."
```

### 영향 분석

AI가 "수량을 바꾸면 어떻게 되나요?"를 이해하려면 영향 범위를 알아야 한다:

```typescript
// data.items.0.quantity 변경 시 영향받는 경로들
const impact = runtime.getImpact('data.items.0.quantity');
// [
//   'derived.subtotal',
//   'derived.discount',
//   'derived.total',
//   'derived.shippingFee',
//   'derived.canCheckout'
// ]

// AI 응답: "수량을 변경하면 소계, 할인액, 총액, 배송비가 재계산됩니다."
```

### 설명 트리

AI가 "왜 총액이 이 금액인가요?"를 설명할 때:

```typescript
const explanation = runtime.explain('derived.total');
// {
//   path: 'derived.total',
//   value: 45000,
//   expression: ['+', ['-', ['get', 'derived.subtotal'], ['get', 'derived.discount']], ['get', 'derived.shippingFee']],
//   dependencies: [
//     { path: 'derived.subtotal', value: 50000, ... },
//     { path: 'derived.discount', value: 5000, ... },
//     { path: 'derived.shippingFee', value: 0, ... }
//   ],
//   explanation: '총액 45,000원 = 소계 50,000원 - 할인 5,000원 + 배송비 0원'
// }
```

---

## 경로 유효성 검사

### 존재 여부 확인

```typescript
const semantic = runtime.getSemantic('data.invalidPath');
// undefined (존재하지 않는 경로)

const semantic2 = runtime.getSemantic('data.items');
// { type: 'list', ... } (존재하는 경로)
```

### 네임스페이스 검사

```typescript
function isWritablePath(path: SemanticPath): boolean {
  return path.startsWith('data.') || path.startsWith('state.');
}

function isDerivedPath(path: SemanticPath): boolean {
  return path.startsWith('derived.');
}
```

---

## 다음 단계

- [도메인 정의](03-domain-definition.md) - 경로 정의 방법
- [Expression DSL](04-expression-dsl.md) - 경로 참조 표현식
- [DAG와 변경 전파](06-dag-propagation.md) - 경로 간 의존성
