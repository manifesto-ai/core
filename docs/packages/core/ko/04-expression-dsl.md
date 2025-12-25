# Expression DSL

```typescript
import { evaluate, analyzeExpression } from '@manifesto-ai/core';

// 주문 총액 계산
const totalExpr = ['-',
  ['sum', ['map', ['get', 'data.items'], ['*', '$.price', '$.quantity']]],
  ['get', 'derived.discount']
];

// 평가
const result = evaluate(totalExpr, {
  get: (path) => runtime.get(path)
});

if (result.ok) {
  console.log('총액:', result.value);  // 총액: 27000
}

// 분석
const analysis = analyzeExpression(totalExpr);
console.log(analysis.directDeps);  // ['data.items', 'derived.discount']
console.log(analysis.operators);   // ['-', 'sum', 'map', '*', 'get']
```

## 왜 JSON 기반 DSL인가

### 직렬화 가능

Expression은 JSON으로 직렬화되어 저장, 전송, 비교가 가능하다:

```typescript
// 데이터베이스 저장
const saved = JSON.stringify(expr);

// 네트워크 전송
await fetch('/api/rules', { body: JSON.stringify({ rule: expr }) });

// 구조 비교
const isSame = JSON.stringify(expr1) === JSON.stringify(expr2);
```

### AI 친화적

AI가 Expression을 읽고, 쓰고, 수정할 수 있다:

```typescript
// AI가 이해할 수 있음
const rule = ['all',
  ['>', ['get', 'data.age'], 18],
  ['!=', ['get', 'data.email'], null]
];
// "data.age가 18보다 크고, data.email이 null이 아니면 true"

// AI가 생성할 수 있음
// "사용자가 프리미엄이거나 구매 금액이 5만원 이상인 조건을 만들어줘"
const aiGenerated = ['any',
  ['==', ['get', 'data.membership'], 'premium'],
  ['>=', ['get', 'derived.total'], 50000]
];
```

### 정적 분석 가능

실행 전에 Expression을 분석할 수 있다:

```typescript
const analysis = analyzeExpression(expr);

// 어떤 경로에 의존하는가?
analysis.directDeps;  // ['data.items', 'data.couponCode']

// 어떤 연산자를 사용하는가?
analysis.operators;   // ['sum', 'map', '*', 'get']

// 얼마나 복잡한가?
analysis.complexity;  // 12

// 반복 컨텍스트를 사용하는가?
analysis.usesContext; // true ($.price 등 사용)
```

---

## 문법 형식

### 튜플 문법

모든 연산은 배열 형태로 표현된다:

```typescript
['operator', arg1, arg2, ...]
```

첫 번째 요소가 연산자이고, 나머지가 인자이다:

```typescript
['>', 5, 3]                    // 5 > 3
['+', 10, 20]                  // 10 + 20
['concat', 'Hello', ' World']  // 'Hello World'
```

### 리터럴 값

기본 타입은 그대로 사용한다:

```typescript
'hello'  // 문자열
42       // 숫자
true     // 불리언
null     // null
```

### 배열 리터럴

문자열 연산자로 시작하지 않는 배열은 데이터 리터럴로 처리된다:

```typescript
[10, 20, 30]              // 배열 리터럴 → [10, 20, 30]
['a', 'b', 'c']           // 문자열 배열은 문자열로 시작하지만 연산자가 아님
[1, 'mixed', true]        // 혼합 타입 배열 리터럴

// 연산자 표현식과 비교:
['concat', 'a', 'b']      // 연산자 표현식 → 'ab'
['+', 1, 2]               // 연산자 표현식 → 3
```

이를 통해 배열 데이터를 표현식에서 직접 사용할 수 있다:

```typescript
// 배열 리터럴을 기본값으로 사용
['coalesce', ['get', 'data.items'], []]

// 배열 리터럴과 비교
['==', ['get', 'data.status'], ['pending', 'draft']]
```

---

## 값 접근

### get

경로에서 값을 읽는다:

```typescript
['get', 'data.user.name']        // data.user.name 값
['get', 'derived.total']         // derived.total 값
['get', 'state.isSubmitting']    // state.isSubmitting 값
```

