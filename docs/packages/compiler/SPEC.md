# @manifesto-ai/compiler Specification v1.0

> **Version:** 1.0
> **Status:** Normative
> **Role:** LLM-Assisted Structural Compiler
> **Implementation:** Manifesto Application (dogfooding)
> **Philosophy:** *LLM is an untrusted proposer. Manifesto is the judge.*

---

## §1. Overview

### 1.1 Purpose

`@manifesto-ai/compiler` transforms natural language requirements into validated Manifesto DomainSchema.

### 1.2 Key Architectural Decision

**Compiler itself is a Manifesto Application.**

```
Compiler is NOT: a wrapper around LLM + validation
Compiler IS: a DomainSchema + Host + World
```

This provides the strongest possible validation of the Manifesto architecture:

| Challenge | How Compiler Proves It |
|-----------|------------------------|
| Complex state machine | Compilation phases as state |
| Async external calls | LLM calls as Effects |
| Retry logic | Action + state-based flow control |
| Resolution mechanism | ITL-agnostic design |
| Failure handling | Standard Manifesto patterns |
| Traceability | Snapshot history |

### 1.3 Core Principles

```
"LLM is an untrusted proposer.
 Builder is the judge.
 Resolution mechanism is external."
```

| Component | Role |
|-----------|------|
| LLM | Generates draft proposals (may be invalid) |
| Builder | Validates drafts, produces DomainSchema |
| External System | Resolves ambiguity (ITL) |

### 1.4 Dual-Use Design

Compiler is **Actor-neutral**:

| Aspect | Treatment |
|--------|-----------|
| Input source | Does not distinguish human vs LLM |
| Validation | Same rules for all |
| Resolution | Same mechanism for all |

Compiler sees only:
- Natural language text
- (Optional) target schema
- (Optional) context

Compiler does NOT see:
- Who generated the input
- What reasoning produced it
- What authority the caller has

### 1.5 Success Criteria

| Criterion | Definition |
|-----------|------------|
| Functional | Natural language → valid DomainSchema |
| Safety | Invalid schema NEVER reaches output |
| Deterministic | Same input + same resolutions = same result |
| Traceable | All attempts recordable in Snapshot history |
| ITL-agnostic | Resolution mechanism is external concern |

---

## §2. Package Boundaries

### 2.1 Dependencies

```
@manifesto-ai/compiler
    │
    ├──→ @manifesto-ai/builder (validateDomain, types)
    ├──→ @manifesto-ai/core (compute, apply)
    ├──→ @manifesto-ai/host (createHost)
    └──→ LLM SDK (effect handler implementation detail)
```

### 2.2 Compiler as Consumer

Compiler consumes the Manifesto stack exactly as any application would:

```
┌─────────────────────────────────────────────┐
│            @manifesto-ai/compiler           │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │  CompilerDomain (defineDomain)      │   │
│  └─────────────────────────────────────┘   │
│                    │                        │
│  ┌─────────────────────────────────────┐   │
│  │  CompilerHost (effect handlers)     │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  External: Resolution via ITL (HITL/AITL)  │
└─────────────────────────────────────────────┘
```

### 2.3 Relationship with Builder

| Layer | Role |
|-------|------|
| Builder | Constitution (validation rules) |
| Compiler | Citizen (subject to constitution) |

Compiler does NOT duplicate Builder's functionality. Compiler **consumes** Builder as the validation authority.

---

## §3. Terminology

### 3.1 Draft vs Schema

| Term | Definition |
|------|------------|
| `DomainDraft` | LLM-generated JSON, NOT YET validated |
| `DomainSchema` | Builder-validated, canonical schema |

```
LLM output → DomainDraft → Builder.validateDomain() → DomainSchema
```

### 3.2 Compilation Phases

| Phase | Description |
|-------|-------------|
| `segmenting` | Decomposing input text into requirement segments |
| `normalizing` | Converting segments to structured intents |
| `proposing` | Generating DomainDraft from intents |
| `validating` | Validating draft via Builder |

