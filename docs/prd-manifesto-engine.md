# PRD: manifesto-engine

**High-Performance Expression & DAG Engine for Manifesto**

---

## 1. Overview

### 1.1 Product Name

**`@anthropic/manifesto-engine`**

Alternative names considered:
- `manifesto-core-wasm` (too technical)
- `manifesto-turbo` (too marketing-y)
- `manifesto-rs` (too Rust-specific)

**선정 이유**: "engine"은 핵심 계산 로직을 담당한다는 의미를 명확히 전달하며, 기존 `manifesto-core`와의 관계(core가 engine을 사용)를 자연스럽게 표현함.

### 1.2 One-liner

> Rust/WASM으로 구현된 고성능 Expression 평가 및 DAG 전파 엔진

### 1.3 Problem Statement

현재 `manifesto-core`의 Expression Evaluator와 DAG Propagation은 순수 TypeScript로 구현되어 있음. 이로 인해:

1. **대형 데이터셋 처리 시 성능 병목** - 10,000행 테이블에서 50ms+ 소요
2. **실시간 업데이트 제약** - 60fps 유지 어려움 (14ms/frame 소요)
3. **재귀 호출 오버헤드** - 깊은 중첩 표현식에서 스택 압박
4. **메모리 비효율** - 객체 스프레드로 인한 과도한 GC 압박

### 1.4 Solution

핵심 계산 로직만 Rust로 재구현하여 WASM으로 컴파일, `manifesto-core`에서 drop-in replacement로 사용.

```
┌─────────────────────────────────────────────────────────┐
│                  @anthropic/manifesto-core              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │ Zod 검증    │  │ Subscription│  │ Effect Runner   │  │
│  │ (TS)        │  │ (TS)        │  │ (TS)            │  │
│  └──────┬──────┘  └──────┬──────┘  └────────┬────────┘  │
│         │                │                  │           │
│         ▼                ▼                  ▼           │
│  ┌─────────────────────────────────────────────────────┐│
│  │           @anthropic/manifesto-engine               ││
│  │                    (Rust WASM)                      ││
│  │  ┌──────────────────┐  ┌──────────────────────────┐ ││
│  │  │ evaluate()       │  │ propagate()              │ ││
│  │  │ parseExpression()│  │ topologicalSort()        │ ││
│  │  │ extractPaths()   │  │ analyzeImpact()          │ ││
│  │  └──────────────────┘  └──────────────────────────┘ ││
│  └─────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

---

## 2. Goals & Non-Goals

### 2.1 Goals

| # | Goal | Success Metric |
|---|------|----------------|
| G1 | 대형 배열 처리 성능 10x 향상 | 10K 요소 처리 < 5ms |
| G2 | 60fps 실시간 업데이트 지원 | 프레임당 계산 < 2ms |
| G3 | 기존 API 100% 호환성 유지 | 모든 기존 테스트 통과 |
| G4 | 메모리 사용량 50% 절감 | 피크 메모리 < 2.5MB |
| G5 | 번들 사이즈 최소화 | WASM < 100KB gzipped |

### 2.2 Non-Goals

| # | Non-Goal | 이유 |
|---|----------|------|
| NG1 | Effect Runner 포팅 | async/await 복잡성, TS 유지가 효율적 |
| NG2 | Zod 스키마 대체 | 런타임 검증은 TS에서 처리 |
| NG3 | Subscription 시스템 포팅 | JS 이벤트 루프 의존 |
| NG4 | Node.js Native Addon | 브라우저 호환성 우선 |
| NG5 | 자체 직렬화 포맷 | JSON 호환성 유지 |

---

## 3. Scope

### 3.1 In Scope

#### Phase 1: Core Engine (v0.1.0)

| 모듈 | 함수 | 우선순위 |
|------|------|----------|
| **Expression** | `evaluate(expr, context)` | P0 |
| **Expression** | `parseExpression(json)` | P0 |
| **Expression** | `isValidExpression(expr)` | P1 |
| **Expression** | `extractPaths(expr)` | P1 |
| **DAG** | `propagate(graph, changedPaths, snapshot)` | P0 |
| **DAG** | `topologicalSort(graph)` | P0 |
| **DAG** | `analyzeImpact(graph, path)` | P1 |
| **Util** | `deepEqual(a, b)` | P0 |

#### Phase 2: Optimization (v0.2.0)

| 기능 | 설명 |
|------|------|
| SIMD 최적화 | 배열 연산 벡터화 |
| Arena Allocator | 메모리 풀링 |
| Expression Caching | 파싱 결과 캐싱 |
| Parallel Evaluation | 독립 표현식 병렬 평가 |

### 3.2 Out of Scope

- Effect 실행 (TS 유지)
- Subscription 관리 (TS 유지)
- Schema 검증 (Zod 유지)
- Runtime 통합 레이어 (TS thin wrapper)

---

## 4. Technical Design

### 4.1 Package Structure

```
packages/engine/
├── Cargo.toml
├── src/
│   ├── lib.rs              # WASM 엔트리포인트
│   ├── expression/
│   │   ├── mod.rs
│   │   ├── types.rs        # Expression AST
│   │   ├── parser.rs       # JSON → AST
│   │   ├── evaluator.rs    # 평가 엔진
│   │   └── operators/      # 연산자별 구현
│   │       ├── mod.rs
│   │       ├── comparison.rs
│   │       ├── logical.rs
│   │       ├── arithmetic.rs
│   │       ├── string.rs
│   │       ├── array.rs
│   │       └── ...
│   ├── dag/
│   │   ├── mod.rs
│   │   ├── graph.rs        # 그래프 구조
│   │   ├── topological.rs  # 위상 정렬
│   │   └── propagation.rs  # 전파 로직
│   └── util/
│       ├── mod.rs
│       └── deep_equal.rs
├── tests/
│   ├── expression_tests.rs
│   ├── dag_tests.rs
│   └── golden/             # Golden test fixtures
│       ├── literals.json
│       ├── array_ops.json
│       └── ...
├── benches/
│   ├── expression_bench.rs
│   └── propagation_bench.rs
└── pkg/                    # wasm-pack 출력
    ├── package.json
    ├── manifesto_engine.js
    ├── manifesto_engine.d.ts
    └── manifesto_engine_bg.wasm