### 컨텍스트 참조

`map`, `filter` 등 반복 함수 내에서 현재 항목을 참조한다:

```typescript
// $  - 현재 항목 전체
// $.field - 현재 항목의 필드

// 가격 * 수량 계산
['map', ['get', 'data.items'], ['*', '$.price', '$.quantity']]

// 완료되지 않은 항목 필터
['filter', ['get', 'data.todos'], ['!', '$.completed']]

// 상품명 목록 추출
['map', ['get', 'data.items'], '$.name']
```

---

## 비교 연산자

| 연산자 | 의미 | 예시 |
|--------|------|------|
| `==` | 같음 | `['==', ['get', 'data.status'], 'active']` |
| `!=` | 다름 | `['!=', ['get', 'data.email'], null]` |
| `>` | 초과 | `['>', ['get', 'data.age'], 18]` |
| `>=` | 이상 | `['>=', ['get', 'derived.total'], 50000]` |
| `<` | 미만 | `['<', ['get', 'data.quantity'], 10]` |
| `<=` | 이하 | `['<=', ['get', 'data.price'], 100000]` |

```typescript
// 성인인지 확인
['>=', ['get', 'data.age'], 18]

// 활성 상태인지 확인
['==', ['get', 'data.status'], 'active']

// 재고가 있는지 확인
['>', ['get', 'data.stock'], 0]
```

---

## 논리 연산자

| 연산자 | 의미 | 예시 |
|--------|------|------|
| `!` | NOT | `['!', ['get', 'state.isLoading']]` |
| `all` | AND (모두 참) | `['all', expr1, expr2, expr3]` |
| `any` | OR (하나라도 참) | `['any', expr1, expr2, expr3]` |

```typescript
// NOT: 로딩 중이 아님
['!', ['get', 'state.isLoading']]

// AND: 장바구니에 상품이 있고, 제출 중이 아님
['all',
  ['>', ['length', ['get', 'data.items']], 0],
  ['!', ['get', 'state.isSubmitting']]
]

// OR: 관리자이거나 프리미엄 회원
['any',
  ['==', ['get', 'data.role'], 'admin'],
  ['==', ['get', 'data.membership'], 'premium']
]
```

---

## 산술 연산자

| 연산자 | 의미 | 예시 |
|--------|------|------|
| `+` | 덧셈 | `['+', 10, 20]` → `30` |
| `-` | 뺄셈 | `['-', 100, 30]` → `70` |
| `*` | 곱셈 | `['*', 5, 3]` → `15` |
| `/` | 나눗셈 | `['/', 100, 4]` → `25` |
| `%` | 나머지 | `['%', 10, 3]` → `1` |

```typescript
// 가격 * 수량
['*', ['get', '$.price'], ['get', '$.quantity']]

// 소계 - 할인
['-', ['get', 'derived.subtotal'], ['get', 'derived.discount']]

// 세금 10% 추가
['+', ['get', 'derived.subtotal'], ['*', ['get', 'derived.subtotal'], 0.1]]
```

---

## 조건 연산자

### case

if-else 체인이다. 조건-결과 쌍을 나열하고 마지막에 기본값을 둔다:

```typescript
['case',
  [조건1, 결과1],
  [조건2, 결과2],
  기본값
]
```

```typescript
// 등급 계산
['case',
  [['>=', ['get', 'data.score'], 90], 'A'],
  [['>=', ['get', 'data.score'], 80], 'B'],
  [['>=', ['get', 'data.score'], 70], 'C'],
  'F'
]

// 배송비 계산
['case',
  [['>=', ['get', 'derived.subtotal'], 50000], 0],     // 5만원 이상 무료
  [['>=', ['get', 'derived.subtotal'], 30000], 2000],  // 3만원 이상 2000원
  3000                                                   // 기본 3000원
]
```

### match

값 패턴 매칭이다:

```typescript
['match', 검사할값,
  [패턴1, 결과1],
  [패턴2, 결과2],
  기본값
]
```

