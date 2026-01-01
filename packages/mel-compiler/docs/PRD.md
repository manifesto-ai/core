# MEL Compiler — Product Requirements Document (PRD)

> **Version:** 1.0  
> **Status:** Draft  
> **Author:** Manifesto Team  
> **Created:** 2025-01-01  
> **Last Updated:** 2025-01-01

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Vision & Goals](#3-vision--goals)
4. [Users & Stakeholders](#4-users--stakeholders)
5. [Functional Requirements](#5-functional-requirements)
6. [Non-Functional Requirements](#6-non-functional-requirements)
7. [Technical Decisions](#7-technical-decisions)
8. [Milestones & Phases](#8-milestones--phases)
9. [Success Metrics](#9-success-metrics)
10. [Dependencies & Constraints](#10-dependencies--constraints)
11. [Risks & Mitigations](#11-risks--mitigations)
12. [Open Questions](#12-open-questions)
13. [Appendix](#13-appendix)

---

## 1. Executive Summary

### 1.1 One-Liner

**MEL Compiler**는 MEL(Manifesto Expression Language) 소스 코드를 Manifesto Schema IR로 변환하는 컴파일러입니다.

### 1.2 Background

Manifesto는 AI-Native Semantic State Engine으로, LLM 에이전트가 도메인 상태를 이해하고 조작할 수 있는 시스템입니다. MEL은 이 시스템의 도메인 정의를 위한 순수하고 결정론적인 언어입니다.

현재 상태:
- ✅ MEL SPEC v0.3.2 완성 (Core Alignment)
- ✅ MEL FDR v0.3.2 완성 (61 FDR entries)
- ❌ 컴파일러 구현 없음
- ❌ SPEC 실전 검증 없음

**v0.3.2 핵심 변경사항:**
- System values (`$system.*`)를 Effects로 처리
- 컴파일러가 `system.get` effects 자동 삽입
- `__sys__` namespace 예약
- Intent-based readiness guards로 stale value 방지
- **available, fail, stop 문법 추가 (Core Alignment)**

### 1.3 Scope

**In Scope:**
- MEL 소스 파싱 (Lexer + Parser)
- AST 생성 및 검증
- **System Value Lowering (`$system.*` → `system.get` effects)** ← v0.3.0
- **Flow Control (available, fail, stop)** ← v0.3.2
- Manifesto Schema IR 생성
- CLI 도구
- 기본적인 에러 리포팅

**Out of Scope (Phase 1):**
- LSP (Language Server Protocol)
- VSCode Extension
- Web Playground
- Formatter / Linter
- Incremental Compilation
- Source Maps

---

## 2. Problem Statement

### 2.1 Current Pain Points

```
문제 1: 스키마 직접 작성의 복잡성
─────────────────────────────────
현재 Manifesto 도메인을 정의하려면 JSON Schema를 직접 작성해야 함.

// 현재: 장황하고 오류 발생 쉬움
{
  "computed": {
    "total": {
      "kind": "mul",
      "left": { "kind": "get", "path": ["price"] },
      "right": { "kind": "get", "path": ["quantity"] }
    }
  }
}

// 원하는 것: 간결하고 명확
computed total = mul(price, quantity)
```

```
문제 2: LLM 생성의 어려움
───────────────────────
LLM이 JSON Schema IR을 직접 생성하면:
- 구조 오류 발생 빈번
- 중첩이 깊어 토큰 비효율
- 검증 어려움

MEL로 생성하면:
- 선형적 구조로 생성 용이
- 문법 오류 즉시 감지
- 토큰 효율적
```

```
문제 3: SPEC 검증 불가
────────────────────
MEL SPEC v0.3.2가 완성되었으나:
- 실제 파싱 가능한지 미확인
- 문법 모호성 미발견
- 엣지 케이스 미테스트
- System Value Lowering 구현 미검증
- Flow Control (available, fail, stop) 구현 미검증
```

### 2.2 Why Now?

1. **SPEC 완성**: MEL v0.3.2 SPEC과 FDR이 완성, Architecture Review 통과
2. **AI-Native 검증**: 컴파일러가 있어야 LLM 생성 → 검증 → 실행 파이프라인 테스트 가능
3. **Manifesto 통합**: Core 런타임과 통합하여 E2E 검증 필요
4. **Core Purity 보장**: System Value Lowering 구현으로 Core 순수성 검증
5. **Core Alignment**: available, fail, stop으로 Core FlowNode 완전 지원

---

## 3. Vision & Goals

### 3.1 Vision Statement

> MEL Compiler는 **인간과 AI 모두**가 Manifesto 도메인을 정의할 수 있는 **단일 진입점**이다.

### 3.2 Goals

| Priority | Goal | Success Criteria |
|----------|------|------------------|
| **P0** | SPEC 검증 | 모든 SPEC 예제가 파싱되고 올바른 IR 생성 |
| **P0** | Core 통합 | 생성된 IR이 Manifesto Core에서 실행 가능 |
| **P1** | 친절한 에러 | 문법 오류 시 라인/컬럼 + 제안 제공 |
| **P1** | CLI 제공 | `mel compile`, `mel check` 명령 동작 |
| **P2** | 프로그래매틱 API | TypeScript에서 직접 호출 가능 |
| **P2** | 브라우저 지원 | 번들링 후 브라우저에서 실행 가능 |

### 3.3 Non-Goals (Phase 1)

- IDE 통합 (LSP, Extension)
- 코드 포맷팅
- 실시간 타입 추론
- 다른 언어로의 컴파일 (JS, Rust 등)

---

## 4. Users & Stakeholders

### 4.1 Primary Users

| User | Description | Needs |
|------|-------------|-------|
| **Human Developer** | Manifesto 앱 개발자 | MEL로 도메인 정의, 에러 이해, IDE 지원 |
| **LLM Agent** | 도메인 조작 AI | MEL 생성 → 검증 → IR 획득 |
| **Manifesto Core** | 런타임 엔진 | 유효한 Schema IR 수신 |

### 4.2 Stakeholders

| Stakeholder | Interest |
|-------------|----------|
| **Manifesto Team** | 아키텍처 일관성, 통합 용이성 |
| **Future Contributors** | 코드 가독성, 문서화 |
| **Downstream Tools** | 안정적인 API, 버전 호환성 |

### 4.3 User Stories

```
US-1: 개발자로서, .mel 파일을 작성하여 도메인을 정의하고 싶다.
      → CLI로 컴파일하여 schema.json 생성

US-2: 개발자로서, 문법 오류 시 어디가 잘못됐는지 알고 싶다.
      → "Line 5, Column 12: Expected '=' after identifier"

US-3: LLM으로서, 생성한 MEL 코드가 유효한지 즉시 확인하고 싶다.
      → compile() 호출 → 성공/실패 + 에러 목록

US-4: Manifesto Core로서, MEL에서 생성된 IR을 신뢰하고 실행하고 싶다.
      → 컴파일러가 생성한 IR은 항상 Schema 타입 준수

US-5: 개발자로서, 빌드 파이프라인에 MEL 컴파일을 통합하고 싶다.
      → npm 패키지로 설치, CLI 또는 API 호출
```

---

## 5. Functional Requirements

### 5.1 Core Features

#### FR-1: Lexical Analysis (Lexer)

```
입력: MEL 소스 코드 (string)
출력: Token[]

요구사항:
├── 모든 MEL 토큰 인식 (키워드, 연산자, 리터럴, 식별자)
├── 주석 처리 (// 및 /* */)
├── 위치 정보 포함 (line, column, offset)
├── 유효하지 않은 문자 감지 및 에러 리포트
└── UTF-8 소스 지원
```

#### FR-2: Syntactic Analysis (Parser)

```
입력: Token[]
출력: AST (Abstract Syntax Tree)

요구사항:
├── MEL SPEC v0.3.2 문법 완전 지원
├── 연산자 우선순위 정확히 처리
├── 문법 오류 시 복구 및 계속 파싱 (다중 에러 리포트)
├── 위치 정보 AST 노드에 보존
├── 중첩 Effect 감지 및 거부 (FDR-MEL-018)
├── $system.* 참조를 sys AST 노드로 파싱
├── available when <Expr> 파싱 (v0.3.2)
├── fail "CODE" with "msg" 파싱 (v0.3.2)
└── stop "reason" 파싱 (v0.3.2)
```

#### FR-3: Semantic Analysis

```
입력: AST
출력: Validated AST + Diagnostics

요구사항:
├── 식별자 스코프 검증 (정의되지 않은 변수 감지)
├── 시스템 식별자 검증 ($system, $meta, $input, $item, $acc)
├── $system.* 사용 위치 검증 (action만 허용, computed/init 금지)
├── __sys__ 프리픽스 사용자 정의 금지 (FDR-MEL-055)
├── computed에서 effect 사용 금지 확인
├── 타입 호환성 기본 검사 (리터럴 타입)
└── 중복 정의 감지

Compile Errors (v0.3.2):
├── E001: $system.* in computed
├── E002: $system.* in state init  
├── E003: Invalid $system reference format
├── E004: User identifier starts with __sys__
├── E005: available expression must be pure (no Effects, no $system.*)
├── E006: fail must be inside a guard (when or once)
├── E007: stop must be inside a guard (when or once)
├── E008: stop message suggests waiting/pending (lint)
├── E009: Primitive aggregation only allowed in computed
├── E010: Primitive aggregation does not allow composition
└── E011: reduce/fold/scan is forbidden
```

#### FR-4: System Value Lowering (v0.3.1)

```
입력: Validated AST with $system.* references
출력: Lowered AST with system.get effects

v0.3.1 핵심 기능 — FDR-MEL-051, 055, 056

요구사항:
├── $system.<key> 참조를 system.get effect로 변환
├── action별 unique key마다 state slot 생성:
│   ├── __sys__<action>_<key>_value: T | null
│   └── __sys__<action>_<key>_intent: string | null
├── acquisition guard 삽입:
│   once(__sys__<A>_<K>_intent) {
│     patch __sys__<A>_<K>_intent = $meta.intentId
│     effect system.get({ key: "<K>", into: __sys__<A>_<K>_value })
│   }
├── $system.<key> → __sys__<A>_<K>_value로 rewrite
├── User guard에 readiness 조건 추가:
│   eq(__sys__<A>_<K>_intent, $meta.intentId)
└── Same key deduplication (동일 action 내)

금지 패턴 (A27):
├── ❌ isNotNull(value) as readiness
└── ✅ eq(intent_marker, $meta.intentId) as readiness
```

#### FR-5: IR Generation

```
입력: Validated AST
출력: Manifesto Schema (JSON-compatible object)

요구사항:
├── 모든 AST 노드 → ExprNode 변환
├── once() 디슈가링 (when + patch 확장)
├── 인덱스 문법 디슈가링 (arr[i] → at(arr, i))
├── 출력이 Manifesto Core Schema 타입과 호환
└── 결정론적 출력 (동일 입력 → 동일 출력)
```

#### FR-6: CLI Tool

```
명령어:

mel compile <input> [-o <output>]
├── .mel 파일을 Schema JSON으로 컴파일
├── 성공 시 exit 0, 실패 시 exit 1
└── 에러는 stderr로 출력

mel check <input>
├── 파싱 및 시맨틱 검사만 수행
├── IR 생성하지 않음
└── 유효성 검사 결과 출력

mel --version
└── 버전 정보 출력

mel --help
└── 사용법 출력
```

#### FR-7: Programmatic API

```typescript
import { compile, parse, check } from '@manifesto-ai/mel-compiler';

// 전체 컴파일
const result = compile(source);
if (result.success) {
  const schema = result.schema;  // Manifesto Schema
} else {
  const errors = result.errors;  // Diagnostic[]
}

// 파싱만
const ast = parse(source);

// 검사만
const diagnostics = check(source);
```

### 5.2 Error Handling

#### FR-8: Diagnostic System

```typescript
interface Diagnostic {
  severity: 'error' | 'warning' | 'info';
  code: string;           // e.g., "MEL001"
  message: string;        // 사람이 읽을 수 있는 메시지
  location: {
    file?: string;
    start: { line: number; column: number; offset: number };
    end: { line: number; column: number; offset: number };
  };
  source: string;         // 해당 라인의 소스 코드
  suggestion?: string;    // 수정 제안
}
```

#### FR-9: Error Messages

```
좋은 에러 메시지 예시:

Error MEL001: Unexpected token
  --> domain.mel:5:12
   |
 5 |   computed x 5
   |            ^
   |
   = expected '=' after identifier 'x'
   = try: computed x = 5


Error MEL002: Undefined identifier
  --> domain.mel:8:20
   |
 8 |   computed y = add(x, z)
   |                       ^
   |
   = 'z' is not defined
   = did you mean 'x'?


Error MEL003: Effect in computed expression
  --> domain.mel:12:15
   |
12 |   computed filtered = effect array.filter(...)
   |                       ^^^^^^
   |
   = effects are not allowed in computed expressions
   = move this to an action instead
```

### 5.3 Feature Matrix

| Feature | Phase 1 | Phase 2 | Phase 3 |
|---------|---------|---------|---------|
| Lexer | ✅ | ✅ | ✅ |
| Parser | ✅ | ✅ | ✅ |
| Basic Semantic Analysis | ✅ | ✅ | ✅ |
| IR Generation | ✅ | ✅ | ✅ |
| CLI | ✅ | ✅ | ✅ |
| Programmatic API | ✅ | ✅ | ✅ |
| Multi-error Recovery | ⚠️ Basic | ✅ | ✅ |
| Type Inference | ❌ | ⚠️ Basic | ✅ |
| Source Maps | ❌ | ✅ | ✅ |
| Watch Mode | ❌ | ✅ | ✅ |
| LSP | ❌ | ❌ | ✅ |
| Formatter | ❌ | ❌ | ✅ |

---

## 6. Non-Functional Requirements

### 6.1 Performance

| Metric | Target | Rationale |
|--------|--------|-----------|
| **Parse Speed** | < 10ms for 1KB MEL | LLM 생성 후 즉시 검증 가능 |
| **Compile Speed** | < 50ms for 1KB MEL | 빌드 파이프라인 병목 방지 |
| **Memory** | < 50MB for 10KB MEL | 브라우저 환경 고려 |
| **Bundle Size** | < 100KB (gzipped) | 브라우저 로딩 시간 |

### 6.2 Reliability

| Requirement | Description |
|-------------|-------------|
| **Determinism** | 동일 입력 → 항상 동일 출력 |
| **Crash-free** | 어떤 입력에도 크래시 없음 (malformed 포함) |
| **Error Isolation** | 하나의 에러가 전체 컴파일 방해하지 않음 |

### 6.3 Compatibility

| Requirement | Target |
|-------------|--------|
| **Node.js** | >= 18.x |
| **Browser** | ES2020+ (Chrome, Firefox, Safari, Edge 최신) |
| **TypeScript** | >= 5.0 |
| **Manifesto Core** | @manifesto-ai/core 최신 |

### 6.4 Maintainability

| Requirement | Description |
|-------------|-------------|
| **Test Coverage** | >= 90% line coverage |
| **Documentation** | 모든 public API 문서화 |
| **Code Style** | ESLint + Prettier 적용 |
| **CI/CD** | PR마다 테스트 + 린트 자동 실행 |

### 6.5 Security

| Requirement | Description |
|-------------|-------------|
| **No Eval** | 동적 코드 실행 금지 |
| **Input Sanitization** | 악의적 입력에 안전 |
| **No Network** | 컴파일 중 네트워크 호출 없음 |

---

## 7. Technical Decisions

### 7.1 Language & Runtime

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Implementation Language** | TypeScript | Manifesto 생태계 통합, 빠른 이터레이션 |
| **Target Runtime** | Node.js + Browser | 범용성 |
| **Module System** | ESM + CJS dual | 호환성 |

### 7.2 Parser Strategy

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Approach** | Handwritten Recursive Descent | 완전한 제어, 최고의 에러 메시지 |
| **Alternative Considered** | Peggy (PEG.js) | 빠른 프로토타입에 좋으나 에러 메시지 제한 |
| **Lexer** | Handwritten | 간단한 토큰 구조, 위치 추적 필요 |

### 7.3 Build & Bundle

| Tool | Purpose |
|------|---------|
| **tsup** | TypeScript → JS 번들링 |
| **Vitest** | 테스트 러너 |
| **ESLint** | 코드 품질 |
| **Prettier** | 코드 포맷팅 |
| **Changesets** | 버전 관리 |

### 7.4 Project Structure

```
packages/
└── @manifesto-ai/mel-compiler/
    ├── src/
    │   ├── index.ts              # Public API
    │   ├── lexer/
    │   │   ├── tokens.ts         # Token 타입 정의
    │   │   ├── lexer.ts          # Lexer 구현
    │   │   └── index.ts
    │   ├── parser/
    │   │   ├── ast.ts            # AST 타입 정의
    │   │   ├── parser.ts         # Parser 구현
    │   │   └── index.ts
    │   ├── analyzer/
    │   │   ├── scope.ts          # 스코프 분석
    │   │   ├── validator.ts      # 시맨틱 검증
    │   │   └── index.ts
    │   ├── generator/
    │   │   ├── ir.ts             # IR 생성
    │   │   └── index.ts
    │   ├── diagnostics/
    │   │   ├── types.ts          # Diagnostic 타입
    │   │   ├── reporter.ts       # 에러 포맷팅
    │   │   └── index.ts
    │   └── cli/
    │       └── index.ts          # CLI 진입점
    ├── tests/
    │   ├── lexer/
    │   ├── parser/
    │   ├── analyzer/
    │   ├── generator/
    │   ├── e2e/
    │   └── fixtures/             # 테스트용 .mel 파일
    ├── package.json
    ├── tsconfig.json
    ├── tsup.config.ts
    └── README.md
```

---

## 8. Milestones & Phases

### 8.1 Overview

```
Phase 1: MVP (2-3 weeks)
├── Lexer 구현
├── Parser 구현 (핵심 문법)
├── 기본 IR 생성
├── CLI 기본 동작
└── SPEC 예제 모두 파싱

Phase 2: Production Ready (2-3 weeks)
├── 전체 문법 지원
├── System Value Lowering (v0.3.1 핵심!) ← NEW
├── Semantic Analysis
├── 친절한 에러 메시지
├── 테스트 커버리지 90%+
└── Manifesto Core 통합 테스트

Phase 3: DX Enhancement (Optional)
├── Watch mode
├── Source maps
├── Performance 최적화
└── LSP 기초
```

### 8.2 Phase 1: MVP

**Duration:** 2-3 weeks  
**Goal:** SPEC 검증 및 기본 컴파일 동작

| Week | Tasks | Deliverables |
|------|-------|--------------|
| **W1** | 프로젝트 셋업, Lexer 구현 | 모든 토큰 인식, 위치 추적 |
| **W1-2** | Parser 구현 (expressions) | 산술, 비교, 논리 표현식 파싱 |
| **W2** | Parser 구현 (declarations) | state, computed, action 파싱 |
| **W2-3** | IR Generator | AST → Schema 변환 |
| **W3** | CLI, 통합 테스트 | `mel compile` 동작 |

**Exit Criteria:**
```mel
// 이 코드가 컴파일되면 Phase 1 완료 (v0.3.1 compliant - basic)
domain Counter {
  state {
    count: number = 0
    lastIntent: string | null = null
  }
  
  computed doubled = mul(count, 2)
  computed isPositive = gt(count, 0)
  
  action increment() {
    // v0.2.2+: Per-intent idempotency with $meta.intentId
    once(lastIntent) {
      patch lastIntent = $meta.intentId
      patch count = add(count, 1)
    }
  }
  
  action reset() {
    when gt(count, 0) {
      patch count = 0
      patch lastIntent = null
    }
  }
}
```

### 8.3 Phase 2: Production Ready

**Duration:** 2-3 weeks  
**Goal:** 실사용 가능한 컴파일러, System Value Lowering 포함

| Week | Tasks | Deliverables |
|------|-------|--------------|
| **W4** | Effect 문법, once() sugar | 전체 action 문법 지원 |
| **W4** | **System Value Lowering** | $system.* → system.get 변환 (v0.3.1 핵심) |
| **W4-5** | Semantic Analyzer | 스코프, 중복, E001-E004 에러 |
| **W5** | Error Recovery, 메시지 개선 | 다중 에러, 친절한 메시지 |
| **W5-6** | Manifesto Core 통합 | E2E 테스트 통과 |
| **W6** | 문서화, 리팩토링 | README, API 문서 |

**Exit Criteria:**
```mel
// SOURCE: 개발자가 작성하는 코드 (v0.3.1)
domain TaskManager {
  state {
    tasks: Record<string, Task> = {}
    filter: "all" | "active" | "completed" = "all"
    addingTask: string | null = null
  }
  
  computed taskCount = len(tasks)
  
  action addTask(title: string) {
    // v0.3.1: $system.uuid가 자동으로 lowering됨
    once(addingTask) when neq(trim(title), "") {
      patch addingTask = $meta.intentId
      patch tasks[$system.uuid] = {
        id: $system.uuid,           // 동일 key = 동일 value (deduplicated)
        title: trim(title),
        completed: false,
        createdAt: $system.time.now
      }
    }
  }
}

// LOWERED: 컴파일러가 생성하는 코드 (검증용)
// 컴파일러는 다음과 같은 변환을 수행해야 함:
//
// state에 추가:
//   __sys__addTask_uuid_value: string | null = null
//   __sys__addTask_uuid_intent: string | null = null
//   __sys__addTask_time_now_value: number | null = null
//   __sys__addTask_time_now_intent: string | null = null
//
// action에 삽입:
//   once(__sys__addTask_uuid_intent) {
//     patch __sys__addTask_uuid_intent = $meta.intentId
//     effect system.get({ key: "uuid", into: __sys__addTask_uuid_value })
//   }
//   once(__sys__addTask_time_now_intent) {
//     patch __sys__addTask_time_now_intent = $meta.intentId  
//     effect system.get({ key: "time.now", into: __sys__addTask_time_now_value })
//   }
//
// readiness 조건 추가:
//   once(addingTask) when and(
//     eq(__sys__addTask_uuid_intent, $meta.intentId),
//     eq(__sys__addTask_time_now_intent, $meta.intentId),
//     neq(trim(title), "")
//   ) { ... }
```

**System Value Lowering 검증:**
- [ ] E001: `computed x = $system.uuid` → compile error
- [ ] E002: `state { x: string = $system.uuid }` → compile error
- [ ] E004: `state { __sys__foo: string }` → compile error
- [ ] 동일 action 내 동일 $system.* → 동일 slot 사용 (deduplication)
- [ ] Readiness는 `eq(intent, $meta.intentId)` 사용, NOT `isNotNull(value)`

### 8.4 Phase 3: DX Enhancement (Optional)

**Duration:** TBD  
**Goal:** 개발자 경험 향상

| Feature | Priority | Effort |
|---------|----------|--------|
| Watch mode (`mel watch`) | P1 | 1 week |
| Source maps | P2 | 1 week |
| Performance profiling | P2 | 1 week |
| LSP basics (diagnostics only) | P3 | 2 weeks |
| VSCode extension (syntax highlight) | P3 | 1 week |

---

## 9. Success Metrics

### 9.1 Phase 1 Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **SPEC Coverage** | 100% | 모든 SPEC 예제 파싱 성공 |
| **Parse Success** | 100% | 유효한 MEL → AST 변환 |
| **IR Validity** | 100% | 생성된 IR이 Schema 타입 준수 |
| **Test Coverage** | >= 80% | Line coverage |

### 9.2 Phase 2 Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **E2E Success** | 100% | 컴파일된 IR이 Core에서 실행 |
| **Error Detection** | 100% | 모든 SPEC 위반 감지 |
| **Error Quality** | >= 4/5 | 개발자 설문 (명확성, 도움됨) |
| **Test Coverage** | >= 90% | Line coverage |
| **Performance** | < 50ms/KB | 1KB MEL 컴파일 시간 |

### 9.3 Long-term Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Adoption** | - | MEL로 작성된 도메인 수 |
| **LLM Success Rate** | >= 95% | LLM 생성 MEL의 컴파일 성공률 |
| **Developer Satisfaction** | >= 4/5 | 사용자 설문 |

---

## 10. Dependencies & Constraints

### 10.1 Dependencies

| Dependency | Type | Description |
|------------|------|-------------|
| **MEL SPEC v0.3.2** | Document | 문법 및 시맨틱 정의 |
| **MEL FDR v0.3.2** | Document | 설계 결정 근거 |
| **Manifesto Core** | Package | Schema 타입 정의, 런타임 |
| **Node.js >= 18** | Runtime | CLI 실행 환경 |
| **TypeScript >= 5** | Language | 구현 언어 |

### 10.2 Constraints

| Constraint | Description | Impact |
|------------|-------------|--------|
| **Browser Compatibility** | 브라우저에서 실행 가능해야 함 | Node.js 전용 API 사용 금지 |
| **No External Parser** | 외부 파서 라이브러리 사용 안 함 | 직접 구현 필요 |
| **Bundle Size** | < 100KB gzipped | 코드 최적화 필요 |
| **SPEC Compliance** | MEL SPEC v0.3.2 100% 준수 | 문법 변경 시 SPEC 먼저 수정 |
| **System Value Lowering** | FDR-MEL-051, 055, 056 준수 | __sys__ namespace, intent-based readiness |
| **Flow Control** | FDR-MEL-058 ~ 061 준수 | available, fail, stop 구현 |

### 10.3 Assumptions

1. MEL SPEC v0.3.2는 Architecture Review를 통과했으며 안정적
2. Manifesto Core의 Schema 타입은 안정적
3. TypeScript 구현으로 성능 충분 (Phase 1 기준)
4. 브라우저 번들 사이즈 100KB 이내 달성 가능
5. System Value Lowering은 컴파일 타임에 완료됨 (런타임 변환 없음)
6. Flow Control (available, fail, stop)은 Core FlowNode와 1:1 대응

---

## 11. Risks & Mitigations

### 11.1 Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **SPEC 모호성 발견** | High | Medium | 파싱 중 발견 시 SPEC 수정, FDR 추가 |
| **성능 부족** | Medium | Low | Phase 3에서 최적화, 필요시 WASM 고려 |
| **번들 사이즈 초과** | Low | Medium | Tree-shaking, 코드 분할 |
| **Core 통합 이슈** | Medium | High | 초기에 통합 테스트 시작 |

### 11.2 Process Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **일정 지연** | Medium | Medium | 주간 마일스톤 점검, 스코프 조정 |
| **요구사항 변경** | Low | High | SPEC 변경 프로세스 정의 |

### 11.3 Contingency Plans

```
만약 TypeScript 성능이 부족하면:
├── Hot path 최적화 (Lexer, Parser 핵심 루프)
├── WASM으로 Lexer만 교체
└── 최후의 수단: Rust로 전체 재작성

만약 SPEC에 치명적 결함 발견되면:
├── v0.3.x 패치 릴리스 (이미 v0.3.1이 Architecture Review 통과)
├── FDR 추가
├── 컴파일러 수정
└── Breaking change로 버전 범프
```

---

## 12. Open Questions

### 12.1 Unresolved

| Question | Context | Owner | Due |
|----------|---------|-------|-----|
| **Import 문법 상세** | 다른 .mel 파일 참조 방법 | TBD | Phase 2 |
| **타입 정의 분리** | 타입만 별도 파일로? | TBD | Phase 2 |
| **Source map 포맷** | 표준 source map vs 커스텀 | TBD | Phase 3 |

### 12.2 Resolved

| Question | Resolution | Date |
|----------|------------|------|
| Rust vs TypeScript | TypeScript (빠른 검증 우선) | 2025-01-01 |
| Parser generator vs 수동 | 수동 (에러 메시지 제어) | 2025-01-01 |
| 중첩 Effect 허용 여부 | 금지 (FDR-MEL-018) | 2025-01-01 |

---

## 13. Appendix

### 13.1 Related Documents

| Document | Description |
|----------|-------------|
| [MEL-SPEC-v0.3.2.md](./MEL-SPEC-v0.3.2.md) | MEL 문법 명세 |
| [MEL-FDR-v0.3.2.md](./MEL-FDR-v0.3.2.md) | MEL 설계 결정 근거 |
| [Manifesto Constitution](./CONSTITUTION.md) | Manifesto 아키텍처 원칙 |

### 13.2 Glossary

| Term | Definition |
|------|------------|
| **MEL** | Manifesto Expression Language |
| **AST** | Abstract Syntax Tree |
| **IR** | Intermediate Representation (= Manifesto Schema) |
| **Lexer** | 소스 코드 → 토큰 변환기 |
| **Parser** | 토큰 → AST 변환기 |
| **Semantic Analysis** | 의미론적 검증 (스코프, 타입 등) |

### 13.3 References

- [Crafting Interpreters](https://craftinginterpreters.com/) - 언어 구현 가이드
- [TypeScript Compiler API](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API)
- [Rust Analyzer](https://rust-analyzer.github.io/) - LSP 구현 참고

---

## Approval

| Role | Name | Date | Signature |
|------|------|------|-----------|
| **Author** | | | |
| **Tech Lead** | | | |
| **Product Owner** | | | |

---

*End of PRD*