### 3.3 ITL (Intelligence in the Loop)

**ITL** is the umbrella term for resolution mechanisms:

```
ITL (Intelligence in the Loop)
├── HITL (Human in the Loop)
│   └── Human makes decision
└── AITL (AI in the Loop)
    ├── Single LLM decision
    ├── Multi-LLM consensus
    ├── Constitutional tribunal
    └── Other AI-based protocols
```

**Compiler is ITL-agnostic.** It only knows that resolution is needed, not who or what provides it.

---

## §4. Core Types

### 4.1 Supporting Types

```typescript
const CompilerContextSchema = z.object({
  domainName: z.string().optional(),
  existingActions: z.array(z.string()).optional(),
  glossary: z.record(z.string(), z.string()).optional(),
});

const NormalizedIntentSchema = z.object({
  kind: z.enum(['state', 'computed', 'action', 'constraint']),
  description: z.string(),
  confidence: z.number().min(0).max(1),
});

const AttemptRecordSchema = z.object({
  attemptNumber: z.number(),
  draftHash: z.string(),
  diagnostics: DomainDiagnosticsSchema.nullable(),
  timestamp: z.number(),
});

const ResolutionOptionSchema = z.object({
  id: z.string(),
  description: z.string(),
  preview: z.string().optional(),
});

const DiscardReasonSchema = z.enum([
  'RESOLUTION_REQUIRED_BUT_DISABLED',
  'MAX_RETRIES_EXCEEDED',
  'EMPTY_INPUT',
  'SEGMENTATION_FAILED',
]);
```

### 4.2 CompilerState

```typescript
const CompilerStateSchema = z.object({
  // ─── Input ───
  input: z.string().nullable(),
  targetSchema: z.any().nullable(),
  context: CompilerContextSchema.nullable(),

  // ─── Configuration ───
  maxRetries: z.number(),
  traceDrafts: z.boolean(),

  // ─── Pipeline State ───
  segments: z.array(z.string()),
  intents: z.array(NormalizedIntentSchema),
  currentDraft: z.any().nullable(),          // DomainDraft (unvalidated)

  // ─── Validation State ───
  diagnostics: DomainDiagnosticsSchema.nullable(),

  // ─── Loop Control ───
  attemptCount: z.number(),

  // ─── History (when traceDrafts: true) ───
  attempts: z.array(AttemptRecordSchema),

  // ─── Resolution State ───
  resolutionOptions: z.array(ResolutionOptionSchema),
  resolutionReason: z.string().nullable(),

  // ─── Status ───
  status: z.enum([
    'idle',
    'segmenting',
    'normalizing',
    'proposing',
    'validating',
    'awaiting_resolution',
    'success',
    'discarded',
  ]),

  // ─── Output ───
  result: DomainSchemaSchema.nullable(),     // DomainSchema (validated)
  resultHash: z.string().nullable(),
  discardReason: DiscardReasonSchema.nullable(),
});
```

### 4.3 Initial State

```typescript
const INITIAL_STATE: CompilerState = {
  input: null,
  targetSchema: null,
  context: null,
  maxRetries: 5,
  traceDrafts: false,
  segments: [],
  intents: [],
  currentDraft: null,
  diagnostics: null,
  attemptCount: 0,
  attempts: [],
  resolutionOptions: [],
  resolutionReason: null,
  status: 'idle',
  result: null,
  resultHash: null,
  discardReason: null,
};
```

---

## §5. CompilerDomain

### 5.1 Computed Values

