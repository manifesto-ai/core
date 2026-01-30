# Translator v1.0 Architecture Decision Records

> **Status:** Proposed  
> **Version:** 1.0.8  
> **Date:** 2026-01-28 (Updated: 2026-01-30)  
> **Deciders:** Manifesto Architecture Team  
> **Scope:** `@manifesto-ai/translator` 전체 아키텍처  
> **Aligns With:** ARCHITECTURE-v2.0.0, ADR-001 (Layer Separation)

---

## Table of Contents

1. [Overview](#1-overview)
2. [ADR-TRN-101: Clean Architecture & Package Boundaries](#adr-trn-101-clean-architecture--package-boundaries)
3. [ADR-TRN-102: Core Interfaces (Strategy Pattern)](#adr-trn-102-core-interfaces-strategy-pattern)
4. [ADR-TRN-103: LLM Adapter Port](#adr-trn-103-llm-adapter-port)
5. [ADR-TRN-104: Pipeline Orchestrator & Parallelization](#adr-trn-104-pipeline-orchestrator--parallelization)
6. [ADR-TRN-105: Output Contracts](#adr-trn-105-output-contracts)
7. [ADR-TRN-106: Pipeline Plugins (Composable Layers)](#adr-trn-106-pipeline-plugins-composable-layers)
8. [ADR-TRN-107: Target Exporters (Generalized Emission)](#adr-trn-107-target-exporters-generalized-emission)
9. [Summary](#summary)

---

> **Alignment Note (2026-01-30)**
>
> Intent IR v0.2.0 is now the canonical spec. Role enum and lowering contract
> are unchanged; v0.2 adds ListTerm, QuantitySpec, `in` predicate support,
> term-level `ext`, and canonicalization refinements. This ADR remains valid;
> references are updated to v0.2 where relevant.

## 1. Overview

### 문제: v0.1의 God Object

v0.1 Translator는 빠른 프로토타이핑 과정에서 다음 안티패턴이 발생했다:

```typescript
// ❌ v0.1: God Object
function translate(text: string, options?: {
  mode?: "llm" | "deterministic";  // OCP 위반
  validateWith?: Lexicon;
  // ... 계속 증가
}): Promise<TranslateResult>;
```

**위반한 원칙들:**

| 원칙 | 위반 내용 |
|------|----------|
| **SRP** | `translate()`가 분해, 번역, 검증, 병합 모두 담당 |
| **OCP** | 새 전략 추가 시 내부 `if-else` 수정 필요 |
| **DIP** | 구체 LLM 구현에 직접 의존 |
| **ISP** | 모든 옵션이 하나의 거대 인터페이스에 혼재 |

### 해결: Clean Architecture + Strategy Pattern

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    @manifesto-ai/translator v1.0                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                         Core (Interfaces)                        │    │
│  │  DecomposeStrategy │ TranslateStrategy │ MergeStrategy │ LLMPort │    │
│  └──────────────────────────────┬──────────────────────────────────┘    │
│                                 │                                        │
│  ┌──────────────────────────────┼──────────────────────────────────┐    │
│  │                         Strategies                               │    │
│  │  Punctuation, SlidingWindow, LLM (Decompose)                     │    │
│  │  LLM, Heuristic, Hybrid (Translate)                              │    │
│  │  Conservative, Aggressive (Merge)                                │    │
│  └──────────────────────────────┬──────────────────────────────────┘    │
│                                 │                                        │
│  ┌──────────────────────────────┼──────────────────────────────────┐    │
│  │                    Adapters (별도 패키지)                         │    │
│  │  @manifesto-ai/translator-adapter-openai                         │    │
│  │  @manifesto-ai/translator-adapter-claude                         │    │
│  │  @manifesto-ai/translator-adapter-ollama                         │    │
│  └──────────────────────────────┬──────────────────────────────────┘    │
│                                 │                                        │
│  ┌──────────────────────────────┴──────────────────────────────────┐    │
│  │                    TranslatorPipeline                            │    │
│  │   text → Decompose → Translate[] (parallel) → Merge → Graph     │    │
│  └──────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## ADR-TRN-101: Clean Architecture & Package Boundaries

### Context

v0.1은 God Object 안티패턴으로 인해 확장, 테스트, 유지보수가 어려웠다. Manifesto ARCHITECTURE-v2.0.0의 원칙을 내부적으로도 따라야 한다.

### Decision

**Hexagonal Architecture (Ports & Adapters) + Strategy Pattern 적용**

#### Translator "Does NOT Know" 경계

| Translator Does NOT Know | Implication |
|--------------------------|-------------|
| `@manifesto-ai/host` | Host dispatch, TraceEvent, ExecutionKey 미사용 |
| `@manifesto-ai/world` | Proposal, Authority, WorldId 미생성 |
| `@manifesto-ai/app` | Runtime integration 미포함 |
| Execution semantics | 실행 방법/시점 결정 X |
| Governance | 승인/거부 로직 X |

```typescript
// ✅ 허용
import type { IntentIR } from '@manifesto-ai/intent-ir';  // type-only

// ❌ 금지
import { Host } from '@manifesto-ai/host';
import { World } from '@manifesto-ai/world';
```

#### Boundary Rules (Normative)

| ID | Level | Rule |
|----|-------|------|
| **TRN-BND-1** | MUST NOT | Translator는 `@manifesto-ai/host\|world\|app`를 import하지 않는다 |
| **TRN-BND-2** | MUST NOT | Translator는 Proposal/Authority/ExecutionKey를 생성하지 않는다 |
| **TRN-BND-3** | MAY | `@manifesto-ai/core`는 type-only import만 허용 |
| **TRN-BND-4** | MUST | Translator는 순수 의미 변환만 담당 (NL → Intent Graph) |
| **TRN-BND-5** | MUST NOT | Translator는 target-specific emission을 포함하지 않는다 (→ TargetExporter Port 사용) |

#### Package Structure

```
@manifesto-ai/translator/           # Core 패키지 (SDK/Target 무의존)
├── src/
│   ├── core/                       # Domain Layer (interfaces only)
│   │   ├── interfaces/
│   │   │   ├── decomposer.ts
│   │   │   ├── translator.ts
│   │   │   ├── merger.ts
│   │   │   ├── llm-port.ts
│   │   │   └── exporter-port.ts    # TargetExporter Port
│   │   └── types/
│   ├── strategies/                 # Built-in Strategies
│   │   ├── decompose/
│   │   ├── translate/
│   │   └── merge/
│   ├── pipeline/                   # Orchestration
│   └── index.ts

@manifesto-ai/translator-adapter-openai/   # LLM Adapter (별도 패키지)
@manifesto-ai/translator-adapter-claude/   # LLM Adapter (별도 패키지)
@manifesto-ai/translator-adapter-ollama/   # LLM Adapter (별도 패키지)

@manifesto-ai/translator-target-manifesto/ # Target Exporter (별도 패키지)
@manifesto-ai/translator-target-json/      # Target Exporter (별도 패키지)
@manifesto-ai/translator-target-openapi/   # Target Exporter (별도 패키지)
```

> **Note:** `translator-adapter-*`는 입력(LLM), `translator-target-*`는 출력(emission). 둘 다 Ports & Adapters 패턴으로 core와 분리.

#### Layer Rules

| ID | Level | Rule |
|----|-------|------|
| **L1** | MUST | Core는 외부 의존성 없음 (순수 인터페이스만) |
| **L2** | MUST | Strategies는 Core 인터페이스만 구현 |
| **L3** | MUST | Adapters는 **별도 패키지**로 분리 |
| **L4** | MUST | Pipeline은 인터페이스로만 조합 |

#### Dependency Flow

```
                    ┌─────────────────┐
                    │    Adapters     │  (별도 패키지)
                    │  (implements)   │
                    └────────┬────────┘
                             │
                             ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Strategies    │───▶│      Core       │◀───│    Pipeline     │
│  (implements)   │    │  (interfaces)   │    │    (uses)       │
└─────────────────┘    └─────────────────┘    └─────────────────┘

Rule: 모든 화살표는 Core(추상)를 향한다 (Dependency Inversion)
```

### Consequences

**Positive:** 테스트 용이, 확장 용이, LLM SDK 의존성 격리, 번들 크기 최적화  
**Negative:** 패키지 수 증가, 초기 설정 복잡도

---

## ADR-TRN-102: Core Interfaces (Strategy Pattern)

### Context

Clean Architecture에서 Core Layer는 **인터페이스만** 정의한다. 각 Strategy의 입력, 출력, 불변 규칙을 명확히 해야 한다.

### Decision

#### 1. DecomposeStrategy

```typescript
interface DecomposeStrategy {
  decompose(text: string, options?: DecomposeOptions): Promise<Chunk[]>;
}

interface DecomposeOptions {
  maxChunkSize?: number;
  overlapSize?: number;
  language?: string;
}

interface Chunk {
  readonly text: string;
  readonly span: Readonly<{ start: number; end: number }>;
  readonly index: number;
  readonly meta?: Readonly<Record<string, unknown>>;
}
```

**Invariants (Normative):**

| ID | Level | Rule |
|----|-------|------|
| **D-INV-0** | MUST | `chunk.text === input.slice(span.start, span.end)` (substring 보장, 패러프레이즈/요약 금지) |
| **D-INV-1** | MUST | `chunks.length >= 1` (빈 텍스트도 최소 1개 청크) |
| **D-INV-2** | MUST | `chunks[i].index === i` (순서 일치) |
| **D-INV-2b** | MUST | `chunks[i].span.start <= chunks[i+1].span.start` (span.start 기준 정렬, overlap 검출 전제) |
| **D-INV-3** | MUST | `0 <= span.start <= span.end <= input.length` |
| **D-INV-3a** | SHOULD | `input.length > 0`인 경우 `span.start < span.end` |
| **D-INV-4** | SHOULD | 기본은 non-overlap cover (오버랩 없이 전체 커버) |
| **D-INV-5** | MUST | overlap 존재 시 Merge 전/중 semantic deduplication 필수 |

> **Critical:** D-INV-0은 Decompose가 "의미를 바꾸는 요약/재작성 레이어"가 되는 것을 방지한다. LLM Decomposer도 원문 substring만 반환해야 한다.

> **Critical:** D-INV-2b는 TRN-104의 span 기반 overlap 검출(`prev.end > curr.start`)이 올바르게 동작하기 위한 전제 조건이다.

> **Empty Input:** `input === ""`인 경우 `{ span: {0,0}, text: "", index: 0 }` 단일 청크가 유효한 결과다. D-INV-3은 이를 허용한다.

#### 2. TranslateStrategy

```typescript
interface TranslateStrategy {
  translate(text: string, options?: TranslateOptions): Promise<IntentGraph>;
}

interface TranslateOptions {
  maxNodes?: number;
  domain?: string;
  language?: string;
  allowedEvents?: string[];
}

interface IntentGraph {
  readonly nodes: readonly IntentNode[];
}

interface IntentNode {
  readonly id: string;
  readonly ir: IntentIR;
  readonly dependsOn: readonly string[];
  readonly resolution: Resolution;
}

interface Resolution {
  readonly status: "Resolved" | "Ambiguous" | "Abstract";
  readonly ambiguityScore: number;
  readonly missing?: readonly Role[];  // ← string[] 아님, Role enum
  readonly questions?: readonly string[];
}

/** 
 * Intent IR θ-role enum (from @manifesto-ai/intent-ir v0.2).
 * 
 * MUST match Intent IR v0.2 exactly. Role extension is BREAKING.
 * Note: TIME is modeled separately as IntentIR.time?: TimeSpec
 */
type Role = 
  | "TARGET" 
  | "THEME" 
  | "SOURCE" 
  | "DEST"         // not "DESTINATION"
  | "INSTRUMENT" 
  | "BENEFICIARY";
```

**Invariants (Normative):**

| ID | Level | Rule |
|----|-------|------|
| **T-INV-1** | MUST | 노드 ID는 그래프 내 유일 |
| **T-INV-2** | MUST | `dependsOn`의 모든 ID는 그래프 내 존재 |
| **T-INV-3** | MUST | 그래프는 DAG (사이클 없음) |
| **T-INV-4** | MUST | `status = "Resolved"` ⟹ `missing` 없거나 비어있음 |
| **T-INV-5** | MUST | **C-ABS-1**: 비-Abstract 노드는 Abstract에 의존 불가 |

#### 3. MergeStrategy

```typescript
interface MergeStrategy {
  merge(graphs: readonly IntentGraph[], options?: MergeOptions): IntentGraph;
}

interface MergeOptions {
  prefixNodeIds?: boolean;
  deduplicate?: boolean;  // overlapSize > 0이면 MUST true
  linkStrategy?: "conservative" | "aggressive" | "none";
}
```

**Invariants (Normative):**

| ID | Level | Rule |
|----|-------|------|
| **M-INV-1** | MUST | 결과 그래프는 유효한 DAG |
| **M-INV-2** | MUST | **C-ABS-1** 준수 |
| **M-INV-3** | MUST | `prefixNodeIds=true` ⟹ 노드 ID 충돌 없음 |
| **M-INV-4** | MUST | overlap 입력 시 semantic deduplication 수행 |
| **M-INV-5** | MUST | **결과 그래프의 노드 ID는 전역 유일**해야 함 (chunk별 n1/n2 반복 생성 시 re-id 필수) |

> **Critical:** M-INV-5는 옵션이 아닌 결과 불변식이다. chunk별 번역은 동일한 ID (n1, n2...)를 생성하기 쉬우므로, MergeStrategy는 반드시 prefix 또는 re-id를 통해 전역 유일성을 보장해야 한다.

> **M-INV-5 vs prefixNodeIds=false:** `prefixNodeIds=false`는 "prefix 스타일을 쓰지 않겠다"는 의미이지, "충돌을 허용하겠다"는 의미가 아니다. `prefixNodeIds=false`여도 MergeStrategy는 re-id 등 다른 방식으로 전역 유일성을 보장해야 한다. 즉 **M-INV-5는 항상 만족되어야 하며, prefixNodeIds는 유일성 보장 방식의 선택일 뿐**이다.

#### Type Flow

```
string ──▶ Chunk[] ──▶ IntentGraph[] ──▶ IntentGraph
      Decompose    Translate        Merge
        │                              │
        └── D-INV-0: substring 보장 ───┘── M-INV-4: dedup 보장
```

### Consequences

**Positive:** 각 Strategy 독립 테스트, OCP 준수, 타입 안전한 조합, Role enum으로 downstream 안정성  
**Negative:** 인터페이스 학습 필요, D-INV-0 강제로 LLM Decomposer 구현 제약

---

## ADR-TRN-103: LLM Adapter Port

### Context

특정 LLM 프로바이더에 직접 의존하면 교체, 테스트, 멀티 프로바이더 지원이 어렵다. 또한 `openai`, `anthropic` SDK는 의존성/번들 크기 이슈가 있다.

### Decision

**Ports & Adapters 패턴 + Adapter 별도 패키지화**

#### LLMPort Interface

```typescript
interface LLMPort {
  complete(request: LLMRequest): Promise<LLMResponse>;
}

interface LLMRequest {
  system?: string;
  messages: LLMMessage[];
  options?: LLMCallOptions;
}

interface LLMMessage {
  role: "user" | "assistant";
  content: string;
}

interface LLMCallOptions {
  temperature?: number;
  maxTokens?: number;
  stop?: string[];
  responseFormat?: "text" | "json";
  timeout?: number;
}

interface LLMResponse {
  content: string;
  usage?: LLMUsage;
  finishReason: "stop" | "length" | "content_filter" | "error";
}

interface LLMUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}
```

#### Error Types

```typescript
class LLMError extends Error {
  constructor(
    message: string,
    readonly code: LLMErrorCode,
    readonly retryable: boolean,
    readonly cause?: unknown
  ) {
    super(message);
  }
}

type LLMErrorCode =
  | "RATE_LIMIT" | "TIMEOUT" | "AUTH_FAILED" 
  | "INVALID_REQUEST" | "SERVICE_ERROR" 
  | "CONTENT_FILTER" | "NETWORK_ERROR" | "UNKNOWN";
```

#### Package Strategy (Normative)

| ID | Level | Rule |
|----|-------|------|
| **PKG-1** | MUST | `@manifesto-ai/translator`는 **LLMPort 정의 및 SDK 무의존 core 로직**(파이프라인/전략/데코레이터/플러그인 타입)을 포함한다 |
| **PKG-2** | MUST | Provider SDK 의존(예: openai, @anthropic-ai/sdk)은 별도 adapter 패키지로 분리한다 |
| **PKG-3** | SHOULD | Adapter 패키지는 해당 SDK를 peerDependency로 선언 |

```
@manifesto-ai/translator                    # Core: interfaces, strategies, pipeline, plugins, decorators (SDK 무의존)
@manifesto-ai/translator-adapter-openai     # depends on 'openai'
@manifesto-ai/translator-adapter-claude     # depends on '@anthropic-ai/sdk'
@manifesto-ai/translator-adapter-ollama     # depends on 'ollama'
```

#### Decorator Adapters (Core 패키지 포함)

```typescript
// 이들은 LLMPort를 받아 LLMPort를 반환하므로 SDK 의존 없음
class RetryLLMAdapter implements LLMPort { ... }
class FallbackLLMAdapter implements LLMPort { ... }
class LoggingLLMAdapter implements LLMPort { ... }
```

#### Usage

```typescript
// 설치
npm install @manifesto-ai/translator @manifesto-ai/translator-adapter-claude

// 사용
import { TranslatorPipeline } from '@manifesto-ai/translator';
import { ClaudeAdapter } from '@manifesto-ai/translator-adapter-claude';

const llm = new ClaudeAdapter({ apiKey: "..." });
const pipeline = createDefaultPipeline(llm);
```

### Consequences

**Positive:** 번들 크기 최적화, SDK 버전 충돌 방지, 선택적 설치  
**Negative:** 패키지 수 증가, 초기 설정 단계 추가

---

## ADR-TRN-104: Pipeline Orchestrator & Parallelization

### Context

개별 컴포넌트를 어떻게 조합하고 병렬로 실행할지 정의해야 한다. 특히 **overlap 사용 시 정확성 리스크**를 관리해야 한다.

### Decision

#### TranslatorPipeline

```typescript
class TranslatorPipeline {
  constructor(
    private decomposer: DecomposeStrategy,
    private translator: TranslateStrategy,
    private merger: MergeStrategy,
    private options?: PipelineOptions
  ) {}
  
  async process(text: string): Promise<PipelineResult> {
    // 1. Decompose
    const chunks = await this.decomposer.decompose(text, {
      maxChunkSize: this.options?.maxChunkSize,
    });
    
    // 2. Span-based overlap detection (옵션이 아닌 실제 결과 기반)
    const hasOverlap = this.detectOverlap(chunks);
    
    // 3. Overlap safety enforcement
    if (hasOverlap && this.options?.deduplicate === false) {
      throw new Error("Actual overlap detected in chunks. deduplicate=false is not allowed.");
    }
    const effectiveDeduplicate = hasOverlap ? true : (this.options?.deduplicate ?? false);
    
    // 4. Translate (parallel)
    const graphs = await this.translateAll(chunks);
    
    // 5. Merge (with dedup if overlap)
    const merged = this.merger.merge(graphs, {
      deduplicate: effectiveDeduplicate,
      linkStrategy: this.options?.linkStrategy,
    });
    
    return { graph: merged, meta: { chunkCount: chunks.length, ... } };
  }
  
  /**
   * Span 기반 overlap 검출.
   * chunks[i].span.end > chunks[i+1].span.start 이면 overlap 존재.
   */
  private detectOverlap(chunks: Chunk[]): boolean {
    for (let i = 0; i < chunks.length - 1; i++) {
      if (chunks[i].span.end > chunks[i + 1].span.start) {
        return true;
      }
    }
    return false;
  }
}

interface PipelineOptions {
  concurrency?: number;           // 동시 실행 수 (기본: 5)
  timeout?: number;               // 전체 타임아웃 (ms)
  chunkTimeout?: number;          // 청크당 타임아웃 (ms)
  maxChunkSize?: number;          // Decomposer에 전달
  deduplicate?: boolean;          // overlap 검출 시 강제 true (false 지정 시 에러)
  errorPolicy?: "fail-fast" | "best-effort";
  linkStrategy?: "conservative" | "aggressive" | "none";
}
```

> **Critical:** overlap은 PipelineOptions가 아닌 **실제 Chunk span 기반**으로 검출한다. Decomposer가 어떤 옵션으로 호출되었든, 결과 span이 겹치면 overlap으로 판정하고 dedup을 강제한다.

#### Overlap Safety Rules (Normative)

| ID | Level | Rule |
|----|-------|------|
| **OVL-1** | MUST | overlap 존재 여부는 **span 기반**으로 검출 (`prev.end > curr.start`) |
| **OVL-2** | MUST | overlap 검출 시 `deduplicate`는 강제 `true` (false 지정 시 에러) |
| **OVL-3** | SHOULD | 기본 파이프라인은 non-overlap Decomposer 사용 권장 |
| **OVL-4** | MUST NOT | `PipelineOptions.overlapSize` 옵션은 존재하지 않음 (span 기반 검출로 대체) |

#### ParallelExecutor Rules (Normative)

| ID | Level | Rule |
|----|-------|------|
| **PEX-1** | MUST | `ParallelExecutor.execute(inputs, fn)`는 **outputs를 inputs와 동일한 인덱스 순서로 반환**해야 한다 |
| **PEX-2** | MUST | 결과 배열 `graphs[i]`는 입력 `chunks[i]`에 대응해야 한다 |
| **PEX-3** | MUST NOT | 완료 순서(arrival order)로 결과를 반환하면 안 됨 (정확성 보장 위반) |

> **Critical (PEX-1):** 이 규칙은 D-INV-2 (chunk.index === i), ChunkHookContext.chunkIndex, Merge의 prefix/re-id 규칙이 모두 chunk 순서를 전제로 하기 때문에 **정확성** 레벨이다. 순서가 틀리면 Plugin/Merge/Coverage가 조용히 틀어진다.

```typescript
// ✅ 올바른 구현 (input order 유지)
class ParallelExecutor<TIn, TOut> {
  async execute(inputs: TIn[], fn: (input: TIn, index: number) => Promise<TOut>): Promise<TOut[]> {
    // Promise.all은 input order를 유지함
    const semaphore = new Semaphore(this.concurrency);
    
    const promises = inputs.map(async (input, index) => {
      await semaphore.acquire();
      try {
        return await fn(input, index);
      } finally {
        semaphore.release();
      }
    });
    
    // Promise.all 결과는 입력 순서 유지 (PEX-1 만족)
    return Promise.all(promises);
  }
}

// ❌ 잘못된 구현 (arrival order)
async execute(inputs, fn) {
  const results: TOut[] = [];
  // ... 완료 순서대로 push → PEX-1 위반!
  return results;
}
```

```typescript
// ❌ 금지: overlap 청크 + deduplicate=false
const chunks = [
  { span: {0, 100}, ... },
  { span: {80, 180}, ... },  // overlap! (80 < 100)
];
// deduplicate: false 이면 → Error

// ✅ 허용: overlap 청크 + deduplicate 명시 또는 생략
// deduplicate: true (or omit) → OK, dedup 자동 적용
```

#### Factory Functions

```typescript
/**
 * 기본 파이프라인 (non-overlap, 안전).
 */
function createDefaultPipeline(llm: LLMPort): TranslatorPipeline {
  return new TranslatorPipeline(
    new SlidingWindowDecomposer(8000, 0),  // overlap = 0
    new LLMTranslator(llm),
    new ConservativeMerger(),
    { concurrency: 5 }
  );
}

/**
 * Context overlap 파이프라인.
 * 긴 문서에서 청크 간 문맥 유지가 필요할 때 사용.
 * Pipeline이 span 기반으로 overlap을 검출하고 자동으로 dedup 적용.
 */
function createContextOverlapPipeline(llm: LLMPort): TranslatorPipeline {
  return new TranslatorPipeline(
    new SlidingWindowDecomposer(8000, 500),  // overlap = 500
    new LLMTranslator(llm),
    new AggressiveMerger(),  // dedup 내장
    { 
      concurrency: 10,
      deduplicate: true,  // 명시적 (생략해도 overlap 검출 시 자동 true)
    }
  );
}

/**
 * 고성능 파이프라인 (best-effort).
 */
function createFastPipeline(llm: LLMPort): TranslatorPipeline {
  return new TranslatorPipeline(
    new SlidingWindowDecomposer(4000, 0),
    new LLMTranslator(llm),
    new ConservativeMerger(),
    { concurrency: 20, errorPolicy: "best-effort" }
  );
}
```

#### Performance Comparison

```
Sequential (4 chunks × 3sec):
[C1: 3s] → [C2: 3s] → [C3: 3s] → [C4: 3s] = 12 seconds

Parallel (4 chunks, concurrency=4):
[C1: 3s]
[C2: 3s]  → [Merge] = 3.1 seconds (3.9x faster)
[C3: 3s]
[C4: 3s]
```

### Consequences

**Positive:** 속도 향상, overlap 안전성 강제, 명확한 팩토리 분리  
**Negative:** overlap 사용 시 추가 고려 필요

---

## ADR-TRN-105: Output Contracts

### Context

Translator가 반환하는 최종 산출물의 타입과 불변 규칙을 정의해야 한다. 특히 **Resolution과 Lowering은 독립적인 축**임을 명확히 해야 한다.

**TRN-107 정합성:** Lowering은 schema/lexicon/resolver 같은 **target-specific 컨텍스트**가 필요하므로, Core가 아닌 TargetExporter가 담당해야 한다. (EXP-1, TRN-BND-5)

### Decision

#### Core Principle: Resolution (Core) vs Lowering (Target)

> **Resolution** (해소 상태): 의미적으로 완전한가? → **Core 담당**  
> **Lowering** (실행 가능 상태): IntentBody로 변환 가능한가? → **Target Exporter 담당**
>
> 이 두 축은 **독립적**이다. Resolution은 Core가 판단하지만, Lowering은 target-specific schema/lexicon이 필요하므로 Exporter가 담당한다.

#### Output Type Hierarchy

```
TranslatorPipeline.process()
         │
         ▼
┌─────────────────┐
│ PipelineResult  │
│  • graph ───────┼──▶ IntentGraph
│  • meta         │         │
│  • diagnostics  │         ▼
└─────────────────┘    IntentNode
                            │
                            ▼
                        IntentIR
                       
Core Helpers:
  • ExecutionPlan      (위상 정렬 + 의존성)  ← Lowering 없음
  • ValidationResult   (검증 결과)

Target Exporter Output (예: ManifestoBundle):
  • InvocationPlan     (Lowering 포함)      ← Target-specific
  • extensionCandidates
```

#### ExecutionPlan (Core, Lowering 없음)

```typescript
/**
 * Core 실행 계획.
 * 
 * 위상 정렬된 실행 순서와 의존성 그래프만 포함.
 * Lowering은 포함하지 않음 (Target Exporter 책임).
 */
interface ExecutionPlan {
  /** 실행할 스텝 (Abstract 제외, 위상 정렬됨) */
  readonly steps: readonly ExecutionStep[];
  
  /** steps 내 노드 간 의존성 엣지만 */
  readonly dependencyEdges: readonly DependencyEdge[];
  
  /** 실행 불가 노드 (Abstract) */
  readonly abstractNodes: readonly string[];
}

/**
 * 실행 스텝 (Core, Lowering 없음).
 */
interface ExecutionStep {
  readonly nodeId: string;
  readonly ir: IntentIR;
  readonly resolution: Resolution;
  // ⚠️ lowering 없음 - Target Exporter가 담당
}

/**
 * Core helper: IntentGraph → ExecutionPlan.
 * Lowering 없이 위상 정렬만 수행.
 */
function buildExecutionPlan(graph: IntentGraph): ExecutionPlan { ... }
```

#### InvocationPlan (Target-specific, Lowering 포함)

```typescript
// ─────────────────────────────────────────────────────────────
// 아래 타입들은 Target Exporter 패키지에 정의됨
// 예: @manifesto-ai/translator-target-manifesto
// ─────────────────────────────────────────────────────────────

/**
 * Manifesto target 실행 계획 (Lowering 포함).
 */
interface InvocationPlan {
  readonly steps: readonly InvocationStep[];
  readonly dependencyEdges: readonly DependencyEdge[];
  readonly abstractNodes: readonly string[];
}

interface InvocationStep {
  readonly nodeId: string;
  readonly ir: IntentIR;
  readonly resolution: Resolution;
  readonly lowering: LoweringResult;  // ← Target-specific
}

/**
 * Lowering 결과 (discriminated union).
 * 
 * - ready: IntentBody 생성 완료, 즉시 실행 가능
 * - deferred: 런타임에 lowering 필요 (담화 참조, 동적 값 등)
 * - failed: lowering 실패 (스키마 미지원 등)
 */
type LoweringResult =
  | { readonly status: "ready"; readonly intentBody: IntentBody }
  | { readonly status: "deferred"; readonly reason: string }
  | { readonly status: "failed"; readonly failure: LoweringFailure };

/**
 * Lowering 실패 정보 (구조체).
 */
interface LoweringFailure {
  readonly kind: LoweringFailureKind;
  readonly details: string;
}

type LoweringFailureKind =
  | "UNSUPPORTED_EVENT"    // 스키마에 없는 이벤트
  | "INVALID_ARGS"         // 인자 타입 불일치
  | "MISSING_REQUIRED"     // 필수 인자 누락
  | "SCHEMA_MISMATCH"      // 스키마 구조 불일치
  | "INTERNAL_ERROR";      // 내부 오류
```

> **Note:** InvocationPlan, LoweringResult, LoweringFailure, IntentBody는 Target Exporter 패키지에 정의된다. Core는 이 타입들을 모른다.

#### DependencyEdge (Core, 공유)

```typescript
/**
 * 의존성 엣지.
 * 
 * 방향: dependency → dependent (n1.dependsOn=[] → n2.dependsOn=["n1"]이면 n1 → n2)
 * 위상정렬: from 노드가 to 노드보다 먼저 실행됨
 */
interface DependencyEdge {
  /** 의존되는 노드 (dependency) - 먼저 실행됨 */
  readonly from: string;
  /** 의존하는 노드 (dependent) - 나중에 실행됨 */
  readonly to: string;
}
```

**왜 Lowering을 분리하는가?**

```typescript
// ❌ 이전 (Lowering이 Core에 있음)
interface InvocationStep {
  lowering: LoweringResult;  // schema/lexicon 없이 어떻게 ready/deferred 판정?
}
// Core가 target runtime을 알아야 하는 모순

// ✅ 이후 (Lowering을 Target Exporter로 분리)
// Core: ExecutionPlan (위상 정렬만)
// Target Exporter: InvocationPlan (schema/lexicon으로 lowering)
```

#### ValidationResult (Core)

```typescript
type ValidationResult = 
  | { readonly valid: true; readonly warnings?: readonly ValidationWarning[] }
  | { readonly valid: false; readonly error: ValidationError };

type ValidationErrorCode =
  | "DUPLICATE_ID"        // 노드 ID 중복
  | "MISSING_DEPENDENCY"  // dependsOn에 없는 노드 참조
  | "CYCLE_DETECTED"      // 순환 의존성
  | "ABSTRACT_DEPENDENCY" // C-ABS-1 위반
  | "INVALID_RESOLUTION"; // 잘못된 해상도 상태

function validateGraph(graph: IntentGraph): ValidationResult { ... }
```

#### Invariants Summary

| ID | 대상 | 규칙 | 소유 |
|----|------|------|------|
| **G-INV-1** | IntentGraph | 노드 ID는 그래프 내 유일 | Core |
| **G-INV-2** | IntentGraph | dependsOn의 모든 ID는 그래프 내 존재 | Core |
| **G-INV-3** | IntentGraph | DAG (사이클 없음) | Core |
| **G-INV-4** | IntentGraph | **C-ABS-1**: 비-Abstract는 Abstract에 의존 불가 | Core |
| **E-INV-1** | ExecutionPlan | steps에 Abstract 없음 | Core |
| **E-INV-2** | ExecutionPlan | **C-EDGES-1**: dependencyEdges는 steps 내 노드만 | Core |
| **E-INV-3** | DependencyEdge | from=dependency(먼저 실행), to=dependent(나중 실행) | Core |
| **L-INV-1** | LoweringResult | `status="ready"` ⟹ `intentBody` 존재 | **Target** |
| **L-INV-2** | LoweringResult | `status≠"ready"` ⟹ `intentBody` 없음 | **Target** |
| **L-INV-3** | LoweringFailure | `status="failed"` ⟹ `failure.kind` + `failure.details` 존재 | **Target** |

#### Core vs Target Ownership

| 타입 | 소유 | 이유 |
|------|------|------|
| `ExecutionPlan` | Core | 위상 정렬만, target 무관 |
| `ExecutionStep` | Core | lowering 없음 |
| `DependencyEdge` | Core | 순수 그래프 구조 |
| `ValidationResult` | Core | 그래프 검증 |
| `buildExecutionPlan()` | Core | 위상 정렬 helper |
| `InvocationPlan` | Target | lowering 포함 |
| `InvocationStep` | Target | lowering 포함 |
| `LoweringResult` | Target | schema/lexicon 의존 |
| `IntentBody` | Target | 런타임 실행체 |

### Consequences

**Positive:**
- Core가 target-agnostic 유지 (TRN-107 정합)
- Resolution/Lowering 책임 분리 명확
- 타입 레벨에서 불일치 방지 (discriminated union)

**Negative:**
- Target 패키지에 타입 정의 분산
- discriminated union 패턴 학습 필요

---

## ADR-TRN-106: Pipeline Plugins (Composable Layers)

### Context

ADR-TRN-101~105에서 Clean Architecture와 Strategy 패턴으로 God Object를 해체했다. 그러나 실제 사용에서는 다양한 **관찰/평가/보수 레이어**가 필요하다:

- 커버리지 체크 (quoted string 누락 경고)
- OR 감지 (v0.2에서도 OR 불가, v0.3+ defer)
- 모호성 점수화
- 의존성 보수 (dependsOn 누락 수정)
- 로깅/메트릭 수집

**문제:** 이를 `PipelineOptions`에 옵션으로 추가하면 v0.1의 God Object로 회귀한다.

**해결:** 옵션 추가가 아닌 **Hook 기반 Plugin 시스템**으로 확장한다.

### Decision

#### Core Principle: Strategy는 뼈대, Layer는 Plugin

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Pipeline with Plugins                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ┌─────────────┐                                                       │
│   │beforeDecompose│ ← Plugin Hook                                       │
│   └──────┬──────┘                                                       │
│          ▼                                                              │
│   ┌─────────────┐                                                       │
│   │  Decompose  │ ← Strategy (고정)                                     │
│   └──────┬──────┘                                                       │
│          ▼                                                              │
│   ┌─────────────┐                                                       │
│   │afterDecompose│ ← Plugin Hook                                        │
│   └──────┬──────┘                                                       │
│          ▼                                                              │
│   ┌─────────────────────────────────────────┐                           │
│   │  beforeTranslateChunk (per chunk)       │ ← Plugin Hook             │
│   │          ▼                              │                           │
│   │     Translate (parallel)                │ ← Strategy (고정)         │
│   │          ▼                              │                           │
│   │  afterTranslateChunk (per chunk)        │ ← Plugin Hook             │
│   └─────────────────────────────────────────┘                           │
│          ▼                                                              │
│   ┌─────────────┐                                                       │
│   │ beforeMerge │ ← Plugin Hook (barrier)                               │
│   └──────┬──────┘                                                       │
│          ▼                                                              │
│   ┌─────────────┐                                                       │
│   │    Merge    │ ← Strategy (고정)                                     │
│   └──────┬──────┘                                                       │
│          ▼                                                              │
│   ┌─────────────┐                                                       │
│   │ afterMerge  │ ← Plugin Hook                                         │
│   └──────┬──────┘                                                       │
│          ▼                                                              │
│   ┌─────────────────────┐                                               │
│   │afterStructuralValidate│ ← Plugin Hook                               │
│   └──────┬──────────────┘                                               │
│          ▼                                                              │
│   ┌─────────────────────┐                                               │
│   │ afterLexiconValidate │ ← Plugin Hook                                │
│   └─────────────────────┘                                               │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Plugin Interface

```typescript
/**
 * Pipeline 실행 단계.
 */
type PipelinePhase =
  | "beforeDecompose"
  | "afterDecompose"
  | "beforeTranslateChunk"
  | "afterTranslateChunk"
  | "beforeMerge"
  | "afterMerge"
  | "afterStructuralValidate"
  | "afterLexiconValidate";

// ─────────────────────────────────────────────────────────────
// Context Types (Fix #2: Mutable vs Readonly 분리)
// ─────────────────────────────────────────────────────────────

/**
 * Pipeline 내부 상태 (Mutable).
 * Pipeline 구현에서만 사용. Plugin에 직접 노출되지 않음.
 */
interface MutablePipelineContext {
  readonly input: string;
  chunks?: Chunk[];
  graphs?: IntentGraph[];
  merged?: IntentGraph;
  structuralValidation?: ValidationResult;
  lexiconValidation?: ValidationResult;
  readonly diagnostics: DiagnosticsBag;
}

/**
 * Plugin이 접근하는 컨텍스트 (Readonly).
 * 
 * Plugin은 이 타입만 받으며, diagnostics를 제외한 모든 필드는 readonly.
 * Transformer Plugin만 별도 반환값으로 수정 가능.
 */
interface ReadonlyPipelineContext {
  readonly input: string;
  readonly chunks?: readonly Chunk[];
  readonly graphs?: readonly IntentGraph[];
  readonly merged?: IntentGraph;
  readonly structuralValidation?: ValidationResult;
  readonly lexiconValidation?: ValidationResult;
  readonly diagnostics: DiagnosticsBag;
}

// ─────────────────────────────────────────────────────────────
// Chunk Hook Context (Fix #3: 병렬 안전한 per-chunk context)
// ─────────────────────────────────────────────────────────────

/**
 * Per-chunk Hook 전용 컨텍스트.
 * 
 * beforeTranslateChunk/afterTranslateChunk는 병렬 실행되므로,
 * 공유 ctx.currentChunk 대신 chunk-local context를 사용.
 */
interface ChunkHookContext extends ReadonlyPipelineContext {
  /** 현재 청크 인덱스 */
  readonly chunkIndex: number;
  
  /** 현재 청크 */
  readonly chunk: Chunk;
  
  /** 현재 청크의 번역 결과 (afterTranslateChunk에서만 존재) */
  readonly chunkGraph?: IntentGraph;
}

/**
 * 진단 정보 수집기.
 */
interface DiagnosticsBag {
  /** 경고 추가 */
  warn(code: string, message: string, nodeId?: string): void;
  
  /** 정보 추가 */
  info(code: string, message: string, nodeId?: string): void;
  
  /** 
   * 메트릭 기록 (last-write-wins).
   * 동일 name이 이미 있으면 덮어씀.
   * 병렬 chunk hook에서 비결정성 주의.
   */
  metric(name: string, value: number): void;
  
  /**
   * 메트릭 누적 (sum aggregation).
   * 동일 name에 대해 값을 합산.
   * 병렬 chunk hook에서 안전하게 집계 시 사용.
   */
  metricAdd(name: string, delta: number): void;
  
  /**
   * 메트릭 관찰 (histogram/average용).
   * 모든 관찰값을 배열로 저장, 나중에 min/max/avg 계산 가능.
   * 
   * ⚠️ 관찰값이 무제한 증가할 수 있음. 구현 시 DIAG-OBS-1 참조.
   */
  metricObserve(name: string, value: number): void;
  
  /** 읽기 전용 접근 */
  readonly warnings: readonly Diagnostic[];
  readonly infos: readonly Diagnostic[];
  readonly metrics: ReadonlyMap<string, number>;
  readonly metricObservations: ReadonlyMap<string, readonly number[]>;
}

/**
 * DiagnosticsBag 읽기 전용 버전.
 * ExportInput.diagnostics에 사용됨.
 */
type DiagnosticsReadonly = Pick<DiagnosticsBag, 
  'warnings' | 'infos' | 'metrics' | 'metricObservations'
>;

interface Diagnostic {
  readonly code: string;
  readonly message: string;
  readonly nodeId?: string;
  readonly timestamp: number;
}

// ─────────────────────────────────────────────────────────────
// Hook Types (Fix #1: Transformer 반환 타입 지원)
// ─────────────────────────────────────────────────────────────

/** 일반 Hook (Inspector/Transformer 공통, 반환값 없음) */
type StandardHook = (ctx: ReadonlyPipelineContext) => void | Promise<void>;

/** Chunk Hook (병렬 실행, chunk-local context) */
type ChunkHook = (ctx: ChunkHookContext) => void | Promise<void>;

/** 
 * Transformer Hook (afterMerge 전용).
 * IntentGraph 반환 시 Pipeline이 validate 재실행.
 */
type TransformerHook = (ctx: ReadonlyPipelineContext) => 
  | void 
  | IntentGraph 
  | Promise<void | IntentGraph>;

/**
 * Pipeline Hooks 정의.
 * 
 * - 대부분 phase: StandardHook
 * - chunk phase: ChunkHook (병렬 안전)
 * - afterMerge: TransformerHook (Transformer만 IntentGraph 반환 가능)
 */
interface PipelineHooks {
  beforeDecompose?: StandardHook;
  afterDecompose?: StandardHook;
  beforeTranslateChunk?: ChunkHook;
  afterTranslateChunk?: ChunkHook;
  beforeMerge?: StandardHook;
  afterMerge?: TransformerHook;  // ← Transformer는 IntentGraph 반환 가능
  afterStructuralValidate?: StandardHook;
  afterLexiconValidate?: StandardHook;
}

/**
 * Pipeline Plugin 인터페이스.
 */
interface PipelinePlugin {
  /** Plugin 이름 (디버깅/로깅용) */
  readonly name: string;
  
  /** Plugin 종류 */
  readonly kind: "inspector" | "transformer";
  
  /**
   * Run-scope Hook 인스턴스 생성.
   * 
   * process() 호출마다 새 인스턴스 생성 → 병렬 안전.
   * Plugin 내부 상태는 이 함수의 클로저로 관리.
   */
  createRunHooks(): PipelineHooks;
}
```

#### Plugin 종류: Inspector vs Transformer

| 종류 | 역할 | 수정 권한 | 예시 |
|------|------|----------|------|
| **Inspector** | 관찰/평가/기록 | diagnostics만 | ScoreLayer, CoverageChecker, ORDetector |
| **Transformer** | 수정/보수 | 그래프 수정 가능 | RepairLayer, CondScopeFixer |

```typescript
// ─────────────────────────────────────────────────────────────
// Inspector Plugin 예시: OR 감지 (ChunkHookContext 사용)
// ─────────────────────────────────────────────────────────────

const orDetectorPlugin: PipelinePlugin = {
  name: "or-detector",
  kind: "inspector",
  
  createRunHooks() {
    return {
      // Fix #3: ChunkHookContext로 병렬 안전한 접근
      afterTranslateChunk(ctx: ChunkHookContext) {
        // ctx.chunkGraph는 현재 청크의 번역 결과
        if (ctx.chunkGraph && detectOrPattern(ctx.chunkGraph)) {
          ctx.diagnostics.warn(
            "OR_DETECTED",
            `OR 패턴 감지됨 (chunk ${ctx.chunkIndex}). v0.2에서도 OR 분기 미지원 (v0.3+ defer).`,
            ctx.chunkGraph.nodes[0]?.id
          );
        }
      }
    };
  }
};

// ─────────────────────────────────────────────────────────────
// Inspector Plugin 예시: 커버리지 체크
// ─────────────────────────────────────────────────────────────

const coverageCheckerPlugin: PipelinePlugin = {
  name: "coverage-checker",
  kind: "inspector",
  
  createRunHooks() {
    let quotedStrings: string[] = [];
    
    return {
      afterDecompose(ctx) {
        // 원본에서 인용 문자열 추출
        quotedStrings = extractQuotedStrings(ctx.input);
      },
      
      afterMerge(ctx) {
        // 인용 문자열이 그래프에 반영됐는지 확인
        const covered = quotedStrings.filter(q => 
          ctx.merged!.nodes.some(n => nodeContainsQuote(n, q))
        );
        
        const coverage = covered.length / quotedStrings.length;
        ctx.diagnostics.metric("quote_coverage", coverage);
        
        if (coverage < 1.0) {
          ctx.diagnostics.warn(
            "QUOTE_MISSING",
            `${quotedStrings.length - covered.length}개 인용 문자열 미반영`
          );
        }
      }
    };
  }
};

// ─────────────────────────────────────────────────────────────
// Transformer Plugin 예시: 의존성 보수
// ─────────────────────────────────────────────────────────────

const dependencyRepairPlugin: PipelinePlugin = {
  name: "dependency-repair",
  kind: "transformer",
  
  createRunHooks() {
    return {
      // Transformer는 IntentGraph 반환 가능 (Fix #1)
      afterMerge(ctx): IntentGraph | void {
        const repaired = repairMissingDependencies(ctx.merged!);
        
        if (repaired.changed) {
          ctx.diagnostics.info(
            "DEPS_REPAIRED",
            `${repaired.addedEdges}개 의존성 추가됨`
          );
          
          // 수정된 그래프 반환 → Pipeline이 validate 재실행
          return repaired.graph;
        }
        // 변경 없으면 void (원본 유지)
      }
    };
  }
};
```

#### Transformer 제약 (Normative)

| ID | Level | Rule |
|----|-------|------|
| **PLG-T-1** | MUST | Transformer가 그래프를 수정하면 Pipeline은 validate를 재실행한다 |
| **PLG-T-2** | MUST NOT | Transformer는 Chunk의 text/span을 수정할 수 없다 (D-INV-0 보호) |
| **PLG-T-3** | MUST | Transformer의 수정은 명시적으로 반환되어야 한다 (암묵적 mutation 금지) |
| **PLG-T-4** | SHOULD | Transformer는 수정 사유를 diagnostics에 기록한다 |

> **Note:** `TransformerHook` 타입은 위 `PipelineHooks.afterMerge`에 이미 정의됨.

#### Pipeline 통합

```typescript
class TranslatorPipeline {
  constructor(
    private decomposer: DecomposeStrategy,
    private translator: TranslateStrategy,
    private merger: MergeStrategy,
    private options?: PipelineOptions,
    private plugins?: PipelinePlugin[]  // ← Plugin 주입
  ) {}
  
  async process(text: string): Promise<PipelineResult> {
    // Run-scope hooks 생성 (병렬 안전)
    // PLG-11: Plugin은 주입 순서대로 실행됨
    const runHooks = this.plugins?.map(p => ({
      plugin: p,
      hooks: p.createRunHooks()
    })) ?? [];
    
    const diagnostics = new DiagnosticsBagImpl();
    
    // Fix #2: 내부는 MutablePipelineContext, Plugin에는 Readonly로 노출
    const ctx: MutablePipelineContext = { input: text, diagnostics };
    
    // 1. beforeDecompose
    await this.runStandardHooks(runHooks, "beforeDecompose", ctx);
    
    // 2. Decompose (maxChunkSize는 항상 decomposer에 전달)
    const chunks = await this.decomposer.decompose(text, {
      maxChunkSize: this.options?.maxChunkSize,
    });
    
    // Chunk 불변식 체크 (D-INV-0/1/2/2b/3)
    this.validateChunks(chunks, text);
    ctx.chunks = chunks;
    
    // 3. afterDecompose
    await this.runStandardHooks(runHooks, "afterDecompose", ctx);
    
    // 4. OVL enforcement (TRN-104 로직)
    const hasOverlap = this.detectOverlap(chunks);
    if (hasOverlap && this.options?.deduplicate === false) {
      throw new Error("Actual overlap detected in chunks. deduplicate=false is not allowed (OVL-2).");
    }
    const effectiveDeduplicate = hasOverlap ? true : (this.options?.deduplicate ?? false);
    
    // 5. Translate (parallel with per-chunk hooks + concurrency limiting)
    const graphs = await this.translateAllWithHooks(chunks, runHooks, ctx);
    ctx.graphs = graphs;
    
    // 6. beforeMerge (barrier)
    await this.runStandardHooks(runHooks, "beforeMerge", ctx);
    
    // 7. Merge (with effectiveDeduplicate)
    let merged = this.merger.merge(graphs, {
      deduplicate: effectiveDeduplicate,
      linkStrategy: this.options?.linkStrategy,
    });
    ctx.merged = merged;
    
    // 8. afterMerge (Inspector + Transformer 모두 실행)
    merged = await this.runAfterMergeHooks(runHooks, ctx);
    ctx.merged = merged;
    
    // 9. Structural Validate
    const structuralValidation = validateGraph(merged);
    ctx.structuralValidation = structuralValidation;
    await this.runStandardHooks(runHooks, "afterStructuralValidate", ctx);
    
    // 10. Lexicon Validate (optional)
    // ...
    
    return {
      graph: merged,
      meta: { chunkCount: chunks.length, nodeCount: merged.nodes.length, hasOverlap },
      diagnostics: diagnostics.toReadonly()
    };
  }
  
  /**
   * Span 기반 overlap 검출 (TRN-104).
   * D-INV-2b(span.start 정렬)가 전제.
   */
  private detectOverlap(chunks: Chunk[]): boolean {
    for (let i = 0; i < chunks.length - 1; i++) {
      if (chunks[i].span.end > chunks[i + 1].span.start) {
        return true;
      }
    }
    return false;
  }
  
  /**
   * per-chunk hook + concurrency limiting (TRN-104 ParallelExecutor 사용).
   */
  private async translateAllWithHooks(
    chunks: Chunk[],
    runHooks: RunHookEntry[],
    ctx: MutablePipelineContext
  ): Promise<IntentGraph[]> {
    const executor = new ParallelExecutor<Chunk, IntentGraph>({
      concurrency: this.options?.concurrency ?? 5,
      timeout: this.options?.chunkTimeout,
      onError: this.options?.errorPolicy ?? "fail-fast",
    });
    
    return executor.execute(chunks, async (chunk, index) => {
      // chunk-local context 생성 (병렬 안전)
      const chunkCtx: ChunkHookContext = {
        ...this.toReadonly(ctx),
        chunkIndex: index,
        chunk,
        chunkGraph: undefined,
      };
      
      // beforeTranslateChunk
      await this.runChunkHooks(runHooks, "beforeTranslateChunk", chunkCtx);
      
      // Translate
      const graph = await this.translator.translate(chunk.text);
      
      // afterTranslateChunk (chunkGraph 포함)
      const afterCtx: ChunkHookContext = { ...chunkCtx, chunkGraph: graph };
      await this.runChunkHooks(runHooks, "afterTranslateChunk", afterCtx);
      
      return graph;
    });
  }
  
  /**
   * afterMerge는 모든 Plugin을 순서대로 실행.
   * Transformer가 그래프를 반환하면 validate 후 ctx 갱신.
   */
  private async runAfterMergeHooks(
    runHooks: RunHookEntry[],
    ctx: MutablePipelineContext
  ): Promise<IntentGraph> {
    let current = ctx.merged!;
    
    for (const { plugin, hooks } of runHooks) {
      const hook = hooks.afterMerge;
      if (!hook) continue;
      
      // Readonly context 전달
      const readonlyCtx = this.toReadonly(ctx);
      const result = await hook(readonlyCtx);
      
      // Transformer가 그래프를 반환한 경우
      if (result && isIntentGraph(result)) {
        if (plugin.kind !== "transformer") {
          throw new PluginError(
            plugin.name,
            "Inspector plugin cannot return IntentGraph from afterMerge"
          );
        }
        
        // PLG-T-1: validate 재실행
        const validation = validateGraph(result);
        if (!validation.valid) {
          throw new PluginError(
            plugin.name,
            `Transformer produced invalid graph: ${validation.error.message}`
          );
        }
        
        // 다음 Plugin은 수정된 그래프를 봄
        current = result;
        ctx.merged = current;
      }
    }
    
    return current;
  }
  
  /**
   * Chunk 불변식 검증 (D-INV-0/1/2/2b/3).
   */
  private validateChunks(chunks: Chunk[], input: string): void {
    if (chunks.length === 0) {
      throw new Error("D-INV-1 violation: chunks.length must be >= 1");
    }
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      // D-INV-2: index 일치
      if (chunk.index !== i) {
        throw new Error(`D-INV-2 violation: chunk[${i}].index is ${chunk.index}`);
      }
      
      // D-INV-3: span 범위
      const { start, end } = chunk.span;
      if (!(0 <= start && start <= end && end <= input.length)) {
        throw new Error(`D-INV-3 violation: invalid span {${start}, ${end}}`);
      }
      
      // D-INV-0: substring 보장
      if (chunk.text !== input.slice(start, end)) {
        throw new Error(`D-INV-0 violation: chunk.text !== input.slice(${start}, ${end})`);
      }
      
      // D-INV-2b: span.start 기준 정렬 (overlap 검출 전제)
      if (i > 0) {
        const prevStart = chunks[i - 1].span.start;
        if (prevStart > start) {
          throw new Error(`D-INV-2b violation: chunks[${i-1}].span.start (${prevStart}) > chunks[${i}].span.start (${start})`);
        }
      }
    }
  }
  
  /**
   * MutablePipelineContext → ReadonlyPipelineContext 변환.
   */
  private toReadonly(ctx: MutablePipelineContext): ReadonlyPipelineContext {
    return ctx as ReadonlyPipelineContext;  // 타입 단언 (실제로는 freeze 권장)
  }
  
  private async runStandardHooks(
    runHooks: RunHookEntry[],
    phase: Exclude<PipelinePhase, "beforeTranslateChunk" | "afterTranslateChunk" | "afterMerge">,
    ctx: MutablePipelineContext
  ): Promise<void> {
    for (const { hooks } of runHooks) {
      const hook = hooks[phase];
      if (hook) await hook(this.toReadonly(ctx));
    }
  }
  
  private async runChunkHooks(
    runHooks: RunHookEntry[],
    phase: "beforeTranslateChunk" | "afterTranslateChunk",
    ctx: ChunkHookContext
  ): Promise<void> {
    for (const { hooks } of runHooks) {
      const hook = hooks[phase];
      if (hook) await hook(ctx);
    }
  }
}

type RunHookEntry = { plugin: PipelinePlugin; hooks: PipelineHooks };
```

#### Usage

```typescript
// Plugin 조합
const pipeline = new TranslatorPipeline(
  new SlidingWindowDecomposer(8000, 0),
  new LLMTranslator(llm),
  new ConservativeMerger(),
  { concurrency: 10 },
  [
    orDetectorPlugin,           // Inspector: OR 감지
    coverageCheckerPlugin,      // Inspector: 커버리지
    dependencyRepairPlugin,     // Transformer: 의존성 보수
    loggingPlugin,              // Inspector: 로깅
  ]
);

const result = await pipeline.process(document);

// 진단 정보 확인
console.log(result.diagnostics.warnings);  // OR_DETECTED, QUOTE_MISSING
console.log(result.diagnostics.metrics);   // { quote_coverage: 0.85 }
```

#### Plugin Rules (Normative)

| ID | Level | Rule |
|----|-------|------|
| **PLG-1** | MUST | Plugin은 `createRunHooks()`로 run-scope 인스턴스를 생성한다 |
| **PLG-2** | MUST | Inspector Plugin은 diagnostics만 수정 가능하다 |
| **PLG-3** | MUST | Transformer Plugin은 수정 결과를 명시적으로 반환한다 |
| **PLG-4** | MUST | Transformer 수정 후 Pipeline은 validate를 재실행한다 |
| **PLG-5** | MUST NOT | 어떤 Plugin도 Chunk.text/span을 수정할 수 없다 |
| **PLG-6** | SHOULD | Plugin은 run-local state만 사용한다 (shared mutable state 금지) |
| **PLG-7** | MUST | beforeTranslateChunk/afterTranslateChunk는 `ChunkHookContext`를 받는다 (병렬 안전) |
| **PLG-8** | MUST | Plugin은 `ReadonlyPipelineContext`만 받는다 (내부는 MutablePipelineContext) |
| **PLG-9** | MUST | Pipeline은 Decompose 결과에 대해 D-INV-0/1/2/2b/3 검증을 수행한다 |
| **PLG-10** | MUST | `DiagnosticsBag.metric()`은 동일 name에 대해 last-write-wins (병렬 비결정성 주의) |
| **PLG-11** | MUST | Plugin은 **주입 순서대로** 실행된다 (배열 인덱스 순) |
| **PLG-12** | MUST | chunk translate는 `ParallelExecutor`를 사용하여 concurrency/timeout/errorPolicy를 준수한다 |
| **PLG-13** | SHOULD | 병렬 chunk hook에서 집계 시 `metricAdd()`/`metricObserve()` 사용 권장 |
| **DIAG-OBS-1** | SHOULD | `metricObserve()` 구현은 샘플 상한(예: 10,000) 또는 롤링 윈도우를 고려해야 함 (메모리 폭증 방지) |

> **Note:** TRN-106의 예시 코드는 TRN-104의 OVL enforcement 및 ParallelExecutor 로직을 포함해야 한다.
>
> **Metric Aggregation:** 병렬 chunk hook에서 동일 metric name을 여러 번 찍으면 `metric()`은 비결정적. 집계가 필요하면 `metricAdd()`(합계) 또는 `metricObserve()`(histogram)를 사용하거나, run-local state에 모아서 afterMerge에서 1회 기록하는 패턴 권장.
>
> **DIAG-OBS-1 운영 가이드:** `metricObserve()`는 관찰값 배열이 무한 증가할 수 있다. 대량 chunk 처리 시 메모리 문제를 방지하려면 구현에서 (1) 샘플 상한 설정, (2) 롤링 윈도우 적용, 또는 (3) streaming aggregation(online 알고리즘)을 고려해야 한다.

### Consequences

**Positive:**
- 옵션 지옥 없이 확장 가능 (OCP)
- 불변식(D-INV-0, C-ABS-1) 보호
- Inspector/Transformer 분리로 수정 범위 명확
- run-scope로 병렬 안전

**Negative:**
- Plugin 작성 시 학습 필요
- Transformer는 validate 오버헤드 발생

---

## ADR-TRN-107: Target Exporters (Generalized Emission Layer)

### Context

v0.x Translator는 `emitForManifesto()`라는 facade를 통해 Manifesto 런타임용 출력(InvocationPlan, melCandidates 등)을 생성했다. 이 접근법의 문제:

1. **Translator core가 Manifesto를 알게 됨** → TRN-BND-1/4 위반
2. **새 target 추가 시 core 수정 필요** → OCP 위반
3. **melCandidates가 Manifesto-specific** → 일반화 불가

LLM 호출을 `LLMPort`로 추상화한 것처럼, **출력 emission도 Port로 추상화**해야 한다.

### Decision

**TargetExporter Port 도입** — 입력(LLM)과 출력(Emission) 모두 Ports & Adapters 패턴 적용

```
                    ┌─────────────────────┐
                    │   LLM Adapters      │  입력 (LLMPort)
                    │  (openai/claude/…)  │
                    └──────────┬──────────┘
                               │
                               ▼
┌───────────────────────────────────────────────────────────────┐
│                    @manifesto-ai/translator                   │
│                         (Core)                                │
│  NL Text → [Pipeline] → IntentGraph → [TargetExporter Port]  │
└───────────────────────────────────────────────────────────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │  Target Exporters   │  출력 (TargetExporter)
                    │ (manifesto/json/…)  │
                    └─────────────────────┘
```

#### Core Types (in `@manifesto-ai/translator`)

```typescript
/**
 * Exporter에 전달되는 입력.
 * Pipeline 결과물의 읽기 전용 스냅샷.
 */
interface ExportInput {
  /** 최종 그래프 (병합 완료) */
  readonly graph: IntentGraph;
  
  /** 
   * Pipeline 진단 정보 (optional).
   * DiagnosticsReadonly는 TRN-106에서 정의됨.
   */
  readonly diagnostics?: DiagnosticsReadonly;
  
  /** 원본 소스 정보 (optional, traceback용) */
  readonly source?: Readonly<{
    text?: string;
    chunks?: readonly Chunk[];
  }>;
}

/**
 * Target Exporter Port.
 * 
 * TOut: 출력 타입 (target-specific)
 * TCtx: 컨텍스트 타입 (target-specific, e.g. Lexicon/Resolver)
 */
interface TargetExporter<TOut, TCtx = void> {
  /** Exporter 식별자 (e.g. "manifesto", "json", "openapi") */
  readonly id: string;
  
  /**
   * IntentGraph를 target-specific 출력으로 변환.
   * 
   * @param input - Pipeline 결과물
   * @param ctx - Target-specific 컨텍스트 (Lexicon, Resolver 등)
   * @returns Target-specific 출력물
   */
  export(input: ExportInput, ctx: TCtx): Promise<TOut>;
}

/**
 * Convenience helper.
 */
async function exportTo<TOut, TCtx>(
  exporter: TargetExporter<TOut, TCtx>,
  input: ExportInput,
  ctx: TCtx
): Promise<TOut> {
  return exporter.export(input, ctx);
}
```

#### Extension Hints (일반화된 melCandidates)

```typescript
/**
 * Target-agnostic extension hint.
 * 
 * "melCandidates"는 Manifesto-specific이므로, core에서는
 * 일반화된 ExtensionCandidate를 정의하고, kind로 구분한다.
 */
interface ExtensionCandidate {
  /** 관련 노드 ID */
  readonly nodeId: string;
  
  /** 
   * 힌트 종류.
   * - "mel": Manifesto Expression Language (Manifesto target)
   * - "jsonschema": JSON Schema extension (OpenAPI target)
   * - "patch-template": Patch template (generic)
   */
  readonly kind: string;
  
  /** kind-specific payload */
  readonly payload: unknown;
  
  /** 이 힌트가 적용되면 활성화되는 기능들 (optional) */
  readonly wouldEnable?: readonly string[];
}
```

> **Note:** `melCandidates`는 core에서 이름을 사용하지 않는다. Manifesto target exporter가 `ExtensionCandidate[]`를 반환하되, `kind="mel"`인 항목들이 기존 melCandidates 역할을 한다.

#### Manifesto Target Package (비-규범적 예시)

```typescript
// @manifesto-ai/translator-target-manifesto

import { 
  TargetExporter, 
  ExportInput, 
  ExtensionCandidate, 
  buildExecutionPlan  // Core helper (lowering 없음)
} from '@manifesto-ai/translator';
import type { Lexicon, Resolver } from '@manifesto-ai/core';  // type-only import

// Target 패키지 내부 타입 (InvocationPlan, LoweringResult 등)
import type { InvocationPlan, InvocationStep, LoweringResult } from './types';

/** Manifesto export에 필요한 컨텍스트 */
interface ManifestoExportContext {
  readonly lexicon: Lexicon;
  readonly resolver: Resolver;
  readonly domain?: string;
}

/** Manifesto target 출력 */
interface ManifestoBundle {
  readonly invocationPlan: InvocationPlan;
  readonly extensionCandidates: readonly ExtensionCandidate[];  // kind="mel" 포함
  readonly meta: Readonly<{
    nodeCount: number;
    readyCount: number;
    deferredCount: number;
    failedCount: number;
  }>;
}

/** Manifesto target exporter */
export const manifestoExporter: TargetExporter<ManifestoBundle, ManifestoExportContext> = {
  id: "manifesto",
  
  async export(input, ctx) {
    // 1. ExecutionPlan 생성 (Core helper, lowering 없음)
    const execPlan = buildExecutionPlan(input.graph);
    
    // 2. Lowering + InvocationPlan 생성 (Target-specific)
    //    lowerWithContext는 ExecutionPlan을 받아서 InvocationPlan을 반환
    const lowered = lowerWithContext(execPlan, ctx.lexicon, ctx.resolver);
    
    // 3. MEL candidates 생성 (kind="mel")
    const melCandidates = generateMelCandidates(lowered.deferred, ctx);
    
    // 4. Bundle 반환
    return {
      invocationPlan: lowered.invocationPlan,
      extensionCandidates: melCandidates.map(m => ({
        nodeId: m.nodeId,
        kind: "mel",
        payload: m.template,
        wouldEnable: m.capabilities,
      })),
      meta: {
        nodeCount: lowered.invocationPlan.steps.length,
        readyCount: lowered.ready.length,
        deferredCount: lowered.deferred.length,
        failedCount: lowered.failed.length,
      },
    };
  }
};

/**
 * 하위 호환 wrapper (deprecated).
 * 기존 emitForManifesto() 호출자를 위한 편의 함수.
 * 
 * @deprecated Use exportTo(manifestoExporter, input, ctx) instead.
 */
export async function emitForManifesto(
  graph: IntentGraph,
  lexicon: Lexicon,
  resolver: Resolver
): Promise<ManifestoBundle> {
  return manifestoExporter.export(
    { graph },
    { lexicon, resolver }
  );
}
```

#### Usage

```typescript
import { TranslatorPipeline, exportTo } from '@manifesto-ai/translator';
import { ClaudeAdapter } from '@manifesto-ai/translator-adapter-claude';
import { manifestoExporter } from '@manifesto-ai/translator-target-manifesto';

// 1. Pipeline 생성
const pipeline = new TranslatorPipeline(...);

// 2. NL → IntentGraph
const result = await pipeline.process(userInput);

// 3. IntentGraph → Manifesto Bundle (Target Export)
const bundle = await exportTo(manifestoExporter, {
  graph: result.graph,
  diagnostics: result.diagnostics,
  source: { text: userInput },
}, {
  lexicon: myLexicon,
  resolver: myResolver,
});

// 4. Bundle 사용
console.log(`Ready: ${bundle.meta.readyCount}, Deferred: ${bundle.meta.deferredCount}`);
for (const hint of bundle.extensionCandidates) {
  if (hint.kind === "mel") {
    console.log(`MEL candidate for ${hint.nodeId}:`, hint.payload);
  }
}
```

### Normative Rules

| ID | Level | Rule |
|----|-------|------|
| **EXP-1** | MUST | `@manifesto-ai/translator` core는 target-specific exporter 구현을 포함하지 않는다 |
| **EXP-2** | MUST | Target-specific emission은 `@manifesto-ai/translator-target-*` 패키지에서 TargetExporter로 구현한다 |
| **EXP-3** | MUST | TargetExporter는 `ExportInput.graph`를 immutable로 취급한다 (mutation 금지) |
| **EXP-4** | SHOULD | TargetExporter는 core의 `buildExecutionPlan()`, `validateGraph()` 헬퍼를 사용할 수 있다 |
| **EXP-5** | MUST | Target-specific extension hints는 `ExtensionCandidate[]` (kind + payload)로 표현한다 |
| **EXP-6** | MUST NOT | Core public API에 `emitForManifesto()` 노출 금지 (target 패키지에서 deprecated wrapper 허용) |
| **EXP-7** | MUST NOT | Core에서 "melCandidates" 용어 사용 금지 → `ExtensionCandidate(kind="mel")` |

### Package Dependency

```
@manifesto-ai/translator-target-manifesto
├── depends on: @manifesto-ai/translator (core types, helpers)
├── depends on: @manifesto-ai/core (Lexicon, Resolver types - type-only)
└── depends on: @manifesto-ai/intent-ir (if needed)

@manifesto-ai/translator-target-json
├── depends on: @manifesto-ai/translator (core types)
└── no other manifesto dependencies

@manifesto-ai/translator-target-openapi
├── depends on: @manifesto-ai/translator (core types)
└── depends on: openapi-types (or similar)
```

### Consequences

**Positive:**
- Output emission이 LLM adapters처럼 조합 가능
- Translator core가 target-agnostic 유지 (Does NOT Know 원칙 완전 준수)
- Manifesto 외 target (JSON, OpenAPI, GraphQL 등) 쉽게 추가 가능
- Manifesto-specific 진화가 core를 깨뜨리지 않음

**Negative:**
- Target emission 시 추가 패키지 설치 필요
- Consumer가 exporter를 명시적으로 선택해야 함 (약간의 boilerplate)

---

## Summary

### v0.1 vs v1.0 비교

| 측면 | v0.1 (God Object) | v1.0 (Clean Architecture) |
|------|-------------------|---------------------------|
| **구조** | 단일 함수 | 분리된 Strategy |
| **LLM 의존** | 직접 의존 | LLMPort 추상화 + 별도 패키지 |
| **처리 방식** | 순차 | 병렬 지원 |
| **Overlap** | 암묵적 | span 기반 검출 + dedup 강제 |
| **Lowering** | boolean flag | discriminated union + failure struct |
| **확장** | 옵션 추가 (God Object 회귀) | Plugin Hook (OCP 준수) |
| **Target 출력** | `emitForManifesto()` (core 결합) | TargetExporter Port (target 패키지 분리) |
| **테스트** | 어려움 | 용이 (Mock 사용) |

### 핵심 인터페이스

| Interface | 책임 | 입력 | 출력 |
|-----------|------|------|------|
| **DecomposeStrategy** | 텍스트 분해 (substring 보장) | `string` | `Chunk[]` |
| **TranslateStrategy** | 의미 추출 | `string` | `IntentGraph` |
| **MergeStrategy** | 그래프 병합 (dedup 포함) | `IntentGraph[]` | `IntentGraph` |
| **LLMPort** | LLM 호출 (입력 Port) | `LLMRequest` | `LLMResponse` |
| **TargetExporter** | Target-specific emission (출력 Port) | `ExportInput` | `TOut` (target-specific) |
| **PipelinePlugin** | 확장 레이어 (Inspector/Transformer) | `ReadonlyPipelineContext` | `void \| IntentGraph` |
| **ChunkHookContext** | per-chunk Hook 전용 (병렬 안전) | extends `ReadonlyPipelineContext` | - |

### 핵심 제약 (Constraints)

| ID | 규칙 |
|----|------|
| **C-ABS-1** | 비-Abstract 노드는 Abstract 노드에 의존 불가 |
| **D-INV-0** | chunk.text === input.slice(span.start, span.end) |
| **D-INV-2b** | chunks[i].span.start <= chunks[i+1].span.start (span 정렬, overlap 검출 전제) |
| **D-INV-3** | 0 <= span.start <= span.end <= input.length (빈 텍스트 허용) |
| **M-INV-5** | Merge 결과 그래프의 노드 ID는 전역 유일 (prefixNodeIds=false여도 re-id 필수) |
| **E-INV-1** | ExecutionPlan.steps에 Abstract 없음 (Core) |
| **E-INV-2** | ExecutionPlan.dependencyEdges는 steps 내 노드만 (Core) |
| **OVL-1** | overlap은 span 기반 검출 (prev.end > curr.start), D-INV-2b 전제 |
| **OVL-2** | overlap 검출 시 deduplicate 강제 true |
| **PEX-1** | ParallelExecutor 결과는 input order로 반환 (정확성 MUST) |
| **PLG-1** | Plugin은 createRunHooks()로 run-scope 인스턴스 생성 |
| **PLG-4** | Transformer 수정 후 Pipeline은 validate 재실행 |
| **PLG-5** | 어떤 Plugin도 Chunk.text/span 수정 불가 |
| **PLG-7** | chunk Hook은 ChunkHookContext를 받음 (병렬 안전) |
| **PLG-8** | Plugin은 ReadonlyPipelineContext만 받음 |
| **PLG-11** | Plugin은 주입 순서대로 실행 |
| **PLG-12** | chunk translate는 ParallelExecutor로 concurrency 준수 |
| **PLG-13** | 병렬 chunk hook 집계 시 metricAdd()/metricObserve() 권장 |
| **DIAG-OBS-1** | metricObserve() 구현은 샘플 상한/롤링 윈도우 고려 (메모리 폭증 방지) |
| **EXP-1** | Core는 target-specific exporter 구현 포함 금지 |
| **EXP-3** | TargetExporter는 graph를 immutable로 취급 |
| **EXP-6** | Core에 emitForManifesto() 노출 금지 |
| **EXP-7** | Core에서 "melCandidates" 용어 사용 금지 → ExtensionCandidate(kind="mel") |
| **L-INV-1~3** | LoweringResult 불변식 (Target Exporter 소유) |

### 패키지 구조

```
@manifesto-ai/translator              # Core: interfaces, strategies, pipeline, plugins, ports (SDK/Target 무의존)
@manifesto-ai/translator-adapter-openai   # LLM Adapter (depends on 'openai')
@manifesto-ai/translator-adapter-claude   # LLM Adapter (depends on '@anthropic-ai/sdk')
@manifesto-ai/translator-adapter-ollama   # LLM Adapter (depends on 'ollama')
@manifesto-ai/translator-target-manifesto # Target Exporter (Manifesto bundle)
@manifesto-ai/translator-target-json      # Target Exporter (JSON/debugging)
@manifesto-ai/translator-target-openapi   # Target Exporter (OpenAPI spec)
```

### Usage Example

```typescript
// 1. 설치
npm install @manifesto-ai/translator @manifesto-ai/translator-adapter-claude @manifesto-ai/translator-target-manifesto

// 2. Import
import { 
  createDefaultPipeline, 
  TranslatorPipeline,
  validateGraph, 
  buildExecutionPlan,    // Core (lowering 없음)
  exportTo,
  orDetectorPlugin,
  coverageCheckerPlugin
} from '@manifesto-ai/translator';
import { ClaudeAdapter } from '@manifesto-ai/translator-adapter-claude';
import { manifestoExporter } from '@manifesto-ai/translator-target-manifesto';

// 3. Pipeline 생성 (with Plugins)
const llm = new ClaudeAdapter({ apiKey: process.env.CLAUDE_KEY });
const pipeline = new TranslatorPipeline(
  new SlidingWindowDecomposer(8000, 0),
  new LLMTranslator(llm),
  new ConservativeMerger(),
  { concurrency: 10 },
  [orDetectorPlugin, coverageCheckerPlugin]  // ← Plugins
);

// 4. 실행
const result = await pipeline.process(longDocument);
console.log(`${result.meta.chunkCount} chunks → ${result.meta.nodeCount} nodes`);

// 5. 진단 정보 확인 (Plugin 결과)
for (const warn of result.diagnostics.warnings) {
  console.log(`[${warn.code}] ${warn.message}`);
}
console.log(`Quote coverage: ${result.diagnostics.metrics.get('quote_coverage')}`);

// 6. 검증
const validation = validateGraph(result.graph);
if (!validation.valid) {
  throw new Error(validation.error.message);
}

// 7. Core 실행 계획 생성 (Lowering 없음)
const execPlan = buildExecutionPlan(result.graph);
for (const step of execPlan.steps) {
  console.log(`Step: ${step.nodeId} (${step.resolution.status})`);
}

// 8. Manifesto target 실행 계획 생성 (Lowering 포함)
const bundle = await exportTo(
  manifestoExporter,
  { graph: result.graph, diagnostics: result.diagnostics, source: { text: longDocument } },
  { lexicon: myLexicon, resolver: myResolver }
);

for (const step of bundle.invocationPlan.steps) {
  switch (step.lowering.status) {
    case "ready":
      console.log(`Ready: ${step.nodeId}`);
      break;
    case "deferred":
      console.log(`Deferred: ${step.nodeId} - ${step.lowering.reason}`);
      break;
    case "failed":
      console.log(`Failed: ${step.nodeId} - ${step.lowering.failure.kind}: ${step.lowering.failure.details}`);
      break;
  }
}
```

---

## References

- [Hexagonal Architecture (Alistair Cockburn)](https://alistair.cockburn.us/hexagonal-architecture/)
- [Clean Architecture (Robert C. Martin)](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Strategy Pattern (GoF)](https://refactoring.guru/design-patterns/strategy)
- Manifesto ARCHITECTURE-v2.0.0
- Manifesto ADR-001 (Layer Separation)
- [Intent IR v0.2 SPEC](../../../intent-ir/docs/SPEC-v0.2.0.md)

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-28 | Initial unified ADR. ADR ID를 TRN-101~105로 변경. |
| 1.0.1 | 2026-01-28 | **Critical fixes:** (1) Role enum을 Intent IR v0.2(=v0.1 동일)와 일치 (6개: TARGET\|THEME\|SOURCE\|DEST\|INSTRUMENT\|BENEFICIARY). (2) DependencyEdge 방향 수정 (from=dependency→to=dependent). (3) D-INV-3을 `0 <= start <= end`로 변경하여 빈 텍스트 허용. (4) overlap 검출을 옵션 기반→span 기반으로 변경. (5) LoweringFailureReason을 string union→struct로 변경. |
| 1.0.2 | 2026-01-28 | **ADR-TRN-106 추가:** Pipeline Plugins (Composable Layers). Hook 기반 확장 시스템. Inspector/Transformer 분리. run-scope 병렬 안전. PLG-1~7 규범 추가. |
| 1.0.3 | 2026-01-28 | **ADR-TRN-106 정합성 수정:** (1) PipelineHooks 타입에 TransformerHook 반환값 지원. (2) MutablePipelineContext/ReadonlyPipelineContext 분리. (3) per-chunk hook에 ChunkHookContext 도입 (병렬 레이스 방지). (4) afterMerge에서 Inspector+Transformer 모두 실행. (5) Pipeline에 Chunk 불변식 검증 추가. (6) metric() last-write-wins 규칙 명시. PLG-7~10 추가. |
| 1.0.4 | 2026-01-28 | **Final Critical fixes:** (1) PKG-1을 "SDK 무의존 core 로직 포함"으로 명확화. (2) translateAllWithHooks에서 Promise.all→ParallelExecutor로 변경 (concurrency 준수). (3) D-INV-2b (span.start 정렬) 불변식 추가 및 validateChunks에 체크 추가. (4) process()에 OVL enforcement 로직 명시. (5) PLG-11 (주입 순서 실행), PLG-12 (ParallelExecutor 사용) 추가. |
| 1.0.5 | 2026-01-28 | **Final polish (GO 승인 후):** (1) M-INV-5 추가: Merge 결과 그래프 노드 ID 전역 유일 보장 (re-id 필수). (2) DiagnosticsBag에 metricAdd()/metricObserve() 집계 메서드 추가 (PLG-13). (3) maxChunkSize를 decomposer에 항상 전달하도록 process() 수정. |
| 1.0.6 | 2026-01-28 | **ADR-TRN-107 추가:** Target Exporters (Generalized Emission Layer). (1) TargetExporter Port 도입 (LLMPort처럼 출력도 추상화). (2) emitForManifesto()를 core에서 제거, target 패키지로 이동. (3) melCandidates → ExtensionCandidate(kind="mel")로 일반화. (4) TRN-BND-5 추가: core는 target-specific emission 포함 금지. (5) EXP-1~7 규범 추가. (6) @manifesto-ai/translator-target-* 패키지 구조 정의. |
| 1.0.7 | 2026-01-28 | **Critical fixes (GO 조건):** (1) TRN-105 분리: ExecutionPlan(Core, lowering 없음) vs InvocationPlan(Target, lowering 포함) - TRN-107 정합성 해결. (2) PEX-1~3 규범 추가: ParallelExecutor 결과 순서 보장 (input order 유지 MUST). **Polish:** (3) M-INV-5 vs prefixNodeIds=false 관계 명확화: false여도 re-id로 유일성 보장 필수. (4) DIAG-OBS-1 추가: metricObserve() 샘플 상한/롤링 윈도우 운영 가이드. (5) DiagnosticsReadonly 타입 정의 추가 (TRN-107에서 참조). |
| 1.0.8 | 2026-01-28 | **텍스트 정합성 최종 수정:** (1) EXP-4 규범: `buildInvocationPlan()` → `buildExecutionPlan()`. (2) TRN-107 Manifesto exporter 예시: Core에서 InvocationPlan import 제거, buildExecutionPlan 사용, type-only import 적용. (3) Summary Usage Example: Core (buildExecutionPlan) vs Target (manifestoExporter) 흐름 분리, target 패키지 설치 추가. |
