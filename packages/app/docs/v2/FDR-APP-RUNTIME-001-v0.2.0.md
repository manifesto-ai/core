# FDR-APP-RUNTIME-001: Lifecycle, Hooks & Plugin System

> **Version:** 0.2.0 (Draft)  
> **Status:** Draft  
> **Date:** 2026-01-19  
> **Scope:** App v2 runtime extensibility model (lifecycle + hooks + plugins)  
> **Depends on:** ARCHITECTURE v2, ADR-001, Host v2.0.2, World v2.0.2, Event-Loop FDR v1.0, **FDR-APP-PUB-001**

---

## 1. Overview

### 1.1 Relationship to FDR-APP-PUB-001

This FDR defines **extensibility** (lifecycle, hooks, plugins).  
FDR-APP-PUB-001 defines **execution model** (tick, publish boundary, scheduler).

```
FDR-APP-PUB-001 (Execution Model)
├── Tick definition ("mailbox idle")
├── Publish boundary ("at most once per tick")
├── Scheduler injection
└── Liveness guarantee

FDR-APP-RUNTIME-001 (Extensibility Model)  ← This document
├── Lifecycle states
├── Hook system (when/what to observe)
└── Plugin system (how to package extensions)
```

**Key dependency:** This FDR's `state:publish` hook fires according to PUB-001's tick boundary definition.

### 1.2 Why One FDR for Lifecycle + Hooks + Plugins?

Lifecycle, Hooks, Plugin은 분리된 개념이 아니라 **하나의 확장성 계약**이다:

```
Lifecycle  →  "언제" 확장 포인트가 활성화되는가 (temporal boundary)
Hooks      →  "무엇을" 관측/확장할 수 있는가 (observation points)
Plugin     →  "어떻게" 확장을 패키징하는가 (packaging unit)
```

세 계약이 정합하지 않으면 확장성 모델이 깨진다. 예를 들어:
- Lifecycle이 `ready` 전인데 Hook이 발화하면? → 불완전한 상태 관측
- Plugin이 `ready` 후에 설치되면? → Hook 발화 순서 예측 불가

### 1.3 Design Goals

| Goal | Description |
|------|-------------|
| **Extensibility** | 외부 코드가 App 동작을 관측하고 반응할 수 있어야 함 |
| **Non-interference** | 확장 코드가 Core/Host/World 헌법을 **구조적으로** 위반할 수 없어야 함 |
| **Observability** | Process는 App 소유이므로 외부에서 관측 가능해야 함 |
| **Composability** | Plugin들이 독립적으로 조합 가능해야 함 |

### 1.4 Core Principle

> **"Hooks are observation, not control."**

이것은 ADR-001의 **"Results are World's; Process is App's"**를 확장성 관점에서 표현한 것이다:

| 구분 | 소유자 | Hook에서 가능한 것 |
|------|--------|-------------------|
| **Results** (World 봉인, Lineage) | World | 관측만 가능 (변경 불가) |
| **Process** (실행 과정, telemetry) | App | 관측 + enqueue로 후행 반응 |

확장 코드는 실행을 **관측**할 수 있지만, 실행 결과(World 봉인)를 **직접 제어**할 수 없다.
후행 반응이 필요하면 `enqueue`로 **다음 tick**에 처리한다.

---

## 2. Lifecycle State Machine

### 2.1 Decision: App is a World-Bound Runtime Facade

**D-LC-1:** App 인스턴스는 하나의 World Protocol 인스턴스를 대표하는 런타임이며, 외부 계약의 유일한 façade다.

```
App ↔ World = 1:1 (고정)
```

> **Note:** 이 결정은 FDR-APP-PUB-001 D0의 **재확인**이다. PUB-001에서 tick/publish boundary 안전성을 위해 1:1 고정을 헌법으로 채택했고, 본 FDR에서는 lifecycle/hooks/plugin 관점에서 동일 헌법을 전제한다.

**Rationale:**
- App이 여러 World를 관리하면 "어느 World의 상태인가?"가 모호해진다
- Lifecycle 상태(`ready`, `disposing` 등)가 World별로 달라질 수 있어 혼란 발생
- Hook 발화 시 "어느 World의 이벤트인가?" 구분 불가
- Multi-world 시나리오는 여러 App 인스턴스로 해결한다

