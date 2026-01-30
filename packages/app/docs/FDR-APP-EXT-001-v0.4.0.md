# FDR-APP-EXT-001: External Memory Interface

> **Version:** 0.4.0 (Draft)  
> **Status:** Draft  
> **Date:** 2026-01-19  
> **Scope:** App v2 External Memory abstraction for extensible agent patterns  
> **Depends on:** ARCHITECTURE v2, ADR-001, World SPEC v2.0.2, Core SPEC v2.0.0, FDR-APP-INTEGRATION-001
>
> **Changelog:**
> - v0.4.0: **Core SPEC 타입 정합성 수정**
    >   - `snapshot.meta` 확장 금지 (Core SPEC v2.0.0에서 4개 필드 고정)
>   - `memoryRecallFailed`를 `input.$app` 네임스페이스로 이동
>   - `input.$app` App 예약 네임스페이스 규약 추가 (APP-INPUT-1~3)
>   - MEM-CONTEXT-3 규칙 수정: 저장 위치를 `input.$app.memoryContext`로 명확화
> - v0.3.0: **Final Sealing** — Blocker 2개 + 권장 4개 반영
    >   - MemoryRecordInput/StoredMemoryRecord 타입 분리 (id 보장)
>   - AppExecutionContext 분리 (World SPEC 경계 준수)
>   - MEM-REC-1~2, MEM-PATCH-1, MEM-INT-5, MEM-CTX-1~3, MEM-MAINT-4 추가
>   - recall timeout/degradation, result.memoryId informative 표기
> - v0.2.0: **Context Freezing** 추가 — Mutable Memory와 Determinism 보장을 위한 값 박제 규칙 (MEM-CONTEXT-1~3)

---

## 1. Overview

### 1.1 Purpose

External Memory는 World/Snapshot과 독립된 **범용 Mutable 저장소 인터페이스**다.

```
Snapshot.data (World-owned)          External Memory (User-owned)
├── World와 함께 봉인                 ├── World와 독립
├── Immutable (역사)                  ├── Mutable (CRUD)
├── Authority 승인 필수               ├── Authority 연동 선택
└── 실행 결과                         └── 실행 컨텍스트/축적 정보
```

### 1.2 Design Principles

| Principle | Description |
|-----------|-------------|
| **Interface, not Implementation** | Manifesto는 인터페이스만 정의, 구현은 사용자 |
| **No Data Format Constraint** | 저장 데이터 형식(T)에 제약 없음 |
| **No Backend Constraint** | Map, DB, Vector Store 등 자유 |
| **Optional Authority** | 필요 시 Authority 연동 가능, 강제 아님 |
| **Use-case Agnostic** | 특정 패턴(ReAct, RAG 등)에 종속되지 않음 |
| **Determinism Guarantee** | recall된 데이터는 Snapshot에 값으로 박제 (Replay 재현성 보장) |
| **Core SPEC Compliance** | SnapshotMeta 등 Core 타입 확장 금지 (v0.4.0) |

### 1.3 Use Cases (Informative)

External Memory는 다양한 패턴을 지원한다:

```
Mind Protocol
├── 페로몬 기반 기억 관리
├── 메모/헌법 계층 구조
└── 중요도 기반 승격/퇴화

ReAct Pattern
├── Thought 저장
├── Action 기록
└── Observation 축적

Plan-and-Execute
├── Plan 저장
├── Step 진행 상태
└── Execution log

RAG (Retrieval-Augmented Generation)
├── Document chunks
├── Embeddings
└── Retrieval index

Session Memory
├── 대화 히스토리
├── 사용자 선호
└── 컨텍스트 유지
```

> **Note:** 위 예시들은 Informative이며, Manifesto는 특정 패턴을 강제하지 않는다.

---

## 2. MemoryStore Interface

### 2.1 Core Interface

**D-MEM-1:** MemoryStore는 범용 CRUD 인터페이스를 제공한다.

