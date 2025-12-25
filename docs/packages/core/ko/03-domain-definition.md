# 도메인 정의

```typescript
import {
  defineDomain,
  defineSource,
  defineDerived,
  defineAsync,
  defineAction,
  fieldPolicy,
  condition,
  sequence,
  setState,
  setValue,
  apiCall,
  z
} from '@manifesto-ai/core';

// 완전한 주문 도메인 정의
const orderDomain = defineDomain({
  id: 'order',
  name: '주문',
  description: '이커머스 주문 관리 도메인',

  dataSchema: z.object({
    items: z.array(z.object({
      id: z.string(),
      name: z.string(),
      price: z.number(),
      quantity: z.number()
    })),
    couponCode: z.string().optional(),
    shippingAddress: z.string().optional()
  }),

  stateSchema: z.object({
    isSubmitting: z.boolean(),
    selectedItemId: z.string().nullable()
  }),

  initialState: {
    isSubmitting: false,
    selectedItemId: null
  },

  paths: {
    sources: {
      // 'items'는 자동으로 'data.items'가 됨
      items: defineSource({
        schema: z.array(z.object({
          id: z.string(),
          name: z.string(),
          price: z.number(),
          quantity: z.number()
        })),
        defaultValue: [],
        semantic: { type: 'list', description: '주문 상품 목록' }
      }),
      couponCode: defineSource({
        schema: z.string().optional(),
        policy: fieldPolicy({
          relevantWhen: [condition('derived.hasItems')],
          editableWhen: [condition('derived.isNotSubmitting')]
        }),
        semantic: { type: 'input', description: '쿠폰 코드' }
      })
    },
    derived: {
      // 'subtotal'은 자동으로 'derived.subtotal'이 됨
      subtotal: defineDerived({
        deps: ['data.items'],
        expr: ['sum', ['map', ['get', 'data.items'], ['*', '$.price', '$.quantity']]],
        semantic: { type: 'currency', description: '주문 소계' }
      }),
      hasItems: defineDerived({
        deps: ['data.items'],
        expr: ['>', ['length', ['get', 'data.items']], 0],
        semantic: { type: 'boolean', description: '장바구니에 상품이 있는지' }
      }),
      isNotSubmitting: defineDerived({
        deps: ['state.isSubmitting'],
        expr: ['!', ['get', 'state.isSubmitting']],
        semantic: { type: 'boolean', description: '제출 중이 아닌지' }
      })
    }
  },

  actions: {
    checkout: defineAction({
      deps: ['data.items', 'state.isSubmitting'],
      preconditions: [
        condition('derived.hasItems', { reason: '장바구니에 상품이 필요하다' }),
        condition('derived.isNotSubmitting', { reason: '이미 제출 중이다' })
      ],
      effect: sequence([
        setState('state.isSubmitting', true, '제출 시작'),
        apiCall({ method: 'POST', endpoint: '/api/orders', description: '주문 생성' }),
        setState('state.isSubmitting', false, '제출 완료')
      ]),
      semantic: {
        type: 'action',
        verb: 'checkout',
        description: '주문을 결제한다',
        risk: 'high'
      }
    })
  }
});
```

## defineDomain()

도메인의 완전한 정의를 생성한다. 도메인은 비즈니스 로직의 단일 진실 공급원이다.

### DefineDomainOptions 타입

```typescript
type DefineDomainOptions<TData, TState> = {
  /** 도메인 고유 식별자 */
  id: string;

  /** 도메인 이름 (사람이 읽을 수 있는) */
  name: string;

  /** 도메인 설명 (AI가 이해할 수 있는) */
  description: string;

  /** 데이터 스키마 (Zod) - 영속적인 비즈니스 데이터 */
  dataSchema: ZodType<TData>;

  /** 상태 스키마 (Zod) - 일시적인 UI 상태 */
  stateSchema: ZodType<TState>;

  /** 초기 상태 값 */
  initialState: TState;

  /** 경로 정의 (선택) */
  paths?: Partial<PathDefinitions<TData, TState>>;

  /** 액션 정의 (선택) */
  actions?: Record<string, ActionDefinition>;

  /** 도메인 메타데이터 (선택) */
  meta?: DomainMeta;
};
```

### ManifestoDomain 반환 타입

```typescript
type ManifestoDomain<TData, TState> = {
  id: string;
  name: string;
  description: string;
  paths: PathDefinitions<TData, TState>;
  actions: Record<string, ActionDefinition>;
  dataSchema: ZodType<TData>;
  stateSchema: ZodType<TState>;
  initialState: TState;
  meta?: DomainMeta;
};
```

