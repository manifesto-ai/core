# @manifesto-ai/effect-utils — Foundational Design Rationale (FDR)

> **Version:** 1.0  
> **Status:** Draft  
> **Purpose:** Document the "why" behind every major design decision for effect-utils

---

## Table of Contents

1. [Purpose of This Document](#1-purpose-of-this-document)
2. [FDR-EU-001: Separate Package from Host](#fdr-eu-001-separate-package-from-host)
3. [FDR-EU-002: Function Composition over Configuration](#fdr-eu-002-function-composition-over-configuration)
4. [FDR-EU-003: Combinators as Building Blocks](#fdr-eu-003-combinators-as-building-blocks)
5. [FDR-EU-004: Primitives Only — No Domain Adapters](#fdr-eu-004-primitives-only--no-domain-adapters)
6. [FDR-EU-005: Schema-Driven Handler Factory](#fdr-eu-005-schema-driven-handler-factory)
7. [FDR-EU-006: Settled Type for Partial Failures](#fdr-eu-006-settled-type-for-partial-failures)
8. [FDR-EU-007: Patch Transform Helpers](#fdr-eu-007-patch-transform-helpers)
9. [FDR-EU-008: No Async Iterator / Stream Abstractions](#fdr-eu-008-no-async-iterator--stream-abstractions)
10. [Summary: The effect-utils Identity](#summary-the-effect-utils-identity)

---

## 1. Purpose of This Document

This document records the **foundational design decisions** of `@manifesto-ai/effect-utils`.

effect-utils exists because:

1. **Host Contract defines "what" handlers must do** — but not "how" to build them
2. **Common patterns emerge** — timeout, retry, parallel, fallback
3. **Boilerplate accumulates** — every handler repeats similar logic
4. **Type safety matters** — `Record<string, unknown>` is not good enough

For each decision, we document:

| Section | Content |
|---------|---------|
| **Decision** | What we decided |
| **Context** | Why this decision was needed |
| **Alternatives** | What other options existed |
| **Rationale** | Why we chose this option |
| **Consequences** | What this enables and constrains |

---

## FDR-EU-001: Separate Package from Host

### Decision

`effect-utils` is a **separate package** from `@manifesto-ai/host`.

```
@manifesto-ai/effect-utils   ← New package
        │
        ▼ (types only)
@manifesto-ai/core           ← Patch, Snapshot types

@manifesto-ai/host
        │
        ├──▶ @manifesto-ai/core
        └──▶ @manifesto-ai/effect-utils (optional peer)
```

### Context

Effect Handler utilities could live in several places:

1. Inside `@manifesto-ai/host`
2. Inside `@manifesto-ai/core`
3. As a separate package

Host already has responsibilities:
- Compute loop orchestration
- Effect execution coordination
- Requirement fulfillment
- Snapshot persistence

Adding utilities would bloat Host and create mixed concerns.

### Alternatives Considered

| Alternative | Description | Why Rejected |
|-------------|-------------|--------------|
| **Utilities in Host** | Export helpers from host package | Bloats Host, forces unnecessary dependencies |
| **Utilities in Core** | Export helpers from core package | Violates Core purity (utilities are for IO) |
| **No utilities** | Let developers write their own | Boilerplate, inconsistent patterns |

### Rationale

**Separation enables:**

| Benefit | Description |
|---------|-------------|
| Independent versioning | Utils can iterate without Host changes |
| Optional adoption | Existing Host users aren't forced to update |
| Testability | Handlers can be unit tested without Host |
| Tree-shaking | Apps only bundle what they use |

**Mirrors Builder pattern:**

```
Builder : Core = effect-utils : Host

Builder provides DX for defining domains (produces Schema)
effect-utils provides DX for implementing handlers (produces Patch[])
```

### Consequences

| Enables | Constrains |
|---------|------------|
| Focused, small packages | One more package to manage |
| Independent testing | Need to coordinate releases |
| Optional adoption | Documentation must explain relationship |
| Clear ownership | |

### Canonical Statement

> **effect-utils is to Host what Builder is to Core: a DX layer that doesn't execute.**

---

## FDR-EU-002: Function Composition over Configuration

### Decision

effect-utils uses **function composition** pattern, not configuration objects.

```typescript
// ✅ Function composition
const handler = withRetry(
  withTimeout(
    fetchData,
    5000
  ),
  { maxRetries: 3 }
);

// ❌ NOT configuration object
const handler = createHandler({
  fetch: fetchData,
  timeout: 5000,
  retry: { max: 3 },
  fallback: null,
  // ... 20 more options
});
```

### Context

Two paradigms exist for building complex behavior:

**Configuration-based:**
```typescript
createFetcher({
  baseUrl: 'https://api.example.com',
  timeout: 5000,
  retry: { max: 3, backoff: 'exponential' },
  auth: { type: 'bearer', token: '...' },
  cache: { ttl: 60000 },
  transform: (data) => data.results,
  onError: (err) => console.error(err),
  // Options keep growing...
});
```

**Composition-based:**
```typescript
pipe(
  fetchJson,
  withAuth(bearerToken),
  withTimeout(5000),
  withRetry(3),
  withCache(60000),
  mapResult(data => data.results)
);
```

### Alternatives Considered

| Alternative | Description | Why Rejected |
|-------------|-------------|--------------|
| **Config objects** | Single object with all options | Option explosion, hard to type, hard to extend |
| **Builder pattern** | `new Handler().timeout(5000).retry(3)` | Mutable, method chaining context hard for LLMs |
| **Decorator pattern** | `@timeout(5000) @retry(3) class Handler` | TypeScript decorators are unstable, class-based |

### Rationale

**For Developers:**

| Aspect | Configuration | Composition |
|--------|--------------|-------------|
| Learning curve | Memorize all options | Learn small functions |
| Customization | Fork or extend config | Compose new functions |
| Testing | Mock entire config | Test each function |
| Type inference | Complex conditional types | Simple generics |

**For LLMs:**

| Aspect | Configuration | Composition |
|--------|--------------|-------------|
| Parsing | Must understand all options | Each function is independent |
| Generation | Option combinations explode | Linear composition |
| Validation | Schema validation complex | Type check each step |
| Explanation | "What does this config do?" | "A wraps B wraps C" |

```typescript
// LLM can understand this step by step:
withRetry(           // 3. If it fails, retry up to 3 times
  withTimeout(       // 2. With a 5 second timeout
    fetchAIS,        // 1. Fetch AIS data
    5000
  ),
  { maxRetries: 3 }
)
```

### Consequences

| Enables | Constrains |
|---------|------------|
| Small, focused functions | No single "configure everything" API |
| Easy to extend | Composition order matters |
| LLM-friendly | Slightly more verbose |
| Type inference works naturally | |

### Canonical Statement

> **Small functions that compose beat large configs that configure.**

---

## FDR-EU-003: Combinators as Building Blocks

### Decision

effect-utils provides a small set of **stateless combinators** that handle common execution patterns.

**Core Combinators (v1.0):**

| Combinator | Purpose | Signature |
|------------|---------|-----------|
| `withTimeout` | Time-bound execution | `(fn, ms) → fn'` |
| `withRetry` | Retry on failure | `(fn, options) → fn'` |
| `withFallback` | Default on failure | `(fn, fallback) → fn'` |
| `parallel` | Concurrent execution | `(fns) → fn` |
| `race` | First success wins | `(fns) → fn` |
| `sequential` | Ordered execution | `(fns) → fn` |

**Explicitly Excluded (stateful, Host policy domain):**

| Pattern | Why Excluded |
|---------|--------------|
| `circuitBreaker` | Requires cross-request state |
| `rateLimit` | Requires cross-request state |
| `cache` | Requires cross-request state |
| `bulkhead` | Requires cross-request state |

### Context

Every Effect Handler eventually needs:
- Timeout handling (external APIs can hang)
- Retry logic (transient failures happen)
- Fallback values (graceful degradation)
- Parallel execution (multiple independent calls)

Without utilities, every handler reimplements these:

```typescript
// Without combinators — repeated in every handler
async function myHandler(params) {
  let attempts = 0;
  while (attempts < 3) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const result = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      return [{ op: 'set', path: 'data', value: result }];
    } catch (e) {
      attempts++;
      if (attempts >= 3) return [{ op: 'set', path: 'error', value: e.message }];
      await sleep(attempts * 1000);
    }
  }
}
```

### Alternatives Considered

| Alternative | Description | Why Rejected |
|-------------|-------------|--------------|
| **Full RxJS integration** | Observable-based combinators | Heavy dependency, learning curve |
| **Effect-TS style** | Algebraic effects | Paradigm shift too large |
| **Minimal (just types)** | Only provide types, no runtime | Doesn't reduce boilerplate |
| **Include circuit breaker** | Stateful resilience | Violates stateless principle (see below) |

### Rationale

**Goldilocks principle:** Enough to eliminate boilerplate, not so much that it becomes a framework.

```typescript
// With combinators — declarative, composable
const fetchWithResilience = withRetry(
  withTimeout(fetch, 5000),
  { maxRetries: 3, backoff: 'exponential' }
);

const handler = async (params) => {
  const result = await fetchWithResilience(params.url);
  return [{ op: 'set', path: 'data', value: result }];
};
```

**Combinator selection criteria:**

| Criterion | Included | Excluded |
|-----------|----------|----------|
| Needed in >50% of handlers | ✅ timeout, retry | |
| Stateless (no cross-request memory) | ✅ all v1.0 combinators | ❌ circuit breaker |
| Framework-agnostic | ✅ pure functions | ❌ React-specific |
| Simple signature | ✅ `fn → fn` | ❌ complex type gymnastics |

### Why Circuit Breaker is Host Policy, Not effect-utils

**Host Contract §14 explicitly grants policy freedom:**

> Host MAY: Retry, Circuit break, Timeout, Parallelize...
> These are **policy decisions**, not part of the Contract.

Circuit breaker requires:
1. **State** — failure count, last failure time, circuit state
2. **Cross-request memory** — "this endpoint failed 5 times in last minute"
3. **Policy decisions** — when to open, when to half-open, when to close

This belongs in Host (or `@manifesto-ai/host-utils` if needed), not effect-utils.

**"Stateless circuit breaker" is a contradiction:**

```typescript
// ❌ "Stateless circuit breaker" degrades to just retry + timeout
const pseudoCircuitBreaker = withRetry(
  withTimeout(fn, 1000),
  { maxRetries: 0 }  // fail fast
);
// This is NOT a circuit breaker — it has no memory across requests
```

**Correct pattern: circuit open → immediate failure patch**

```typescript
// Host-level circuit breaker (outside effect-utils)
class HostCircuitBreaker {
  private state: Map<string, CircuitState> = new Map();
  
  async executeEffect(req: Requirement): Promise<Patch[]> {
    const circuit = this.state.get(req.type);
    
    if (circuit?.isOpen) {
      // Don't skip — return failure patches per Host Contract
      return [
        toErrorPatch('system.lastError', {
          code: 'CIRCUIT_OPEN',
          message: `Circuit breaker open for ${req.type}`
        })
      ];
    }
    
    // Execute and update circuit state...
  }
}
```

### Consequences

| Enables | Constrains |
|---------|------------|
| Consistent resilience patterns | No stateful patterns in v1.0 |
| Composable building blocks | Circuit breaker needs Host-level solution |
| Predictable behavior | No magic, explicit composition |
| Small bundle size | |
| Clear boundary with Host | |

### Canonical Statement

> **Combinators transform functions. They are stateless. Stateful resilience patterns belong in Host.**

---

## FDR-EU-004: Primitives Only — No Domain Adapters

### Decision

effect-utils provides **only primitives**. It does NOT provide:
- HTTP clients
- Database adapters
- Message queue connectors
- Domain-specific protocols (AIS, EDI, SOAP, etc.)

### Context

The temptation is strong:

```typescript
// "Wouldn't it be nice if..."
import { httpEffect, wsEffect, dbEffect } from '@manifesto-ai/effect-utils';

const handler = httpEffect({
  url: '/api/data',
  method: 'GET',
  timeout: 5000
});
```

But this path leads to:
- Maintaining adapters for every protocol
- Version conflicts with native SDKs
- Always being behind latest API changes
- Framework bloat

### Alternatives Considered

| Alternative | Description | Why Rejected |
|-------------|-------------|--------------|
| **Include HTTP adapter** | Built-in fetch wrapper | Everyone has preferences (axios, ky, got) |
| **Include DB adapters** | Prisma, Drizzle, etc. | Version conflicts, massive scope |
| **Adapter plugin system** | `registerAdapter('http', ...)` | Plugin systems add complexity |

### Rationale

**Manifesto provides the "what", developers provide the "how".**

```
effect-utils provides:
├── withTimeout()     ← Generic timing
├── withRetry()       ← Generic resilience  
├── parallel()        ← Generic concurrency
└── toPatch()         ← Generic transformation

Developers provide:
├── aisClient         ← Their AIS SDK
├── maerskApi         ← Their Maersk integration
├── unipassClient     ← Their customs API
└── legacySoapClient  ← Their legacy adapter
```

**Comparison with ecosystem:**

| Library | Provides Primitives | Provides Adapters |
|---------|--------------------|--------------------|
| Redux Saga | ✅ `call`, `put` | ❌ |
| React Query | ✅ caching, retry | ❌ (you provide fetcher) |
| effect-utils | ✅ combinators | ❌ |

### Consequences

| Enables | Constrains |
|---------|------------|
| Zero opinions on HTTP libraries | Developers choose their stack |
| No version conflicts | More integration code |
| Small package size | No "batteries included" |
| Focus on core value | |

### Canonical Statement

> **effect-utils makes building handlers easier. It doesn't build them for you.**

---

## FDR-EU-005: Schema-Driven Handler Factory

### Decision

effect-utils provides `defineEffectSchema` and `createHandler` for **type-safe handler creation**.

**Zod is a required dependency (`dependencies`, not `peerDependencies`).**

```typescript
// 1. Define schema
const myEffectSchema = defineEffectSchema({
  type: 'api.myEffect',
  input: z.object({
    userId: z.string(),
    limit: z.number().default(10)
  }),
  output: z.object({
    items: z.array(ItemSchema),
    total: z.number()
  }),
  outputPath: 'data.items'
});

// 2. Create handler with full type inference
const myHandler = createHandler(myEffectSchema, async (input, snapshot) => {
  // input is typed: { userId: string, limit: number }
  // snapshot is Readonly<Snapshot> — read-only context per Host Contract
  const result = await fetchItems(input.userId, input.limit);
  // return is validated against output schema
  return { items: result.items, total: result.total };
});
```

### Context

Host Contract defines handler signature as:

```typescript
type EffectHandler = (
  type: string,
  params: Record<string, unknown>  // ← No type safety
) => Promise<Patch[]>;
```

This means:
- `params` is untyped
- Return type is just `Patch[]`
- No validation of effect type matching
- Runtime errors instead of compile errors

### Alternatives Considered

| Alternative | Description | Why Rejected |
|-------------|-------------|--------------|
| **No schema, just types** | `as MyParams` casting | No runtime validation |
| **JSON Schema** | Standard schema format | Worse TypeScript integration than Zod |
| **Manual validation** | Developer validates in handler | Boilerplate, inconsistent |
| **Zod as peer optional** | Let users choose schema lib | Type-level exposure requires Zod anyway; DX/docs/LLM generation all diverge |

### Rationale

**Why Zod is required (not optional peer):**

1. **Builder already adopted Zod-first** — Consistency across Manifesto packages
2. **Type-level exposure** — Once `z.ZodTypeAny` appears in types, Zod must be installed anyway
3. **DX clarity** — Optional peer creates "installed but not imported" runtime errors
4. **LLM generation** — Single schema library means no branching in generated code

**Zod provides both runtime validation and type inference:**

```typescript
const schema = z.object({ userId: z.string() });

// Runtime: validates actual data
schema.parse(untrustedInput);

// Compile time: infers TypeScript type
type Input = z.infer<typeof schema>;  // { userId: string }
```

**Schema bridges MEL and TypeScript:**

```
MEL Effect Declaration:
effect api.myEffect({ userId: customerId, into: data.items })
                      ↓
Effect Schema (effect-utils):
defineEffectSchema({ type: 'api.myEffect', input: z.object({...}) })
                      ↓
Handler Implementation:
createHandler(schema, async (input) => { /* typed! */ })
```

**Future Alternative (if needed):**

If demand arises for other schema libraries (Valibot, Yup), provide via sub-entrypoint:

```typescript
// Default (Zod)
import { defineEffectSchema } from '@manifesto-ai/effect-utils';

// Future: alternative schema libs via sub-entrypoints
import { defineEffectSchema } from '@manifesto-ai/effect-utils/valibot';
```

This keeps main entrypoint clean while allowing extension.

### Handler Contract Alignment

`createHandler` aligns with Host Contract §7.5:

| Host Contract Rule | createHandler Behavior |
|--------------------|------------------------|
| Handler MAY receive snapshot as read-only context | `snapshot: Readonly<Snapshot>` parameter |
| Handler MUST NOT implement domain logic | **Developer responsibility — documented, not enforced** |
| Handler MUST return `Patch[]` | Auto-transforms output to patches via `outputPath` |
| Handler MUST NOT throw | Wraps implementation in try/catch, converts to error patches |

**Critical: "No domain logic in handlers" is a MUST NOT from Host Contract.**

```typescript
// ❌ WRONG: Domain logic in handler
createHandler(schema, async (input, snapshot) => {
  if (input.amount > 1000) {  // Business rule!
    return { requiresApproval: true };
  }
  // ...
});

// ✅ CORRECT: Pure IO, no decisions
createHandler(schema, async (input, snapshot) => {
  const result = await api.fetchData(input.id);
  return result;  // Just return data, let Flow decide
});
```

### Consequences

| Enables | Constrains |
|---------|------------|
| Type-safe handler development | Zod is required dependency |
| Runtime input validation | Schema must match MEL effect |
| Output path auto-patching | |
| Self-documenting effects | |
| Consistent with Builder | |

### Canonical Statement

> **Schema is the contract between MEL declaration and TypeScript implementation. Zod is the language of that contract.**

---

## FDR-EU-006: Settled Type for Partial Failures

### Decision

`parallel()` and `race()` return **Settled** results, not throwing on partial failure.

```typescript
type Settled<T> = 
  | { status: 'fulfilled'; value: T }
  | { status: 'rejected'; reason: Error };

// parallel returns all results, even if some failed
const results = await parallel({
  ais: fetchAIS,
  tos: fetchTOS,
  weather: fetchWeather
})();

// results: {
//   ais: { status: 'fulfilled', value: AisData },
//   tos: { status: 'rejected', reason: Error },
//   weather: { status: 'fulfilled', value: WeatherData }
// }
```

### Context

Standard Promise APIs have different behaviors:

```typescript
// Promise.all — fails fast, loses successful results
await Promise.all([fetchA(), fetchB(), fetchC()]);
// If fetchB fails, you don't get fetchA's result

// Promise.allSettled — keeps all results
await Promise.allSettled([fetchA(), fetchB(), fetchC()]);
// Returns all results with status
```

For Effect Handlers, partial success is common and valuable:
- API A succeeded, API B failed → still useful
- 3/5 carriers responded → show partial results

### Alternatives Considered

| Alternative | Description | Why Rejected |
|-------------|-------------|--------------|
| **Throw on any failure** | Use Promise.all behavior | Loses successful results |
| **Return `T | null`** | Null for failures | Loses error information |
| **Return `Result<T, E>`** | Custom Result type | Another type to learn |

### Rationale

**Settled mirrors Promise.allSettled — already known to JS developers.**

```typescript
// Standard JavaScript
const results = await Promise.allSettled([p1, p2, p3]);
results[0].status === 'fulfilled' ? results[0].value : results[0].reason;

// effect-utils parallel — same pattern
const results = await parallel({ a: p1, b: p2, c: p3 })();
results.a.status === 'fulfilled' ? results.a.value : results.a.reason;
```

**Enables graceful degradation:**

```typescript
const results = await parallel({
  ais: fetchAIS,
  tos: fetchTOS,
  weather: fetchWeather
})();

return [
  toPatch('signals.ais', results.ais.status === 'fulfilled' ? results.ais.value : null),
  toPatch('signals.tos', results.tos.status === 'fulfilled' ? results.tos.value : null),
  toPatch('signals.weather', results.weather.status === 'fulfilled' ? results.weather.value : null),
  toPatch('signals.errors', collectRejected(results)),
];
```

### Consequences

| Enables | Constrains |
|---------|------------|
| Partial success handling | Must check status on each result |
| Error information preserved | Slightly more verbose |
| Consistent with JS standards | |
| Explicit failure handling | |

### Canonical Statement

> **Partial failure is not total failure. Keep what succeeded.**

---

## FDR-EU-007: Patch Transform Helpers

### Decision

effect-utils provides helpers to transform results into `Patch[]`.

```typescript
// Single patch
toPatch('data.user', userData);
// → { op: 'set', path: 'data.user', value: userData }

// Multiple patches
toPatches({
  'data.user': userData,
  'data.loadedAt': Date.now()
});
// → [{ op: 'set', path: 'data.user', value: userData },
//    { op: 'set', path: 'data.loadedAt', value: 1234567890 }]

// Error patch
toErrorPatch('data.error', new Error('Failed'));
// → { op: 'set', path: 'data.error', value: { code: 'Error', message: 'Failed' } }

// Collect errors from Settled results
collectErrors(settledResults, 'signals.errors');
// → [{ op: 'set', path: 'signals.errors', value: { ais: {...}, tos: {...} } }]
```

### Context

Every Effect Handler must return `Patch[]`. Without helpers:

```typescript
async function handler(params) {
  const data = await fetchData();
  
  // Manual patch construction — verbose, error-prone
  return [
    { op: 'set', path: 'data.result', value: data },
    { op: 'set', path: 'data.loadedAt', value: Date.now() },
    { op: 'set', path: 'data.status', value: 'ready' },
  ];
}
```

With helpers:

```typescript
async function handler(params) {
  const data = await fetchData();
  
  return toPatches({
    'data.result': data,
    'data.loadedAt': Date.now(),
    'data.status': 'ready',
  });
}
```

### Alternatives Considered

| Alternative | Description | Why Rejected |
|-------------|-------------|--------------|
| **No helpers** | Manual patch construction | Boilerplate, typos in 'op' field |
| **Patch builder class** | `new PatchBuilder().set(...).merge(...)` | Over-engineering |
| **Auto-patching** | Detect changes automatically | Magic, hard to debug |

### Rationale

**Helpers reduce ceremony without hiding intent:**

```typescript
// Before: What is 'set'? What is 'op'? Easy to typo.
{ op: 'set', path: 'data.x', value: y }

// After: Clear intent, less syntax
toPatch('data.x', y)
```

**Type safety:**

```typescript
// toPatch enforces correct structure
function toPatch(path: string, value: unknown): Patch {
  return { op: 'set', path, value };
}

// Can't accidentally create invalid patch
toPatch('data.x', y);  // Always valid
{ op: 'ste', path: 'data.x', value: y };  // Typo goes unnoticed
```

### Consequences

| Enables | Constrains |
|---------|------------|
| Less boilerplate | Still manual path strings |
| Fewer typos | Paths not validated at compile time |
| Consistent error formatting | |
| Readable handler code | |

### Canonical Statement

> **Helpers reduce syntax, not power. You can still construct patches manually.**

---

## FDR-EU-008: No Async Iterator / Stream Abstractions

### Decision

effect-utils does NOT provide async iterator, observable, or stream abstractions.

```typescript
// ❌ NOT provided
import { stream, observe, iterate } from '@manifesto-ai/effect-utils';

// ❌ NOT provided
effect.stream('ws://quotes', {
  onMessage: (msg) => toPatch('quotes', msg),
  debounce: 500
});
```

### Context

Manifesto's event flow for streaming data:

```
External Stream (WS/SSE/etc.)
        │
        ▼
┌───────────────────────────────────────┐
│  Bridge / Ingress Layer               │  ← Streaming belongs HERE
│  ┌─────────────────────────────────┐  │
│  │ SourceEvent Creation            │  │
│  │ - Debouncing / Buffering        │  │
│  │ - Batching                      │  │
│  └─────────────────────────────────┘  │
│              │                        │
│              ▼                        │
│  ┌─────────────────────────────────┐  │
│  │ Projection                      │  │
│  │ SourceEvent → IntentBody        │  │
│  └─────────────────────────────────┘  │
│              │                        │
│              ▼                        │
│  ┌─────────────────────────────────┐  │
│  │ Issuer                          │  │
│  │ IntentBody → IntentInstance     │  │
│  └─────────────────────────────────┘  │
└───────────────────────────────────────┘
        │
        ▼ dispatch(Intent)
┌───────────────────────────────────────┐
│  World Protocol                       │
│  - Proposal, Authority, Decision      │
└───────────────────────────────────────┘
        │
        ▼ approved Intent
┌───────────────────────────────────────┐
│  Host                                 │  ← Request/Response only
│  - compute() loop                     │
│  - Effect execution                   │
│  - Patch application                  │
└───────────────────────────────────────┘
```

**Key insight:** Host handles **request/response effect fulfillment**. Streaming is an **ingress concern** handled before Intent reaches Host.

### Alternatives Considered

| Alternative | Description | Why Rejected |
|-------------|-------------|--------------|
| **RxJS integration** | Observable-based effects | Heavy, paradigm shift |
| **AsyncIterator helpers** | `for await` patterns | Still push-based, ingress concern |
| **Stream subscription** | Built-in WS/SSE support | Domain-specific, wrong layer |

### Rationale

**effect-utils handles request/response. Bridge/Ingress handles push/stream.**

```
effect-utils scope (request/response):
├── Timeout, retry, parallel     ✅
├── Transform to Patch[]         ✅
└── Stream subscription          ❌ (Ingress concern)

Bridge/Ingress scope (event flow):
├── WebSocket/SSE management     ✅
├── Debouncing/buffering         ✅
├── SourceEvent creation         ✅
├── Projection to Intent         ✅
└── Intent issuance              ✅

Host scope (execution):
├── Compute loop                 ✅
├── Effect fulfillment           ✅
├── Patch application            ✅
└── Snapshot persistence         ✅
```

**Intent & Projection Spec alignment:**

The Intent & Projection Spec defines `SourceEvent` kinds:
- `ui` — User interface events
- `api` — External API calls
- `agent` — AI agent actions
- `system` — System-generated events

Streaming data (WebSocket quotes, SSE updates) enters as **SourceEvents** at the Bridge layer, gets **projected** to Intents, then dispatched to World/Host.

**Correct streaming pattern in Manifesto:**

```typescript
// Bridge/Application layer — NOT effect-utils
class QuoteStreamIngress {
  private ws: WebSocket;
  private buffer: Quote[] = [];
  
  constructor(
    private bridge: Bridge,
    private options: { debounceMs: number; batchSize: number }
  ) {
    this.ws = new WebSocket('wss://quotes');
    this.ws.onmessage = (e) => this.handleMessage(JSON.parse(e.data));
  }
  
  private handleMessage(quote: Quote) {
    this.buffer.push(quote);
    this.scheduleFlush();
  }
  
  private scheduleFlush = debounce(() => {
    if (this.buffer.length === 0) return;
    
    // Create SourceEvent
    const sourceEvent = createAPISourceEvent('quotes-batch', {
      quotes: this.buffer
    });
    
    // Dispatch through Bridge (→ Projection → Intent → World → Host)
    this.bridge.dispatchEvent(sourceEvent);
    this.buffer = [];
  }, this.options.debounceMs);
}

// Effect handler (effect-utils territory) — just handles the batch
const quotesUpdateHandler = createHandler(quotesUpdateSchema, async (input) => {
  // input.quotes is already batched by ingress layer
  return {
    latest: input.quotes,
    updatedAt: Date.now()
  };
});
```

### Where Should Stream Utilities Live?

| Option | Recommendation |
|--------|----------------|
| **In effect-utils** | ❌ Wrong layer |
| **In Host** | ❌ Host is request/response |
| **In Bridge** | ⚠️ Maybe, if common patterns emerge |
| **In app code** | ✅ Default — domain-specific buffering/debouncing |
| **In `@manifesto-ai/bridge-utils`** | ✅ Future — if common ingress primitives needed |

**v1.0 Recommendation:** Leave to application code. If patterns repeat across projects, extract to `@manifesto-ai/bridge-utils` or `@manifesto-ai/source-utils`.

### Consequences

| Enables | Constrains |
|---------|------------|
| Clear layer boundaries | No streaming helpers in effect-utils |
| Correct architectural alignment | Streaming patterns documented elsewhere |
| effect-utils stays stateless | |
| Host stays request/response | |

### Canonical Statement

> **Streams are ingress concerns (Bridge/Application). effect-utils handles request/response effect fulfillment.**

---

## Summary: The effect-utils Identity

### What effect-utils IS

| Aspect | Description |
|--------|-------------|
| **DX layer** | Makes building Effect Handlers easier |
| **Combinator library** | Small functions that compose |
| **Type-safe** | Zod schemas for input/output |
| **Stateless** | No internal state, pure transforms |
| **Focused** | Only execution patterns, not IO adapters |

### What effect-utils IS NOT

| Aspect | Why Not |
|--------|---------|
| HTTP client | Use your preferred library |
| Database adapter | Use your preferred ORM |
| Stream/Observable library | Host's responsibility |
| Full resilience framework | Just the primitives |
| Required dependency | Host works without it |

### Package Boundary

```typescript
// @manifesto-ai/effect-utils exports:

// Combinators
export { withTimeout, withRetry, withFallback } from './combinators';
export { parallel, race, sequential } from './combinators';

// Transforms
export { toPatch, toPatches, toErrorPatch, collectErrors } from './transforms';

// Schema
export { defineEffectSchema, createHandler } from './schema';

// Types
export type { Settled, EffectSchema, CombinatorOptions } from './types';
```

### Canonical Statements Summary

| FDR | Statement |
|-----|-----------|
| EU-001 | effect-utils is to Host what Builder is to Core: a DX layer that doesn't execute. |
| EU-002 | Small functions that compose beat large configs that configure. |
| EU-003 | Combinators transform functions. They are stateless. Stateful resilience patterns belong in Host. |
| EU-004 | effect-utils makes building handlers easier. It doesn't build them for you. |
| EU-005 | Schema is the contract between MEL declaration and TypeScript implementation. Zod is the language of that contract. |
| EU-006 | Partial failure is not total failure. Keep what succeeded. |
| EU-007 | Helpers reduce syntax, not power. You can still construct patches manually. |
| EU-008 | Streams are ingress concerns (Bridge/Application). effect-utils handles request/response effect fulfillment. |

### Dependency Direction

```
@manifesto-ai/effect-utils
        │
        ▼ (types only)
@manifesto-ai/core              ← Patch, Snapshot types
        
        ▲ (optional peer)
        │
@manifesto-ai/host              ← Uses effect-utils for handler DX
```

---

## Cross-Reference

| Related Spec | Relationship |
|--------------|--------------|
| Host Contract | Defines EffectHandler signature that effect-utils helps implement |
| MEL Spec | Defines effect declarations that effect-utils helps fulfill |
| Schema Spec | Defines Patch structure that effect-utils produces |
| Builder Spec | Similar DX philosophy, different layer |

---

*End of @manifesto-ai/effect-utils FDR v1.0*
