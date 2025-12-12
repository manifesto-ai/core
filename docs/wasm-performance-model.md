# WASM 전환 성능 모델링

## 1. 현재 JS 구현의 병목점 분석

### 1.1 Expression Evaluator 병목점

```typescript
// 병목 1: 재귀 호출 오버헤드
function evalExpr(expr: Expression, ctx: EvaluationContext): unknown {
  // 매 호출마다: 함수 호출 스택, 클로저 생성, 인자 복사
  const [op, ...args] = expr;  // 배열 destructuring = 새 배열 할당

  switch (op) {  // 55개 분기 - JIT 최적화 어려움
    case '==':
      return evalExpr(args[0], ctx) === evalExpr(args[1], ctx);
      //     ^^^^^^^^^ 재귀    ^^^^^^^^^ 재귀
  }
}
```

| 병목 | 위치 | 영향도 |
|------|------|--------|
| 재귀 호출 오버헤드 | evalExpr 전체 | HIGH |
| 배열 destructuring | line 36 | MEDIUM |
| 객체 스프레드 (컨텍스트 복사) | line 377, 388, 399, 410, 423 | HIGH |
| switch 55개 분기 | line 38-286 | MEDIUM |
| RegExp 매번 생성 | line 131, 133 | MEDIUM |
| Array spread/copy | line 170, 174, 432 | LOW |

### 1.2 DAG Propagation 병목점

```typescript
// 병목 1: deepEqual 재귀 비교
function deepEqual(a: unknown, b: unknown): boolean {
  // 모든 키에 대해 재귀적으로 비교
  for (const key of aKeys) {
    if (!deepEqual(a[key], b[key])) return false;  // 재귀
  }
}

// 병목 2: Map 연산 오버헤드
const ctx: EvaluationContext = {
  get: (path) => {
    if (changes.has(path)) {  // Map.has
      return changes.get(path);  // Map.get
    }
    return snapshot.get(path);  // 또 다른 접근
  },
};
```

| 병목 | 위치 | 영향도 |
|------|------|--------|
| deepEqual 재귀 비교 | line 212-243 | HIGH |
| Map 연산 오버헤드 | line 54-58 | MEDIUM |
| 위상 정렬 반복 | getAffectedOrder | MEDIUM |
| 클로저 생성 | ctx 객체 | LOW |

---

## 2. 복잡도 분석

### 2.1 Expression 복잡도

| Expression 타입 | 시간 복잡도 | 예시 |
|-----------------|------------|------|
| 리터럴 | O(1) | `42`, `"hello"` |
| get | O(d) | `['get', 'data.a.b.c']` (d = depth) |
| 이항 연산 | O(L+R) | `['+', L, R]` |
| case/match | O(n × branch) | `['case', c1, r1, c2, r2, ...]` |
| map/filter | O(n × expr) | `['map', arr, expr]` |
| reduce | O(n × expr) | `['reduce', arr, expr, init]` |
| 중첩 | O(depth × branch) | 복합 표현식 |

**실제 예시 복잡도**:

```typescript
// PRD 예시: canBulkShip
['all',
  ['>', ['length', ['get', 'data.selectedIds']], 0],
  ['every', ['get', 'derived.selectedStatuses'], ['==', ['get', '$'], 'pending']]
]

// 분석:
// - all: 2개 조건
// - length + get: O(1) + O(1)
// - every: O(n) × O(1) where n = selectedStatuses.length
// 총: O(n) where n = 배열 크기
```

### 2.2 DAG Propagation 복잡도

| 연산 | 시간 복잡도 | 설명 |
|------|------------|------|
| getAffectedOrder | O(V + E) | 위상 정렬 (V=노드, E=엣지) |
| propagate loop | O(n × eval) | n = 영향받는 노드 수 |
| deepEqual | O(size) | size = 객체/배열 크기 |
| 총 전파 | O(V + E + n × (eval + deepEqual)) | |

---

## 3. 벤치마크 시나리오 모델링

### 3.1 시나리오 정의

| 시나리오 | 설명 | 파라미터 |
|----------|------|----------|
| **S1: 단순 폼** | 10개 필드, 5개 derived | nodes=15, depth=2 |
| **S2: 중형 대시보드** | 50개 필드, 30개 derived | nodes=80, depth=4 |
| **S3: 대형 테이블** | 1000행 × 10열, 집계 | nodes=50, array=10000 |
| **S4: 복잡한 규칙** | 깊은 중첩 조건문 | depth=10, branches=20 |
| **S5: 실시간 차트** | 100개 시계열 포인트 | nodes=100, updates/sec=60 |

### 3.2 연산량 추정

#### S1: 단순 폼 (1회 전파)

```
Expression 평가:
  - 5개 derived × 평균 3개 연산자 = 15회 evalExpr 호출
  - 컨텍스트 복사: 5회

deepEqual:
  - 5개 값 비교 × 평균 깊이 1 = 5회

총: ~25 연산 (매우 가벼움)
```

#### S2: 중형 대시보드 (1회 전파)