### 2.2 Decision: Lifecycle as Existential State Machine

**D-LC-2:** App lifecycle은 UI 프레임워크의 lifecycle이 아니라, **World에 책임지는 실행 주체의 존재 상태**다.

### 2.3 States

```typescript
type AppStatus = 
  | 'created'      // 인스턴스 생성됨, 아직 초기화 전
  | 'initializing' // 내부 결합 진행 중
  | 'ready'        // 외부 계약 사용 가능
  | 'disposing'    // 정리 중, 새 ingress 거부
  | 'disposed';    // 종료됨, terminal
```

> **Note:** `executing`은 외부 상태가 아니라 telemetry로만 관측되는 논리 상태다.

### 2.4 Transitions

```
created ──→ initializing ──→ ready ──→ disposing ──→ disposed
   │                           │
   └─── (error) ───────────────┴──→ disposed
```

| From | To | Trigger | Reversible |
|------|----|---------|------------|
| created | initializing | `app.init()` 호출 | ❌ |
| initializing | ready | 내부 결합 완료 | ❌ |
| ready | disposing | `app.dispose()` 호출 | ❌ |
| disposing | disposed | graceful shutdown 완료 | ❌ |
| any | disposed | unrecoverable error | ❌ |

### 2.5 Readiness Boundary

**D-LC-3:** App은 **명시적 초기화 경계**를 가지며, `ready` 이전에 외부 계약을 제공하지 않는다.

**`ready`가 의미하는 것 (MUST):**

| Condition | Description |
|-----------|-------------|
| WorldStore ready | baseSnapshot 복구 가능 |
| Policies fixed | ExecutionKeyPolicy, publish scheduler 고정 |
| Runtime active | HostExecutor 구현체 활성화 |
| Plugins installed | 모든 Plugin의 `install()` 완료 |

### 2.6 Disposal Semantics

**D-LC-4:** `disposing` 상태에서:

| Behavior | Policy |
|----------|--------|
| 새 intent ingress | **MUST reject** |
| 진행 중 execution | App 정책에 따라 graceful wait 또는 abort |
| Hook 발화 | `app:disposing`만 허용 |
| Plugin uninstall | 역순으로 `uninstall()` 호출 |

---

## 3. Hook System

### 3.1 Decision: Hooks are Extensibility without Control

**D-HOOK-1:** Nuxt처럼 "문자열 키 기반 hook registry"를 채택하되, Manifesto에서 hooks는 **관측/확장 포인트**로만 정의한다.

### 3.2 Non-Interference Constraints (Constitutional)

**D-HOOK-2:** 다음은 **헌법적 제약**이며 위반 시 시스템 정합성이 깨진다:

| Constraint | Description | Rule ID | Why |
|------------|-------------|---------|-----|
| No state mutation | Handler는 Snapshot을 직접 변형하지 않는다 | HOOK-NI-1 | Snapshot-only channel 위반 |
| No sync act() | Handler는 동일 tick 내 `act()` 호출 금지 | HOOK-NI-2 | Re-entrancy → 무한 루프 가능 |
| No await blocking | Handler는 async work로 실행 경로를 지연시키지 않는다 | HOOK-NI-3 | Mailbox liveness 위반 |
| Error isolation | Handler 예외는 다른 handler/실행에 영향 주지 않는다 | HOOK-NI-4 | 하나의 plugin이 전체를 죽이면 안 됨 |

**Why "Constitutional"?**

이 제약들은 "권장사항"이 아니라 **구조적으로 강제**되어야 한다:
- HOOK-NI-1: `HookContext`에 mutation API 자체가 없음
- HOOK-NI-2: `AppRef`에 `act()` 메서드 자체가 없음 (`enqueueAction`만 제공)
- HOOK-NI-3: `callHook()`이 handler의 반환값을 await하지 않음
- HOOK-NI-4: try-catch로 handler 호출을 감싸고 에러를 격리

### 3.3 Hook Taxonomy

#### A) Lifecycle Hooks (존재 변화)

