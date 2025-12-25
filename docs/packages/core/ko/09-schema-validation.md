# Zod 통합 & 검증

```typescript
import { z } from 'zod';
import { validateValue, CommonSchemas } from '@manifesto-ai/core';

// Zod 스키마 정의
const itemSchema = z.object({
  id: CommonSchemas.id(),
  name: z.string().min(1, '상품명을 입력해주세요'),
  price: CommonSchemas.money(),
  quantity: CommonSchemas.positiveInt()
});

// 값 검증
const result = validateValue(itemSchema, invalidItem, 'data.items.0');
// {
//   valid: false,
//   issues: [
//     { code: 'too_small', message: '상품명을 입력해주세요', path: 'data.items.0.name', ... }
//   ]
// }
```

## 핵심 개념

### "스키마가 곧 계약"

Manifesto는 **Zod**를 스키마 라이브러리로 채택한다. 모든 데이터는 스키마에 의해 타입 안전성과 런타임 검증을 동시에 보장받는다.

```typescript
// 스키마 정의 = 타입 정의 + 검증 규칙
const orderSchema = z.object({
  items: z.array(itemSchema).min(1, '최소 1개 상품이 필요합니다'),
  couponCode: z.string().optional(),
  shippingAddress: addressSchema,
  termsAgreed: z.boolean().refine(v => v === true, '약관에 동의해야 합니다')
});

// 타입 자동 추론
type Order = z.infer<typeof orderSchema>;
// { items: Item[]; couponCode?: string; shippingAddress: Address; termsAgreed: boolean }

// 런타임 검증
const result = orderSchema.safeParse(userInput);
```

---

## CommonSchemas

자주 사용되는 스키마 패턴을 미리 정의해 둔다.

### 문자열 스키마

```typescript
import { CommonSchemas } from '@manifesto-ai/core';

// 이메일
CommonSchemas.email();
// z.string().email()

// URL
CommonSchemas.url();
// z.string().url()

// 전화번호 (한국)
CommonSchemas.phoneKR();
// z.string().regex(/^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$/)

// 사업자등록번호
CommonSchemas.businessNumber();
// z.string().regex(/^[0-9]{3}-?[0-9]{2}-?[0-9]{5}$/)

// ID 문자열
CommonSchemas.id();
// z.string().min(1)

// ISO 날짜 문자열
CommonSchemas.dateString();
// z.string().datetime()
```

### 숫자 스키마

```typescript
// 양의 정수
CommonSchemas.positiveInt();
// z.number().int().positive()

// 비음수 정수
CommonSchemas.nonNegativeInt();
// z.number().int().nonnegative()

// 금액
CommonSchemas.money();
// z.number().nonnegative()

// 퍼센트 (0-100)
CommonSchemas.percent();
// z.number().min(0).max(100)
```

### 복합 스키마

```typescript
// 선택 옵션
CommonSchemas.selectOption(['standard', 'express', 'overnight'] as const);
// z.enum(['standard', 'express', 'overnight'])

// nullable 래퍼
CommonSchemas.nullable(z.string());
// z.string().nullable()

// optional 래퍼
CommonSchemas.optional(z.string());
// z.string().optional()

// 배열
CommonSchemas.array(itemSchema);
// z.array(itemSchema)

// 레코드
CommonSchemas.record(z.number());
// z.record(z.number())
```

---

## SchemaUtils

### 범위 스키마

```typescript
import { SchemaUtils } from '@manifesto-ai/core';

// 숫자 범위
SchemaUtils.range(1, 100);
// z.number().min(1).max(100)

// 문자열 길이 범위
SchemaUtils.stringLength(2, 50);
// z.string().min(2).max(50)
```

### Enum 유니온

```typescript
// 여러 값 중 하나
SchemaUtils.enumUnion('pending', 'processing', 'completed', 'cancelled');
// z.enum(['pending', 'processing', 'completed', 'cancelled'])
```

### 상호 의존 스키마