```
Expression 평가:
  - 30개 derived × 평균 5개 연산자 = 150회 evalExpr 호출
  - 일부 map/filter 포함: +50회
  - 컨텍스트 복사: 30회

deepEqual:
  - 30개 값 비교 × 평균 깊이 2 = 60회

총: ~290 연산
```

#### S3: 대형 테이블 (1회 전파)

```
Expression 평가:
  - 집계 연산 (sum, avg 등): 10000 요소 순회
  - filter/map 체인: 10000 × 3 = 30000회 evalExpr 호출
  - 컨텍스트 복사: 30000회 (객체 스프레드)

deepEqual:
  - 배열 비교: 10000 요소 순회

총: ~70000 연산 (병목 발생)
```

#### S4: 복잡한 규칙 (1회 평가)

```
Expression 평가:
  - 깊이 10, 분기 20: 2^10 최악 케이스
  - 실제 (early return 가정): ~100회 evalExpr
  - switch 분기 비용: 100 × O(log 55)

총: ~500 연산
```

#### S5: 실시간 차트 (1초간)

```
Expression 평가:
  - 60 updates × 100 nodes × 3 ops = 18000회/초

deepEqual:
  - 60 × 100 = 6000회/초

총: ~24000 연산/초 (16ms 프레임 내 ~400 연산)
```

---

## 4. JS vs Rust WASM 성능 비교 모델

### 4.1 연산별 예상 성능 비율

| 연산 | JS (상대) | Rust WASM (상대) | 개선 배율 | 근거 |
|------|----------|------------------|----------|------|
| 함수 호출 | 1.0 | 0.05 | **20x** | WASM 호출 스택 최적화 |
| switch 분기 | 1.0 | 0.2 | **5x** | 점프 테이블 최적화 |
| 객체 생성 | 1.0 | 0.1 | **10x** | 스택 할당 |
| 배열 순회 | 1.0 | 0.3 | **3x** | 캐시 지역성 |
| Map get/set | 1.0 | 0.4 | **2.5x** | HashMap 최적화 |
| deepEqual | 1.0 | 0.15 | **7x** | 인라인화 + SIMD |
| JSON 파싱 | 1.0 | 0.5 | **2x** | serde 최적화 |
| **FFI 오버헤드** | 0 | +0.1ms | - | 경계 비용 |

### 4.2 시나리오별 예상 성능

| 시나리오 | JS 예상 | Rust WASM 예상 | 개선 | 체감 |
|----------|---------|---------------|------|------|
| S1: 단순 폼 | 0.5ms | 0.15ms | 3x | 미미 |
| S2: 중형 대시보드 | 3ms | 0.5ms | **6x** | 눈에 띔 |
| S3: 대형 테이블 | 50ms | 5ms | **10x** | 극적 |
| S4: 복잡한 규칙 | 2ms | 0.3ms | **7x** | 눈에 띔 |
| S5: 실시간 차트 | 15ms/frame | 2ms/frame | **7x** | 필수적 |

### 4.3 FFI 오버헤드 분석

```
JSON 직렬화 (JS → WASM):
  - 작은 Expression (<1KB): ~0.05ms
  - 중간 Expression (1-10KB): ~0.2ms
  - 큰 Snapshot (100KB): ~1ms

JSON 역직렬화 (WASM → JS):
  - PropagationResult (작음): ~0.05ms
  - 대형 changes Map: ~0.5ms

총 FFI 오버헤드: 0.1ms ~ 1.5ms
```

**손익분기점**: 순수 계산 시간이 **2ms 이상**일 때 WASM이 유리

---

## 5. 메모리 모델

### 5.1 JS 현재 메모리 사용

```
Expression 평가 중:
  - 컨텍스트 객체 복사: n × 100 bytes (n = 배열 요소 수)
  - 중간 결과 배열: 10KB ~ 1MB
  - 클로저 캡처: 함수당 ~200 bytes

DAG Propagation 중:
  - changes Map: 노드 수 × 200 bytes
  - 평가 컨텍스트: ~500 bytes
  - 스냅샷 참조: 공유됨
```

### 5.2 Rust WASM 메모리 사용

```
Expression 평가 중:
  - 스택 기반 컨텍스트: 고정 ~1KB
  - 중간 결과: 힙 할당 최소화 (arena allocator)
  - 재사용 가능한 버퍼: ~10KB 풀

DAG Propagation 중:
  - changes HashMap: 노드 수 × 100 bytes (더 효율적)
  - 평가 컨텍스트: 스택 ~200 bytes
```

### 5.3 메모리 개선

| 항목 | JS | Rust WASM | 개선 |
|------|-----|-----------|------|
| 컨텍스트 복사 | n × 100B | 고정 1KB | **n배** |
| Map 엔트리 | 200B/entry | 100B/entry | **2x** |
| 중간 배열 | GC 의존 | arena | 예측 가능 |
| 피크 메모리 | ~5MB | ~2MB | **2.5x** |

---

## 6. 실제 벤치마크 설계

### 6.1 벤치마크 코드 (제안)