| Hook | Payload | Fired When |
|------|---------|------------|
| `app:created` | `{ app }` | 인스턴스 생성 직후 |
| `app:initializing` | `{ app }` | init 시작 |
| `app:ready` | `{ app }` | ready 진입 |
| `app:disposing` | `{ app, reason? }` | dispose 시작 |
| `app:disposed` | `{ app }` | dispose 완료 (terminal) |

#### B) State Publish Hooks (외부 계약 표면)

| Hook | Payload | Fired When |
|------|---------|------------|
| `state:publish` | `{ snapshot, diff? }` | **tick boundary** (per FDR-APP-PUB-001 PUB-BOUNDARY-1) |
| `state:branch` | `{ from, to, reason }` | branch switch 시 |

> **Critical:** `state:publish`는 FDR-APP-PUB-001에서 정의한 **Proposal Tick** 경계에서 **최대 1회** 발화한다. computed 노드 단위나 apply 단위로 발화하지 않는다.

#### C) Telemetry Hooks (Process Observation, App-owned)

| Hook | Payload | Fired When |
|------|---------|------------|
| `execution:scheduled` | `{ proposal, executionKey }` | execution 예약됨 |
| `execution:started` | `{ proposal, baseSnapshot }` | execution 시작 |
| `execution:tick:start` | `{ snapshot, tick }` | compute loop tick 시작 |
| `execution:tick:end` | `{ snapshot, tick, duration }` | compute loop tick 종료 |
| `execution:compute` | `{ intent, result }` | Core.compute 완료 |
| `execution:apply` | `{ patches, snapshot }` | Core.apply 완료 |
| `execution:effect:dispatched` | `{ requirement }` | effect 실행 시작 |
| `execution:effect:fulfilled` | `{ requirement, patches }` | effect 실행 완료 |

#### D) Governance Boundary Hooks (World Results, Forwarded by App)

| Hook | Payload | Fired When |
|------|---------|------------|
| `execution:completed` | `{ proposal, world, duration }` | 실행 성공, World 생성됨 |
| `execution:failed` | `{ proposal, world, error }` | 실행 실패, World 생성됨 |
| `world:created` | `{ world, proposal }` | World 봉인됨 |
| `world:aborted` | `{ proposal, reason }` | liveness abort 등 |

### 3.4 Hook Registry Model

**D-HOOK-3:** String-keyed registry with namespacing.

```typescript
type HookName = string;  // 'category:subcategory:event' 형식

// 충돌 회피 네임스페이스
// - Core hooks: 'app:', 'state:', 'execution:', 'world:'
// - Plugin hooks: 'plugin:<name>:*'
// - User hooks: 'user:*'
```

**D-HOOK-4:** Fire-and-forget invocation.

```typescript
// App 내부 구현
function callHook(name: HookName, payload: unknown): void {
  for (const handler of registry.get(name) ?? []) {
    try {
      handler(payload, hookContext);
    } catch (error) {
      // 격리: 다른 handler에 영향 없음
      emit('hook:error', { hook: name, error });
    }
  }
  // 반환값 없음, await 없음
}
```

### 3.5 HookContext Contract

**D-HOOK-5:** 모든 Hook handler는 두 번째 인자로 `HookContext`를 받는다.

```typescript
type HookContext = {
  // 읽기 전용 접근
  readonly app: AppRef;     // App에 대한 제한된 참조
  readonly timestamp: number;
};

// AppRef는 제한된 인터페이스 (act() 직접 호출 불가)
type AppRef = {
  readonly status: AppStatus;
  getState<T = unknown>(): AppState<T>;
  getDomainSchema(): DomainSchema;
  getCurrentHead(): WorldId;
  currentBranch(): Branch;
  // act()는 없음 - enqueueAction 사용 강제
  enqueueAction(type: string, input?: unknown, opts?: ActOptions): ProposalId;
};
```

### 3.6 Scheduled Reaction Pattern

**D-HOOK-6:** Hooks 안에서 즉시 실행을 "제어"하지 말고 enqueue하라.