```

### 4.2 API Design

#### TypeScript Interface (생성됨)

```typescript
// pkg/manifesto_engine.d.ts

/**
 * Expression 평가
 * @param exprJson - Expression AST (JSON string)
 * @param contextJson - EvaluationContext (JSON string)
 * @returns EvaluationResult (JSON string)
 */
export function evaluate(exprJson: string, contextJson: string): string;

/**
 * Expression 파싱 및 검증
 * @param json - JSON string
 * @returns ParseResult (JSON string)
 */
export function parseExpression(json: string): string;

/**
 * Expression 유효성 검사
 * @param exprJson - Expression AST (JSON string)
 * @returns boolean
 */
export function isValidExpression(exprJson: string): boolean;

/**
 * Expression에서 경로 추출
 * @param exprJson - Expression AST (JSON string)
 * @returns string[] (JSON string)
 */
export function extractPaths(exprJson: string): string;

/**
 * DAG 전파
 * @param graphJson - DependencyGraph (JSON string)
 * @param changedPathsJson - string[] (JSON string)
 * @param snapshotJson - Snapshot values (JSON string)
 * @returns PropagationResult (JSON string)
 */
export function propagate(
  graphJson: string,
  changedPathsJson: string,
  snapshotJson: string
): string;

/**
 * 위상 정렬
 * @param graphJson - DependencyGraph (JSON string)
 * @returns string[] (JSON string)
 */
export function topologicalSort(graphJson: string): string;

/**
 * 영향 분석
 * @param graphJson - DependencyGraph (JSON string)
 * @param path - SemanticPath
 * @returns ImpactAnalysis (JSON string)
 */
export function analyzeImpact(graphJson: string, path: string): string;

/**
 * 깊은 동등성 비교
 * @param aJson - 값 A (JSON string)
 * @param bJson - 값 B (JSON string)
 * @returns boolean
 */
export function deepEqual(aJson: string, bJson: string): boolean;
```

#### Rust Internal Types

```rust
// src/expression/types.rs

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum Expression {
    Null,
    Bool(bool),
    Number(f64),
    String(String),
    Array(Vec<Expression>),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvaluationContext {
    pub values: std::collections::HashMap<String, serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub current: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub index: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub accumulator: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "ok")]
pub enum EvaluationResult {
    #[serde(rename = "true")]
    Ok { value: serde_json::Value },
    #[serde(rename = "false")]
    Err { error: String },
}
```

### 4.3 Data Flow

```
┌──────────────────────────────────────────────────────────────┐
│                        TypeScript                            │
│                                                              │
│  const expr = ['map', ['get', 'data.items'], ['+', ['get', '$'], 1]];
│  const ctx = { values: { 'data.items': [1, 2, 3] } };        │
│                            │                                 │
│                            ▼                                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           JSON.stringify()                            │   │
│  │  expr → '["map",["get","data.items"],["+",["get","$"],1]]'
│  │  ctx  → '{"values":{"data.items":[1,2,3]}}'          │   │
│  └──────────────────────────────────────────────────────┘   │
│                            │                                 │
└────────────────────────────┼─────────────────────────────────┘
                             │ WASM FFI Boundary