```typescript
// 상태에 따른 메시지
['match', ['get', 'data.status'],
  ['pending', '대기 중'],
  ['processing', '처리 중'],
  ['completed', '완료'],
  ['cancelled', '취소됨'],
  '알 수 없음'
]
```

### coalesce

첫 번째 null이 아닌 값을 반환한다:

```typescript
['coalesce', expr1, expr2, expr3]
```

```typescript
// 닉네임이 없으면 이름, 이름도 없으면 '익명'
['coalesce',
  ['get', 'data.nickname'],
  ['get', 'data.name'],
  '익명'
]
```

---

## 다형성 연산자

일부 연산자는 문자열과 배열 모두에서 동작하며, 입력 타입을 자동으로 감지한다. 이를 통해 타입별 연산자 없이도 유연한 데이터 조작이 가능하다.

| 연산자 | 문자열 | 배열 | 예시 |
|--------|--------|------|------|
| `concat` | 문자열 연결 | 배열 병합 | `['concat', [1,2], [3,4]]` → `[1,2,3,4]` |
| `length` | 문자열 길이 | 배열 길이 | `['length', 'hello']` → `5` |
| `slice` | 부분 문자열 | 부분 배열 | `['slice', [1,2,3,4], 1, 3]` → `[2,3]` |
| `includes` | 부분 문자열 포함 | 요소 포함 | `['includes', [1,2,3], 2]` → `true` |
| `indexOf` | 문자/문자열 위치 | 요소 위치 | `['indexOf', [1,2,3], 2]` → `1` |
| `at` | 해당 인덱스 문자 | 해당 인덱스 요소 | `['at', 'hello', 1]` → `'e'` |
| `isEmpty` | 빈 문자열 체크 | 빈 배열 체크 | `['isEmpty', []]` → `true` |

```typescript
// 문자열 모드
['concat', 'Hello', ' ', 'World']   // 'Hello World'
['length', 'hello']                  // 5
['slice', 'hello', 1, 4]            // 'ell'
['includes', 'hello', 'ell']        // true
['indexOf', 'hello', 'l']           // 2
['at', 'hello', 1]                  // 'e'
['isEmpty', '']                     // true

// 배열 모드
['concat', [1, 2], [3, 4]]          // [1, 2, 3, 4]
['concat', [1], [2], [3]]           // [1, 2, 3]
['length', [1, 2, 3]]               // 3
['slice', [1, 2, 3, 4], 1, 3]       // [2, 3]
['includes', [1, 2, 3], 2]          // true
['indexOf', ['a', 'b', 'c'], 'b']   // 1
['at', [10, 20, 30], -1]            // 30 (음수 인덱스)
['isEmpty', []]                     // true
```

---

## 배열 함수

### 기본 함수

| 함수 | 설명 | 예시 |
|------|------|------|
| `length` | 길이 (다형성) | `['length', ['get', 'data.items']]` |
| `at` | 인덱스 접근 (다형성) | `['at', ['get', 'data.items'], 0]` |
| `first` | 첫 번째 요소 | `['first', ['get', 'data.items']]` |
| `last` | 마지막 요소 | `['last', ['get', 'data.items']]` |
| `includes` | 포함 여부 (다형성) | `['includes', ['get', 'data.tags'], 'sale']` |
| `indexOf` | 인덱스 찾기 (다형성) | `['indexOf', ['get', 'data.items'], 'A']` |

### 변환 함수

```typescript
// map: 각 항목 변환
['map', ['get', 'data.items'], '$.name']
// ['상품A', '상품B', '상품C']

// filter: 조건에 맞는 항목만
['filter', ['get', 'data.items'], ['>', '$.price', 10000]]
// price > 10000인 항목들

// flatten: 중첩 배열 평탄화
['flatten', [[1, 2], [3, 4]]]
// [1, 2, 3, 4]

// unique: 중복 제거
['unique', [1, 2, 2, 3, 3, 3]]
// [1, 2, 3]

// sort: 정렬
['sort', ['get', 'data.items'], '$.price']
// price 기준 오름차순

// reverse: 역순
['reverse', ['get', 'data.items']]
```

### 검증 함수

