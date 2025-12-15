# Policy 평가

```typescript
import { createRuntime } from '@manifesto-ai/core';

const runtime = createRuntime({ domain: orderDomain });

// 액션 실행 가능 여부 확인
const availability = runtime.checkPreconditions('checkout');
// {
//   available: false,
//   unsatisfiedConditions: [
//     { path: 'derived.hasShippingAddress', actualValue: false, satisfied: false }
//   ],
//   reasons: ['배송지가 입력되어야 합니다'],
//   explanation: 'Action "checkout" is NOT available...'
// }

// 필드 정책 확인
const policy = runtime.getFieldPolicy('data.shippingAddress');
// { relevant: true, editable: true, required: true }
```

## 핵심 개념

### "조건과 정책을 데이터로 선언"

Manifesto는 액션의 전제조건과 필드의 표시/편집/필수 상태를 **선언적으로** 정의한다. 이를 통해 AI가 "왜 이 버튼이 비활성화인가요?"를 정확히 설명할 수 있다.

```typescript
// 전제조건 선언
const checkoutAction = defineAction({
  preconditions: [
    condition('derived.hasItems', 'true', '장바구니에 상품이 있어야 합니다'),
    condition('derived.hasShippingAddress', 'true', '배송지가 입력되어야 합니다'),
    condition('state.isSubmitting', 'false', '이미 제출 중이 아니어야 합니다')
  ],
  effect: { type: 'ApiCall', ... },
  semantic: { verb: 'checkout', description: '주문 결제' }
});

// 필드 정책 선언
const shippingAddressSource = defineSource({
  schema: addressSchema,
  policy: fieldPolicy({
    relevantWhen: [condition('derived.hasItems', 'true')],
    editableWhen: [condition('state.isSubmitting', 'false')],
    requiredWhen: [condition('derived.hasItems', 'true')]
  }),
  semantic: { type: 'address', description: '배송 주소' }
});
```

---

## ConditionRef

조건 참조는 경로의 boolean 값을 검사한다.

### 타입 정의

```typescript
type ConditionRef = {
  /** 검사할 경로 */
  path: SemanticPath;

  /** 기대 값 ('true' 또는 'false', 기본값: 'true') */
  expect?: 'true' | 'false';

  /** 사람이 읽을 수 있는 이유 */
  reason?: string;
};
```

### condition 헬퍼

```typescript
import { condition } from '@manifesto-ai/core';

// 기본 사용
condition('derived.hasItems', 'true', '장바구니에 상품이 필요');
// { path: 'derived.hasItems', expect: 'true', reason: '장바구니에 상품이 필요' }

// expect 생략 시 'true'
condition('derived.isValid');
// { path: 'derived.isValid', expect: 'true' }

// 'false' 기대
condition('state.isSubmitting', 'false', '제출 중이 아니어야 함');
// { path: 'state.isSubmitting', expect: 'false', reason: '제출 중이 아니어야 함' }
```

---

## 전제조건 (Precondition)

### ActionDefinition의 preconditions

```typescript
const submitOrderAction = defineAction({
  preconditions: [
    // 상품이 있어야 함
    condition('derived.hasItems', 'true', '장바구니에 상품이 있어야 합니다'),

    // 유효한 배송지
    condition('derived.hasValidAddress', 'true', '유효한 배송지가 필요합니다'),

    // 결제 수단 선택됨
    condition('derived.hasPaymentMethod', 'true', '결제 수단을 선택해야 합니다'),

    // 약관 동의
    condition('data.termsAgreed', 'true', '이용약관에 동의해야 합니다'),

    // 제출 중 아님
    condition('state.isSubmitting', 'false', '이미 처리 중입니다')
  ],
  effect: apiCall('/api/orders', 'POST', ...),
  semantic: {
    verb: 'submitOrder',
    object: '주문',
    description: '주문을 최종 제출합니다'
  }
});
```

### 전제조건 평가

```typescript
import { evaluatePrecondition, evaluateAllPreconditions } from '@manifesto-ai/core';

// 단일 조건 평가
const result = evaluatePrecondition(
  condition('derived.hasItems', 'true', '장바구니에 상품이 필요'),
  { get: (path) => runtime.get(path) }
);
// {
//   condition: { path: 'derived.hasItems', expect: 'true', ... },
//   actualValue: true,
//   satisfied: true,
//   debug: { path: 'derived.hasItems', expectedBoolean: true, actualBoolean: true }
// }

// 모든 조건 평가
const results = evaluateAllPreconditions(
  action.preconditions,
  { get: runtime.get }
);
```

### PreconditionEvaluationResult 타입