┌────────────────────────────┼─────────────────────────────────┐
│                            ▼            Rust WASM            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           serde_json::from_str()                      │   │
│  │  Parse JSON → Expression AST + EvaluationContext      │   │
│  └──────────────────────────────────────────────────────┘   │
│                            │                                 │
│                            ▼                                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           evaluate()                                  │   │
│  │  - Pattern match on operator                         │   │
│  │  - Recursive evaluation (stack-based)                │   │
│  │  - No heap allocation for context                    │   │
│  └──────────────────────────────────────────────────────┘   │
│                            │                                 │
│                            ▼                                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           serde_json::to_string()                     │   │
│  │  EvaluationResult → '{"ok":"true","value":[2,3,4]}'  │   │
│  └──────────────────────────────────────────────────────┘   │
│                            │                                 │
└────────────────────────────┼─────────────────────────────────┘
                             │ WASM FFI Boundary
┌────────────────────────────┼─────────────────────────────────┐
│                            ▼            TypeScript           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           JSON.parse()                                │   │
│  │  '{"ok":"true","value":[2,3,4]}' → { ok: true, ... } │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  Result: [2, 3, 4]                                          │
└──────────────────────────────────────────────────────────────┘
```

### 4.4 Operator Implementation Matrix

| 카테고리 | 연산자 수 | 복잡도 | 구현 전략 |
|----------|----------|--------|----------|
| 접근 | 1 (`get`) | LOW | 단순 HashMap 조회 |
| 비교 | 6 | LOW | 직접 비교 |
| 논리 | 3 | LOW | short-circuit 평가 |
| 산술 | 5 | LOW | 직접 계산 |
| 조건 | 3 | MEDIUM | lazy 평가 |
| 문자열 | 9 | MEDIUM | Rust String 메서드 |
| 배열 | 15 | HIGH | Iterator 활용 |
| 숫자 | 10 | LOW | std 라이브러리 |
| 객체 | 6 | MEDIUM | HashMap 연산 |
| 타입 | 7 | LOW | 타입 체크 |
| 날짜 | 6 | MEDIUM | chrono 크레이트 |
| **총** | **71** | | |

### 4.5 Error Handling

```rust
#[derive(Debug, Serialize)]
pub struct EngineError {
    pub code: ErrorCode,
    pub message: String,
    pub path: Option<String>,
    pub context: Option<serde_json::Value>,
}

#[derive(Debug, Serialize)]
pub enum ErrorCode {
    // Parse errors
    InvalidJson,
    InvalidExpression,

    // Evaluation errors
    UnknownOperator,
    TypeError,
    PathNotFound,
    DivisionByZero,
    IndexOutOfBounds,

    // DAG errors
    CycleDetected,
    NodeNotFound,
}
```

---

## 5. Integration Guide

### 5.1 manifesto-core 통합

```typescript
// packages/core/src/expression/evaluator.ts

import * as engine from '@anthropic/manifesto-engine';

// 복잡도 임계값
const WASM_THRESHOLD = {
  arraySize: 1000,
  nodeCount: 50,
  exprDepth: 5,
};

export function evaluate(
  expr: Expression,
  ctx: EvaluationContext
): EvalResult {
  // 복잡도 추정
  const complexity = estimateComplexity(expr, ctx);

  if (shouldUseWasm(complexity)) {
    // Rust WASM 사용
    const resultJson = engine.evaluate(
      JSON.stringify(expr),
      JSON.stringify({ values: ctx.values, current: ctx.current })
    );
    return JSON.parse(resultJson);
  } else {
    // 기존 JS 구현 사용
    return evaluateJS(expr, ctx);
  }
}

function shouldUseWasm(complexity: Complexity): boolean {
  return (
    complexity.arraySize > WASM_THRESHOLD.arraySize ||
    complexity.nodeCount > WASM_THRESHOLD.nodeCount ||
    complexity.exprDepth > WASM_THRESHOLD.exprDepth
  );
}
```

### 5.2 Standalone 사용

```typescript
import * as engine from '@anthropic/manifesto-engine';

// 직접 사용
const result = engine.evaluate(
  '["map", ["get", "items"], ["+", ["get", "$"], 1]]',
  '{"values": {"items": [1, 2, 3]}}'
);