```typescript
// 둘 중 하나 필수
SchemaUtils.eitherRequired(
  z.string(),  // 휴대폰 번호
  z.string()   // 이메일
);
// { field1?: string; field2?: string } - 둘 중 하나는 있어야 함
```

---

## schemaToSource

Zod 스키마에서 SourceDefinition을 생성한다.

```typescript
import { schemaToSource } from '@manifesto-ai/core';

const itemsSource = schemaToSource(
  z.array(itemSchema),
  {
    type: 'list',
    description: '주문 상품 목록',
    importance: 'critical'
  },
  {
    defaultValue: []
  }
);
// SourceDefinition {
//   schema: z.array(itemSchema),
//   defaultValue: [],
//   semantic: {
//     type: 'list',
//     description: '주문 상품 목록',
//     importance: 'critical',
//     readable: true,
//     writable: true
//   }
// }
```

---

## 값 검증

### validateValue

단일 값을 검증한다.

```typescript
import { validateValue } from '@manifesto-ai/core';

// 유효한 값
const validResult = validateValue(itemSchema, {
  id: '1',
  name: '노트북',
  price: 1500000,
  quantity: 1
}, 'data.items.0');
// { valid: true, issues: [] }

// 유효하지 않은 값
const invalidResult = validateValue(itemSchema, {
  id: '',
  name: '',
  price: -100,
  quantity: 0
}, 'data.items.0');
// {
//   valid: false,
//   issues: [
//     { code: 'too_small', message: '상품명을 입력해주세요', path: 'data.items.0.name', ... },
//     { code: 'too_small', message: 'Number must be greater than 0', path: 'data.items.0.price', ... },
//     { code: 'too_small', message: 'Number must be greater than 0', path: 'data.items.0.quantity', ... }
//   ]
// }
```

### ValidationResult 타입

```typescript
type ValidationResult = {
  /** 전체 유효성 */
  valid: boolean;

  /** 발견된 이슈들 */
  issues: ValidationIssue[];
};
```

### ValidationIssue 타입

```typescript
type ValidationIssue = {
  /** Zod 에러 코드 */
  code: string;

  /** 에러 메시지 */
  message: string;

  /** SemanticPath */
  path: SemanticPath;

  /** 심각도 */
  severity: 'error' | 'warning' | 'suggestion';

  /** 자동 수정 제안 */
  suggestedFix?: {
    description: string;
    value: unknown;
  };
};
```

### 부분 검증

```typescript
import { validatePartial } from '@manifesto-ai/core';

// 일부 필드만 검증 (다른 필드는 무시)
const result = validatePartial(
  orderSchema,
  { items: [item1] },  // shippingAddress 누락
  'data'
);
// { valid: true, issues: [] }  // partial이므로 누락 허용
```

---

## 도메인 데이터 검증

### validateDomainData

전체 도메인 데이터를 검증한다.

```typescript
import { validateDomainData } from '@manifesto-ai/core';

const result = validateDomainData(orderDomain, {
  items: [],
  shippingAddress: null,
  termsAgreed: false
});
// {
//   valid: false,
//   issues: [
//     { path: 'data.items', message: '최소 1개 상품이 필요합니다', ... },
//     { path: 'data.shippingAddress', message: '배송지를 입력해주세요', ... }
//   ]
// }
```

### 필드별 검증

```typescript
import { validateFields } from '@manifesto-ai/core';

const results = validateFields(orderDomain, data);
// {
//   'data.items': { valid: true, issues: [] },
//   'data.shippingAddress': { valid: false, issues: [...] },
//   'data.couponCode': { valid: true, issues: [] }
// }
```

---

## 비동기 검증

서버 API를 통한 검증이 필요한 경우에 사용한다.