```typescript
const CompilerDomain = defineDomain(CompilerStateSchema, ({
  state, computed, actions, flow, expr
}) => {

  const {
    isIdle,
    isSegmenting,
    isNormalizing,
    isProposing,
    isValidating,
    isAwaitingResolution,
    isTerminal,
    canRetry,
  } = computed.define({
    isIdle: expr.eq(state.status, 'idle'),
    isSegmenting: expr.eq(state.status, 'segmenting'),
    isNormalizing: expr.eq(state.status, 'normalizing'),
    isProposing: expr.eq(state.status, 'proposing'),
    isValidating: expr.eq(state.status, 'validating'),
    isAwaitingResolution: expr.eq(state.status, 'awaiting_resolution'),
    isTerminal: expr.or(
      expr.eq(state.status, 'success'),
      expr.eq(state.status, 'discarded')
    ),
    canRetry: expr.lt(state.attemptCount, state.maxRetries),
  });
```

### 5.2 Actions

#### 5.2.1 start

Initiates compilation pipeline.

```typescript
  const { start } = actions.define({
    start: {
      label: 'Start Compilation',
      input: z.object({
        text: z.string(),
        schema: z.any(),
        context: CompilerContextSchema.optional(),
        maxRetries: z.number().optional(),
        traceDrafts: z.boolean().optional(),
      }),
      available: isIdle,
      flow: flow.seq(
        flow.patch(state.input).set(expr.input('text')),
        flow.patch(state.targetSchema).set(expr.input('schema')),
        flow.patch(state.context).set(
          expr.coalesce(expr.input('context'), null)
        ),
        flow.patch(state.maxRetries).set(
          expr.coalesce(expr.input('maxRetries'), 5)
        ),
        flow.patch(state.traceDrafts).set(
          expr.coalesce(expr.input('traceDrafts'), false)
        ),
        flow.patch(state.status).set('segmenting'),
        flow.effect('llm:segment', {
          text: expr.input('text'),
        })
      ),
    },
  });
```

#### 5.2.2 receiveSegments

Receives segmentation result from LLM.

```typescript
  const { receiveSegments } = actions.define({
    receiveSegments: {
      label: 'Receive Segmentation Result',
      input: z.object({
        segments: z.array(z.string()),
      }),
      available: isSegmenting,
      flow: flow.seq(
        flow.patch(state.segments).set(expr.input('segments')),
        flow.when(
          expr.eq(expr.len(expr.input('segments')), 0),
          // Empty → discard
          flow.seq(
            flow.patch(state.status).set('discarded'),
            flow.patch(state.discardReason).set('SEGMENTATION_FAILED')
          ),
          // Has segments → normalize
          flow.seq(
            flow.patch(state.status).set('normalizing'),
            flow.effect('llm:normalize', {
              segments: expr.input('segments'),
              schema: state.targetSchema,
              context: state.context,
            })
          )
        )
      ),
    },
  });
```

#### 5.2.3 receiveIntents

Receives normalization result from LLM.

```typescript
  const { receiveIntents } = actions.define({
    receiveIntents: {
      label: 'Receive Normalization Result',
      input: z.object({
        intents: z.array(NormalizedIntentSchema),
      }),
      available: isNormalizing,
      flow: flow.seq(
        flow.patch(state.intents).set(expr.input('intents')),
        flow.patch(state.status).set('proposing'),
        flow.effect('llm:propose', {
          schema: state.targetSchema,
          intents: expr.input('intents'),
          history: state.attempts,
          context: state.context,
        })
      ),
    },
  });
```

#### 5.2.4 receiveDraft

Receives draft proposal from LLM.

```typescript
  const { receiveDraft } = actions.define({
    receiveDraft: {
      label: 'Receive Draft Proposal',
      input: z.object({
        draft: z.any(),  // DomainDraft (unvalidated)
      }),
      available: isProposing,
      flow: flow.seq(
        flow.patch(state.currentDraft).set(expr.input('draft')),
        flow.patch(state.status).set('validating'),
        flow.effect('builder:validate', {
          draft: expr.input('draft'),
        })
      ),
    },
  });
```

#### 5.2.5 receiveValidation