```typescript
/**
 * MemoryStore: 외부 메모리 저장소 인터페이스
 * 
 * Manifesto는 이 인터페이스만 정의.
 * 저장 방식, 데이터 형식은 사용자가 결정.
 */
interface MemoryStore<T = unknown> {
  // CRUD (Required)
  create(record: MemoryRecordInput<T>): Promise<MemoryId>;
  get(id: MemoryId): Promise<StoredMemoryRecord<T> | null>;
  update(id: MemoryId, patch: Partial<T>): Promise<void>;
  delete(id: MemoryId): Promise<void>;
  query(filter: MemoryFilter): Promise<StoredMemoryRecord<T>[]>;
  
  // Batch Operations (Optional)
  createMany?(records: MemoryRecordInput<T>[]): Promise<MemoryId[]>;
  deleteMany?(ids: MemoryId[]): Promise<void>;
  updateMany?(updates: Array<{ id: MemoryId; patch: Partial<T> }>): Promise<void>;
  
  // Lifecycle (Optional)
  consolidate?(): Promise<void>;
  clear?(): Promise<void>;
}
```

### 2.2 Record Types

**D-MEM-REC:** 입력 레코드와 저장된 레코드는 타입이 분리된다.

```typescript
/**
 * MemoryRecordInput: 생성 시 입력 레코드
 * id, createdAt, updatedAt은 선택적 (자동 생성 가능)
 */
type MemoryRecordInput<T> = {
  readonly id?: MemoryId;
  readonly data: T;
  readonly createdAt?: number;
  readonly updatedAt?: number;
  readonly tags?: readonly string[];
  readonly meta?: Record<string, unknown>;
};

/**
 * StoredMemoryRecord: 저장소에서 반환되는 레코드
 * id, createdAt, updatedAt은 필수 (저장소가 보장)
 */
type StoredMemoryRecord<T> = {
  readonly id: MemoryId;
  readonly data: T;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly tags?: readonly string[];
  readonly meta?: Record<string, unknown>;
};
```

---

## 3. App Integration

### 3.1 MemoryStore Injection

**D-MEM-2:** App은 MemoryStore를 선택적으로 주입받는다.

```typescript
type AppConfig = {
  memoryStore?: MemoryStore<unknown>;
};

class App {
  private memoryStore?: MemoryStore<unknown>;
  
  constructor(config: AppConfig) {
    this.memoryStore = config.memoryStore;
  }
  
  getMemoryStore<T>(): MemoryStore<T> | undefined {
    return this.memoryStore as MemoryStore<T> | undefined;
  }
}
```

### 3.2 Execution Context Integration (Optional)

**D-MEM-3:** MemoryStore 내용을 실행 컨텍스트로 주입할 수 있다.

> **⚠️ Critical: Context Freezing (Determinism 보장)**
>
> External Memory는 Mutable이므로, recall()로 조회한 데이터를 **참조(Reference)**로 저장하면
> World replay 시 다른 값이 조회되어 **Determinism이 깨진다**.
>
> **Solution:** recall된 데이터는 **값(Value)**으로 Snapshot에 박제되어야 한다.

```typescript
interface MemoryProvider<TContext = unknown> {
  recall(query: MemoryQuery): Promise<TContext>;
  remember(experience: MemoryExperience): Promise<void>;
}

type MemoryQuery = {
  readonly actorId: ActorId;
  readonly intent: Intent;
  readonly baseWorld: WorldId;
  readonly timestamp: number;
  readonly hints?: Record<string, unknown>;
};

type MemoryExperience = {
  readonly actorId: ActorId;
  readonly intent: Intent;
  readonly outcome: 'completed' | 'failed';
  readonly baseWorld: WorldId;
  readonly resultWorld: WorldId;
  readonly timestamp: number;
  readonly data?: unknown;
};
```

### 3.3 Context Freezing Implementation (v0.4.0 개정)

**D-MEM-4:** recall된 컨텍스트는 Snapshot 내부에 값으로 박제되어야 한다.

> **⚠️ Critical: Core SPEC 타입 준수 (v0.4.0)**
>
> Core SPEC v2.0.0에서 `SnapshotMeta`는 **4개 필드로 고정**되어 있다:
> ```typescript
> type SnapshotMeta = {
>   readonly version: number;
>   readonly timestamp: number;
>   readonly randomSeed: string;
>   readonly schemaHash: string;
> };
> ```
>
> **`snapshot.meta`에 필드를 추가하면 프로토콜 타입 위반**이다.
> App 전용 데이터는 **`input.$app` 네임스페이스**를 사용해야 한다.