```typescript
import { validateAsync } from '@manifesto-ai/core';

// 쿠폰 코드 유효성 검증
const result = await validateAsync(
  'SAVE10',
  'data.couponCode',
  async (value) => {
    const response = await fetch(`/api/coupons/validate?code=${value}`);
    const data = await response.json();

    if (data.valid) {
      return true;
    }
    return data.message || '유효하지 않은 쿠폰입니다';
  }
);
// { valid: false, issues: [{ message: '만료된 쿠폰입니다', path: 'data.couponCode', ... }] }
```

---

## 검증 결과 처리

### 결과 병합

```typescript
import { mergeValidationResults } from '@manifesto-ai/core';

const itemsResult = validateValue(itemsSchema, items, 'data.items');
const addressResult = validateValue(addressSchema, address, 'data.shippingAddress');
const couponResult = await validateAsync(couponCode, 'data.couponCode', validateCoupon);

const merged = mergeValidationResults(itemsResult, addressResult, couponResult);
// { valid: false, issues: [...모든 이슈 병합...] }
```

### 경로별 그룹화

```typescript
import { groupValidationByPath } from '@manifesto-ai/core';

const grouped = groupValidationByPath(result);
// {
//   'data.items.0.name': [{ message: '상품명을 입력해주세요', ... }],
//   'data.items.0.price': [{ message: '가격은 0보다 커야 합니다', ... }],
//   'data.shippingAddress.zipCode': [{ message: '우편번호를 입력해주세요', ... }]
// }
```

### 심각도별 필터링

```typescript
import { getErrors, getWarnings, getSuggestions, filterBySeverity } from '@manifesto-ai/core';

// 에러만
const errors = getErrors(result);
// [{ severity: 'error', ... }]

// 경고만
const warnings = getWarnings(result);
// [{ severity: 'warning', ... }]

// 제안만
const suggestions = getSuggestions(result);
// [{ severity: 'suggestion', ... }]

// 특정 심각도
const critical = filterBySeverity(result, 'error');
```

---

## 자동 수정 제안

검증 실패 시 자동으로 수정 방법을 제안한다.

```typescript
// ValidationIssue의 suggestedFix
const issue = result.issues[0];
if (issue.suggestedFix) {
  console.log(`수정 방법: ${issue.suggestedFix.description}`);
  // "수정 방법: Set to minimum value (1)"

  // 자동 적용
  if (typeof issue.suggestedFix.value === 'number') {
    runtime.set(issue.path, issue.suggestedFix.value);
  }
}
```

### 자동 수정 규칙

```typescript
// 타입 변환
// 문자열 → 숫자
{ description: 'Convert to number', value: ['toNumber', ['get', '$input']] }

// 숫자 → 문자열
{ description: 'Convert to string', value: ['toString', ['get', '$input']] }

// 범위 수정
// 최솟값으로 설정
{ description: 'Set to minimum value (1)', value: 1 }

// 최댓값으로 설정
{ description: 'Set to maximum value (100)', value: 100 }

// 이메일 형식
{ description: 'Enter a valid email address', value: null }
```

---

## 스키마 메타데이터

### getSchemaMetadata

```typescript
import { getSchemaMetadata } from '@manifesto-ai/core';

const meta = getSchemaMetadata(z.string().optional().describe('사용자 이름'));
// {
//   type: 'ZodString',
//   isOptional: true,
//   isNullable: false,
//   description: '사용자 이름'
// }
```

### getSchemaDefault

```typescript
import { getSchemaDefault } from '@manifesto-ai/core';

const defaultValue = getSchemaDefault(z.number().default(0));
// 0

const noDefault = getSchemaDefault(z.string());
// undefined
```

### toJsonSchema

```typescript
import { toJsonSchema } from '@manifesto-ai/core';

const jsonSchema = toJsonSchema(z.string().nullable().describe('설명'));
// {
//   type: 'string',
//   description: '설명',
//   nullable: true
// }
```

---

## 실전 예시: 주문 폼 검증

### 스키마 정의