```typescript
// ❌ 금지: 동일 tick 내 직접 act
hooks.on('execution:completed', (payload, ctx) => {
  ctx.app.act({ type: 'followUp' });  // HOOK-NI-2 위반
});

// ✅ 허용: 후행 큐로 요청
hooks.on('execution:completed', (payload, ctx) => {
  ctx.app.enqueueAction('followUp', { /* input */ });
});
```

Enqueued work는 **현재 tick boundary 이후**에 실행된다.

---

## 4. Plugin System

### 4.1 Decision: Plugin is a Bundle of Hooks + Dependencies

**D-PLUGIN-1:** Plugin은 hooks, 의존성 주입, lifecycle을 패키징하는 **확장 단위**다.

**Why Plugin?**

Hook만으로는 부족하다:
- **상태 공유**: 여러 hook에서 같은 service instance를 써야 할 때
- **의존성 관리**: Plugin A가 Plugin B의 기능을 써야 할 때
- **설치/제거**: 관련 hook들을 한 번에 등록/해제해야 할 때

Plugin은 이 문제들을 **하나의 단위**로 해결한다:

```typescript
type Plugin = {
  /** Plugin 고유 식별자 */
  readonly name: string;
  
  /** SemVer 버전 (optional) */
  readonly version?: string;
  
  /** Hook 등록 */
  readonly hooks?: Partial<HookHandlers>;
  
  /** 의존성 주입 - 다른 Plugin/App에서 사용 가능 */
  readonly provide?: Record<string, unknown>;
  
  /** 다른 Plugin 의존 (name 기준) */
  readonly dependencies?: string[];
  
  /** Plugin 설치 시 호출 (async 허용 - init 단계에서만) */
  install?(app: App): void | Promise<void>;
  
  /** Plugin 제거 시 호출 */
  uninstall?(app: App): void;
};
```

### 4.2 Plugin Lifecycle

```
app.use(plugin)
      │
      ▼
┌─────────────────────────────────────────────────┐
│  1. Validate dependencies (missing → error)     │
│  2. Register hooks (plugin.hooks → registry)    │
│  3. Call plugin.install(app) if defined         │
│  4. Merge plugin.provide into injection context │
└─────────────────────────────────────────────────┘
      │
      ▼
Plugin is "installed"
      │
      ▼ (on app.dispose())
┌─────────────────────────────────────────────────┐
│  1. Call plugin.uninstall(app) if defined       │
│  2. Remove hooks from registry                  │
│  3. Remove provided values from context         │
└─────────────────────────────────────────────────┘
```

### 4.3 Plugin Ordering & Conflict Resolution

**D-PLUGIN-2:** Plugin 설치 순서는 **의존성 그래프**에 의해 결정된다.

```typescript
// 의존성 순서 결정
const installOrder = topologicalSort(plugins, p => p.dependencies ?? []);

// 제거는 역순
const uninstallOrder = installOrder.reverse();
```

**D-PLUGIN-3:** 같은 Hook에 여러 handler가 등록되면 **등록 순서**대로 실행된다.

| Scenario | Behavior |
|----------|----------|
| 같은 hook, 여러 plugin | 의존성 순서 → 등록 순서대로 실행 |
| 같은 provide key | 나중 plugin이 덮어씀 (warning 발생) |
| 순환 의존성 | install 시 error throw |

### 4.4 Plugin Constraints

**D-PLUGIN-4:** Plugin도 Non-Interference 제약을 따른다.

| Constraint | Description |
|------------|-------------|
| install()에서 act() 금지 | App이 아직 ready 아님 |
| install()에서 async blocking 최소화 | initializing 단계 지연 |
| hooks는 HOOK-NI-* 준수 | Plugin이라고 예외 없음 |
| uninstall()에서 World mutation 금지 | disposing 단계 |

### 4.5 Dependency Wiring (Spec-aligned)

**D-PLUGIN-5:** v2 App SPEC은 `provide/inject`를 정의하지 않는다. 의존성은 설치 시점에 **closure** 또는 App 설정으로 주입한다.

```typescript
// Memory Plugin (closure로 의존성 주입)
const createMemoryPlugin = (memory: MemoryService): Plugin => ({
  name: '@manifesto/memory',
  hooks: { /* ... */ },
});

// 다른 Plugin에서 사용 (closure로 공유)
const createAnalyticsPlugin = (memory: MemoryService): Plugin => ({
  name: '@manifesto/analytics',
  dependencies: ['@manifesto/memory'],
  hooks: { /* memory 사용 */ },
});
```