```typescript
/**
 * AppExecutionContext: App 레벨 실행 컨텍스트
 * 
 * World SPEC의 HostExecutionOptions와 분리된 App 내부 타입.
 */
type AppExecutionContext = {
  readonly memoryContext?: unknown;
  readonly memoryRecallFailed?: boolean;
};

/**
 * AppHostExecutor: App 레벨 HostExecutor 래퍼
 */
class AppHostExecutor {
  constructor(
    private host: Host,
    private memoryProvider?: MemoryProvider
  ) {}

  async execute(
    key: ExecutionKey,
    baseSnapshot: Snapshot,
    intent: Intent,
    opts: HostExecutionOptions
  ): Promise<HostExecutionResult> {
    // 1. recall은 App 내부에서 수행 (best-effort with timeout)
    const appContext = await this.recallWithTimeout(
      { actorId: intent.actorId, intent, baseWorld: key, timestamp: Date.now() },
      { timeoutMs: 5000 }
    );
    
    // 2. Context Freezing: Snapshot에 값 박제
    const frozenSnapshot = this.freezeContext(baseSnapshot, appContext);
    
    // 3. Host 실행 (World SPEC 경계 준수)
    return this.host.execute(key, frozenSnapshot, intent, opts);
  }
  
  private async recallWithTimeout(
    query: MemoryQuery,
    opts: { timeoutMs: number }
  ): Promise<AppExecutionContext> {
    if (!this.memoryProvider) {
      return { memoryContext: undefined };
    }
    
    try {
      const memoryContext = await Promise.race([
        this.memoryProvider.recall(query),
        this.timeout(opts.timeoutMs),
      ]);
      return { memoryContext, memoryRecallFailed: false };
    } catch (error) {
      console.warn('Memory recall failed, proceeding without context:', error);
      return { memoryContext: undefined, memoryRecallFailed: true };
    }
  }
  
  private timeout(ms: number): Promise<never> {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Memory recall timeout')), ms)
    );
  }
  
  /**
   * Context Freezing: Snapshot에 App 컨텍스트 박제
   * 
   * v0.4.0 변경사항:
   * - ❌ snapshot.meta 확장 금지 (Core SPEC 위반)
   * - ✅ input.$app 네임스페이스 사용
   */
  private freezeContext(
    snapshot: Snapshot,
    context: AppExecutionContext
  ): Snapshot {
    const existingInput = (snapshot.input ?? {}) as Record<string, unknown>;
    const existing$app = (existingInput.$app ?? {}) as Record<string, unknown>;
    
    return {
      ...snapshot,
      input: {
        ...existingInput,
        // ✅ App 예약 네임스페이스에 컨텍스트 박제
        $app: {
          ...existing$app,
          memoryContext: context.memoryContext
            ? structuredClone(context.memoryContext)
            : undefined,
          memoryRecallFailed: context.memoryRecallFailed,
        },
      },
      // ❌ v0.4.0: meta 확장 금지 (Core SPEC 타입 위반)
      // meta는 그대로 유지, 확장하지 않음
    };
  }
}

/**
 * Replay 시: 박제된 컨텍스트 사용
 * 
 * v0.4.0: input.$app에서 조회
 */
function getMemoryContextForReplay<TContext>(
  snapshot: Snapshot
): TContext | undefined {
  const input = snapshot.input as Record<string, unknown> | undefined;
  const $app = input?.$app as Record<string, unknown> | undefined;
  return $app?.memoryContext as TContext | undefined;
}

/**
 * Replay 시: 박제된 실패 여부 확인
 */
function getMemoryRecallFailedForReplay(snapshot: Snapshot): boolean {
  const input = snapshot.input as Record<string, unknown> | undefined;
  const $app = input?.$app as Record<string, unknown> | undefined;
  return ($app?.memoryRecallFailed as boolean) ?? false;
}
```

### 3.4 Replay Determinism

```typescript
/**
 * World replay 시 Determinism 보장
 */
async function replayWorld(
  worldId: WorldId,
  worldStore: WorldStore,
  appExecutor: AppHostExecutor
): Promise<Snapshot> {
  const world = await worldStore.getWorld(worldId);
  
  // ✅ 박제된 컨텍스트가 이미 Snapshot에 포함됨
  const frozenSnapshot = await worldStore.restore(world.parentWorld);
  
  // Replay 모드: External Memory 재조회 없이 박제된 컨텍스트 사용
  return appExecutor.executeReplay(
    world.executionKey,
    frozenSnapshot,
    world.intent
  );
}
```