### Auto-prefixing 규칙

`paths` 내의 키는 자동으로 네임스페이스 접두사가 붙는다:

| 섹션 | 입력 키 | 변환 결과 |
|------|---------|-----------|
| `sources` | `items` | `data.items` |
| `sources` | `user.name` | `data.user.name` |
| `derived` | `total` | `derived.total` |
| `async` | `shippingRates` | `async.shippingRates` |

이미 접두사가 있는 경우 그대로 유지된다:

```typescript
paths: {
  sources: {
    'data.items': defineSource({...}),  // 그대로 'data.items'
    'items': defineSource({...})        // 'data.items'로 변환
  }
}
```

### 타입 추론

TypeScript는 `dataSchema`와 `stateSchema`로부터 `TData`와 `TState` 타입을 자동 추론한다:

```typescript
const domain = defineDomain({
  dataSchema: z.object({
    items: z.array(z.object({ id: z.string(), price: z.number() }))
  }),
  stateSchema: z.object({
    isLoading: z.boolean()
  }),
  // ...
});

// 타입 추론됨:
// domain: ManifestoDomain<{ items: Array<{ id: string; price: number }> }, { isLoading: boolean }>
```

---

## defineSource()

사용자 입력 또는 외부에서 주입되는 데이터 필드를 정의한다. `data.*` 네임스페이스에 위치한다.

### DefineSourceOptions 타입

```typescript
type DefineSourceOptions = {
  /** Zod 스키마 - 값의 타입과 검증 규칙 */
  schema: ZodType;

  /** 기본값 (선택) */
  defaultValue?: unknown;

  /** 필드 정책 (선택) - 동적 관련성/수정가능성/필수여부 */
  policy?: FieldPolicy;

  /** Semantic 메타데이터 - AI 이해용 */
  semantic: SemanticMeta;
};
```

### SourceDefinition 반환 타입

```typescript
type SourceDefinition = {
  schema: ZodType;
  defaultValue?: unknown;
  policy?: FieldPolicy;
  semantic: SemanticMeta;  // readable: true, writable: true 기본값
};
```

### FieldPolicy 연동

필드의 동적 상태를 조건부로 제어한다:

```typescript
const couponCodeSource = defineSource({
  schema: z.string().optional(),
  policy: fieldPolicy({
    // 장바구니에 상품이 있을 때만 표시
    relevantWhen: [condition('derived.hasItems')],
    // 제출 중이 아닐 때만 수정 가능
    editableWhen: [condition('derived.isNotSubmitting')],
    // 총액이 10만원 이상이면 필수
    requiredWhen: [condition('derived.isHighValue')]
  }),
  semantic: {
    type: 'input',
    description: '할인 쿠폰 코드'
  }
});
```

### 예시

```typescript
// 기본 입력 필드
const nameSource = defineSource({
  schema: z.string().min(1),
  defaultValue: '',
  semantic: { type: 'input', description: '상품명' }
});

// 배열 필드
const itemsSource = defineSource({
  schema: z.array(z.object({
    id: z.string(),
    name: z.string(),
    price: z.number().positive(),
    quantity: z.number().int().min(1)
  })),
  defaultValue: [],
  semantic: {
    type: 'list',
    description: '주문 상품 목록',
    importance: 'critical'
  }
});

// 조건부 필드
const businessTaxIdSource = defineSource({
  schema: z.string().optional(),
  policy: fieldPolicy({
    relevantWhen: [condition('derived.isBusinessAccount')],
    requiredWhen: [condition('derived.isBusinessAccount')]
  }),
  semantic: { type: 'input', description: '사업자등록번호' }
});
```

---

## defineDerived()

다른 경로의 값으로부터 동기적으로 계산되는 값을 정의한다. `derived.*` 네임스페이스에 위치한다.

### DefineDerivedOptions 타입

```typescript
type DefineDerivedOptions = {
  /** 의존하는 경로들 */
  deps: SemanticPath[];

  /** 계산 표현식 (Expression DSL) */
  expr: Expression;

  /** Semantic 메타데이터 */
  semantic: SemanticMeta;
};
```

### DerivedDefinition 반환 타입

```typescript
type DerivedDefinition = {
  deps: SemanticPath[];
  expr: Expression;
  semantic: SemanticMeta;  // readable: true, writable: false 기본값
};
```

### deps와 expr의 관계

`deps`는 변경 추적용이고, `expr`은 실제 계산 로직이다:

```typescript
// deps에 명시된 경로가 변경되면 expr이 재평가됨
const subtotal = defineDerived({
  deps: ['data.items'],  // data.items 변경 시 재계산
  expr: ['sum', ['map', ['get', 'data.items'], ['*', '$.price', '$.quantity']]],
  semantic: { type: 'currency', description: '소계' }
});
```

**주의**: `expr` 내에서 참조하는 모든 경로는 `deps`에 포함되어야 한다. 그렇지 않으면 해당 경로 변경 시 재계산이 트리거되지 않는다.

### 순환 의존성 방지

derived 값은 다른 derived 값을 참조할 수 있지만, 순환 참조는 허용되지 않는다:

```typescript
// 허용: 체인 의존성
const subtotal = defineDerived({
  deps: ['data.items'],
  expr: ['sum', ['map', ['get', 'data.items'], ['*', '$.price', '$.quantity']]],
  semantic: { type: 'currency', description: '소계' }
});

const discount = defineDerived({
  deps: ['derived.subtotal', 'data.couponCode'],
  expr: ['if',
    ['!=', ['get', 'data.couponCode'], null],
    ['*', ['get', 'derived.subtotal'], 0.1],
    0
  ],
  semantic: { type: 'currency', description: '할인액' }
});

const total = defineDerived({
  deps: ['derived.subtotal', 'derived.discount'],
  expr: ['-', ['get', 'derived.subtotal'], ['get', 'derived.discount']],
  semantic: { type: 'currency', description: '총액' }
});

// 금지: 순환 참조 (빌드 시 에러)
// A depends on B, B depends on A
```

### 예시

```typescript
// 숫자 계산
const itemCount = defineDerived({
  deps: ['data.items'],
  expr: ['length', ['get', 'data.items']],
  semantic: { type: 'count', description: '상품 수' }
});

// 불리언 조건
const canCheckout = defineDerived({
  deps: ['data.items', 'state.isSubmitting'],
  expr: ['all',
    ['>', ['length', ['get', 'data.items']], 0],
    ['!', ['get', 'state.isSubmitting']]
  ],
  semantic: { type: 'boolean', description: '결제 가능 여부' }
});

// 문자열 조합
const orderSummary = defineDerived({
  deps: ['derived.itemCount', 'derived.total'],
  expr: ['concat',
    '상품 ', ['toString', ['get', 'derived.itemCount']], '개, ',
    '총 ', ['toString', ['get', 'derived.total']], '원'
  ],
  semantic: { type: 'string', description: '주문 요약' }
});

// 조건부 값
const shippingFee = defineDerived({
  deps: ['derived.subtotal'],
  expr: ['case',
    [['>=', ['get', 'derived.subtotal'], 50000], 0],
    3000
  ],
  semantic: { type: 'currency', description: '배송비 (5만원 이상 무료)' }
});
```

---

## defineAsync()

외부 API 호출 등 비동기 데이터 소스를 정의한다. `async.*` 네임스페이스에 위치한다.

### DefineAsyncOptions 타입

```typescript
type DefineAsyncOptions = {
  /** 트리거 경로들 - 이 경로들이 변경되면 비동기 호출 */
  deps: SemanticPath[];

  /** 실행 조건 (선택) - 조건이 true일 때만 호출 */
  condition?: Expression;

  /** 디바운스 시간(ms) (선택) */
  debounce?: number;

  /** 실행할 Effect */
  effect: Effect;

  /** 결과 저장 경로 */
  resultPath: SemanticPath;

  /** 로딩 상태 경로 */
  loadingPath: SemanticPath;

  /** 에러 상태 경로 */
  errorPath: SemanticPath;

  /** Semantic 메타데이터 */
  semantic: SemanticMeta;
};
```

### AsyncDefinition 반환 타입

```typescript
type AsyncDefinition = {
  deps: SemanticPath[];
  condition?: Expression;
  debounce?: number;
  effect: Effect;
  resultPath: SemanticPath;
  loadingPath: SemanticPath;
  errorPath: SemanticPath;
  semantic: SemanticMeta;  // readable: true, writable: false 기본값
};
```

### condition과 debounce