```typescript
type PreconditionEvaluationResult = {
  /** 조건 참조 */
  condition: ConditionRef;

  /** 실제 평가된 값 */
  actualValue: unknown;

  /** 조건 충족 여부 */
  satisfied: boolean;

  /** 디버그 정보 */
  debug?: {
    path: SemanticPath;
    expectedBoolean: boolean;
    actualBoolean: boolean;
  };
};
```

---

## 액션 실행 가능성

### checkActionAvailability

```typescript
import { checkActionAvailability } from '@manifesto-ai/core';

const availability = checkActionAvailability(
  checkoutAction,
  { get: runtime.get }
);

if (availability.available) {
  // 실행 가능
  runtime.executeAction('checkout');
} else {
  // 실행 불가 - 이유 표시
  console.log('결제 불가:', availability.reasons);
  // ['배송지가 입력되어야 합니다']
}
```

### ActionAvailability 타입

```typescript
type ActionAvailability = {
  /** 실행 가능 여부 */
  available: boolean;

  /** 충족되지 않은 조건들 */
  unsatisfiedConditions: PreconditionEvaluationResult[];

  /** 사람이 읽을 수 있는 이유 */
  reasons: string[];

  /** AI용 상세 설명 */
  explanation: string;
};
```

### AI용 설명 생성

```typescript
// availability.explanation 예시:
`Action "checkout" is NOT available.

Unsatisfied preconditions:
  - derived.hasShippingAddress
    Expected: true
    Actual: false (raw: false)
    Reason: 배송지가 입력되어야 합니다

To enable this action:
  - Make derived.hasShippingAddress evaluate to true`
```

### Runtime에서의 사용

```typescript
const runtime = createRuntime({ domain: orderDomain });

// checkPreconditions는 내부적으로 checkActionAvailability 사용
const status = runtime.checkPreconditions('checkout');
// {
//   available: false,
//   unsatisfied: [
//     { path: 'derived.hasShippingAddress', actual: false, reason: '...' }
//   ]
// }

// 또는 모든 액션의 상태
const allActions = runtime.getAvailableActions();
// {
//   addItem: { available: true },
//   removeItem: { available: true },
//   checkout: { available: false, reasons: ['...'] }
// }
```

---

## 필드 정책 (Field Policy)

### FieldPolicy 타입

```typescript
type FieldPolicy = {
  /** 이 필드가 의미있는(표시할) 조건들 */
  relevantWhen?: ConditionRef[];

  /** 이 필드가 편집 가능한 조건들 */
  editableWhen?: ConditionRef[];

  /** 이 필드가 필수인 조건들 */
  requiredWhen?: ConditionRef[];
};
```

### fieldPolicy 헬퍼

```typescript
import { fieldPolicy, condition } from '@manifesto-ai/core';

const addressPolicy = fieldPolicy({
  // 상품이 있을 때만 표시
  relevantWhen: [
    condition('derived.hasItems', 'true')
  ],

  // 제출 중이 아닐 때만 편집 가능
  editableWhen: [
    condition('state.isSubmitting', 'false')
  ],

  // 상품이 있으면 필수
  requiredWhen: [
    condition('derived.hasItems', 'true')
  ]
});
```

### 조건부 정책 예시

```typescript
// 쿠폰 코드 필드
const couponPolicy = fieldPolicy({
  // 상품 소계가 10000원 이상일 때만 관련
  relevantWhen: [
    condition('derived.canUseCoupon', 'true')
  ],

  // 항상 편집 가능 (제출 중 제외)
  editableWhen: [
    condition('state.isSubmitting', 'false')
  ]

  // 필수 아님 (requiredWhen 생략)
});

// 사업자등록번호 필드
const businessNumberPolicy = fieldPolicy({
  // 사업자 유형일 때만 표시
  relevantWhen: [
    condition('data.customerType', 'true')  // 'business'를 true로 변환
  ],

  // 편집 가능 조건
  editableWhen: [
    condition('state.isSubmitting', 'false')
  ],

  // 사업자 유형이면 필수
  requiredWhen: [
    condition('data.customerType', 'true')
  ]
});
```

### 필드 정책 평가

```typescript
import { evaluateFieldPolicy } from '@manifesto-ai/core';

const evaluation = evaluateFieldPolicy(
  addressPolicy,
  { get: runtime.get }
);
// {
//   relevant: true,
//   relevantReason: undefined,
//   relevantConditions: [{ condition: {...}, actualValue: true, satisfied: true }],
//
//   editable: true,
//   editableReason: undefined,
//   editableConditions: [{ condition: {...}, actualValue: false, satisfied: true }],
//
//   required: true,
//   requiredReason: undefined,
//   requiredConditions: [{ condition: {...}, actualValue: true, satisfied: true }]
// }
```

### FieldPolicyEvaluation 타입