### 3.5 Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| MEM-INT-1 | MAY | App MAY accept MemoryStore at construction |
| MEM-INT-2 | MUST | App MUST expose MemoryStore if provided |
| MEM-INT-3 | MAY | MemoryProvider is optional wrapper |
| MEM-INT-4 | MUST NOT | MemoryStore failure MUST NOT block World execution |
| MEM-INT-5 | SHOULD | recall/remember는 timeout을 두고 실패 시 빈 컨텍스트로 degrade |
| MEM-CTX-1 | MUST | memoryContext는 World/Proposal record에 포함되지 않는 **실행-시점 힌트** |
| MEM-CTX-2 | MUST NOT | memoryContext는 World SPEC의 HostExecutionOptions를 통해 전달되지 않아야 함 |
| MEM-CTX-3 | MUST | 저장 위치: **`snapshot.input.$app.memoryContext`** (v0.4.0 개정) |
| MEM-CONTEXT-1 | MUST | recall()된 데이터는 Snapshot에 **값(Value)**으로 박제되어야 함 |
| MEM-CONTEXT-2 | MUST | World replay 시 External Memory 재조회 없이 박제된 값을 사용해야 함 |

### 3.6 App Reserved Namespace Rules (v0.4.0 신규)

| Rule ID | Level | Description |
|---------|-------|-------------|
| APP-INPUT-1 | MUST | App reserved namespace is `input.$app` |
| APP-INPUT-2 | MUST NOT | Domain schemas MUST NOT use `$app` prefix in input field names |
| APP-INPUT-3 | MUST NOT | App MUST NOT extend SnapshotMeta (Core SPEC defines exactly 4 fields) |

---

## 4. Authority Integration (Optional)

**D-MEM-5:** 중요한 메모리 작업에 Authority 승인을 연동할 수 있다.

```typescript
type MemoryOperation = {
  readonly type: 'create' | 'update' | 'delete' | 'promote' | 'demote';
  readonly record?: StoredMemoryRecord<unknown>;
  readonly actorId: ActorId;
  readonly meta?: Record<string, unknown>;
};

interface MemoryAuthorityPolicy {
  requiresAuthority(operation: MemoryOperation): boolean;
  assessRisk?(operation: MemoryOperation): 'low' | 'medium' | 'high';
}
```

### 4.1 Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| MEM-AUTH-1 | MAY | Memory operations MAY require Authority approval |
| MEM-AUTH-2 | SHOULD | Authority-controlled ops SHOULD go through Proposal |
| MEM-AUTH-3 | MAY | MemoryAuthorityPolicy is optional |
| MEM-AUTH-4 | MUST | Non-authority operations MUST NOT create World records |

---

## 5. Lifecycle Hooks (Optional)

```typescript
interface MemoryHooks<T = unknown> {
  onCreated?(record: StoredMemoryRecord<T>): void | Promise<void>;
  onUpdated?(id: MemoryId, before: T, after: T): void | Promise<void>;
  onDeleted?(id: MemoryId, record: StoredMemoryRecord<T>): void | Promise<void>;
  onQueried?(filter: MemoryFilter, results: StoredMemoryRecord<T>[]): void | Promise<void>;
}
```

### 5.1 Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| MEM-HOOK-1 | MAY | Lifecycle hooks are optional |
| MEM-HOOK-2 | MUST NOT | Hook failure MUST NOT fail the operation |
| MEM-HOOK-3 | SHOULD | Hooks SHOULD be async-safe |

---

## 6. Maintenance Integration

```typescript
type MemoryMaintenanceConfig = {
  enabled: boolean;
  retention: MemoryRetentionPolicy;
};

type MemoryRetentionPolicy = {
  maxAge?: number;
  maxRecords?: number;
  ephemeralTags?: string[];
};
```

### 6.1 Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| MEM-MAINT-1 | MAY | MemoryStore MAY integrate with Maintenance cycle |
| MEM-MAINT-2 | SHOULD | Ephemeral records SHOULD be periodically cleaned |
| MEM-MAINT-3 | MAY | consolidate() MAY be called during Maintenance |
| MEM-MAINT-4 | SHOULD | MemoryStore maintenance는 별도 job queue에서 실행, mailbox/tick 블로킹 금지 |

