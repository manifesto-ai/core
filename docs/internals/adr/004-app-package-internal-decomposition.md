# ADR-004: App Package Internal Decomposition

> **Status:** Proposed
> **Date:** 2026-02-07
> **Deciders:** Manifesto Architecture Team
> **Scope:** `@manifesto-ai/app` internal structure
> **Depends On:** ADR-001 (Layer Separation), ADR-003 (World Owns Persistence), ADR-APP-002 (createApp API Simplification)
> **Related SPECs:** APP-SPEC v2.3.0, ARCHITECTURE v2.0

---

## 1. Context

### 1.1 The Problem

ADR-001 acknowledged a known risk:

> **Negative: App has many responsibilities** — Mitigated by internal modularization (`runtime/`, `session/`, `ui/`)

This mitigation has not been sufficiently realized. The current App package exhibits three God Object symptoms:

| Symptom | Evidence |
|---------|----------|
| **Monolithic type file** | `core/types/index.ts` — 2,100 lines containing all type definitions for the entire package |
| **Fat facade** | `ManifestoApp` — 897 lines, 18 private fields, mixes composition root + orchestration + system action execution |
| **Monolithic executor** | `AppExecutorImpl.execute()` — single 424-line method implementing 9-phase pipeline |

### 1.2 Root Cause Analysis

The root cause is **conflation of three distinct roles** within `ManifestoApp`:

1. **Composition Root** — Assembling modules, resolving dependencies, wiring callbacks
2. **Lifecycle Manager** — `created → ready → disposed` transitions
3. **Runtime Facade** — Delegating API calls to internal modules

These roles have different lifecycles:

| Role | Active During | Should Know |
|------|---------------|-------------|
| Composition Root | `created → ready` transition only | All modules (to assemble them) |
| Lifecycle Manager | Entire lifetime | Status, hooks |
| Runtime Facade | `ready → disposing` only | Assembled runtime modules |

Currently `ManifestoApp` performs all three simultaneously, resulting in:

- 18 nullable private fields (because composition is incomplete until `ready()`)
- Non-null assertions (`!`) throughout the codebase
- `ensureReady()` guard repeated in every public method
- System action execution logic (120 lines) embedded directly in the facade

### 1.3 AppExecutor Monolith

`AppExecutorImpl.execute()` implements the entire Proposal Tick as a single method:

```
preparing → submitted → evaluating → approved/rejected → executing →
post-validate → store → update → completed/failed
```

This causes:

- **Code duplication**: Rejection handling appears twice (authority rejection + scope validation rejection) with near-identical code
- **ErrorValue construction**: Same pattern repeated 5+ times
- **decisionId generation**: Same pattern repeated 3 times
- **14 dependencies**: `AppExecutorDependencies` has 14 fields because one class does everything

### 1.4 Type File Monolith

`core/types/index.ts` (2,100 lines) contains types for every concern:

- Action lifecycle (Phase, Result, Handle, Update)
- Authority/Policy (AuthorityDecision, ApprovedScope, PolicyService)
- Host integration (HostExecutor, HostExecutionResult, Intent)
- World persistence (WorldStore, WorldDelta)
- Memory (MemoryStore, MemoryProvider, RecallRequest, 11 maintenance types)
- State (AppState, SystemState, ErrorValue)
- Configuration (AppConfig, SchedulerConfig, ActorPolicyConfig)
- Hooks (AppHooks with 20 event signatures, HookContext, AppRef)
- Branch/Session/Migration types

Unrelated changes create diffs in the same file, making change tracking difficult and merge conflicts frequent.

---

## 2. Decision

### 2.1 Phase Object Pattern for ManifestoApp

Split `ManifestoApp` into three internal components with distinct lifecycles:

```
ManifestoApp (Thin Facade)
  │
  ├── AppBootstrap (created → ready transition)
  │     Resolves schema, assembles components, initializes plugins
  │
  └── AppRuntime (ready → disposing operational state)
        Holds all assembled, non-null dependencies
        Exposes act(), getState(), subscribe(), etc.
```