```typescript
type FieldPolicyEvaluation = {
  /** 이 필드가 현재 의미있는지 (표시할지) */
  relevant: boolean;
  relevantReason?: string;
  relevantConditions?: ConditionEvaluationDetail[];

  /** 이 필드가 현재 수정 가능한지 */
  editable: boolean;
  editableReason?: string;
  editableConditions?: ConditionEvaluationDetail[];

  /** 이 필드가 현재 필수인지 */
  required: boolean;
  requiredReason?: string;
  requiredConditions?: ConditionEvaluationDetail[];
};
```

---

## UI 상태 변환

### policyToUIState

필드 정책 평가 결과를 UI에서 바로 사용할 수 있는 형태로 변환한다.

```typescript
import { policyToUIState } from '@manifesto-ai/core';

const evaluation = evaluateFieldPolicy(policy, ctx);
const uiState = policyToUIState(evaluation);
// {
//   visible: true,      // relevant 값
//   enabled: true,      // relevant && editable
//   showRequired: true, // relevant && required
//   disabledReason: undefined,
//   hiddenReason: undefined
// }
```

### FieldUIState 타입

```typescript
type FieldUIState = {
  /** 보여야 하는지 */
  visible: boolean;

  /** 활성화 상태인지 */
  enabled: boolean;

  /** 필수 표시를 보여야 하는지 */
  showRequired: boolean;

  /** 비활성화 이유 (있으면) */
  disabledReason?: string;

  /** 숨김 이유 (있으면) */
  hiddenReason?: string;
};
```

### React에서의 활용

```typescript
// React Bridge에서
function FormField({ path }: { path: SemanticPath }) {
  const uiState = useFieldUIState(path);

  if (!uiState.visible) {
    return null;
  }

  return (
    <div>
      <label>
        {getLabel(path)}
        {uiState.showRequired && <span className="required">*</span>}
      </label>
      <input
        disabled={!uiState.enabled}
        title={uiState.disabledReason}
      />
    </div>
  );
}
```

---

## 배치 평가

### 다중 필드 정책 평가

```typescript
import { evaluateMultipleFieldPolicies } from '@manifesto-ai/core';

const policies = {
  'data.shippingAddress': addressPolicy,
  'data.couponCode': couponPolicy,
  'data.businessNumber': businessNumberPolicy
};

const results = evaluateMultipleFieldPolicies(policies, { get: runtime.get });
// {
//   'data.shippingAddress': { relevant: true, editable: true, required: true },
//   'data.couponCode': { relevant: true, editable: true, required: false },
//   'data.businessNumber': { relevant: false, editable: true, required: false }
// }
```

---

## 의존성 추출

### 전제조건 의존성

```typescript
import { extractPreconditionDependencies } from '@manifesto-ai/core';

const deps = extractPreconditionDependencies(checkoutAction.preconditions);
// [
//   'derived.hasItems',
//   'derived.hasValidAddress',
//   'derived.hasPaymentMethod',
//   'data.termsAgreed',
//   'state.isSubmitting'
// ]

// 이 경로들 중 하나라도 변경되면 전제조건을 재평가해야 함
```

### 필드 정책 의존성

```typescript
import { extractFieldPolicyDependencies } from '@manifesto-ai/core';

const deps = extractFieldPolicyDependencies(addressPolicy);
// ['derived.hasItems', 'state.isSubmitting']

// 구독에 활용
for (const dep of deps) {
  runtime.subscribe(dep, () => {
    // 필드 정책 재평가
    const newEvaluation = evaluateFieldPolicy(addressPolicy, { get: runtime.get });
  });
}
```

---

## 필요 변경 분석

### analyzePreconditionRequirements

충족되지 않은 전제조건을 해결하기 위한 변경사항을 분석한다.

```typescript
import { analyzePreconditionRequirements } from '@manifesto-ai/core';

const availability = checkActionAvailability(checkoutAction, { get: runtime.get });
const requirements = analyzePreconditionRequirements(availability.unsatisfiedConditions);
// [
//   {
//     path: 'derived.hasShippingAddress',
//     currentValue: false,
//     requiredValue: true,
//     reason: '배송지가 입력되어야 합니다'
//   }
// ]
```

### AI가 해결책 제안

```typescript
// AI 응답 생성
function suggestSolution(requirements: PreconditionRequirement[]): string {
  const suggestions: string[] = [];

  for (const req of requirements) {
    if (req.path.startsWith('derived.')) {
      // Derived 경로의 원인을 추적
      const sourceRequirements = traceToSource(req.path);
      suggestions.push(`${req.reason} (${sourceRequirements})`);
    } else {
      suggestions.push(`${req.path}를 설정하세요: ${req.reason}`);
    }
  }

  return suggestions.join('\n');
}
```

---

## AI 통합

### 필드 정책 설명 생성