```typescript
const shippingRatesAsync = defineAsync({
  deps: ['data.items', 'data.shippingAddress'],
  // 주소가 있고 상품이 있을 때만 호출
  condition: ['all',
    ['>', ['length', ['get', 'data.items']], 0],
    ['!=', ['get', 'data.shippingAddress'], null]
  ],
  // 300ms 디바운스 - 빠른 연속 변경 시 마지막 변경만 실행
  debounce: 300,
  effect: apiCall({
    method: 'GET',
    endpoint: '/api/shipping-rates',
    query: {
      address: ['get', 'data.shippingAddress'],
      itemCount: ['length', ['get', 'data.items']]
    },
    description: '배송비 조회'
  }),
  resultPath: 'async.shippingRates',
  loadingPath: 'state.shippingLoading',
  errorPath: 'state.shippingError',
  semantic: { type: 'async', description: '배송비 옵션' }
});
```

### resultPath/loadingPath/errorPath

비동기 작업의 세 가지 상태를 각각 다른 경로에 저장한다:

| 경로 | 값 | 설명 |
|------|---|------|
| `resultPath` | API 응답 데이터 | 성공 시 저장 |
| `loadingPath` | `true`/`false` | 로딩 중 여부 |
| `errorPath` | 에러 객체 또는 `null` | 실패 시 에러 정보 |

### 예시

```typescript
// 사용자 검색
const userSearchAsync = defineAsync({
  deps: ['data.searchQuery'],
  condition: ['>=', ['length', ['get', 'data.searchQuery']], 2],  // 2글자 이상
  debounce: 500,
  effect: apiCall({
    method: 'GET',
    endpoint: '/api/users',
    query: { q: ['get', 'data.searchQuery'] },
    description: '사용자 검색'
  }),
  resultPath: 'async.searchResults',
  loadingPath: 'state.searchLoading',
  errorPath: 'state.searchError',
  semantic: { type: 'async', description: '검색 결과' }
});

// 상품 상세 정보
const productDetailAsync = defineAsync({
  deps: ['state.selectedProductId'],
  condition: ['!=', ['get', 'state.selectedProductId'], null],
  effect: apiCall({
    method: 'GET',
    endpoint: ['concat', '/api/products/', ['get', 'state.selectedProductId']],
    description: '상품 상세 조회'
  }),
  resultPath: 'async.productDetail',
  loadingPath: 'state.productLoading',
  errorPath: 'state.productError',
  semantic: { type: 'async', description: '선택된 상품 상세' }
});
```

---

## defineAction()

사용자가 실행할 수 있는 작업을 정의한다. 전제조건(preconditions)이 충족되어야 실행 가능하다.

### DefineActionOptions 타입

```typescript
type DefineActionOptions = {
  /** 의존하는 경로들 */
  deps: SemanticPath[];

  /** 입력 파라미터 스키마 (선택) */
  input?: ZodType;

  /** 실행할 Effect */
  effect: Effect;

  /** 실행 전제조건 (선택) */
  preconditions?: ConditionRef[];

  /** Semantic 메타데이터 (ActionSemanticMeta) */
  semantic: ActionSemanticMeta;
};
```

### ActionDefinition 반환 타입

```typescript
type ActionDefinition = {
  deps: SemanticPath[];
  input?: ZodType;
  effect: Effect;
  preconditions?: ConditionRef[];
  semantic: ActionSemanticMeta;
};
```

### preconditions

액션 실행 전에 확인되는 조건들이다. 모든 조건이 충족되어야 액션이 실행된다:

```typescript
const checkoutAction = defineAction({
  deps: ['data.items', 'state.isSubmitting'],
  preconditions: [
    // 장바구니에 상품이 있어야 함
    {
      path: 'derived.hasItems',
      expect: 'true',
      reason: '장바구니에 상품이 있어야 결제할 수 있다'
    },
    // 이미 제출 중이 아니어야 함
    {
      path: 'state.isSubmitting',
      expect: 'false',
      reason: '이미 결제가 진행 중이다'
    },
    // 필수 정보가 입력되어야 함
    {
      path: 'derived.hasShippingAddress',
      expect: 'true',
      reason: '배송지를 입력해야 한다'
    }
  ],
  effect: sequence([...]),
  semantic: { type: 'action', verb: 'checkout', description: '결제하기' }
});
```

### effect

액션이 실행할 Effect를 정의한다. 자세한 내용은 [Effect 시스템](05-effect-system.md) 참조.

### ActionSemanticMeta

액션 전용 메타데이터로, 기본 `SemanticMeta`에 추가 필드가 있다:

```typescript
type ActionSemanticMeta = SemanticMeta & {
  /** 동사 - AI가 이해하는 행위 */
  verb: string;

  /** 위험도 - AI의 자동 실행 결정에 영향 */
  risk?: 'none' | 'low' | 'medium' | 'high' | 'critical';

  /** 예상 결과 */
  expectedOutcome?: string;

  /** 되돌릴 수 있는지 */
  reversible?: boolean;
};
```