#### ManifestoApp Responsibility Constraints:

The following rules define what ManifestoApp may and may not do. These are **responsibility-based** constraints (not LOC targets):

| Rule ID | Level | Description |
|---------|-------|-------------|
| FACADE-1 | MUST | ManifestoApp MUST only contain delegation to `_bootstrap` or `_runtime` |
| FACADE-2 | MUST NOT | ManifestoApp MUST NOT perform state mutation directly |
| FACADE-3 | MUST NOT | ManifestoApp MUST NOT contain business logic (execution, policy, memory) |
| FACADE-4 | MUST NOT | ManifestoApp MUST NOT create or assemble internal modules (that is Bootstrap's role) |
| FACADE-5 | MAY | ManifestoApp MAY contain lifecycle guards (`_getRuntime()`) and status property access |

In practice these rules will result in ~150 lines, but the constraint is **responsibility**, not line count.

#### ManifestoApp becomes a true thin facade:

```typescript
class ManifestoApp implements App {
  private _bootstrap: AppBootstrap;
  private _runtime: AppRuntime | null = null;
  private _lifecycle: LifecycleManager;

  constructor(config: AppConfig, worldStore: WorldStore) {
    this._lifecycle = createLifecycleManager();
    this._bootstrap = new AppBootstrap(config, worldStore, this._lifecycle);
  }

  async ready(): Promise<void> {
    this._runtime = await this._bootstrap.assemble();
    this._lifecycle.transitionTo("ready");
  }

  act(type, input, opts) {
    return this._getRuntime().act(type, input, opts);
  }

  getState<T>() {
    return this._getRuntime().getState<T>();
  }

  // All public methods follow same 1-line delegation pattern

  private _getRuntime(): AppRuntime {
    if (!this._runtime) throw new AppNotReadyError("...");
    if (this._lifecycle.isDisposed()) throw new AppDisposedError("...");
    return this._runtime;
  }
}
```

#### Key properties:

- **ManifestoApp** has 3 fields (was 18)
- **AppRuntime** holds all dependencies as non-null (no `!` assertions)
- **AppBootstrap** is discarded after `ready()` (or retained only for reference)
- `ensureReady()` guard concentrated in single `_getRuntime()` method

### 2.2 Explicit Pipeline for Action Execution

Split `AppExecutorImpl.execute()` (424 lines) into SPEC-aligned pipeline stages:

```
execution/pipeline/
  types.ts        — PipelineContext, StepResult
  prepare.ts      — Phase 1-2: validate action, create proposal
  authorize.ts    — Phase 3-4: derive key, request approval, validate scope
  execute.ts      — Phase 5-6: restore snapshot, recall, host execution, post-validate
  persist.ts      — Phase 7-8: create world, store delta, update state, advance head
  finalize.ts     — Phase 9: create result, emit hooks, cleanup
```

#### Pipeline context with typed stage outputs:

The pipeline uses a shared context for immutable inputs, but each stage's **output** is typed separately to prevent PipelineContext from becoming a new God Object:

```typescript
// Immutable inputs — set once at pipeline creation
type PipelineInput = {
  readonly handle: ActionHandleImpl;
  readonly actionType: string;
  readonly input: unknown;
  readonly opts?: ActOptions;
  readonly actorId: string;
  readonly branchId: string;
};

// Each stage declares its output type
type PrepareOutput = {
  readonly proposal: Proposal;
};

type AuthorizeOutput = {
  readonly decision: AuthorityDecision;
  readonly executionKey: ExecutionKey;
};

type ExecuteOutput = {
  readonly execResult: HostExecutionResult;
  readonly baseSnapshot: Snapshot;
};

type PersistOutput = {
  readonly newWorldId: WorldId;
  readonly newWorld: World;
  readonly delta: WorldDelta;
};

// Pipeline context accumulates typed outputs
type PipelineContext = PipelineInput & {
  prepare?: PrepareOutput;
  authorize?: AuthorizeOutput;
  execute?: ExecuteOutput;
  persist?: PersistOutput;
};
```

#### Pipeline Context Rules:

| Rule ID | Level | Description |
|---------|-------|-------------|
| PIPE-CTX-1 | MUST NOT | A stage MUST NOT read fields from a later stage's output |
| PIPE-CTX-2 | MUST NOT | A stage MUST NOT mutate `PipelineInput` fields |
| PIPE-CTX-3 | MUST | A stage MUST write only to its own output namespace |
| PIPE-CTX-4 | MUST NOT | `PipelineContext` MUST NOT accumulate untyped fields (no `[key: string]: unknown`) |

#### Each stage receives only its required dependencies:

```typescript
// authorize.ts — needs only 2 deps, not 14
interface AuthorizeDeps {
  policyService: PolicyService;
  lifecycleManager: LifecycleManager;
}

async function authorize(
  ctx: PipelineContext,
  deps: AuthorizeDeps
): Promise<StepResult> {
  const proposal = ctx.prepare!.proposal; // reads from previous stage's typed output
  const executionKey = deps.policyService.deriveExecutionKey(proposal);
  const decision = await deps.policyService.requestApproval(proposal);

  if (!decision.approved) {
    return { halted: true, result: createRejectedResult(ctx, decision) };
  }
  // scope validation...

  // writes to own namespace only (PIPE-CTX-3)
  ctx.authorize = { decision, executionKey };
  return { halted: false };
}
```

#### Pipeline orchestrator replaces monolithic execute():

```typescript
class DomainActionExecutor {
  async execute(handle, type, input, opts): Promise<void> {
    const ctx = createPipelineContext(handle, type, input, opts, this._defaults);

    const steps = [prepare, authorize, executeHost, persist, finalize];
    for (const step of steps) {
      const result = await step(ctx, this._deps[step.name]);
      if (result.halted) return;
    }
  }
}
```

### 2.3 System Action Executor Extraction

Extract `ManifestoApp._executeSystemAction()` (120 lines) into a dedicated class:

```typescript
// execution/system-action-executor.ts
class SystemActionExecutor {
  constructor(deps: SystemActionExecutorDeps) {}

  async execute(
    handle: ActionHandleImpl,
    actionType: SystemActionType,
    input: unknown,
    opts?: ActOptions
  ): Promise<void> {
    // Current _executeSystemAction() logic
  }
}
```

This aligns with **SYSRT-1**: "System Runtime MUST be separate from Domain Runtime."

### 2.4 Type File Decomposition

Split `core/types/index.ts` (2,100 lines) into domain-aligned modules following APP-SPEC sections:

```
core/types/
  index.ts             — Re-export hub (~50 lines)
  identifiers.ts       — §5.1: WorldId, ActorId, ProposalId, ExecutionKey, etc.
  action.ts            — §5.4, §5.10, §16: ActionPhase, ActionResult, ActionHandle, ActionUpdate
  authority.ts         — §5.6-5.8, §10: AuthorityDecision, ApprovedScope, PolicyService
  host-executor.ts     — §8: HostExecutor, HostExecutionResult, Host, Intent
  world-store.ts       — §9: WorldStore, WorldDelta, CompactOptions
  memory.ts            — §11: MemoryStore, MemoryProvider, RecallRequest, maintenance types
  state.ts             — §7: AppState, SystemState, ErrorValue, SnapshotMeta
  config.ts            — §6.1: AppConfig, SchedulerConfig, ActorPolicyConfig, options
  hooks.ts             — §17: AppHooks, HookContext, AppRef, EnqueueOptions
  branch.ts            — §12: Branch, ForkOptions, MigrationLink
  session.ts           — §14: Session, SessionOptions
  facades.ts           — §15: SystemFacade, MemoryFacade, SystemMemoryFacade
  app.ts               — §6.2: App interface
```

`index.ts` re-exports everything, preserving existing import paths:

```typescript
// core/types/index.ts
export * from "./identifiers.js";
export * from "./action.js";
export * from "./authority.js";
// ...
```

#### Type Module Dependency Rules:

To prevent re-entanglement, type modules MUST follow a strict dependency DAG:

```
                    identifiers.ts    (leaf — no internal imports)
                         ↑
              ┌──────────┼──────────┐
              │          │          │
          state.ts   action.ts  authority.ts   (may import identifiers)
              ↑          ↑          ↑
              │          │          │
        host-executor.ts │    world-store.ts   (may import identifiers, state)
              │          │          │
              └──────┬───┴──────┬──┘
                     │          │
               memory.ts    hooks.ts           (may import state, action, identifiers)
                     │          │
                     └────┬─────┘
                          │
                    config.ts                  (may import all above)
                          │
                     facades.ts                (may import state, action, memory)
                          │
                       app.ts                  (may import all — defines App interface)
```

| Rule ID | Level | Description |
|---------|-------|-------------|
| TYPE-DEP-1 | MUST NOT | Leaf modules (`identifiers.ts`, `state.ts`) MUST NOT import from other type modules |
| TYPE-DEP-2 | MUST NOT | No circular imports between type modules |
| TYPE-DEP-3 | MUST | `index.ts` is re-export only — MUST NOT define types |
| TYPE-DEP-4 | MUST | Shared base types (`ErrorValue`, `Snapshot`, `Patch`) live in `state.ts` or are re-exported from `@manifesto-ai/core` |

---

## 3. Resulting Structure

### 3.1 Directory Layout (After)

```
src/
  app.ts                          # ManifestoApp thin facade (~150 lines)
  create-app.ts                   # Factory function

  core/
    types/
      index.ts                    # Re-export hub
      identifiers.ts              # Opaque IDs
      action.ts                   # Action lifecycle types
      authority.ts                # Policy/Authority types
      host-executor.ts            # Host integration types
      world-store.ts              # Persistence types
      memory.ts                   # Memory types
      state.ts                    # State types
      config.ts                   # Configuration types
      hooks.ts                    # Hook types
      branch.ts                   # Branch types
      session.ts                  # Session types
      facades.ts                  # Facade interfaces
      app.ts                      # App interface
    lifecycle/                    # (unchanged)
    schema/                       # (unchanged)
    state/                        # (unchanged)

  bootstrap/                      # NEW: Composition root
    app-bootstrap.ts              # created → ready assembly
    component-assembler.ts        # Module wiring

  runtime/                        # NEW: Ready-state container
    app-runtime.ts                # Non-null dependency holder + delegation

  execution/
    domain-action-executor.ts     # Replaces executor.ts (pipeline orchestrator)
    system-action-executor.ts     # NEW: Extracted from ManifestoApp
    pipeline/                     # NEW: Pipeline stages
      types.ts
      prepare.ts
      authorize.ts
      execute.ts
      persist.ts
      finalize.ts
    action/                       # (unchanged)
    host-executor/                # (unchanged)
    proposal/                     # (unchanged)
    # remaining files unchanged

  # All other directories unchanged
```

### 3.2 Responsibility Mapping (Before → After)

| Component | Before | After | Primary Responsibility |
|-----------|--------|-------|----------------------|
| `ManifestoApp` | 897 lines, 18 fields | delegation only (FACADE-1~5) | API surface + lifecycle guard |
| `AppBootstrap` | (in ManifestoApp) | ~200 lines | Module assembly, schema resolution |
| `AppRuntime` | (in ManifestoApp) | ~150 lines | Non-null dependency holder, operational delegation |
| `AppExecutorImpl` | 656 lines, 14 deps | removed | — |
| `DomainActionExecutor` | (in AppExecutorImpl) | ~80 lines (orchestrator) | Pipeline sequencing |
| Pipeline stages (5) | (in execute()) | ~80 lines each, ~400 total | One SPEC phase per stage |
| `SystemActionExecutor` | (in ManifestoApp) | ~130 lines | System action lifecycle |
| `core/types/index.ts` | 2,100 lines | ~50 lines (re-export hub) | Re-export only (TYPE-DEP-3) |
| Type modules (13) | (in types/index.ts) | ~160 lines avg, ~2,100 total | One SPEC section per module |

**Total LOC stays approximately the same** — this is decomposition, not removal. Line counts are estimates, not targets; the binding constraints are the responsibility rules (FACADE-*, PIPE-CTX-*, TYPE-DEP-*).

---

## 4. Constraints

### 4.1 SPEC Compatibility

This ADR MUST NOT change the public API defined in APP-SPEC v2.3.0:

- `createApp(config)` signature unchanged
- `App` interface unchanged
- `ready()` / `dispose()` lifecycle unchanged
- `ActionHandle` behavior unchanged
- All hook events and timing unchanged

### 4.2 Behavioral Invariants (Semantic Preservation)

Beyond API signature compatibility, the following **behavioral invariants** MUST be preserved across all phases. These are the acceptance criteria for each refactoring step:

#### Action Phase Transition Order

The phase transition sequence MUST remain identical:

```
Domain:  preparing → submitted → evaluating → approved → executing → completed
                                            → rejected (terminal)
                                 → preparation_failed (terminal)
                                                       → failed (terminal)

System:  preparing → submitted → evaluating → approved → executing → completed
                                                                   → failed
```

No phase may be skipped, reordered, or added without SPEC amendment.

#### Hook Emission Order

Per-proposal hook emission MUST fire in this exact order:

```
action:preparing
  → action:submitted
    → (if rejected) audit:rejected → action:completed
    → (if approved) state:publish → action:completed
    → (if failed)   audit:failed → state:publish → action:completed
```

`state:publish` MUST fire at most once per proposal tick (INV-9).

#### Subscription Transaction Boundary

- `subscriptionStore.startTransaction()` MUST be called exactly once at the start of `execute()`
- `subscriptionStore.endTransaction()` MUST be called exactly once before `action:completed` hook
- `subscriptionStore.notify()` MUST occur between start and end
- These three calls MUST maintain 1:1:1 ratio per proposal execution

#### World Head Advance Condition

Per BRANCH-7:
- Branch head MUST advance only on `outcome: "completed"`
- Branch head MUST NOT advance on `outcome: "failed"`
- `worldHeadTracker.advanceHead()` and `branchManager.appendWorldToBranch()` MUST be called together or not at all

### 4.3 Constitutional Compliance

Per CLAUDE.md §3 Package Boundary Rules, all changes remain within `@manifesto-ai/app`:

- No changes to `@manifesto-ai/core`, `@manifesto-ai/host`, or `@manifesto-ai/world`
- No new cross-package dependencies
- No change to the forbidden import matrix

### 4.4 What This ADR Does NOT Do

| Non-Goal | Reason |
|----------|--------|
| Extract App into multiple packages | ADR-001 decided Runtime is internal to App |
| Change the public API | SPEC compatibility |
| Refactor other packages | Scope limited to `@manifesto-ai/app` |
| Change execution semantics | Pipeline is structural refactoring only |
| Implement ADR-003 World ownership | Separate ADR, separate implementation |

---

## 5. Implementation Plan

### Phase 1: Type Decomposition (Risk: Very Low)

Split `core/types/index.ts` into domain-aligned modules. Pure file reorganization with re-export hub. Zero semantic change. All existing import paths continue to work through `index.ts`.

**Validation:** All existing tests pass without modification.

### Phase 2: System Action Executor Extraction (Risk: Low)

Extract `ManifestoApp._executeSystemAction()` into `SystemActionExecutor`. Move-only refactoring. ManifestoApp delegates to new class.

**Validation:** All system action tests pass without modification.

### Phase 3: Executor Pipeline Decomposition (Risk: Medium)

Replace `AppExecutorImpl.execute()` with pipeline stages. Each stage is independently testable. Duplicated rejection/error code consolidated.

**Why "Medium" risk, not "Low":** Despite being described as "structural refactoring only," this phase splits a 424-line imperative method into 5 async functions with a shared context object. Subtle behavioral regressions are possible:

- Transaction start/end timing may shift
- Hook emission order may change if stage boundaries don't align with original code flow
- Error handling paths (try/catch scope) change when code moves between functions

**Acceptance criteria (mandatory before merge):**

1. **Golden test suite:** Before any code changes, capture the current executor's behavior as snapshot tests:
   - Successful action: full phase transition sequence + hook emission order + final ActionResult shape
   - Rejected action (authority): phase transitions + audit:rejected emission + no World creation
   - Rejected action (scope violation): same as above
   - Failed action: phase transitions + audit:failed + World creation with error state
   - Preparation failed: phase transitions + no proposal creation
   - Each golden test asserts on `subscriptionStore.startTransaction/endTransaction` call counts

2. **Behavioral equivalence:** After pipeline decomposition, all golden tests MUST pass without modification. If a golden test requires change, the behavioral difference MUST be explicitly documented and approved.

3. **Stage isolation tests:** Each pipeline stage gets unit tests with minimal deps (not full 14-dependency setup).

**Validation:** Golden tests pass unmodified. Stage isolation tests added. Coverage for each stage's success and failure paths.

### Phase 4: Bootstrap/Runtime Split (Risk: Medium)

Split ManifestoApp into Bootstrap + Runtime. Nullable fields eliminated. `ready()` semantics preserved.

**Validation:** All lifecycle tests pass. Integration tests verify `ready()` → API availability flow.

---

## 6. Consequences

### 6.1 Positive

1. **Single Responsibility**: Each module has one reason to change
2. **Testability**: Pipeline stages testable in isolation without 14-dependency setup
3. **Readability**: No single file exceeds 300 lines; each file maps to one SPEC section
4. **Null Safety**: `AppRuntime` holds only non-null dependencies; `!` assertions eliminated
5. **Change Tracking**: Type changes produce diffs in relevant files only
6. **Onboarding**: New contributors can understand one module without reading 2,100 lines

### 6.2 Negative

1. **More files**: ~15 new files (type modules + bootstrap + runtime + pipeline stages)
2. **Indirection**: One more hop from ManifestoApp to AppRuntime to actual logic
3. **Migration effort**: Existing tests may need import path adjustments (mitigated by re-exports)

### 6.3 Risks

| Risk | Mitigation |
|------|------------|
| Pipeline context becomes its own God Object | Typed stage outputs (PIPE-CTX-1~4): each stage writes only to its namespace; no untyped accumulation |
| Pipeline decomposition introduces subtle behavioral changes | Golden test suite (Phase 3 acceptance criteria): capture before, assert identical after |
| Bootstrap/Runtime split makes debugging harder | Clear lifecycle: Bootstrap runs once, Runtime runs forever; single `_getRuntime()` entry point |
| Re-export hub creates circular dependencies | Type DAG rules (TYPE-DEP-1~4): strict layered imports, no cross-module references |
| ManifestoApp grows back over time | Responsibility rules (FACADE-1~5): delegation only, no business logic; enforced by code review |

---

## 7. Alternatives Considered

### 7.1 Do Nothing

**Rejected:** Code smell will compound as features are added. Memory maintenance (v0.4.8) already added ~300 lines to the type monolith.

### 7.2 Middleware Chain (Chain of Responsibility)

**Rejected:** Manifesto's pipeline phases are fixed by SPEC. Dynamic step injection adds complexity without benefit. If plugin-injected execution steps are needed in the future, this can be revisited.

### 7.3 Result Monad / Railway-Oriented Pipeline

**Rejected:** While elegant, TypeScript's monad ergonomics are poor. The explicit pipeline with early-return is more idiomatic and debuggable. Constitution's "errors are values" applies to Core (pure computation), not App (orchestration).

### 7.4 Extract App Runtime as Separate Package

**Rejected:** ADR-001 explicitly decided "Runtime is not a new layer but the name for App's execution environment responsibility." Extracting a package would contradict this decision and require a new ADR to supersede ADR-001.

---

*End of ADR-004*