```typescript
import { z } from 'zod';
import { CommonSchemas } from '@manifesto-ai/core';

// 상품 스키마
const itemSchema = z.object({
  id: CommonSchemas.id(),
  name: z.string().min(1, '상품명을 입력해주세요'),
  price: CommonSchemas.money().refine(p => p > 0, '가격은 0보다 커야 합니다'),
  quantity: CommonSchemas.positiveInt().max(99, '최대 99개까지 주문 가능합니다')
});

// 주소 스키마
const addressSchema = z.object({
  name: z.string().min(2, '이름은 2자 이상이어야 합니다'),
  phone: CommonSchemas.phoneKR(),
  zipCode: z.string().regex(/^\d{5}$/, '우편번호 5자리를 입력해주세요'),
  address: z.string().min(10, '상세 주소를 입력해주세요'),
  detail: z.string().optional()
});

// 주문 스키마
const orderDataSchema = z.object({
  items: z.array(itemSchema).min(1, '최소 1개 상품을 추가해주세요'),
  couponCode: z.string().optional(),
  shippingAddress: addressSchema,
  memo: z.string().max(500, '배송 메모는 500자 이내로 입력해주세요').optional(),
  termsAgreed: z.literal(true, {
    errorMap: () => ({ message: '이용약관에 동의해야 합니다' })
  })
});

type OrderData = z.infer<typeof orderDataSchema>;
```

### 도메인에서 사용

```typescript
const orderDomain = defineDomain({
  name: 'order',
  dataSchema: orderDataSchema,
  stateSchema: z.object({
    isSubmitting: z.boolean(),
    validationErrors: z.record(z.array(z.string()))
  }),

  paths: {
    sources: {
      items: schemaToSource(
        z.array(itemSchema),
        { type: 'list', description: '주문 상품 목록', importance: 'critical' },
        { defaultValue: [] }
      ),

      shippingAddress: schemaToSource(
        addressSchema,
        { type: 'address', description: '배송 주소', importance: 'high' }
      ),

      couponCode: schemaToSource(
        z.string().optional(),
        { type: 'string', description: '할인 쿠폰 코드' },
        { defaultValue: '' }
      ),

      termsAgreed: schemaToSource(
        z.boolean(),
        { type: 'boolean', description: '이용약관 동의' },
        { defaultValue: false }
      )
    }
    // ...
  }
});
```

### 폼 제출 시 검증

```typescript
async function submitOrder(runtime: DomainRuntime): Promise<void> {
  // 1. 동기 검증
  const data = runtime.getSnapshot().data;
  const syncResult = validateDomainData(orderDomain, data);

  if (!syncResult.valid) {
    runtime.set('state.validationErrors', groupValidationByPath(syncResult));
    return;
  }

  // 2. 비동기 검증 (쿠폰)
  if (data.couponCode) {
    const asyncResult = await validateAsync(
      data.couponCode,
      'data.couponCode',
      validateCouponApi
    );

    if (!asyncResult.valid) {
      runtime.set('state.validationErrors', groupValidationByPath(asyncResult));
      return;
    }
  }

  // 3. 전제조건 확인
  const availability = runtime.checkPreconditions('submitOrder');
  if (!availability.available) {
    alert(availability.reasons.join('\n'));
    return;
  }

  // 4. 주문 제출
  await runtime.executeAction('submitOrder');
}
```

### React에서 에러 표시

```typescript
function FormField({ path, label }: { path: SemanticPath; label: string }) {
  const value = useValue(path);
  const errors = useValidationErrors(path);

  return (
    <div className="form-field">
      <label>{label}</label>
      <input
        value={value ?? ''}
        onChange={e => runtime.set(path, e.target.value)}
        className={errors.length > 0 ? 'error' : ''}
      />
      {errors.map((error, i) => (
        <span key={i} className="error-message">{error.message}</span>
      ))}
    </div>
  );
}
```

---

## 다음 단계

- [도메인 정의](03-domain-definition.md) - 스키마가 포함된 도메인 정의
- [Policy 평가](08-policy.md) - 검증과 정책의 연동
- [Runtime API](07-runtime.md) - 런타임에서의 검증