Receives validation result from Builder. Handles success, retry, or discard.

```typescript
  const { receiveValidation } = actions.define({
    receiveValidation: {
      label: 'Receive Validation Result',
      input: z.object({
        valid: z.boolean(),
        schema: DomainSchemaSchema.nullable(),
        diagnostics: DomainDiagnosticsSchema.nullable(),
        schemaHash: z.string().nullable(),
        timestamp: z.number(),
      }),
      available: isValidating,
      flow: flow.seq(
        flow.patch(state.diagnostics).set(expr.input('diagnostics')),

        flow.when(
          expr.input('valid'),

          // ─── Success ───
          flow.seq(
            flow.patch(state.result).set(expr.input('schema')),
            flow.patch(state.resultHash).set(expr.input('schemaHash')),
            flow.patch(state.status).set('success')
          ),

          // ─── Failure ───
          flow.seq(
            // Record attempt if traceDrafts enabled
            flow.when(
              state.traceDrafts,
              flow.patch(state.attempts).set(
                expr.append(state.attempts, {
                  attemptNumber: state.attemptCount,
                  draftHash: expr.coalesce(expr.input('schemaHash'), ''),
                  diagnostics: expr.input('diagnostics'),
                  timestamp: expr.input('timestamp'),
                })
              )
            ),

            // Check retry eligibility
            flow.when(
              canRetry,
              // ─── Retry ───
              flow.seq(
                flow.patch(state.attemptCount).set(
                  expr.add(state.attemptCount, 1)
                ),
                flow.patch(state.status).set('proposing'),
                flow.effect('llm:propose', {
                  schema: state.targetSchema,
                  intents: state.intents,
                  history: state.attempts,
                  context: state.context,
                })
              ),
              // ─── Max retries exceeded ───
              flow.seq(
                flow.patch(state.status).set('discarded'),
                flow.patch(state.discardReason).set('MAX_RETRIES_EXCEEDED')
              )
            )
          )
        )
      ),
    },
  });
```

#### 5.2.6 requestResolution

Transitions to resolution state when ambiguity is detected.

```typescript
  const { requestResolution } = actions.define({
    requestResolution: {
      label: 'Request Resolution',
      input: z.object({
        reason: z.string(),
        options: z.array(ResolutionOptionSchema),
      }),
      available: expr.or(isNormalizing, isProposing),
      flow: flow.seq(
        flow.patch(state.resolutionReason).set(expr.input('reason')),
        flow.patch(state.resolutionOptions).set(expr.input('options')),
        flow.patch(state.status).set('awaiting_resolution')
      ),
    },
  });
```

#### 5.2.7 resolve

Resolves ambiguity and resumes pipeline. **Called by external system (HITL or AITL).**

```typescript
  const { resolve } = actions.define({
    resolve: {
      label: 'Resolve Ambiguity',
      input: z.object({
        selectedOptionId: z.string(),
      }),
      available: isAwaitingResolution,
      flow: flow.seq(
        // Clear resolution state
        flow.patch(state.resolutionOptions).set([]),
        flow.patch(state.resolutionReason).set(null),

        // Resume at proposing
        flow.patch(state.status).set('proposing'),
        flow.effect('llm:propose', {
          schema: state.targetSchema,
          intents: state.intents,
          history: state.attempts,
          context: state.context,
          resolution: expr.input('selectedOptionId'),
        })
      ),
    },
  });
```

#### 5.2.8 discard

Discards compilation. Can be called when resolution is required but not available.

```typescript
  const { discard } = actions.define({
    discard: {
      label: 'Discard Compilation',
      input: z.object({
        reason: DiscardReasonSchema,
      }),
      available: expr.not(isTerminal),
      flow: flow.seq(
        flow.patch(state.resolutionOptions).set([]),
        flow.patch(state.resolutionReason).set(null),
        flow.patch(state.status).set('discarded'),
        flow.patch(state.discardReason).set(expr.input('reason'))
      ),
    },
  });
```