```typescript
// benchmark.ts
import { evaluate } from '@anthropic/manifesto-core';
import { evaluate as wasmEvaluate } from '@anthropic/manifesto-core-wasm';

const scenarios = {
  // S3: 대형 테이블
  largeTable: {
    expr: ['sum', ['map', ['get', 'data.rows'], ['get', '$.value']]],
    context: {
      'data.rows': Array.from({ length: 10000 }, (_, i) => ({ value: i })),
    },
  },

  // S4: 복잡한 규칙
  complexRules: {
    expr: generateDeepCase(10, 20), // 깊이 10, 분기 20
    context: { /* ... */ },
  },
};

async function benchmark(name: string, scenario: any) {
  const iterations = 1000;

  // JS
  const jsStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    evaluate(scenario.expr, { get: (p) => scenario.context[p] });
  }
  const jsTime = performance.now() - jsStart;

  // WASM
  const wasmStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    wasmEvaluate(
      JSON.stringify(scenario.expr),
      JSON.stringify(scenario.context)
    );
  }
  const wasmTime = performance.now() - wasmStart;

  console.log(`${name}:`);
  console.log(`  JS: ${(jsTime / iterations).toFixed(2)}ms/op`);
  console.log(`  WASM: ${(wasmTime / iterations).toFixed(2)}ms/op`);
  console.log(`  Speedup: ${(jsTime / wasmTime).toFixed(1)}x`);
}
```

### 6.2 예상 벤치마크 결과

```
S1: 단순 폼
  JS: 0.45ms/op
  WASM: 0.18ms/op (+ 0.08ms FFI)
  Speedup: 1.7x ❌ (FFI 오버헤드가 이득 상쇄)

S2: 중형 대시보드
  JS: 2.8ms/op
  WASM: 0.45ms/op (+ 0.15ms FFI)
  Speedup: 4.7x ✅

S3: 대형 테이블
  JS: 48ms/op
  WASM: 4.2ms/op (+ 0.8ms FFI)
  Speedup: 9.6x ✅✅

S4: 복잡한 규칙
  JS: 1.9ms/op
  WASM: 0.28ms/op (+ 0.1ms FFI)
  Speedup: 5.0x ✅

S5: 실시간 차트 (16ms 프레임)
  JS: 14ms (87% 프레임)
  WASM: 1.8ms (11% 프레임)
  Speedup: 7.8x ✅✅ (headroom 확보)
```

---

## 7. 결론 및 권장사항

### 7.1 WASM 전환이 유리한 경우

| 조건 | 예상 개선 | 권장 |
|------|----------|------|
| 배열 10000+ 요소 처리 | 8-12x | **강력 권장** |
| 60fps 실시간 업데이트 | 6-8x | **강력 권장** |
| 깊은 중첩 표현식 (depth > 5) | 5-7x | 권장 |
| 노드 100개 이상 DAG | 4-6x | 권장 |
| 일반적인 폼 (<50 필드) | 1-2x | 불필요 |

### 7.2 하이브리드 전략

```
┌─────────────────────────────────────────────────────────┐
│                   Decision Layer (TS)                   │
│  if (estimatedComplexity > THRESHOLD) {                │
│    return wasmEvaluate(expr, ctx);  // Rust WASM       │
│  } else {                                               │
│    return jsEvaluate(expr, ctx);    // Native JS       │
│  }                                                      │
└─────────────────────────────────────────────────────────┘

THRESHOLD 추정:
  - Expression 노드 수 > 50
  - 배열 요소 수 > 1000
  - DAG 노드 수 > 30
```

### 7.3 최종 성능 모델 요약

| 메트릭 | JS 현재 | Rust WASM | 비고 |
|--------|---------|-----------|------|
| 단순 표현식 | 0.5ms | 0.3ms | FFI 오버헤드 포함 |
| 복잡한 표현식 | 5ms | 0.7ms | **7x 개선** |
| 대형 배열 처리 | 50ms | 5ms | **10x 개선** |
| 메모리 피크 | 5MB | 2MB | **2.5x 개선** |
| 60fps 유지 가능 노드 수 | ~50 | ~400 | **8x 확장** |

---

## 8. 구현 로드맵 (성능 관점)

```
Phase 1: 벤치마크 인프라 (1일)
  - 현재 JS 성능 baseline 측정
  - 시나리오별 테스트 데이터 생성

Phase 2: Rust Core 구현 (1주)
  - Expression evaluator
  - deepEqual
  - 단위 테스트 + Golden test

Phase 3: WASM 바인딩 (2-3일)
  - wasm-bindgen 설정
  - JSON 직렬화 최적화
  - FFI 오버헤드 측정

Phase 4: 벤치마크 검증 (2일)
  - 예상 vs 실제 비교
  - 병목점 프로파일링
  - 최적화 반복

Phase 5: 하이브리드 통합 (2-3일)
  - 복잡도 추정 로직
  - 자동 전환 구현
  - 회귀 테스트
```

**예상 총 기간**: 2-3주 (벤치마크 검증 포함)