console.log(JSON.parse(result));
// { ok: true, value: [2, 3, 4] }
```

### 5.3 번들러 설정

```javascript
// vite.config.js
import wasm from 'vite-plugin-wasm';

export default {
  plugins: [wasm()],
  optimizeDeps: {
    exclude: ['@anthropic/manifesto-engine'],
  },
};
```

```javascript
// webpack.config.js
module.exports = {
  experiments: {
    asyncWebAssembly: true,
  },
};
```

---

## 6. Testing Strategy

### 6.1 Test Levels

| Level | 도구 | 범위 |
|-------|------|------|
| Unit (Rust) | `cargo test` | 개별 함수 |
| Golden (Rust) | `insta` | 입출력 스냅샷 |
| Property (Rust) | `proptest` | 불변식 검증 |
| Integration (TS) | `vitest` | WASM 바인딩 |
| Compatibility (TS) | `vitest` | JS vs WASM 일치 |
| Benchmark (Rust) | `criterion` | 성능 측정 |

### 6.2 Golden Test Fixtures

```json
// tests/golden/array_map.json
{
  "name": "array_map_add_one",
  "input": {
    "expr": ["map", ["get", "items"], ["+", ["get", "$"], 1]],
    "context": { "values": { "items": [1, 2, 3, 4, 5] } }
  },
  "expected": {
    "ok": true,
    "value": [2, 3, 4, 5, 6]
  }
}
```

### 6.3 Compatibility Test

```typescript
// tests/compatibility.test.ts
import { evaluate as jsEvaluate } from '../src/expression/evaluator';
import * as engine from '@anthropic/manifesto-engine';

describe('JS/WASM Compatibility', () => {
  const testCases = loadGoldenTests();

  for (const tc of testCases) {
    it(`${tc.name} produces identical results`, () => {
      const jsResult = jsEvaluate(tc.input.expr, tc.input.context);
      const wasmResult = JSON.parse(
        engine.evaluate(
          JSON.stringify(tc.input.expr),
          JSON.stringify(tc.input.context)
        )
      );

      expect(wasmResult).toEqual(jsResult);
    });
  }
});
```

### 6.4 Property Tests

```rust
// tests/property_tests.rs
use proptest::prelude::*;

proptest! {
    #[test]
    fn parse_stringify_roundtrip(expr in arb_expression()) {
        let json = serde_json::to_string(&expr).unwrap();
        let parsed: Expression = serde_json::from_str(&json).unwrap();
        prop_assert_eq!(expr, parsed);
    }

    #[test]
    fn evaluate_deterministic(expr in arb_expression(), ctx in arb_context()) {
        let result1 = evaluate(&expr, &ctx);
        let result2 = evaluate(&expr, &ctx);
        prop_assert_eq!(result1, result2);
    }

    #[test]
    fn propagate_idempotent(graph in arb_graph(), paths in arb_paths()) {
        let snapshot1 = create_snapshot();
        let result1 = propagate(&graph, &paths, &snapshot1);

        let snapshot2 = apply_changes(&snapshot1, &result1.changes);
        let result2 = propagate(&graph, &paths, &snapshot2);

        prop_assert!(result2.changes.is_empty());
    }
}
```

---

## 7. Performance Targets

### 7.1 Benchmarks

| 시나리오 | JS Baseline | Target | 최소 개선 |
|----------|-------------|--------|----------|
| 10K 배열 map | 50ms | < 5ms | 10x |
| 깊은 중첩 (depth=10) | 2ms | < 0.4ms | 5x |
| 100노드 DAG 전파 | 20ms | < 3ms | 6x |
| deepEqual (100 keys) | 0.5ms | < 0.1ms | 5x |
| 60fps 유지 (100노드) | 14ms/frame | < 2ms/frame | 7x |

### 7.2 Bundle Size

| 항목 | Target |
|------|--------|
| WASM (raw) | < 300KB |
| WASM (gzipped) | < 100KB |
| JS glue code | < 10KB |
| Total (gzipped) | < 110KB |

### 7.3 Memory

| 메트릭 | Target |
|--------|--------|
| 피크 메모리 | < 2.5MB |
| 10K 배열 처리 시 | < 5MB |
| GC 압박 | JS 대비 50% 감소 |

---

## 8. Rollout Plan

### 8.1 Timeline

```
Week 1-2: Core Implementation
  ├── Day 1-2: Project setup, Cargo.toml, wasm-bindgen
  ├── Day 3-5: Expression types + parser
  ├── Day 6-8: Expression evaluator (55 operators)
  └── Day 9-10: Unit tests + Golden tests