#### 5.2.9 reset

Resets compiler to initial state.

```typescript
  const { reset } = actions.define({
    reset: {
      label: 'Reset Compiler',
      input: z.object({}),
      available: isTerminal,
      flow: flow.seq(
        flow.patch(state.input).set(null),
        flow.patch(state.targetSchema).set(null),
        flow.patch(state.context).set(null),
        flow.patch(state.segments).set([]),
        flow.patch(state.intents).set([]),
        flow.patch(state.currentDraft).set(null),
        flow.patch(state.diagnostics).set(null),
        flow.patch(state.attemptCount).set(0),
        flow.patch(state.attempts).set([]),
        flow.patch(state.resolutionOptions).set([]),
        flow.patch(state.resolutionReason).set(null),
        flow.patch(state.status).set('idle'),
        flow.patch(state.result).set(null),
        flow.patch(state.resultHash).set(null),
        flow.patch(state.discardReason).set(null)
      ),
    },
  });

  return {
    computed: {
      isIdle, isSegmenting, isNormalizing, isProposing,
      isValidating, isAwaitingResolution, isTerminal, canRetry,
    },
    actions: {
      start, receiveSegments, receiveIntents, receiveDraft,
      receiveValidation, requestResolution, resolve, discard, reset,
    },
  };
});
```

---

## §6. Effects

### 6.1 Effect Types

| Effect | Params | Description |
|--------|--------|-------------|
| `llm:segment` | `{ text }` | Segment input text |
| `llm:normalize` | `{ segments, schema, context? }` | Normalize to intents |
| `llm:propose` | `{ schema, intents, history, context?, resolution? }` | Generate DomainDraft |
| `builder:validate` | `{ draft }` | Validate via Builder |

### 6.2 Effect Handler Contracts

```typescript
type CompilerEffectHandlers = {
  'llm:segment': (params: {
    text: string;
  }) => Promise
    | { ok: true; segments: string[] }
    | { ok: false; error: string }
  >;

  'llm:normalize': (params: {
    segments: string[];
    schema: unknown;
    context?: CompilerContext;
  }) => Promise
    | { ok: true; intents: NormalizedIntent[] }
    | { ok: 'resolution'; reason: string; options: ResolutionOption[] }
    | { ok: false; error: string }
  >;

  'llm:propose': (params: {
    schema: unknown;
    intents: NormalizedIntent[];
    history: AttemptRecord[];
    context?: CompilerContext;
    resolution?: string;
  }) => Promise
    | { ok: true; draft: unknown }
    | { ok: 'resolution'; reason: string; options: ResolutionOption[] }
    | { ok: false; error: string }
  >;

  'builder:validate': (params: {
    draft: unknown;
  }) => Promise<{
    valid: boolean;
    schema: DomainSchema | null;
    diagnostics: DomainDiagnostics | null;
    schemaHash: string | null;
    timestamp: number;
  }>;
};
```

### 6.3 Timestamp Handling

Timestamps MUST be provided by effect handlers, NOT computed in expressions.

```typescript
// ❌ WRONG: Non-deterministic
timestamp: expr.now()

// ✅ CORRECT: Timestamp from effect result
timestamp: expr.input('timestamp')
```

---

## §7. Resolution Policy

### 7.1 Policy Definition

```typescript
type CompilerResolutionPolicy = {
  onResolutionRequired: 'await' | 'discard';
};
```

| Policy | Behavior |
|--------|----------|
| `'await'` | Transition to `awaiting_resolution`, wait for `resolve` action |
| `'discard'` | Immediately discard with `RESOLUTION_REQUIRED_BUT_DISABLED` |

### 7.2 ITL-Agnostic Design

**Compiler does NOT determine who resolves ambiguity.**