```typescript
// every: 모든 항목이 조건 충족
['every', ['get', 'data.items'], ['>', '$.quantity', 0]]
// 모든 상품의 수량이 0보다 큰가?

// some: 하나라도 조건 충족
['some', ['get', 'data.items'], ['==', '$.category', 'food']]
// 식품이 하나라도 있는가?
```

### reduce

누적 연산:

```typescript
['reduce', 배열, 누적표현식, 초기값]
```

```typescript
// 총합 계산 (sum과 동일)
['reduce', ['get', 'data.prices'], ['+', '$acc', '$'], 0]

// 최대값 찾기 (max와 동일)
['reduce', ['get', 'data.scores'],
  ['case', [['>', '$', '$acc'], '$'], '$acc'],
  0
]
```

### 조작 함수

배열에 요소를 추가하는 함수:

| 함수 | 설명 | 예시 |
|------|------|------|
| `append` | 끝에 추가 | `['append', [1, 2], 3]` → `[1, 2, 3]` |
| `prepend` | 앞에 추가 | `['prepend', [1, 2], 0]` → `[0, 1, 2]` |

```typescript
// 장바구니에 상품 추가
['append', ['get', 'data.cartItems'], newItem]

// 긴급 메시지를 맨 앞에 추가
['prepend', ['get', 'data.messages'], urgentMessage]

// 단계별로 배열 구축
['append', ['append', [], 'first'], 'second']
// ['first', 'second']
```

### 함수형 패턴 함수

배열 조작을 위한 함수형 프로그래밍 패턴:

| 함수 | 설명 | 예시 |
|------|------|------|
| `take` | 앞에서 n개 | `['take', [1,2,3,4], 2]` → `[1, 2]` |
| `drop` | 앞에서 n개 제외 | `['drop', [1,2,3,4], 2]` → `[3, 4]` |
| `find` | 첫 매칭 요소 | `['find', arr, ['>', '$', 10]]` |
| `findIndex` | 첫 매칭 인덱스 | `['findIndex', arr, ['==', '$.id', 'x']]` |
| `isEmpty` | 비어있는지 체크 (다형성) | `['isEmpty', []]` → `true` |
| `range` | 숫자 범위 생성 | `['range', 1, 5]` → `[1, 2, 3, 4, 5]` |

```typescript
// 페이지네이션: 첫 10개 항목 가져오기
['take', ['get', 'data.items'], 10]

// 페이지네이션: 2페이지 (10개 건너뛰고 다음 10개)
['take', ['drop', ['get', 'data.items'], 10], 10]

// 미완료 할 일 중 첫 번째 찾기
['find', ['get', 'data.todos'], ['!', '$.completed']]
// 할 일 객체 반환 또는 undefined

// ID로 항목 인덱스 찾기
['findIndex', ['get', 'data.items'], ['==', '$.id', 'target-id']]
// 인덱스 반환 또는 -1

// 장바구니가 비어있는지 확인
['isEmpty', ['get', 'data.cartItems']]

// 페이지 번호 생성
['range', 1, ['get', 'derived.totalPages']]
// 5페이지인 경우 [1, 2, 3, 4, 5]
```

### 고급 변환 함수

데이터 처리를 위한 복잡한 변환:

| 함수 | 설명 | 예시 |
|------|------|------|
| `zip` | 두 배열의 요소를 쌍으로 묶기 | `['zip', [1,2], ['a','b']]` → `[[1,'a'], [2,'b']]` |
| `partition` | 조건으로 분리 | `['partition', arr, pred]` → `[truthy, falsy]` |
| `groupBy` | 키 표현식으로 그룹화 | `['groupBy', users, '$.role']` → `{admin: [...], user: [...]}` |
| `chunk` | 고정 크기로 분할 | `['chunk', [1,2,3,4], 2]` → `[[1,2], [3,4]]` |
| `compact` | falsy 값 제거 | `['compact', [0, 1, null, 2, '', 3]]` → `[1, 2, 3]` |