Week 3: DAG Implementation
  ├── Day 1-2: Graph structure
  ├── Day 3-4: Topological sort + propagation
  └── Day 5: Integration tests

Week 4: Integration & Optimization
  ├── Day 1-2: manifesto-core 통합
  ├── Day 3-4: Benchmark + 최적화
  └── Day 5: Documentation

Week 5: Release
  ├── Day 1-2: Compatibility testing
  ├── Day 3: npm publish (beta)
  ├── Day 4-5: Bug fixes
  └── Day 5: v0.1.0 release
```

### 8.2 Release Strategy

| 버전 | 내용 | 배포 |
|------|------|------|
| v0.1.0-alpha | Expression evaluator | npm (alpha tag) |
| v0.1.0-beta | + DAG propagation | npm (beta tag) |
| v0.1.0 | 안정화 + 문서화 | npm (latest) |
| v0.2.0 | SIMD + 캐싱 최적화 | npm (latest) |

### 8.3 Feature Flags

```typescript
// manifesto-core에서 점진적 활성화
const FEATURE_FLAGS = {
  // v0.1.0: 기본 비활성화, opt-in
  WASM_EXPRESSION: process.env.MANIFESTO_WASM_EXPRESSION === 'true',

  // v0.2.0: 기본 활성화, opt-out 가능
  WASM_DAG: process.env.MANIFESTO_WASM_DAG !== 'false',

  // v0.3.0: 자동 선택 (복잡도 기반)
  WASM_AUTO: process.env.MANIFESTO_WASM_AUTO !== 'false',
};
```

---

## 9. Risks & Mitigations

| 리스크 | 확률 | 영향 | 대응 |
|--------|------|------|------|
| JS/WASM 결과 불일치 | MEDIUM | HIGH | Golden test 강화, truthy/falsy 규칙 문서화 |
| WASM 로딩 지연 | LOW | MEDIUM | async init + fallback to JS |
| 번들 사이즈 초과 | LOW | MEDIUM | wasm-opt 최적화, 코드 스플리팅 |
| 브라우저 호환성 | LOW | HIGH | Can I Use 체크, polyfill 준비 |
| 메모리 누수 | LOW | HIGH | Rust ownership으로 자동 해결 |
| 디버깅 어려움 | MEDIUM | MEDIUM | source-map, 상세 에러 메시지 |

---

## 10. Success Metrics

### 10.1 Launch Criteria (v0.1.0)

- [ ] 모든 기존 테스트 통과 (JS/WASM 동일 결과)
- [ ] 10K 배열 처리 < 5ms (10x 개선)
- [ ] 번들 사이즈 < 100KB gzipped
- [ ] Chrome, Firefox, Safari, Edge 지원
- [ ] TypeScript 타입 정의 완비
- [ ] README + API 문서

### 10.2 Success Metrics (3개월 후)

| 메트릭 | Target |
|--------|--------|
| 대형 앱 도입 | 3개 이상 |
| 성능 관련 이슈 | 50% 감소 |
| npm 주간 다운로드 | 1K+ |
| GitHub Stars | 100+ |

---

## 11. Open Questions

| # | 질문 | 담당 | 기한 |
|---|------|------|------|
| Q1 | Node.js Native Addon 지원 필요? | PM | Week 1 |
| Q2 | SIMD 최적화 Phase 1 포함? | Eng | Week 1 |
| Q3 | `now` 연산자 - 서버 시간 주입 방식? | Eng | Week 2 |
| Q4 | 캐싱 전략 (LRU? TTL?) | Eng | Week 3 |

---

## Appendix

### A. Dependencies

```toml
# Cargo.toml
[package]
name = "manifesto-engine"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib", "rlib"]

[dependencies]
wasm-bindgen = "0.2"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
indexmap = { version = "2.0", features = ["serde"] }
thiserror = "1.0"

[dev-dependencies]
wasm-bindgen-test = "0.3"
proptest = "1.0"
criterion = "0.5"
insta = { version = "1.0", features = ["json"] }

[profile.release]
opt-level = "s"      # 사이즈 최적화
lto = true           # Link-Time Optimization
```

### B. Browser Compatibility

| 브라우저 | 최소 버전 | WASM 지원 |
|----------|----------|----------|
| Chrome | 57+ | ✅ |
| Firefox | 52+ | ✅ |
| Safari | 11+ | ✅ |
| Edge | 16+ | ✅ |
| iOS Safari | 11+ | ✅ |
| Android Chrome | 57+ | ✅ |

### C. Related Documents

- [manifesto-core Analysis Report](./manifesto-core-analysis-report.md)
- [WASM Performance Model](./wasm-performance-model.md)