```
Compiler                          External System
────────                          ───────────────
status: 'awaiting_resolution'  →  Receives notification
resolutionOptions: [...]       →  Presents options
                                  
                                  Determines resolution method:
                                  ├── HITL: Human selects
                                  ├── AITL: LLM decides
                                  ├── Consensus: Multiple agents vote
                                  └── Tribunal: Constitutional review
                                  
                               ←  dispatch({ type: 'resolve', ... })
status: 'proposing'            ←  Continues
```

### 7.3 Default Policy

```typescript
const DEFAULT_POLICY: CompilerResolutionPolicy = {
  onResolutionRequired: 'discard',
};
```

This ensures safe defaults: if no resolution mechanism is configured, compilation fails gracefully rather than hanging indefinitely.

---

## §8. State Machine

### 8.1 Status Transitions

```
                    ┌─────────┐
                    │  idle   │
                    └────┬────┘
                         │ start
                         ▼
                  ┌─────────────┐
                  │ segmenting  │
                  └──────┬──────┘
                         │ receiveSegments
            ┌────────────┼────────────┐
            │ empty      │            │
            ▼            ▼            │
     ┌──────────┐  ┌─────────────┐    │
     │discarded │  │ normalizing │    │
     └──────────┘  └──────┬──────┘    │
                         │ receiveIntents
                         ▼
                  ┌─────────────┐
          ┌──────│  proposing  │◄─────────┐
          │      └──────┬──────┘          │
          │ resolution  │ receiveDraft    │ retry
          ▼             ▼                 │
┌───────────────────┐  ┌─────────────┐    │
│awaiting_resolution│  │ validating  │────┘
└─────────┬─────────┘  └──────┬──────┘
          │                   │
   ┌──────┴──────┐            │ receiveValidation (valid)
   │             │            │
   │   resolve   │            ▼
   │             │      ┌──────────┐
   └──────┬──────┘      │ success  │
          │             └──────────┘
          │
          │ discard
          ▼
   ┌─────────────┐
   │  discarded  │ ◄── (MAX_RETRIES_EXCEEDED)
   └─────────────┘
```

### 8.2 Terminal States

| Status | Meaning |
|--------|---------|
| `success` | Compilation succeeded, `result` contains valid DomainSchema |
| `discarded` | Compilation abandoned, `discardReason` explains why |

---

## §9. Host Implementation

### 9.1 Host Setup

```typescript
import { createHost } from '@manifesto-ai/host';
import { CompilerDomain } from './domain';

function createCompilerHost(options: CompilerHostOptions) {
  return createHost({
    domain: CompilerDomain,
    initialState: INITIAL_STATE,
    effectHandlers: {
      'llm:segment': options.llmHandlers.segment,
      'llm:normalize': options.llmHandlers.normalize,
      'llm:propose': options.llmHandlers.propose,
      'builder:validate': createBuilderValidateHandler(),
    },
    resolutionPolicy: options.policy ?? DEFAULT_POLICY,
  });
}
```

### 9.2 Effect Handler: builder:validate

```typescript
import { validateDomain } from '@manifesto-ai/builder';

function createBuilderValidateHandler() {
  return async (params: { draft: unknown }) => {
    const result = validateDomain(params.draft);

    return {
      valid: result.valid,
      schema: result.valid ? result.schema : null,
      diagnostics: result.diagnostics,
      schemaHash: result.valid ? result.schemaHash : null,
      timestamp: Date.now(),
    };
  };
}
```

### 9.3 Handling Resolution Requests

When LLM effect returns `{ ok: 'resolution', ... }`:

```typescript
// Effect handler wrapper (conceptual)
async function handleLLMEffect(effect, params, dispatch, policy) {
  const result = await llmClient.call(effect, params);
  
  if (result.ok === 'resolution') {
    if (policy.onResolutionRequired === 'await') {
      await dispatch({
        type: 'requestResolution',
        input: { reason: result.reason, options: result.options },
      });
      // Host waits; external system will call 'resolve'
    } else {
      await dispatch({
        type: 'discard',
        input: { reason: 'RESOLUTION_REQUIRED_BUT_DISABLED' },
      });
    }
  } else if (result.ok === true) {
    // Continue with appropriate receive action
  } else {
    // Handle error
  }
}
```