### 예시

```typescript
// 간단한 액션 (입력 없음)
const clearCartAction = defineAction({
  deps: ['data.items'],
  effect: setValue('data.items', [], '장바구니 비우기'),
  semantic: {
    type: 'action',
    verb: 'clear',
    description: '장바구니를 비운다',
    risk: 'medium',
    reversible: false
  }
});

// 입력이 있는 액션
const addItemAction = defineAction({
  deps: ['data.items'],
  input: z.object({
    id: z.string(),
    name: z.string(),
    price: z.number().positive(),
    quantity: z.number().int().min(1)
  }),
  preconditions: [
    condition('derived.isNotSubmitting', { reason: '결제 중에는 상품을 추가할 수 없다' })
  ],
  effect: setValue('data.items',
    ['concat', ['get', 'data.items'], [['get', 'input']]],
    '상품 추가'
  ),
  semantic: {
    type: 'action',
    verb: 'add',
    description: '장바구니에 상품을 추가한다',
    risk: 'low',
    reversible: true
  }
});

// 위험한 액션
const deleteOrderAction = defineAction({
  deps: ['data.orderId', 'data.status'],
  preconditions: [
    condition('derived.isDraft', { reason: '임시저장 상태의 주문만 삭제할 수 있다' })
  ],
  effect: apiCall({
    method: 'DELETE',
    endpoint: ['concat', '/api/orders/', ['get', 'data.orderId']],
    description: '주문 삭제'
  }),
  semantic: {
    type: 'action',
    verb: 'delete',
    description: '주문을 영구 삭제한다',
    risk: 'critical',
    reversible: false,
    expectedOutcome: '주문이 완전히 삭제되며 복구할 수 없다'
  }
});
```

---

## 헬퍼 함수

### fieldPolicy()

FieldPolicy 객체를 생성한다:

```typescript
function fieldPolicy(options: {
  relevantWhen?: ConditionRef[];
  editableWhen?: ConditionRef[];
  requiredWhen?: ConditionRef[];
}): FieldPolicy;

// 사용
const policy = fieldPolicy({
  relevantWhen: [condition('derived.showAdvanced')],
  editableWhen: [condition('derived.isNotSubmitting')],
  requiredWhen: [condition('derived.needsAddress')]
});
```

### condition()

ConditionRef 객체를 생성한다:

```typescript
function condition(
  path: SemanticPath,
  options?: { expect?: 'true' | 'false'; reason?: string }
): ConditionRef;

// 사용
condition('derived.hasItems');
// → { path: 'derived.hasItems', expect: 'true' }

condition('state.isSubmitting', { expect: 'false', reason: '제출 중이 아니어야 한다' });
// → { path: 'state.isSubmitting', expect: 'false', reason: '제출 중이 아니어야 한다' }
```

---

## 도메인 검증

### validateDomain()

도메인 정의의 유효성을 검증한다:

```typescript
import { validateDomain } from '@manifesto-ai/core';

const result = validateDomain(orderDomain);
// { valid: boolean, issues: ValidationIssue[] }

if (!result.valid) {
  result.issues.forEach(issue => {
    console.log(`[${issue.severity}] ${issue.path}: ${issue.message}`);
  });
}
```

### ValidationResult 타입

```typescript
type ValidationResult = {
  valid: boolean;
  issues: ValidationIssue[];
};

type ValidationIssue = {
  code: string;
  message: string;
  path: SemanticPath;
  severity: 'error' | 'warning' | 'info' | 'suggestion';
  suggestedFix?: {
    description: string;
    value: Expression;
  };
};
```

### 일반적인 검증 오류

| 코드 | 원인 | 해결 |
|------|------|------|
| `CIRCULAR_DEPENDENCY` | derived 간 순환 참조 | 의존성 체인 재설계 |
| `MISSING_DEPENDENCY` | expr에서 참조하지만 deps에 없음 | deps에 경로 추가 |
| `INVALID_PATH` | 존재하지 않는 경로 참조 | 경로명 확인 |
| `SCHEMA_MISMATCH` | source의 schema와 dataSchema 불일치 | 스키마 동기화 |

---

## 다음 단계

- [Expression DSL](04-expression-dsl.md) - expr 작성법
- [Effect 시스템](05-effect-system.md) - effect 정의법
- [Policy 평가](08-policy.md) - FieldPolicy와 preconditions 평가