```typescript
import { explainFieldPolicy } from '@manifesto-ai/core';

const explanation = explainFieldPolicy('data.shippingAddress', evaluation);
// Field: data.shippingAddress
//
// Relevant: Yes
// Editable: Yes
// Required: Yes
//   Because:
//   - derived.hasItems = true
```

### 전체 컨텍스트 생성

```typescript
function generatePolicyContext(runtime: DomainRuntime): PolicyContext {
  const actions: Record<string, ActionAvailability> = {};
  const fields: Record<SemanticPath, FieldPolicyEvaluation> = {};

  // 모든 액션의 전제조건 평가
  for (const [name, action] of Object.entries(domain.actions)) {
    actions[name] = checkActionAvailability(action, { get: runtime.get });
  }

  // 모든 필드의 정책 평가
  for (const [path, source] of Object.entries(domain.paths.sources)) {
    if (source.policy) {
      fields[path] = evaluateFieldPolicy(source.policy, { get: runtime.get });
    }
  }

  return { actions, fields };
}
```

---

## 실전 예시: 주문 폼

### 도메인 정의

```typescript
const orderDomain = defineDomain({
  name: 'order',
  // ...

  paths: {
    sources: {
      items: defineSource({
        schema: z.array(itemSchema),
        semantic: { type: 'list', description: '주문 상품 목록' }
      }),

      shippingAddress: defineSource({
        schema: addressSchema,
        policy: fieldPolicy({
          relevantWhen: [condition('derived.hasItems', 'true')],
          editableWhen: [condition('state.isSubmitting', 'false')],
          requiredWhen: [condition('derived.hasItems', 'true')]
        }),
        semantic: { type: 'address', description: '배송 주소' }
      }),

      couponCode: defineSource({
        schema: z.string().optional(),
        policy: fieldPolicy({
          relevantWhen: [condition('derived.subtotal', 'true')],
          editableWhen: [
            condition('state.isSubmitting', 'false'),
            condition('state.couponApplied', 'false')
          ]
        }),
        semantic: { type: 'string', description: '할인 쿠폰 코드' }
      })
    },

    derived: {
      hasItems: defineDerived({
        deps: ['data.items'],
        expr: ['>', ['length', ['get', 'data.items']], 0],
        semantic: { type: 'boolean', description: '상품 존재 여부' }
      }),

      hasShippingAddress: defineDerived({
        deps: ['data.shippingAddress'],
        expr: ['and',
          ['get', 'data.shippingAddress'],
          ['get', 'data.shippingAddress.zipCode']
        ],
        semantic: { type: 'boolean', description: '유효한 배송지 여부' }
      }),

      canCheckout: defineDerived({
        deps: ['derived.hasItems', 'derived.hasShippingAddress', 'state.isSubmitting'],
        expr: ['and',
          ['get', 'derived.hasItems'],
          ['get', 'derived.hasShippingAddress'],
          ['not', ['get', 'state.isSubmitting']]
        ],
        semantic: { type: 'boolean', description: '결제 가능 여부' }
      })
    }
  },

  actions: {
    checkout: defineAction({
      preconditions: [
        condition('derived.hasItems', 'true', '장바구니에 상품이 있어야 합니다'),
        condition('derived.hasShippingAddress', 'true', '배송지가 입력되어야 합니다'),
        condition('state.isSubmitting', 'false', '이미 처리 중입니다')
      ],
      effect: sequence([
        setState('state.isSubmitting', true),
        apiCall('/api/orders', 'POST'),
        setState('state.isSubmitting', false)
      ]),
      semantic: { verb: 'checkout', object: '주문', description: '주문 결제' }
    })
  }
});
```

### 사용 예시

```typescript
const runtime = createRuntime({ domain: orderDomain });

// 빈 장바구니 상태
runtime.checkPreconditions('checkout');
// { available: false, reasons: ['장바구니에 상품이 있어야 합니다'] }

runtime.getFieldPolicy('data.shippingAddress');
// { relevant: false, editable: true, required: false }

// 상품 추가 후
runtime.set('data.items', [{ id: '1', name: '노트북', price: 1500000, quantity: 1 }]);

runtime.checkPreconditions('checkout');
// { available: false, reasons: ['배송지가 입력되어야 합니다'] }

runtime.getFieldPolicy('data.shippingAddress');
// { relevant: true, editable: true, required: true }

// 배송지 입력 후
runtime.set('data.shippingAddress', {
  address: '서울시 강남구...',
  zipCode: '06000'
});

runtime.checkPreconditions('checkout');
// { available: true }

// 결제 실행
await runtime.executeAction('checkout');
```

---

## 다음 단계

- [도메인 정의](03-domain-definition.md) - 정책이 포함된 도메인 정의
- [Runtime API](07-runtime.md) - 런타임에서 정책 사용
- [DAG와 변경 전파](06-dag-propagation.md) - 정책 의존성과 전파