```typescript
// 이름과 점수를 쌍으로 묶기
['zip', ['get', 'data.names'], ['get', 'data.scores']]
// [['Alice', 95], ['Bob', 87], ['Carol', 92]]

// 활성/비활성 사용자 분리
['partition', ['get', 'data.users'], '$.isActive']
// [[활성 사용자들], [비활성 사용자들]]

// 상태별 주문 그룹화
['groupBy', ['get', 'data.orders'], '$.status']
// { pending: [...], shipped: [...], delivered: [...] }

// 페이지네이션용 청크 생성
['chunk', ['get', 'data.items'], 10]
// [[첫 10개], [다음 10개], ...]

// null과 빈 문자열 제거로 데이터 정리
['compact', ['get', 'data.optionalValues']]
// truthy 값만 남음
```

---

## 숫자 함수

| 함수 | 설명 | 예시 |
|------|------|------|
| `sum` | 합계 | `['sum', ['get', 'data.prices']]` |
| `min` | 최소값 | `['min', ['get', 'data.scores']]` |
| `max` | 최대값 | `['max', ['get', 'data.scores']]` |
| `avg` | 평균 | `['avg', ['get', 'data.ratings']]` |
| `count` | 개수 | `['count', ['get', 'data.items']]` |
| `round` | 반올림 | `['round', 3.7]` → `4` |
| `floor` | 내림 | `['floor', 3.9]` → `3` |
| `ceil` | 올림 | `['ceil', 3.1]` → `4` |
| `abs` | 절대값 | `['abs', -5]` → `5` |
| `clamp` | 범위 제한 | `['clamp', 15, 0, 10]` → `10` |

```typescript
// 주문 총액
['sum', ['map', ['get', 'data.items'], ['*', '$.price', '$.quantity']]]

// 가격 범위
['concat',
  ['toString', ['min', ['map', ['get', 'data.items'], '$.price']]],
  ' ~ ',
  ['toString', ['max', ['map', ['get', 'data.items'], '$.price']]]
]

// 세금 반올림 (소수점 2자리)
['round', ['*', ['get', 'derived.subtotal'], 0.1], 2]
```

---

## 문자열 함수

| 함수 | 설명 | 예시 |
|------|------|------|
| `concat` | 연결 (다형성) | `['concat', 'Hello', ' ', 'World']` |
| `upper` | 대문자 | `['upper', 'hello']` → `'HELLO'` |
| `lower` | 소문자 | `['lower', 'HELLO']` → `'hello'` |
| `trim` | 공백 제거 | `['trim', '  hello  ']` → `'hello'` |
| `slice` | 부분 문자열 (다형성) | `['slice', 'hello', 0, 2]` → `'he'` |
| `split` | 분할 | `['split', 'a,b,c', ',']` → `['a','b','c']` |
| `join` | 결합 | `['join', ['get', 'data.tags'], ', ']` |
| `matches` | 정규식 매칭 | `['matches', 'test@email.com', '^.+@.+$']` |
| `replace` | 치환 | `['replace', 'hello world', 'world', 'manifesto']` |

```typescript
// 전체 이름
['concat', ['get', 'data.lastName'], ' ', ['get', 'data.firstName']]

// 이메일 형식 검증
['matches', ['get', 'data.email'], '^[^@]+@[^@]+\\.[^@]+$']

// 상품 목록 문자열
['join', ['map', ['get', 'data.items'], '$.name'], ', ']
// '상품A, 상품B, 상품C'
```

---

## 객체 함수

| 함수 | 설명 | 예시 |
|------|------|------|
| `has` | 키 존재 확인 | `['has', ['get', 'data.user'], 'email']` |
| `keys` | 키 목록 | `['keys', ['get', 'data.user']]` |
| `values` | 값 목록 | `['values', ['get', 'data.user']]` |
| `entries` | 키-값 쌍 목록 | `['entries', ['get', 'data.user']]` |
| `pick` | 특정 키만 선택 | `['pick', ['get', 'data.user'], 'id', 'name']` |
| `omit` | 특정 키 제외 | `['omit', ['get', 'data.user'], 'password']` |
| `assoc` | 키-값 추가/수정 (불변) | `['assoc', obj, 'name', 'John']` |
| `dissoc` | 키 제거 (불변) | `['dissoc', obj, 'password']` |
| `merge` | 객체 병합 (불변) | `['merge', obj1, obj2]` |