---

## 5. Cross-Cutting: Lifecycle ↔ Hooks ↔ Plugin

### 5.1 Lifecycle-Hook Binding

| Lifecycle State | Emitted Hooks | Available Hook Categories |
|-----------------|---------------|---------------------------|
| `created` | `app:created` | Lifecycle only |
| `initializing` | `app:initializing` | Lifecycle only |
| `ready` | `app:ready` | **All hooks available** |
| `disposing` | `app:disposing` | Lifecycle only |
| `disposed` | `app:disposed` | None (terminal) |

### 5.2 Plugin Installation Window

```
created ──→ initializing ──→ ready
              │
              ├── app.use(plugin) 허용
              ├── plugin.install() 호출
              └── hooks 등록
              
ready 이후 app.use() → Error (too late)
```

**D-CROSS-1:** Plugin은 `ready` **이전에만** 설치 가능하다.

**Rationale:** ready 이후 plugin 추가는 hook 발화 순서를 예측 불가능하게 만든다.

### 5.3 Hook Firing Guarantees

| Guarantee | Description |
|-----------|-------------|
| Lifecycle hooks | 상태 전이 시 **정확히 1번** 발화 |
| Telemetry hooks | 해당 이벤트 발생 시마다 발화 (0-N번) |
| Governance hooks | World 결과당 **정확히 1번** 발화 |
| state:publish | tick당 **최대 1번** 발화 |

---

## 6. Examples (Informative)

### 6.1 Telemetry Plugin

```typescript
const telemetryPlugin: Plugin = {
  name: '@manifesto/telemetry',
  hooks: {
    'execution:tick:end': (payload, ctx) => {
      // ✅ 관측만 함 (non-interference)
      metrics.histogram('tick_duration_ms', payload.duration);
    },
    'execution:completed': (payload, ctx) => {
      metrics.counter('executions_total', 1, { status: 'completed' });
    },
    'execution:failed': (payload, ctx) => {
      metrics.counter('executions_total', 1, { status: 'failed' });
    },
  },
};
```

### 6.2 Memory Plugin

```typescript
const memoryPlugin: Plugin = {
  name: '@manifesto/memory',
  hooks: {
    'execution:completed': (payload, ctx) => {
      // ✅ enqueueAction으로 후행 처리
      ctx.app.enqueueAction('memory.consolidate', { worldId: payload.world.worldId });
    },
  },
};
```

### 6.3 Mind Protocol Plugin (Sketch)

```typescript
const mind = new MindRuntime();
const mindPlugin: Plugin = {
  name: '@manifesto/mind',
  dependencies: ['@manifesto/memory'],
  hooks: {
    'app:ready': (payload, ctx) => {
      mind.start();  // tick loop 시작
    },
    'state:publish': (payload, ctx) => {
      mind.observe(payload.snapshot);
    },
    'app:disposing': (payload, ctx) => {
      mind.stop();
    },
  },
};
```

---

## 7. Proposed Rules for SPEC

### Lifecycle Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| LC-1 | MUST | App instance MUST be bound to exactly one World Protocol instance |
| LC-2 | MUST | App MUST expose explicit readiness boundary; before `ready`, contract APIs MUST NOT be usable |
| LC-3 | MUST | `disposing` MUST reject new ingress |
| LC-4 | MUST | `disposed` MUST be terminal; no further hooks except diagnostics |
| LC-5 | SHOULD | `executing` SHOULD be telemetry-only, not public status |