---

## §10. Public API

### 10.1 createCompiler

```typescript
import { createCompiler } from '@manifesto-ai/compiler';

const compiler = createCompiler({
  llmClient: myLLMClient,
  resolutionPolicy: { onResolutionRequired: 'await' },
  maxRetries: 5,
  traceDrafts: false,
});
```

### 10.2 Compiler Interface

```typescript
type Compiler = {
  // Start compilation
  start(input: CompileInput): Promise<void>;
  
  // Get current state
  getSnapshot(): CompilerState;
  
  // Subscribe to state changes
  subscribe(callback: (state: CompilerState) => void): Unsubscribe;
  
  // Dispatch actions
  dispatch(action: CompilerAction): Promise<void>;
  
  // Convenience: resolve ambiguity
  resolve(selectedOptionId: string): Promise<void>;
  
  // Convenience: discard
  discard(reason: DiscardReason): Promise<void>;
  
  // Reset to idle
  reset(): Promise<void>;
};

type CompileInput = {
  text: string;
  schema: z.ZodObject<any>;
  context?: CompilerContext;
  maxRetries?: number;
  traceDrafts?: boolean;
};
```

### 10.3 Usage Example

```typescript
const compiler = createCompiler({ llmClient, resolutionPolicy: { onResolutionRequired: 'await' } });

// Subscribe to state changes
compiler.subscribe((state) => {
  if (state.status === 'awaiting_resolution') {
    // External system handles resolution
    // Could be HITL (show UI), AITL (call another LLM), etc.
    handleResolution(state.resolutionOptions).then((selectedId) => {
      compiler.resolve(selectedId);
    });
  }
  
  if (state.status === 'success') {
    console.log('Result:', state.result);
  }
  
  if (state.status === 'discarded') {
    console.log('Discarded:', state.discardReason);
  }
});

// Start compilation
await compiler.start({
  text: 'When event is received, record the handler...',
  schema: EventSchema,
});
```

---

## §11. Integration Patterns

### 11.1 HITL Integration (Human)

```typescript
// External system using Ink CLI
compiler.subscribe(async (state) => {
  if (state.status === 'awaiting_resolution') {
    const selected = await renderInkSelection(state.resolutionOptions);
    compiler.resolve(selected);
  }
});
```

### 11.2 AITL Integration (Single LLM)

```typescript
// External system using another LLM
compiler.subscribe(async (state) => {
  if (state.status === 'awaiting_resolution') {
    const selected = await anotherLLM.decide(state.resolutionOptions);
    compiler.resolve(selected);
  }
});
```

### 11.3 AITL Integration (Multi-Agent Consensus)

```typescript
// External system using consensus protocol
compiler.subscribe(async (state) => {
  if (state.status === 'awaiting_resolution') {
    const votes = await Promise.all(
      agents.map(agent => agent.vote(state.resolutionOptions))
    );
    const selected = majorityVote(votes);
    compiler.resolve(selected);
  }
});
```

### 11.4 Manifesto App Integration

```typescript
// Another Manifesto App that uses Compiler via effect
const TeacherDomain = defineDomain(TeacherSchema, ({ flow, expr }) => {
  actions.define({
    generateDomain: {
      flow: flow.seq(
        flow.effect('compiler:start', {
          text: state.requirements,
          schema: state.targetSchema,
        }),
        flow.when(
          expr.eq(state.compilerStatus, 'awaiting_resolution'),
          // AITL handshake flow
          flow.call(aitlHandshakeFlow)
        ),
        // ...
      ),
    },
  });
});
```

---

## §12. Implementation Notes