---

## 7. Rules Summary

### MemoryStore CRUD

| Rule ID | Level | Description |
|---------|-------|-------------|
| MEM-CRUD-1 | MUST | Implement create, get, update, delete, query |
| MEM-CRUD-2 | MUST | get() returns null for non-existent ID |
| MEM-CRUD-3 | MUST | update() throws for non-existent ID |
| MEM-CRUD-4 | SHOULD | Auto-generate ID if not provided |
| MEM-CRUD-5 | SHOULD | Auto-set timestamps |
| MEM-REC-1 | MUST | get()/query() 반환은 id 필수 (StoredMemoryRecord) |
| MEM-REC-2 | MUST | 반환 레코드의 createdAt/updatedAt 필수 |
| MEM-PATCH-1 | SHOULD | update() patch는 object T일 때 shallow merge 권장 |

### App Integration

| Rule ID | Level | Description |
|---------|-------|-------------|
| MEM-INT-1 | MAY | App MAY accept MemoryStore |
| MEM-INT-2 | MUST | App MUST expose injected MemoryStore |
| MEM-INT-4 | MUST NOT | MemoryStore failure MUST NOT block execution |
| MEM-INT-5 | SHOULD | recall/remember는 timeout + graceful degradation |
| MEM-CTX-1 | MUST | memoryContext는 실행-시점 힌트 (World record 미포함) |
| MEM-CTX-2 | MUST NOT | HostExecutionOptions 통해 전달 금지 |
| MEM-CTX-3 | MUST | 저장 위치: `snapshot.input.$app.memoryContext` (v0.4.0 개정) |
| MEM-CONTEXT-1 | MUST | recall()된 데이터는 Snapshot에 값으로 박제 |
| MEM-CONTEXT-2 | MUST | Replay 시 박제된 값 사용 (재조회 금지) |

### App Reserved Namespace (v0.4.0 신규)

| Rule ID | Level | Description |
|---------|-------|-------------|
| APP-INPUT-1 | MUST | App reserved namespace is `input.$app` |
| APP-INPUT-2 | MUST NOT | Domain schemas MUST NOT use `$app` prefix in input |
| APP-INPUT-3 | MUST NOT | App MUST NOT extend SnapshotMeta |

---

## 8. References

- **ARCHITECTURE v2.0.0**: Layer separation
- **ADR-001**: App responsibilities
- **Core SPEC v2.0.0**: Snapshot, SnapshotMeta type definitions (normative)
- **FDR-APP-INTEGRATION-001**: WorldStore, Maintenance cycle
- **FDR-APP-POLICY-001**: Authority integration patterns

---

## 9. Appendix: Type Definitions