### Hook Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| HOOK-1 | MUST | App MUST provide string-keyed hook registry |
| HOOK-2 | MUST | Hooks MUST be observational; MUST NOT affect execution outcome |
| HOOK-NI-1 | MUST NOT | Hook handlers MUST NOT mutate Snapshot directly |
| HOOK-NI-2 | MUST NOT | Hook handlers MUST NOT call `act()` synchronously within same tick |
| HOOK-NI-3 | MUST NOT | Hook handlers MUST NOT await async operations that block execution |
| HOOK-NI-4 | MUST | Hook errors MUST be isolated; MUST NOT affect other handlers |
| HOOK-5 | SHOULD | Hook invocation SHOULD be fire-and-forget |
| HOOK-6 | SHOULD | App SHOULD provide `enqueue()` for post-dispatch reactions |
| HOOK-7 | MUST | Enqueued work MUST run outside current tick boundary |
| HOOK-8 | MUST | `state:publish` MUST be emitted at most once per tick (per FDR-APP-PUB-001 PUB-BOUNDARY-1) |

### Plugin Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| PLUGIN-1 | MUST | Plugin MUST have unique `name` |
| PLUGIN-2 | MUST | Plugin installation MUST happen before `ready` |
| PLUGIN-3 | MUST | Plugin dependencies MUST be installed before dependent plugin |
| PLUGIN-4 | MUST | Circular dependencies MUST cause installation error |
| PLUGIN-5 | MUST | Plugin hooks MUST follow HOOK-NI-* constraints |
| PLUGIN-6 | SHOULD | Plugin uninstall SHOULD be called in reverse installation order |
| PLUGIN-7 | MAY | Plugin MAY provide injectable values via `provide` |

---

## 8. Appendix: Type Definitions (Informative)

```typescript
// ─────────────────────────────────────────────────────────
// Lifecycle
// ─────────────────────────────────────────────────────────
type AppStatus = 'created' | 'initializing' | 'ready' | 'disposing' | 'disposed';

// ─────────────────────────────────────────────────────────
// Hooks
// ─────────────────────────────────────────────────────────
type HookName = string;
type HookHandler<T = unknown> = (payload: T, ctx: HookContext) => void;
type HookHandlers = Record<HookName, HookHandler>;

type HookContext = {
  readonly app: AppRef;
  readonly timestamp: number;
};

type AppRef = {
  readonly status: AppStatus;
  getState<T = unknown>(): AppState<T>;
  getDomainSchema(): DomainSchema;
  getCurrentHead(): WorldId;
  currentBranch(): Branch;
  enqueueAction(type: string, input?: unknown, opts?: ActOptions): ProposalId;
};

// ─────────────────────────────────────────────────────────
// Plugin
// ─────────────────────────────────────────────────────────
type Plugin = {
  readonly name: string;
  readonly version?: string;
  readonly hooks?: Partial<HookHandlers>;
  readonly provide?: Record<string, unknown>;
  readonly dependencies?: string[];
  install?(app: App): void | Promise<void>;
  uninstall?(app: App): void;
};

// ─────────────────────────────────────────────────────────
// Hook Payloads (Representative)
// ─────────────────────────────────────────────────────────
type AppHookPayload = { app: AppRef };
type StatePublishPayload = { snapshot: Snapshot; diff?: Patch[] };
type ExecutionTickPayload = { snapshot: Snapshot; tick: number; duration?: number };
type ExecutionCompletedPayload = { proposal: Proposal; world: World; duration: number };
type ExecutionFailedPayload = { proposal: Proposal; world: World; error: ErrorValue };
type WorldCreatedPayload = { world: World; proposal: Proposal };
```

---

## 9. References

- **FDR-APP-PUB-001**: World-Bound App Runtime & Publish Boundary (tick definition, publish boundary)
- ARCHITECTURE v2.0.0
- ADR-001: Layer Separation
- Event-Loop Execution Model FDR v1.0
- World SPEC v2.0.2 (Event System §8)
- Host SPEC v2.0.2 (TraceEvent)

---

## 10. Cross-Reference Summary

| This FDR | Depends on | For |
|----------|------------|-----|
| D-LC-1 (App↔World 1:1) | FDR-APP-PUB-001 D0 | 헌법 재확인 |
| HOOK-8 (state:publish frequency) | FDR-APP-PUB-001 PUB-BOUNDARY-1 | tick당 최대 1회 |
| "tick boundary" 언급 시 | FDR-APP-PUB-001 D1 | tick = mailbox idle |
| Telemetry vs State 분리 | FDR-APP-PUB-001 D4 | Dual Channel |

---

*End of FDR-APP-RUNTIME-001*