### 12.1 LLM Prompt Guidelines

The `llm:propose` effect handler MUST instruct the LLM to:

1. Output valid JSON conforming to DomainSchema structure
2. NOT output TypeScript code
3. Consider previous failed attempts (in `history`) and their diagnostics
4. Consider resolution selection if provided
5. Follow Builder Spec §12 (DomainSchema format)

### 12.2 Error Recovery

| Error Type | Handling |
|------------|----------|
| LLM API failure | Effect handler retries with backoff |
| Invalid JSON from LLM | Treat as validation failure → retry |
| Builder validation failure | Retry with diagnostics in history |
| Resolution timeout | External system decides (discard or extend) |

### 12.3 Memory Protection

When `traceDrafts: false` (default):
- `attempts` array remains empty
- Only `attemptCount` is tracked
- Full drafts are not stored in state

---

## §13. Non-Goals

| Item | Reason |
|------|--------|
| Optimal design guarantee | LLM may produce valid but suboptimal schemas |
| One-shot success | Retries are expected and normal |
| Perfect NL understanding | Segmentation/normalization are best-effort |
| Resolution mechanism | External concern, not Compiler's responsibility |
| Actor authentication | Compiler is Actor-neutral |

---

## §14. Package Structure

```
@manifesto-ai/compiler
├── domain/
│   ├── schema.ts        # CompilerStateSchema
│   ├── domain.ts        # CompilerDomain
│   └── types.ts         # Supporting types
│
├── effects/
│   ├── llm/
│   │   ├── segment.ts
│   │   ├── normalize.ts
│   │   └── propose.ts
│   └── builder.ts
│
├── host/
│   └── index.ts         # createCompilerHost
│
├── api/
│   └── index.ts         # createCompiler
│
└── index.ts             # Public exports
```

---

## §15. Extension Points

### 15.1 Custom LLM Adapters

```typescript
type LLMAdapter = {
  segment(text: string): Promise<SegmentResult>;
  normalize(params: NormalizeParams): Promise<NormalizeResult>;
  propose(params: ProposeParams): Promise<ProposeResult>;
};
```

### 15.2 Telemetry Hook

```typescript
type CompilerTelemetry = {
  onPhaseChange(from: Status, to: Status): void;
  onAttempt(attempt: AttemptRecord): void;
  onResolutionRequested(reason: string, options: ResolutionOption[]): void;
  onComplete(result: CompilerState): void;
};
```

---

## Appendix A: Determinism Guarantees (Informative)

### A.1 What is Deterministic

| Input | Deterministic Output |
|-------|---------------------|
| Same `text` + same `schema` + same LLM responses + same resolutions | Same `result` |

### A.2 Sources of Non-Determinism

| Source | Mitigation |
|--------|------------|
| LLM responses | Outside Manifesto scope |
| Resolution decisions | Recorded in Snapshot |
| Timestamps | Provided by effect handlers |

### A.3 Replay Capability

Given:
- Initial input
- Recorded LLM responses
- Recorded resolution decisions

The compilation can be replayed deterministically.

---

## Appendix B: CLI Reference Implementation (Informative)

This section describes a reference CLI implementation using Ink. This is NOT normative.

### B.1 CLI Usage

```bash
# Basic (resolution disabled)
manifesto compile "requirements..." --schema ./schema.ts --out ./domain.json

# With HITL resolution
manifesto compile "..." --schema ./schema.ts --resolution=hitl

# With trace
manifesto compile "..." --schema ./schema.ts --trace
```

### B.2 HITL Provider

```typescript
// Ink-based HITL
compiler.subscribe(async (state) => {
  if (state.status === 'awaiting_resolution') {
    const selected = await renderInkPrompt({
      message: state.resolutionReason,
      choices: state.resolutionOptions,
    });
    compiler.resolve(selected);
  }
});
```

---

*End of @manifesto-ai/compiler Specification v1.0*