```typescript
// 이메일 필드가 있는지 확인
['has', ['get', 'data.user'], 'email']

// 필요한 필드만 추출
['pick', ['get', 'data.order'], 'id', 'status', 'total']

// 민감 정보 제외
['omit', ['get', 'data.user'], 'password', 'ssn']

// 불변 객체 업데이트: 필드 추가/수정
['assoc', ['get', 'data.todo'], 'completed', true]

// 불변 객체 업데이트: 필드 제거
['dissoc', ['get', 'data.user'], 'temporaryToken']

// 기본값과 사용자 설정 병합
['merge', ['get', 'data.defaults'], ['get', 'data.userSettings']]
```

---

## 타입 함수

| 함수 | 설명 | 예시 |
|------|------|------|
| `isNull` | null 확인 | `['isNull', ['get', 'data.email']]` |
| `isNumber` | 숫자 확인 | `['isNumber', ['get', 'data.age']]` |
| `isString` | 문자열 확인 | `['isString', ['get', 'data.name']]` |
| `isArray` | 배열 확인 | `['isArray', ['get', 'data.items']]` |
| `isObject` | 객체 확인 | `['isObject', ['get', 'data.user']]` |
| `toNumber` | 숫자 변환 | `['toNumber', '42']` → `42` |
| `toString` | 문자열 변환 | `['toString', 42]` → `'42'` |

---

## 날짜 함수

| 함수 | 설명 | 예시 |
|------|------|------|
| `now` | 현재 시간 | `['now']` |
| `date` | 날짜 파싱 | `['date', '2024-01-15']` |
| `year` | 연도 추출 | `['year', ['get', 'data.createdAt']]` |
| `month` | 월 추출 | `['month', ['get', 'data.createdAt']]` |
| `day` | 일 추출 | `['day', ['get', 'data.createdAt']]` |
| `diff` | 날짜 차이 | `['diff', date1, date2, 'days']` |

```typescript
// 오늘 날짜
['now']

// 생성 후 경과 일수
['diff', ['now'], ['get', 'data.createdAt'], 'days']

// 올해 주문인지 확인
['==', ['year', ['get', 'data.orderDate']], ['year', ['now']]]
```

---

## 유틸리티 함수

| 함수 | 설명 | 예시 |
|------|------|------|
| `uuid` | UUID v4 생성 | `['uuid']` → `'550e8400-e29b-41d4-a716-446655440000'` |

```typescript
// 새 할 일 항목에 고유 ID 생성
['assoc', ['get', 'data.newTodo'], 'id', ['uuid']]

// 생성된 ID로 새 항목 추가
['append',
  ['get', 'data.todos'],
  {
    id: ['uuid'],
    text: ['get', 'data.inputText'],
    completed: false
  }
]
```

---

## Expression 평가

### evaluate() 함수

Expression을 평가하고 결과를 반환한다:

```typescript
function evaluate(expr: Expression, ctx: EvaluationContext): EvalResult

type EvalResult<T = unknown> =
  | { ok: true; value: T }
  | { ok: false; error: string };
```

```typescript
import { evaluate } from '@manifesto-ai/core';

const expr = ['+', ['get', 'data.price'], ['get', 'data.tax']];

const result = evaluate(expr, {
  get: (path) => {
    if (path === 'data.price') return 10000;
    if (path === 'data.tax') return 1000;
    return null;
  }
});

if (result.ok) {
  console.log(result.value);  // 11000
} else {
  console.log(result.error);  // 에러 메시지
}
```

### EvaluationContext 인터페이스

```typescript
type EvaluationContext = {
  /** 경로에서 값을 가져오는 함수 */
  get: (path: SemanticPath) => unknown;

  /** 현재 반복 항목 (map/filter 내부) */
  current?: unknown;

  /** 현재 인덱스 (map/filter 내부) */
  index?: number;

  /** 누적값 (reduce 내부) */
  accumulator?: unknown;
};
```

---

## 분석 도구

### extractPaths()

Expression에서 참조하는 모든 경로를 추출한다:

```typescript
import { extractPaths } from '@manifesto-ai/core';

const expr = ['all',
  ['>', ['get', 'data.age'], 18],
  ['!=', ['get', 'data.email'], null]
];

const paths = extractPaths(expr);
// ['data.age', 'data.email']
```

### analyzeExpression()

Expression의 상세 분석 결과를 반환한다:

```typescript
import { analyzeExpression } from '@manifesto-ai/core';

const analysis = analyzeExpression(expr);
// {
//   directDeps: ['data.items', 'data.discount'],
//   operators: ['sum', 'map', '*', 'get', '-'],
//   complexity: 8,
//   usesContext: true  // $ 참조 사용
// }
```

### isPureExpression()

Expression이 순수 함수인지(부수효과 없는지) 확인한다:

```typescript
import { isPureExpression } from '@manifesto-ai/core';

isPureExpression(['>', ['get', 'data.age'], 18]);  // true
```

### isConstantExpression()

Expression이 상수인지(외부 의존성 없는지) 확인한다:

```typescript
import { isConstantExpression } from '@manifesto-ai/core';

isConstantExpression(['+', 1, 2]);                    // true
isConstantExpression(['+', 1, ['get', 'data.x']]);   // false
```

### optimizeExpression()

Expression을 최적화한다:

```typescript
import { optimizeExpression } from '@manifesto-ai/core';

// 상수 폴딩
optimizeExpression(['+', 1, 2]);  // 3

// 불필요한 연산 제거
optimizeExpression(['!', ['!', ['get', 'data.flag']]]);
// ['get', 'data.flag']
```

---

## 실전 예시: 주문 도메인

```typescript
const orderDomain = defineDomain({
  // ...
  paths: {
    derived: {
      // 상품 수
      itemCount: defineDerived({
        deps: ['data.items'],
        expr: ['length', ['get', 'data.items']],
        semantic: { type: 'count', description: '상품 수' }
      }),

      // 소계
      subtotal: defineDerived({
        deps: ['data.items'],
        expr: ['sum', ['map', ['get', 'data.items'], ['*', '$.price', '$.quantity']]],
        semantic: { type: 'currency', description: '소계' }
      }),

      // 할인 금액 (10% 쿠폰)
      discount: defineDerived({
        deps: ['derived.subtotal', 'data.couponCode'],
        expr: ['case',
          [['==', ['get', 'data.couponCode'], 'SAVE10'],
           ['*', ['get', 'derived.subtotal'], 0.1]],
          0
        ],
        semantic: { type: 'currency', description: '할인 금액' }
      }),

      // 배송비 (5만원 이상 무료)
      shippingFee: defineDerived({
        deps: ['derived.subtotal'],
        expr: ['case',
          [['>=', ['get', 'derived.subtotal'], 50000], 0],
          3000
        ],
        semantic: { type: 'currency', description: '배송비' }
      }),

      // 총액
      total: defineDerived({
        deps: ['derived.subtotal', 'derived.discount', 'derived.shippingFee'],
        expr: ['+',
          ['-', ['get', 'derived.subtotal'], ['get', 'derived.discount']],
          ['get', 'derived.shippingFee']
        ],
        semantic: { type: 'currency', description: '총액' }
      }),

      // 결제 가능 여부
      canCheckout: defineDerived({
        deps: ['data.items', 'state.isSubmitting'],
        expr: ['all',
          ['>', ['length', ['get', 'data.items']], 0],
          ['!', ['get', 'state.isSubmitting']]
        ],
        semantic: { type: 'boolean', description: '결제 가능 여부' }
      }),

      // 주문 요약
      summary: defineDerived({
        deps: ['derived.itemCount', 'derived.total'],
        expr: ['concat',
          '총 ', ['toString', ['get', 'derived.itemCount']], '개 상품, ',
          ['toString', ['get', 'derived.total']], '원'
        ],
        semantic: { type: 'string', description: '주문 요약' }
      })
    }
  }
});
```

---

## 다음 단계

- [Effect 시스템](05-effect-system.md) - 부수효과 정의
- [DAG와 변경 전파](06-dag-propagation.md) - 의존성 추적