```typescript
// ───────────────────────────────────────────────────────────
// Core Types
// ───────────────────────────────────────────────────────────
type MemoryId = string;

type MemoryRecordInput<T> = {
  readonly id?: MemoryId;
  readonly data: T;
  readonly createdAt?: number;
  readonly updatedAt?: number;
  readonly tags?: readonly string[];
  readonly meta?: Record<string, unknown>;
};

type StoredMemoryRecord<T> = {
  readonly id: MemoryId;
  readonly data: T;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly tags?: readonly string[];
  readonly meta?: Record<string, unknown>;
};

type MemoryFilter = {
  readonly ids?: readonly MemoryId[];
  readonly tags?: readonly string[];
  readonly createdAfter?: number;
  readonly createdBefore?: number;
  readonly limit?: number;
  readonly offset?: number;
  readonly orderBy?: 'createdAt' | 'updatedAt';
  readonly order?: 'asc' | 'desc';
  readonly [key: string]: unknown;
};

// ───────────────────────────────────────────────────────────
// MemoryStore Interface
// ───────────────────────────────────────────────────────────
interface MemoryStore<T = unknown> {
  create(record: MemoryRecordInput<T>): Promise<MemoryId>;
  get(id: MemoryId): Promise<StoredMemoryRecord<T> | null>;
  update(id: MemoryId, patch: Partial<T>): Promise<void>;
  delete(id: MemoryId): Promise<void>;
  query(filter: MemoryFilter): Promise<StoredMemoryRecord<T>[]>;
  
  createMany?(records: MemoryRecordInput<T>[]): Promise<MemoryId[]>;
  deleteMany?(ids: MemoryId[]): Promise<void>;
  updateMany?(updates: Array<{ id: MemoryId; patch: Partial<T> }>): Promise<void>;
  
  consolidate?(): Promise<void>;
  clear?(): Promise<void>;
}

// ───────────────────────────────────────────────────────────
// App Execution Context
// ───────────────────────────────────────────────────────────
type AppExecutionContext = {
  readonly memoryContext?: unknown;
  readonly memoryRecallFailed?: boolean;
};

// ───────────────────────────────────────────────────────────
// App Reserved Input Namespace (v0.4.0)
// ───────────────────────────────────────────────────────────
/**
 * input.$app 구조 (App 예약)
 * Domain schema는 이 네임스페이스를 사용하면 안 됨 (APP-INPUT-2)
 */
type AppInputNamespace = {
  readonly memoryContext?: unknown;
  readonly memoryRecallFailed?: boolean;
  readonly [key: string]: unknown;
};

// ───────────────────────────────────────────────────────────
// Context Freezing Functions
// ───────────────────────────────────────────────────────────
function freezeMemoryContext<TContext>(
  snapshot: Snapshot,
  context: TContext
): Snapshot {
  const existingInput = (snapshot.input ?? {}) as Record<string, unknown>;
  const existing$app = (existingInput.$app ?? {}) as Record<string, unknown>;
  
  return {
    ...snapshot,
    input: {
      ...existingInput,
      $app: {
        ...existing$app,
        memoryContext: structuredClone(context),
      },
    },
  };
}

function getMemoryContextForReplay<TContext>(
  snapshot: Snapshot
): TContext | undefined {
  const input = snapshot.input as Record<string, unknown> | undefined;
  const $app = input?.$app as Record<string, unknown> | undefined;
  return $app?.memoryContext as TContext | undefined;
}

// ───────────────────────────────────────────────────────────
// Optional: Execution Integration
// ───────────────────────────────────────────────────────────
type MemoryQuery = {
  readonly actorId: ActorId;
  readonly intent: Intent;
  readonly baseWorld: WorldId;
  readonly timestamp: number;
  readonly hints?: Record<string, unknown>;
};

type MemoryExperience = {
  readonly actorId: ActorId;
  readonly intent: Intent;
  readonly outcome: 'completed' | 'failed';
  readonly baseWorld: WorldId;
  readonly resultWorld: WorldId;
  readonly timestamp: number;
  readonly data?: unknown;
};

interface MemoryProvider<TContext = unknown> {
  recall(query: MemoryQuery): Promise<TContext>;
  remember(experience: MemoryExperience): Promise<void>;
}

// ───────────────────────────────────────────────────────────
// Optional: Authority Integration
// ───────────────────────────────────────────────────────────
type MemoryOperation = {
  readonly type: 'create' | 'update' | 'delete' | 'promote' | 'demote';
  readonly record?: StoredMemoryRecord<unknown>;
  readonly actorId: ActorId;
  readonly meta?: Record<string, unknown>;
};

interface MemoryAuthorityPolicy {
  requiresAuthority(operation: MemoryOperation): boolean;
  assessRisk?(operation: MemoryOperation): 'low' | 'medium' | 'high';
}

// ───────────────────────────────────────────────────────────
// Optional: Lifecycle Hooks
// ───────────────────────────────────────────────────────────
interface MemoryHooks<T = unknown> {
  onCreated?(record: StoredMemoryRecord<T>): void | Promise<void>;
  onUpdated?(id: MemoryId, before: T, after: T): void | Promise<void>;
  onDeleted?(id: MemoryId, record: StoredMemoryRecord<T>): void | Promise<void>;
  onQueried?(filter: MemoryFilter, results: StoredMemoryRecord<T>[]): void | Promise<void>;
}

// ───────────────────────────────────────────────────────────
// Optional: Maintenance
// ───────────────────────────────────────────────────────────
type MemoryRetentionPolicy = {
  maxAge?: number;
  maxRecords?: number;
  ephemeralTags?: string[];
};
```

---

*End of FDR-APP-EXT-001 v0.4.0*
