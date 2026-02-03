# FDR-APP-INTEGRATION-001: Host-World Integration & Memory Lifecycle

> **Version:** 0.4.1 (Draft)
> **Status:** Draft
> **Date:** 2026-02-03
> **Scope:** App v2 Host-World integration, WorldStore strategy, Maintenance cycle for memory lifecycle
> **Depends on:** ARCHITECTURE v2, ADR-001, Host v2.0.2, World v2.0.3, Core SPEC v2.0.0, FDR-APP-PUB-001, FDR-APP-RUNTIME-001
>
> **Changelog:**
> - v0.4.1: **World SPEC v2.0.3 정합 — Platform Namespace 통합**
>   - Delta scope에서 `$mel` 명시적 제외 (WORLD-HASH-4b 정합)
>   - `toCanonicalSnapshot()`: `$host` + `$mel` 모두 제거 (platform namespaces)
>   - STORE-HOST-1 → STORE-PLATFORM-1: platform namespaces 제거로 일반화
>   - References를 World SPEC v2.0.3로 업데이트
>   - Cross-Reference에 MEL-DATA-*, WORLD-HASH-4b 추가
> - v0.4.0: **Core v2 Patch 모델 정합성 수정**
>   - `generateDelta()`: `worldId` 참조 제거 → 외부 파라미터로 전달
>   - `canonicalizePatches()`: JSON Patch ops (add/remove/replace) → Core v2 ops (set/unset/merge)
>   - `jsonPatchToCorePatches()`: 변환 함수 추가
>   - DELTA-GEN-5 규칙 추가: Core Patch 연산자만 사용
> - v0.3.2: World SPEC 정합 — `status` → `outcome` 필드 통일
> - v0.3.1: 최종 봉합 — RESTORE_CONTEXT 고정, canonical snapshot ($host 제거), Delta canonicalization, compactedIndex
> - v0.3.0: 리뷰 피드백 반영 — A안(항상 복구 가능) 채택, Delta 정의 추가, Active Horizon 보존 규칙, Maintenance 실행 모델, outcome 권위 명시

---

## 1. Overview

### 1.1 Why This FDR Is Critical

이 FDR은 Manifesto의 **장기 생명력**을 결정하는 계약이다.

```
World Lineage = 시간 좌표계 = Episodic Memory
WorldStore = 기억의 저장소
HostExecutor = 과거(base)와 미래(terminal)를 연결하는 다리
```

잘못 설계하면:
- 저장 비용 폭발 → 오래된 기억 강제 삭제 → **존재의 단절**
- 복구 성능 저하 → 과거 접근 불가 → **기억 상실**
- 실행 오류 → Lineage 오염 → **기억 왜곡**

### 1.2 Design Principles

| Principle | Description |
|-----------|-------------|
| **Memory as Existence** | World Lineage는 버전 관리가 아니라 존재의 역사 |
| **Maintenance as Lifecycle** | 기억 정리는 최적화가 아니라 자연스러운 생애주기 관리 |
| **Deterministic Restoration** | 어떤 World든 복구하면 **항상** 동일한 상태 (복구 불가 없음) |
| **Graceful Compression** | 삭제 없음, 압축만 (저장 포맷 최적화 + digest 제공) |
| **Extensible Significance** | 중요도 판단은 Plugin이 확장 가능해야 함 |

> **Critical Decision (A안 채택):** Compaction은 "상세 손실"이 아니라 "저장 포맷 압축"이다.
> 모든 World는 **항상 복구 가능**하며, 압축된 World는 추가로 digest(요약)를 제공한다.
> 이것이 "존재의 단절 방지"와 "Deterministic Restoration" 원칙을 동시에 만족시킨다.

### 1.3 Core Insight

> **WorldStore의 gc 정책이 Memory lifecycle을 구현하는 게 아니다.**
> **Memory lifecycle이 WorldStore의 maintenance 전략을 정의한다.**

---

## 2. HostExecutor Contract

### 2.1 Decision: App Implements HostExecutor

**D-HEXEC-1:** World는 HostExecutor interface만 정의하고, App이 구현한다.

```typescript
// World SPEC에서 정의 (World는 구현을 모름)
interface HostExecutor {
  execute(
    key: ExecutionKey,
    baseSnapshot: Snapshot,
    intent: Intent,
    opts?: HostExecutionOptions
  ): Promise<HostExecutionResult>;
}

// App에서 구현
class AppHostExecutor implements HostExecutor {
  constructor(
    private host: Host,
    private worldStore: WorldStore,
    private policy: ExecutionPolicy
  ) {}
  
  async execute(key, baseSnapshot, intent, opts): Promise<HostExecutionResult> {
    // Host dispatch + result 해석
  }
}
```

**Rationale:** Dependency Inversion. World가 Host를 직접 알면 레이어 경계 위반.

### 2.2 HostExecutor Responsibilities

| Responsibility | Description | Owner |
|----------------|-------------|-------|
| baseSnapshot 주입 | WorldStore에서 복구하여 전달 | App |
| ExecutionKey 매핑 | Proposal → ExecutionKey 변환 | App (policy) |
| Host dispatch | 실제 실행 위임 | App → Host |
| Result 해석 | HostResult → HostExecutionResult 변환 | App |
| TraceEvent 변환 | Host TraceEvent → App telemetry | App |

### 2.3 Execution Flow

```
World.submitProposal(proposal)
        │
        ▼ approved
World.executeProposal(proposal)
        │
        ▼
┌───────────────────────────────────────────────────────┐
│  App (HostExecutor implementation)                     │
│                                                        │
│  1. baseSnapshot = worldStore.restore(proposal.base)   │
│  2. key = policy.deriveExecutionKey(proposal)          │
│  3. result = host.dispatch(intent)                     │
│     (baseSnapshot은 Host reset/seed로 주입)            │
│  4. return { terminalSnapshot, status, traceRef }      │
│                                                        │
└───────────────────────────────────────────────────────┘
        │
        ▼
World.sealWorld(proposal, result)
        │
        ▼
worldStore.store(newWorld, delta)
```

### 2.4 Error Handling

**D-HEXEC-2:** HostExecutor는 실행 실패를 에러가 아닌 결과로 반환한다.

```typescript
type HostExecutionResult = {
  terminalSnapshot: Snapshot;
  outcome: 'completed' | 'failed';  // advisory (World SPEC 정합)
  traceRef?: string;
  error?: ErrorValue;  // outcome === 'failed'일 때
};
```

**Rationale:** "Failure → World created" (FDR-W012). 실패도 역사의 일부.

> **Authority:** `outcome`은 힌트(advisory)이며, **`terminalSnapshot`이 권위**다.
> World는 `terminalSnapshot`에서 `deriveOutcome()`으로 최종 결과를 판정한다.
> 이것은 World SPEC v2.0.3의 outcome 판정 규칙과 정합한다.

### 2.5 Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| HEXEC-1 | MUST | App MUST implement HostExecutor interface |
| HEXEC-2 | MUST | HostExecutor MUST restore baseSnapshot from WorldStore before execution |
| HEXEC-3 | MUST | HostExecutor MUST return result (not throw) for execution failures |
| HEXEC-4 | MUST NOT | HostExecutor MUST NOT expose Host internals to World |
| HEXEC-5 | SHOULD | HostExecutor SHOULD record traceRef for audit |

---

## 3. WorldStore Strategy

### 3.1 Decision: Delta + Checkpoint + Lazy Loading

**D-STORE-1:** WorldStore는 세 가지 메커니즘을 조합하여 저장한다.

```
Delta        →  변경분만 저장 (공간 효율)
Checkpoint   →  전체 상태 저장 (복구 효율)
Lazy Loading →  필요할 때만 메모리에 (메모리 효율)
```

**Rationale:**
- 모든 World를 full snapshot으로 저장 → 저장 비용 폭발
- 모든 World를 delta로만 저장 → 복구 시 처음부터 replay
- 조합하면 **저장/복구/메모리 트레이드오프 균형**

### 3.2 Storage Structure

```typescript
type WorldStore = {
  // === 저장소 ===
  
  /** Checkpoint: 전체 Snapshot (중요한 기억) */
  checkpoints: CheckpointStore;
  
  /** Delta: 변경분만 (일반 기억) */
  deltas: DeltaStore;
  
  /** Compacted: 압축된 역사 (흐려진 기억) */
  compacted: CompactedStore;
  
  // === 인덱스 ===
  
  /** 빠른 탐색용 메타데이터 */
  index: WorldIndex;
  
  // === 캐시 ===
  
  /** In-memory LRU cache */
  cache: SnapshotCache;
  
  // === 확장 ===
  
  /** Significance 판단 providers (Plugin 주입) */
  significanceProviders: SignificanceProvider[];
};
```

### 3.3 Stored Types

```typescript
/** Checkpoint: 전체 상태 저장 */
type StoredCheckpoint = {
  readonly worldId: WorldId;
  readonly snapshot: Snapshot;
  readonly createdAt: number;
  readonly reason: CheckpointReason;
};

type CheckpointReason =
  | 'policy_interval'    // 정책 기반 주기적 생성
  | 'significant_moment' // 의미 있는 순간
  | 'manual'             // 명시적 요청
  | 'consolidation';     // Maintenance consolidation

/** Delta: 변경분만 저장 */
type StoredDelta = {
  readonly worldId: WorldId;
  readonly parentId: WorldId;
  readonly patches: readonly Patch[];      // snapshotHash input 범위만 (§3.6 참조)
  readonly metadata: WorldMetadata;
  readonly nearestCheckpoint: WorldId;     // 복구 시 시작점
  readonly schemaHash: string;             // apply 시 사용할 schema
};

/** Compacted: 압축된 저장 포맷 (복구 가능 + digest 제공) */
type StoredCompacted = {
  readonly compactedId: string;
  readonly worldIds: readonly WorldId[];  // 포함된 World들
  readonly from: WorldId;
  readonly to: WorldId;
  readonly period: { start: number; end: number };
  readonly digest: HistoryDigest;         // 무슨 일이 있었는지 요약
  
  /**
   * 압축된 스냅샷 데이터
   * - checkpoint처럼 full snapshot을 저장하되, 압축 알고리즘 적용
   * - 또는 nearest checkpoint + compressed delta chain
   */
  readonly storage: CompactedStorage;
};

type CompactedStorage =
  | { type: 'compressed_snapshot'; data: CompressedData }
  | { type: 'checkpoint_ref'; checkpointId: WorldId; compressedDeltas: CompressedData };

type HistoryDigest = {
  readonly worldCount: number;
  readonly intentTypes: readonly string[];  // 어떤 종류의 action들이 있었나
  readonly significantEvents?: string[];    // 주요 사건 요약
};
```

### 3.4 Index Structure

```typescript
type WorldIndex = {
  // === Lineage 탐색 ===
  
  /** 부모 → 자식들 */
  children: Map<WorldId, WorldId[]>;
  
  /** 자식 → 부모 */
  parent: Map<WorldId, WorldId>;
  
  // === Checkpoint 탐색 ===
  
  /** World → 가장 가까운 checkpoint */
  nearestCheckpoint: Map<WorldId, WorldId>;
  
  /** Checkpoint 목록 (시간순) */
  checkpointTimeline: SortedMap<number, WorldId>;
  
  // === Compacted 탐색 ===
  
  /** World → 소속 compacted segment ID */
  compactedIndex: Map<WorldId, string>;
  
  // === 시간 탐색 ===
  
  /** 시간 → World */
  byTime: SortedMap<number, WorldId>;
  
  // === 상태 ===
  
  /** World의 저장 상태 */
  storageState: Map<WorldId, StorageState>;
};

type StorageState =
  | 'checkpoint'  // 전체 저장됨 (빠른 복구)
  | 'delta'       // 변경분만 저장됨 (replay 필요)
  | 'compacted'   // 압축됨 (복구 가능, 압축 해제 필요)
  | 'cached';     // 메모리에만 (아직 저장 안 됨)
```

**Index Maintenance:**

```typescript
// Compaction 시 인덱스 업데이트
function updateCompactedIndex(record: StoredCompacted): void {
  for (const worldId of record.worldIds) {
    index.compactedIndex.set(worldId, record.compactedId);
    index.storageState.set(worldId, 'compacted');
  }
}
```
```

### 3.5 Restoration Algorithm

**D-STORE-2:** 어떤 World든 복구하면 **항상** 동일한 Snapshot을 반환해야 한다. (복구 실패 없음)

#### 3.5.1 Restore Context (Determinism Guarantee)

**D-STORE-RESTORE-CTX:** WorldStore는 restore에서 `Core.apply`를 호출할 때 **결정적인 고정 HostContext**를 사용한다.

```typescript
/**
 * 복구 전용 고정 컨텍스트
 * - 항상 동일한 값을 사용하여 "같은 WorldId → 같은 Snapshot" 보장
 */
const RESTORE_CONTEXT: HostContext = Object.freeze({
  now: 0,                    // 고정 timestamp
  randomSeed: 'worldstore',  // 고정 seed
  env: {},                   // 빈 환경
});
```

**Rationale:** `Core.apply`는 context에 따라 meta 값이 달라질 수 있음. 복구 시 고정 context를 사용해야 "Deterministic Restoration" 원칙이 성립.

#### 3.5.2 Canonical Snapshot (Platform Namespaces 처리)

**D-STORE-CANONICAL:** WorldStore가 저장하는 snapshot은 **platform namespaces (`data.$host`, `data.$mel`)를 제거**한 "canonical snapshot"이어야 한다.

```typescript
/**
 * 저장 전 canonical 변환
 * - data.$host 제거 (Host-owned, World identity에 영향 없음)
 * - data.$mel 제거 (Compiler-owned guard state, World identity에 영향 없음)
 * - 복구 시 baseSnapshot으로 사용될 때 이전 실행 상태 유입 방지
 *
 * Per WORLD-HASH-4a, WORLD-HASH-4b: platform namespaces are excluded from snapshotHash
 */
function toCanonicalSnapshot(snapshot: Snapshot): Snapshot {
  const { $host, $mel, ...rest } = snapshot.data;
  return {
    ...snapshot,
    data: rest
  };
}
```

**Rationale:**
- `data.$host`: Host 소유 상태 (Host SPEC HOST-DATA-1~6)
- `data.$mel`: Compiler 소유 guard state (World SPEC v2.0.3 MEL-DATA-1~3)
- 둘 다 World hash에서 제외됨 (WORLD-HASH-4a, WORLD-HASH-4b)
- 저장 시 제거해야 다음 실행의 baseSnapshot에 이전 실행 상태가 유입되지 않음
- Delta 범위는 snapshotHash input 범위와 일치해야 함 (D-STORE-3, STORE-4)

#### 3.5.3 Restoration Implementation

```typescript
async function restore(worldId: WorldId): Promise<Snapshot> {
  // 1. Cache hit?
  if (cache.has(worldId)) {
    return cache.get(worldId);
  }
  
  // 2. 저장 상태 확인
  const state = index.storageState.get(worldId);
  
  switch (state) {
    case 'checkpoint':
      // 전체 저장됨 → 직접 반환 (이미 canonical)
      return checkpoints.get(worldId).snapshot;
      
    case 'delta':
      // 변경분만 → checkpoint에서 시작하여 replay
      return restoreFromDelta(worldId);
      
    case 'compacted':
      // 압축됨 → 압축 해제하여 복구 (항상 성공)
      return restoreFromCompacted(worldId);
      
    default:
      throw new WorldNotFoundException(worldId);
  }
}

async function restoreFromDelta(worldId: WorldId): Promise<Snapshot> {
  // 1. 가장 가까운 checkpoint 찾기
  const checkpointId = index.nearestCheckpoint.get(worldId);
  const baseSnapshot = checkpoints.get(checkpointId).snapshot;
  
  // 2. Delta chain 수집
  const deltaChain = collectDeltaChain(checkpointId, worldId);
  
  // 3. 순서대로 apply (고정 context 사용)
  let snapshot = baseSnapshot;
  for (const delta of deltaChain) {
    const schema = schemaRegistry.get(delta.schemaHash);
    snapshot = Core.apply(schema, snapshot, delta.patches, RESTORE_CONTEXT);
  }
  
  // 4. Cache에 저장
  cache.set(worldId, snapshot);
  
  return snapshot;
}

async function restoreFromCompacted(worldId: WorldId): Promise<Snapshot> {
  // worldId → compactedId 인덱스 조회
  const compactedId = index.compactedIndex.get(worldId);
  const record = compacted.get(compactedId);
  
  switch (record.storage.type) {
    case 'compressed_snapshot':
      // 압축된 전체 스냅샷 → 압축 해제
      const snapshot = decompress(record.storage.data);
      cache.set(worldId, snapshot);
      return snapshot;
      
    case 'checkpoint_ref':
      // checkpoint + 압축된 delta chain
      const baseSnapshot = checkpoints.get(record.storage.checkpointId).snapshot;
      const deltas = decompressDeltas(record.storage.compressedDeltas);
      
      // 고정 context로 apply
      let result = baseSnapshot;
      for (const delta of deltas) {
        const schema = schemaRegistry.get(delta.schemaHash);
        result = Core.apply(schema, result, delta.patches, RESTORE_CONTEXT);
      }
      
      cache.set(worldId, result);
      return result;
  }
}

function collectDeltaChain(from: WorldId, to: WorldId): StoredDelta[] {
  const chain: StoredDelta[] = [];
  let current = to;
  
  while (current !== from) {
    const delta = deltas.get(current);
    chain.unshift(delta);
    current = delta.parentId;
  }
  
  return chain;
}
```

---

## 3.6 Delta Definition (v0.4.0 개정)

**D-STORE-3:** Delta는 **World snapshotHash input에 포함되는 부분의 변화**만 표현한다.

```typescript
/**
 * Core v2 Patch 타입
 * 
 * Core SPEC v2.0.0에서 정의된 3가지 연산자만 사용
 * - set: 값 설정 (add/replace 통합)
 * - unset: 값 제거 (remove)
 * - merge: 객체 병합
 */
type CorePatch =
  | { readonly op: 'set'; readonly path: string; readonly value: unknown }
  | { readonly op: 'unset'; readonly path: string }
  | { readonly op: 'merge'; readonly path: string; readonly value: Record<string, unknown> };

type StoredDelta = {
  readonly worldId: WorldId;
  readonly parentId: WorldId;
  readonly patches: readonly CorePatch[];   // ✅ Core v2 Patch 타입 사용
  readonly metadata: WorldMetadata;
  readonly nearestCheckpoint: WorldId;
  readonly schemaHash: string;
};
```

**Delta 범위 (Normative):**

| 포함 | 제외 |
|------|------|
| `data.*` (excluding platform namespaces) | `data.$host` (Host-owned, WORLD-HASH-4a) |
| `system.*` (normalized) | `data.$mel` (Compiler-owned, WORLD-HASH-4b) |

> **Note:** Delta는 snapshotHash input 범위만 포함해야 함 (D-STORE-3, STORE-4).
> World SPEC v2.0.3에서 `$host`와 `$mel` 모두 snapshotHash에서 제외되므로,
> Delta에서도 제외되어야 계약 일관성이 유지됨.

### 3.6.1 Delta Generation Rules (v0.4.0 개정)

**D-DELTA-GEN:** Delta 생성 시 Patch[]는 **결정적이고 재현 가능한 순서**로 canonicalize한다.

```typescript
/**
 * parent → child diff로 Delta 생성
 * 
 * v0.4.0 변경: worldId는 외부 파라미터로 전달
 * (Core Snapshot 타입에 worldId 필드가 없음)
 */
function generateDelta(
  parentWorldId: WorldId,       // ✅ 외부에서 전달
  parentSnapshot: Snapshot,
  childWorldId: WorldId,        // ✅ 외부에서 전달
  childSnapshot: Snapshot,
  schemaHash: string
): StoredDelta {
  // 1. Canonical snapshot으로 변환 (platform namespaces 제거: $host, $mel)
  const canonicalParent = toCanonicalSnapshot(parentSnapshot);
  const canonicalChild = toCanonicalSnapshot(childSnapshot);
  
  // 2. Diff 계산 (JSON Patch 형식)
  const rawJsonPatches = diff(canonicalParent, canonicalChild);
  
  // 3. JSON Patch → Core v2 Patch 변환
  const corePatches = jsonPatchToCorePatches(rawJsonPatches);
  
  // 4. Canonicalize: 경로 기준 정렬
  const patches = canonicalizePatches(corePatches);
  
  return {
    worldId: childWorldId,      // ✅ 외부 파라미터 사용
    parentId: parentWorldId,    // ✅ 외부 파라미터 사용
    patches,
    metadata: extractMetadata(childSnapshot),
    nearestCheckpoint: findNearestCheckpoint(parentWorldId),
    schemaHash,
  };
}

/**
 * JSON Patch → Core v2 Patch 변환
 * 
 * v0.4.0 신규: Core SPEC v2.0.0 정합성
 * 
 * JSON Patch ops → Core v2 ops:
 * - add    → set
 * - replace → set
 * - remove → unset
 * - (copy, move, test는 미지원)
 */
function jsonPatchToCorePatches(jsonPatches: JsonPatch[]): CorePatch[] {
  return jsonPatches.map(jp => {
    switch (jp.op) {
      case 'add':
      case 'replace':
        return { op: 'set', path: jp.path, value: jp.value };
      
      case 'remove':
        return { op: 'unset', path: jp.path };
      
      default:
        throw new Error(`Unsupported JSON Patch op for Core conversion: ${jp.op}`);
    }
  });
}

/**
 * Core Patch[] canonicalization
 * 
 * v0.4.0 개정: Core v2 연산자 순서 사용
 * - 경로 기준 사전식 정렬
 * - 같은 경로면 op 순서: unset < set < merge
 */
function canonicalizePatches(patches: CorePatch[]): CorePatch[] {
  return [...patches].sort((a, b) => {
    // 1. 경로 기준 사전식 정렬
    const pathCompare = a.path.localeCompare(b.path);
    if (pathCompare !== 0) return pathCompare;
    
    // 2. 같은 경로면 op 순서: unset < set < merge
    const opOrder: Record<string, number> = { 
      unset: 0,   // 제거 먼저
      set: 1,     // 설정
      merge: 2    // 병합 마지막
    };
    return (opOrder[a.op] ?? 3) - (opOrder[b.op] ?? 3);
  });
}
```

**Delta Generation Rules:**

| Rule ID | Level | Description |
|---------|-------|-------------|
| DELTA-GEN-1 | MUST | Patch[]는 **경로 기준 사전식 정렬**으로 canonicalize |
| DELTA-GEN-2 | MUST | Patch path는 apply-time에 **정적으로 해석 가능**해야 함 |
| DELTA-GEN-3 | MUST | Delta 생성 전 **canonical snapshot 변환** 적용 (platform namespaces 제거: `$host`, `$mel`) |
| DELTA-GEN-4 | MUST | 같은 parent→child에 대해 **항상 동일한 Patch[]** 생성 |
| DELTA-GEN-5 | MUST | Patch op는 **Core v2 연산자만 사용** (set, unset, merge) |
| DELTA-GEN-6 | MUST | `worldId`는 Snapshot에서 추출하지 않고 **외부 파라미터로 전달** |

---

## 3.7 Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| STORE-1 | MUST | WorldStore MUST support checkpoint, delta, and compacted storage |
| STORE-2 | MUST | Restoration of any WorldId MUST **always succeed** and produce identical Snapshot |
| STORE-3 | MUST | WorldStore MUST track nearestCheckpoint for every delta |
| STORE-4 | MUST | Delta MUST only contain changes within snapshotHash input scope |
| STORE-5 | MUST | Delta MUST record schemaHash for multi-schema restoration |
| STORE-6 | SHOULD | WorldStore SHOULD implement LRU cache for frequently accessed Worlds |
| STORE-PLATFORM-1 | MUST | Stored snapshot MUST be canonical (platform namespaces removed: `$host`, `$mel`) |
| RESTORE-CTX-1 | MUST | Restore MUST use fixed deterministic HostContext (`RESTORE_CONTEXT`) |
| DELTA-GEN-1 | MUST | Patch[] MUST be canonicalized (path-based lexicographic sort) |
| DELTA-GEN-2 | MUST | Patch path MUST be statically resolvable at apply-time |
| DELTA-GEN-3 | MUST | Delta generation MUST apply canonical snapshot transform (platform namespaces removed) |
| DELTA-GEN-4 | MUST | Same parent→child MUST produce identical Patch[] |
| DELTA-GEN-5 | MUST | Patch op MUST use Core v2 operators only (set, unset, merge) |
| DELTA-GEN-6 | MUST | worldId MUST be passed as external parameter, not extracted from Snapshot |
| COMPACT-INDEX-1 | MUST | WorldStore MUST maintain `worldId → compactedId` index |

---

### 3.8 Base World Preservation (Constitutional)

**D-STORE-BASE:** 현재 branch head와 그 조상(실행 가능한 baseWorld chain)은 **절대로** 복구 불가능해지면 안 된다.

```typescript
type ActiveHorizon = {
  /** 현재 branch의 head World */
  readonly heads: Set<WorldId>;
  
  /** head에서 N 세대까지의 조상 (baseWorld로 사용 가능한 범위) */
  readonly depth: number;
  
  /** 계산된 보존 대상 */
  readonly preserved: Set<WorldId>;
};

function calculateActiveHorizon(
  heads: Set<WorldId>,
  depth: number,
  index: WorldIndex
): Set<WorldId> {
  const preserved = new Set<WorldId>();
  
  for (const head of heads) {
    let current: WorldId | null = head;
    let currentDepth = 0;
    
    while (current && currentDepth <= depth) {
      preserved.add(current);
      current = index.parent.get(current) ?? null;
      currentDepth++;
    }
  }
  
  return preserved;
}
```

| Rule ID | Level | Description |
|---------|-------|-------------|
| STORE-BASE-1 | MUST | Current branch head and its ancestors (active horizon) MUST always be fully restorable |
| STORE-BASE-2 | MUST | Active horizon Worlds MUST NOT be compacted in a way that increases restore latency beyond threshold |
| STORE-BASE-3 | SHOULD | Active horizon depth SHOULD be configurable (default: 100) |

---

## 4. Maintenance Cycle: Memory Lifecycle

### 4.1 Conceptual Foundation

World Lineage는 시간에 따라 관리가 필요하다:

```
Active (실행 중)
├── 모든 최근 World 접근 가능
├── Delta chain 유지
└── 빠른 복구

Maintenance (유지보수 주기)
├── Consolidation: 중요한 World → Checkpoint로 승격
├── Pruning: 불필요한 delta → 정리
└── Compaction: 오래된 구간 → 압축된 역사로

Post-Maintenance
├── 승격된 Checkpoint만 즉시 접근
└── 압축된 구간은 digest만 접근 가능
```

### 4.2 Decision: Maintenance Cycle

**D-MAINT-1:** WorldStore의 메모리 정리는 **Maintenance Cycle**로 정의한다.

```typescript
type MaintenanceCycle = {
  /** 시작 조건 */
  trigger: MaintenanceTrigger;
  
  /** 수행할 단계들 */
  phases: MaintenancePhase[];
};

type MaintenanceTrigger =
  | { type: 'scheduled'; interval: Duration }      // 주기적
  | { type: 'threshold'; condition: () => boolean } // 조건 기반
  | { type: 'manual' };                             // 명시적 호출

type MaintenancePhase =
  | { type: 'consolidation'; policy: ConsolidationPolicy }
  | { type: 'pruning'; policy: PruningPolicy }
  | { type: 'compaction'; policy: CompactionPolicy };
```

### 4.3 Consolidation: 기억 강화

**D-MAINT-2:** Consolidation은 중요한 World를 Checkpoint로 승격한다.

#### 4.3.1 SignificanceProvider (확장점)

**D-MAINT-3:** 중요도 판단은 **SignificanceProvider**를 통해 Plugin이 확장 가능하다.

```typescript
/**
 * Plugin이 등록하는 중요도 판단 provider
 * 
 * 예: Pheromone 기반, 감정 강도 기반, 관계 형성 기반 등
 */
interface SignificanceProvider {
  /** Provider 식별자 */
  readonly name: string;
  
  /** 0.0 ~ 1.0 사이 점수 반환 */
  score(world: World, context: MaintenanceContext): number;
  
  /** 이 provider의 가중치 (default: 1.0) */
  readonly weight?: number;
}

type MaintenanceContext = {
  readonly store: WorldStore;
  readonly index: WorldIndex;
  readonly accessHistory: AccessHistory;
  
  /** Plugin이 주입한 추가 컨텍스트 */
  readonly extensions: Map<string, unknown>;
};
```

#### 4.3.2 Consolidation Policy

```typescript
type ConsolidationPolicy = {
  /** 기본 제공 criteria (Built-in) */
  builtIn: BuiltInSignificanceCriteria;
  
  /** Plugin이 등록한 providers */
  providers: SignificanceProvider[];
  
  /** 최종 판단 threshold (aggregate score ≥ threshold → significant) */
  threshold: number;  // e.g., 0.5
  
  /** Aggregation 방식 */
  aggregation: 'max' | 'average' | 'weighted_average';
  
  /** Delta chain 제한 (structural trigger) */
  maxDeltaChainDepth: number;  // e.g., 50
  maxDeltaChainSize: number;   // e.g., 1MB
};

type BuiltInSignificanceCriteria = {
  /** 자주 접근된 World */
  accessFrequency?: { threshold: number; window: Duration };
  
  /** 분기점 World (여러 자식이 있음) */
  isBranchPoint?: boolean;
  
  /** 명시적으로 표시된 중요 순간 */
  markedSignificant?: boolean;
  
  /** 특정 intent type */
  intentTypes?: string[];
};
```

#### 4.3.3 Significance Evaluation

```typescript
function evaluateSignificance(
  world: World,
  policy: ConsolidationPolicy,
  context: MaintenanceContext
): { isSignificant: boolean; score: number; breakdown: ScoreBreakdown } {
  
  // 1. Built-in criteria 평가 (0.0 ~ 1.0)
  const builtInScore = evaluateBuiltIn(world, policy.builtIn, context);
  
  // 2. Plugin providers 평가
  const providerScores = policy.providers.map(p => ({
    name: p.name,
    score: clamp(p.score(world, context), 0, 1),
    weight: p.weight ?? 1.0
  }));
  
  // 3. Aggregate
  const finalScore = aggregate(builtInScore, providerScores, policy.aggregation);
  
  // 4. Threshold 비교
  return {
    isSignificant: finalScore >= policy.threshold,
    score: finalScore,
    breakdown: { builtIn: builtInScore, providers: providerScores }
  };
}

function aggregate(
  builtInScore: number,
  providerScores: { score: number; weight: number }[],
  method: ConsolidationPolicy['aggregation']
): number {
  const allScores = [
    { score: builtInScore, weight: 1.0 },
    ...providerScores
  ];
  
  switch (method) {
    case 'max':
      return Math.max(...allScores.map(s => s.score));
      
    case 'average':
      return allScores.reduce((sum, s) => sum + s.score, 0) / allScores.length;
      
    case 'weighted_average':
      const totalWeight = allScores.reduce((sum, s) => sum + s.weight, 0);
      const weightedSum = allScores.reduce((sum, s) => sum + s.score * s.weight, 0);
      return weightedSum / totalWeight;
  }
}
```

#### 4.3.4 Consolidation Algorithm

```typescript
async function consolidate(
  policy: ConsolidationPolicy,
  context: MaintenanceContext
): Promise<ConsolidationResult> {
  const consolidated: WorldId[] = [];
  const skipped: WorldId[] = [];
  
  // 1. Structural trigger 기반 후보 찾기
  const candidates = findConsolidationCandidates(policy, context);
  
  for (const worldId of candidates) {
    const world = await loadWorldMetadata(worldId);
    
    // 2. Significance 평가
    const evaluation = evaluateSignificance(world, policy, context);
    
    if (evaluation.isSignificant) {
      // 3. Checkpoint로 승격
      const snapshot = await restore(worldId);
      await checkpoints.store({
        worldId,
        snapshot,
        createdAt: now(),
        reason: 'consolidation'
      });
      
      // 4. 인덱스 업데이트
      index.storageState.set(worldId, 'checkpoint');
      updateNearestCheckpointIndex(worldId);
      
      consolidated.push(worldId);
    } else {
      skipped.push(worldId);
    }
  }
  
  return { consolidated, skipped };
}

function findConsolidationCandidates(
  policy: ConsolidationPolicy,
  context: MaintenanceContext
): WorldId[] {
  return Array.from(context.store.deltas.keys()).filter(worldId => {
    const chainDepth = getDeltaChainDepth(worldId, context.index);
    const chainSize = getDeltaChainSize(worldId, context.store);
    
    // Structural trigger: chain이 너무 길거나 크면 후보
    return (
      chainDepth >= policy.maxDeltaChainDepth ||
      chainSize >= policy.maxDeltaChainSize
    );
  });
}
```

### 4.4 Pruning: 기억 정리

**D-MAINT-4:** Pruning은 불필요한 delta를 정리하되, 복구 가능성은 유지한다.

```typescript
type PruningPolicy = {
  /** 정리 대상 기준 */
  criteria: PruningCriteria;
  
  /** 최소 보존 기간 */
  minRetention: Duration;
  
  /** 절대 삭제 금지 대상 */
  preserve: PreservationRules;
};

type PruningCriteria = {
  /** Checkpoint 사이의 중간 delta만 */
  betweenCheckpoints?: boolean;
  
  /** 오래된 것 (minRetention 이후) */
  olderThan?: Duration;
  
  /** 접근 기록 없음 */
  neverAccessed?: boolean;
};

type PreservationRules = {
  /** 분기점은 보존 */
  branchPoints: boolean;
  
  /** 명시적 중요 표시된 것 보존 */
  markedSignificant: boolean;
  
  /** Checkpoint는 절대 삭제 금지 */
  checkpoints: true;  // 항상 true
};
```

**Pruning Algorithm:**

```typescript
async function prune(
  policy: PruningPolicy,
  context: MaintenanceContext
): Promise<PruningResult> {
  const candidates = findPruningCandidates(policy, context);
  const pruned: WorldId[] = [];
  const preserved: WorldId[] = [];
  
  for (const worldId of candidates) {
    // 1. 보존 규칙 확인
    if (shouldPreserve(worldId, policy.preserve, context)) {
      preserved.push(worldId);
      continue;
    }
    
    // 2. 삭제해도 복구에 영향 없는지 확인
    if (!canSafelyPrune(worldId, context)) {
      preserved.push(worldId);
      continue;
    }
    
    // 3. Delta 삭제
    context.store.deltas.delete(worldId);
    context.index.storageState.delete(worldId);
    pruned.push(worldId);
  }
  
  return { pruned, preserved };
}

function canSafelyPrune(worldId: WorldId, context: MaintenanceContext): boolean {
  // Checkpoint 또는 다른 delta가 이 World를 참조하지 않아야 함
  const children = context.index.children.get(worldId) ?? [];
  
  for (const childId of children) {
    const childState = context.index.storageState.get(childId);
    if (childState === 'delta') {
      // 자식이 delta면 이 World가 없으면 복구 불가
      return false;
    }
  }
  
  return true;
}
```

### 4.5 Compaction: 저장 포맷 압축

**D-MAINT-5:** Compaction은 **저장 포맷을 압축**하되, 복구 가능성은 100% 유지한다.

> **핵심 결정:** Compaction은 "상세 손실"이 아니라 "저장 효율화"다.
> 압축된 World도 `restore()`로 **항상** 원본 Snapshot을 복구할 수 있다.
> 추가로 `digest`를 제공하여 전체 복구 없이 요약 정보 접근 가능.

```typescript
type CompactionPolicy = {
  /** 압축 대상 기준 */
  criteria: CompactionCriteria;
  
  /** Digest 생성 방법 */
  digestGenerator: DigestGenerator;
  
  /** 압축 알고리즘 */
  compression: CompressionAlgorithm;
  
  /** Active horizon 보존 (필수) */
  preserveActiveHorizon: true;  // 항상 true
};

type CompactionCriteria = {
  /** 일정 기간 이상 지난 것 */
  olderThan: Duration;
  
  /** Active horizon 외부만 */
  outsideActiveHorizon: true;  // 항상 true
  
  /** 연속된 구간만 압축 */
  contiguousOnly: boolean;
};

type CompressionAlgorithm = 'zstd' | 'lz4' | 'gzip' | 'none';

type DigestGenerator = {
  /** 기간 내 intent types 수집 */
  collectIntentTypes: boolean;
  
  /** 주요 사건 추출 (선택) */
  extractSignificantEvents?: (worlds: World[]) => string[];
  
  /** Custom digest 생성 */
  custom?: (worlds: World[]) => HistoryDigest;
};
```

**Compaction Algorithm:**

```typescript
async function compact(
  policy: CompactionPolicy,
  context: MaintenanceContext
): Promise<CompactionResult> {
  const compactedSegments: StoredCompacted[] = [];
  
  // 1. Active horizon 계산 (절대 압축 대상 제외)
  const activeHorizon = calculateActiveHorizon(
    context.store.getHeads(),
    context.config.activeHorizonDepth,
    context.index
  );
  
  // 2. 압축 대상 구간 찾기 (active horizon 외부만)
  const segments = findContiguousSegments(policy.criteria, context)
    .filter(seg => !seg.worldIds.some(id => activeHorizon.has(id)));
  
  for (const segment of segments) {
    // 3. Digest 생성 (요약 정보)
    const digest = generateDigest(segment, policy.digestGenerator);
    
    // 4. 압축 저장 (복구 가능한 형태)
    const storage = await compressSegment(segment, policy.compression, context);
    
    // 5. Compacted 레코드 저장
    const record: StoredCompacted = {
      compactedId: generateCompactedId(),
      worldIds: segment.worldIds,
      from: segment.from,
      to: segment.to,
      period: { start: segment.startTime, end: segment.endTime },
      digest,
      storage  // 압축된 데이터 (복구 가능)
    };
    
    context.store.compacted.store(record);
    
    // 6. 원본 delta 삭제 (압축본으로 대체됨)
    for (const worldId of segment.worldIds) {
      context.store.deltas.delete(worldId);
      context.index.storageState.set(worldId, 'compacted');
    }
    
    compactedSegments.push(record);
  }
  
  return { compacted: compactedSegments };
}

async function compressSegment(
  segment: Segment,
  algorithm: CompressionAlgorithm,
  context: MaintenanceContext
): Promise<CompactedStorage> {
  // 가장 가까운 checkpoint 찾기
  const checkpointId = findNearestCheckpoint(segment.from, context.index);
  
  // Delta chain 수집
  const deltas = collectDeltaChain(checkpointId, segment.to);
  
  // 압축
  const compressedDeltas = compress(deltas, algorithm);
  
  return {
    type: 'checkpoint_ref',
    checkpointId,
    compressedDeltas
  };
}
```

### 4.6 Maintenance Cycle Execution

```typescript
async function executeMaintenanceCycle(
  cycle: MaintenanceCycle,
  context: MaintenanceContext
): Promise<MaintenanceResult> {
  const phaseResults: PhaseResult[] = [];
  
  // 순서대로 실행: Consolidation → Pruning → Compaction
  for (const phase of cycle.phases) {
    switch (phase.type) {
      case 'consolidation':
        phaseResults.push({
          type: 'consolidation',
          result: await consolidate(phase.policy, context)
        });
        break;
        
      case 'pruning':
        phaseResults.push({
          type: 'pruning',
          result: await prune(phase.policy, context)
        });
        break;
        
      case 'compaction':
        phaseResults.push({
          type: 'compaction',
          result: await compact(phase.policy, context)
        });
        break;
    }
  }
  
  return { phases: phaseResults, completedAt: now() };
}
```

### 4.7 Maintenance Hooks Integration

FDR-APP-RUNTIME-001의 Hook 시스템과 연결:

```typescript
type MaintenanceHooks = {
  'maintenance:start': { trigger: MaintenanceTrigger };
  'maintenance:consolidation:before': { candidates: WorldId[] };
  'maintenance:consolidation:after': { result: ConsolidationResult };
  'maintenance:pruning:before': { candidates: WorldId[] };
  'maintenance:pruning:after': { result: PruningResult };
  'maintenance:compaction:before': { segments: Segment[] };
  'maintenance:compaction:after': { result: CompactionResult };
  'maintenance:end': { result: MaintenanceResult };
};
```

### 4.8 Maintenance Execution Model

**D-MAINT-EXEC:** Maintenance는 App 내부의 **별도 작업 큐/잡**으로 실행되며, tick publish/host mailbox 진행을 **블로킹하지 않는다**.

```typescript
type MaintenanceScheduler = {
  /** 별도 작업 큐에 maintenance 작업 예약 */
  schedule(cycle: MaintenanceCycle): void;
  
  /** 현재 maintenance 진행 중 여부 */
  isRunning(): boolean;
  
  /** 진행 중인 maintenance 완료 대기 (graceful shutdown용) */
  waitForCompletion(): Promise<void>;
};
```

**실행 모델:**
- Maintenance는 **idle 시간** 또는 **명시적 트리거**에만 실행
- Hook handler에서 직접 maintenance 실행 금지 (enqueue 패턴 사용)
- Maintenance 중에도 read (restore) 가능, write (새 World 생성)는 대기

### 4.9 Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| MAINT-1 | MUST | Maintenance cycle MUST execute phases in order: consolidation → pruning → compaction |
| MAINT-2 | MUST | Consolidation MUST preserve branch points and significant Worlds |
| MAINT-3 | MUST | Pruning MUST NOT delete Worlds required for other Worlds' restoration |
| MAINT-4 | MUST | Compaction MUST preserve full recoverability (compression, not deletion) |
| MAINT-5 | MUST NOT | Maintenance MUST NOT run during active execution (only when idle or explicitly triggered) |
| MAINT-6 | SHOULD | Maintenance cycle SHOULD emit hooks for observability |
| MAINT-7 | SHOULD | Default trigger SHOULD be scheduled (e.g., daily) |
| MAINT-PRESERVE-1 | MUST | Maintenance MUST preserve active horizon (branch heads + ancestors within depth) |
| MAINT-PRESERVE-2 | MUST | Maintenance MUST preserve all branch points |
| MAINT-PRESERVE-3 | MUST | Maintenance MUST preserve all manually marked significant Worlds |
| MAINT-EXEC-1 | SHOULD | Maintenance SHOULD run in separate job queue, not blocking mailbox/tick |
| MAINT-EXEC-2 | MUST NOT | Hook handlers MUST NOT execute maintenance synchronously |

---

## 5. Plugin Integration: SignificanceProvider

### 5.1 Registration

**D-PLUGIN-SIG-1:** Plugin은 `install()` 시 SignificanceProvider를 등록할 수 있다.

```typescript
// WorldStore interface 확장
interface WorldStore {
  // ... 기존 메서드들 ...
  
  /** SignificanceProvider 등록 (Plugin용) */
  registerSignificanceProvider(provider: SignificanceProvider): void;
  
  /** 등록된 providers 조회 */
  getSignificanceProviders(): readonly SignificanceProvider[];
}
```

### 5.2 Example: Pheromone-based Significance

```typescript
const pheromonePlugin: Plugin = {
  name: '@manifesto/pheromone-significance',
  
  install(app) {
    app.worldStore.registerSignificanceProvider({
      name: 'pheromone',
      weight: 2.0,  // 다른 provider보다 2배 중요
      
      score(world, ctx) {
        // Pheromone service에서 activation 조회
        const pheromones = ctx.extensions.get('pheromones') as PheromoneService;
        if (!pheromones) return 0;
        
        const activation = pheromones.getActivationFor(world.worldId);
        
        // 정규화하여 0-1 반환
        return Math.min(activation / MAX_ACTIVATION, 1.0);
      }
    });
  }
};
```

### 5.3 Example: Emotional Intensity Significance

```typescript
const emotionalPlugin: Plugin = {
  name: '@manifesto/emotional-significance',
  
  install(app) {
    app.worldStore.registerSignificanceProvider({
      name: 'emotional-intensity',
      weight: 1.5,
      
      score(world, ctx) {
        // World의 snapshot에서 감정 상태 추출
        const snapshot = ctx.store.cache.get(world.worldId);
        if (!snapshot) return 0;
        
        const emotionalState = snapshot.data.innerState?.emotions;
        if (!emotionalState) return 0;
        
        // 감정 벡터 변화량 계산
        return calculateEmotionalIntensity(emotionalState);
      }
    });
  }
};
```

### 5.4 Example: Relationship Formation Significance

```typescript
const relationshipPlugin: Plugin = {
  name: '@manifesto/relationship-significance',
  
  install(app) {
    app.worldStore.registerSignificanceProvider({
      name: 'relationship-formation',
      weight: 3.0,  // 관계 형성은 매우 중요
      
      score(world, ctx) {
        // 관계 변화 감지
        const relationshipChanges = detectRelationshipChanges(world, ctx);
        
        if (relationshipChanges.newRelationship) return 1.0;
        if (relationshipChanges.significantChange) return 0.7;
        if (relationshipChanges.minorChange) return 0.3;
        return 0;
      }
    });
  }
};
```

### 5.5 Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| PLUGIN-SIG-1 | MUST | WorldStore MUST support SignificanceProvider registration |
| PLUGIN-SIG-2 | MUST | Provider score MUST return value in range [0.0, 1.0] |
| PLUGIN-SIG-3 | MUST | Provider MUST NOT throw; errors return 0 score |
| PLUGIN-SIG-4 | SHOULD | Provider weight SHOULD default to 1.0 |
| PLUGIN-SIG-5 | MAY | Plugin MAY register multiple providers |

---

## 6. Configuration & Defaults

### 6.1 Recommended Defaults

```typescript
const defaultWorldStoreConfig: WorldStoreConfig = {
  // === Checkpoint Policy ===
  checkpoint: {
    maxDeltaChainDepth: 50,
    maxDeltaChainSize: 1_000_000, // 1MB
    preserveBranchPoints: true,
  },
  
  // === Cache Policy ===
  cache: {
    maxSize: 100,
    ttl: 3600_000, // 1시간
  },
  
  // === Active Horizon ===
  activeHorizon: {
    depth: 100,  // head에서 100세대 조상까지 보호
  },
  
  // === Maintenance Cycle ===
  maintenance: {
    trigger: { type: 'scheduled', interval: { hours: 24 } },
    phases: [
      {
        type: 'consolidation',
        policy: {
          builtIn: {
            accessFrequency: { threshold: 5, window: { days: 7 } },
            isBranchPoint: true,
            markedSignificant: true,
          },
          providers: [],  // Plugin이 등록
          threshold: 0.5,
          aggregation: 'weighted_average',
          maxDeltaChainDepth: 50,
          maxDeltaChainSize: 1_000_000,
        },
      },
      {
        type: 'pruning',
        policy: {
          criteria: { betweenCheckpoints: true, olderThan: { days: 30 } },
          minRetention: { days: 7 },
          preserve: { branchPoints: true, markedSignificant: true, checkpoints: true, activeHorizon: true },
        },
      },
      {
        type: 'compaction',
        policy: {
          criteria: { olderThan: { days: 90 }, outsideActiveHorizon: true, contiguousOnly: true },
          digestGenerator: { collectIntentTypes: true },
          compression: 'zstd',
          preserveActiveHorizon: true,
        },
      },
    ],
  },
};
```

### 6.2 Configuration Rationale

| Config | Default | Rationale |
|--------|---------|-----------|
| maxDeltaChainDepth: 50 | 50 apply ≈ ~1초 복구 | 사용자 체감 성능 |
| cache.maxSize: 100 | 최근 작업 컨텍스트 | 메모리 효율 |
| activeHorizon.depth: 100 | 100세대 조상 보호 | baseWorld 안전 |
| threshold: 0.5 | 절반 이상 중요 | 균형점 |
| aggregation: weighted_average | Provider weight 반영 | Plugin 영향력 조절 |
| pruning.minRetention: 7days | 일주일 "최근 기억" | 롤백 가능성 |
| compaction.olderThan: 90days | 3개월 "오래된 기억" | 장기 저장 비용 |
| compression: zstd | 고압축률 + 빠른 해제 | 균형 |

---

## 7. Cross-Layer Integration

### 7.1 Integration Diagram

```
┌────────────────────────────────────────────────────────────────────────────┐
│                              App                                            │
│                                                                             │
│  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────────────────────┐│
│  │  HostExecutor   │  │   WorldStore     │  │   Maintenance Scheduler     ││
│  │                 │  │                  │  │                             ││
│  │  - execute()    │  │  - checkpoints   │  │  - trigger                  ││
│  │  - restore base │──│  - deltas        │──│  - consolidate              ││
│  │  - store result │  │  - compacted     │  │  - prune                    ││
│  │                 │  │  - cache         │  │  - compact                  ││
│  │                 │  │  - providers[]   │◄─│                             ││
│  └────────┬────────┘  └────────┬─────────┘  └───────────┬─────────────────┘│
│           │                    │                        │                   │
│           │         ┌─────────────────────┐             │                   │
│           │         │      Index          │             │                   │
│           └────────►│  - lineage          │◄────────────┘                   │
│                     │  - checkpointAt     │                                 │
│                     │  - storageState     │                                 │
│                     └─────────────────────┘                                 │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    SignificanceProviders (Plugin 주입)               │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │   │
│  │  │ pheromone   │  │ emotional   │  │ relationship│  │   custom    │ │   │
│  │  │ (weight:2.0)│  │ (weight:1.5)│  │ (weight:3.0)│  │ (weight:1.0)│ │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────────┘
                │                                      │
                ▼                                      ▼
┌───────────────────────────┐              ┌───────────────────────────┐
│           Host            │              │          World            │
│  - dispatch()             │              │  - submitProposal()       │
│  - mailbox                │              │  - sealWorld()            │
│  - TraceEvent             │              │  - lineage                │
└───────────────────────────┘              └───────────────────────────┘
```

### 7.2 Lifecycle Integration

| App Lifecycle | WorldStore | Maintenance |
|---------------|------------|-------------|
| `initializing` | WorldStore 초기화, index 로드 | - |
| `ready` | 정상 운영 | Maintenance trigger 활성화 |
| `disposing` | flush pending writes | 진행 중이면 완료 대기 |
| `disposed` | - | - |

---

## 8. Error Handling

### 8.1 Restoration Errors

> **Note:** Compacted Worlds는 **항상 복구 가능**하므로, 복구 실패 예외는 "데이터 손상" 또는 "World 미존재" 경우에만 발생한다.

```typescript
/** World를 찾을 수 없음 */
class WorldNotFoundException extends Error {
  constructor(readonly worldId: WorldId) {
    super(`World ${worldId} not found in store.`);
  }
}

/** Delta chain 손상 */
class DeltaChainCorruptedException extends Error {
  constructor(
    readonly worldId: WorldId,
    readonly missingParent: WorldId
  ) {
    super(`Delta chain broken: ${worldId} references missing parent ${missingParent}`);
  }
}

/** 압축 데이터 손상 */
class CompactedDataCorruptedException extends Error {
  constructor(
    readonly worldId: WorldId,
    readonly compactedId: string
  ) {
    super(`Compacted data corrupted for ${worldId} in ${compactedId}`);
  }
}

/** Schema 불일치 */
class SchemaMismatchException extends Error {
  constructor(
    readonly worldId: WorldId,
    readonly expectedSchema: string,
    readonly availableSchemas: string[]
  ) {
    super(`Schema ${expectedSchema} not available for restoring ${worldId}`);
  }
}
```

### 8.2 Error Recovery

| Error | Recovery Strategy |
|-------|-------------------|
| WorldNotFoundException | Lineage에서 가장 가까운 World로 fallback (optional) |
| DeltaChainCorruptedException | 가장 가까운 Checkpoint로 fallback, 손실 기록 |
| CompactedDataCorruptedException | 백업에서 복구 시도, 실패 시 해당 구간 손실 기록 |
| SchemaMismatchException | Schema migration 시도, 또는 호환 가능한 schema로 복구 |

### 8.3 Digest Access (복구 없이 요약만)

```typescript
/** 복구 없이 digest만 조회 */
function getDigest(worldId: WorldId): HistoryDigest | null {
  const state = index.storageState.get(worldId);
  
  if (state === 'compacted') {
    const record = compacted.get(worldId);
    return record?.digest ?? null;
  }
  
  return null;  // checkpoint/delta는 digest 없음
}
```

---

## 9. Proposed Rules Summary

### HostExecutor

| Rule ID | Level | Description |
|---------|-------|-------------|
| HEXEC-1 | MUST | App MUST implement HostExecutor interface |
| HEXEC-2 | MUST | HostExecutor MUST restore baseSnapshot from WorldStore |
| HEXEC-3 | MUST | HostExecutor MUST return result (not throw) for failures |
| HEXEC-4 | MUST NOT | HostExecutor MUST NOT expose Host internals to World |
| HEXEC-5 | SHOULD | HostExecutor SHOULD record traceRef for audit |
| HEXEC-6 | NOTE | outcome is advisory; terminalSnapshot is authoritative |

### WorldStore

| Rule ID | Level | Description |
|---------|-------|-------------|
| STORE-1 | MUST | WorldStore MUST support checkpoint, delta, and compacted storage |
| STORE-2 | MUST | Restoration of any WorldId MUST **always succeed** |
| STORE-3 | MUST | WorldStore MUST track nearestCheckpoint for every delta |
| STORE-4 | MUST | Delta MUST only contain changes within snapshotHash input scope |
| STORE-5 | MUST | Delta MUST record schemaHash for multi-schema restoration |
| STORE-6 | SHOULD | WorldStore SHOULD implement LRU cache |
| STORE-BASE-1 | MUST | Active horizon (heads + ancestors) MUST always be fully restorable |
| STORE-BASE-2 | MUST | Active horizon MUST NOT have degraded restore latency |
| STORE-BASE-3 | SHOULD | Active horizon depth SHOULD be configurable (default: 100) |
| STORE-PLATFORM-1 | MUST | Stored snapshot MUST be canonical (platform namespaces removed: `$host`, `$mel`) |
| RESTORE-CTX-1 | MUST | Restore MUST use fixed deterministic HostContext |
| DELTA-GEN-1 | MUST | Patch[] MUST be canonicalized by path (lexicographic sort) |
| DELTA-GEN-2 | MUST | Patch path MUST be statically resolvable at apply-time |
| DELTA-GEN-3 | MUST | Delta generation MUST apply canonical snapshot transform (platform namespaces removed) |
| DELTA-GEN-4 | MUST | Same parent→child MUST produce identical Patch[] |
| COMPACT-INDEX-1 | MUST | WorldStore MUST maintain worldId → compactedId index |

### Maintenance Cycle

| Rule ID | Level | Description |
|---------|-------|-------------|
| MAINT-1 | MUST | Phases execute in order: consolidation → pruning → compaction |
| MAINT-2 | MUST | Consolidation MUST preserve branch points |
| MAINT-3 | MUST | Pruning MUST NOT break restoration chains |
| MAINT-4 | MUST | Compaction MUST preserve full recoverability |
| MAINT-5 | MUST NOT | Maintenance MUST NOT run during active execution |
| MAINT-6 | SHOULD | Maintenance SHOULD emit hooks |
| MAINT-7 | SHOULD | Default trigger SHOULD be scheduled |
| MAINT-PRESERVE-1 | MUST | Maintenance MUST preserve active horizon |
| MAINT-PRESERVE-2 | MUST | Maintenance MUST preserve all branch points |
| MAINT-PRESERVE-3 | MUST | Maintenance MUST preserve marked significant Worlds |
| MAINT-EXEC-1 | SHOULD | Maintenance SHOULD run in separate job queue |
| MAINT-EXEC-2 | MUST NOT | Hook handlers MUST NOT execute maintenance synchronously |

### SignificanceProvider

| Rule ID | Level | Description |
|---------|-------|-------------|
| PLUGIN-SIG-1 | MUST | WorldStore MUST support provider registration |
| PLUGIN-SIG-2 | MUST | Provider score MUST be in [0.0, 1.0] |
| PLUGIN-SIG-3 | MUST | Provider MUST NOT throw |
| PLUGIN-SIG-4 | SHOULD | Weight SHOULD default to 1.0 |
| PLUGIN-SIG-5 | MAY | Plugin MAY register multiple providers |

---

## 10. References

- **FDR-APP-PUB-001**: Tick definition, publish boundary
- **FDR-APP-RUNTIME-001**: Lifecycle, Hooks, Plugin (maintenance hooks integration)
- **World SPEC v2.0.3**: WorldStore contract, baseSnapshot restoration, platform namespace hash exclusion (WORLD-HASH-4a/4b)
- **Host SPEC v2.0.2**: HostExecutor interface, execution result
- **ADR-001**: Layer separation (App implements HostExecutor)
- **Core SPEC v2.0.0**: Patch operators (set/unset/merge), StateSpec reserved namespaces

---

---

## 11. Appendix: Type Definitions (v0.4.0 개정)

```typescript
// ───────────────────────────────────────────────────────────
// Core v2 Patch Type (v0.4.0)
// ───────────────────────────────────────────────────────────
/**
 * Core SPEC v2.0.0에서 정의된 Patch 연산자
 * 
 * JSON Patch (RFC 6902)와 다름:
 * - add/replace → set
 * - remove → unset
 * - (merge는 Core 전용)
 */
type CorePatch =
  | { readonly op: 'set'; readonly path: string; readonly value: unknown }
  | { readonly op: 'unset'; readonly path: string }
  | { readonly op: 'merge'; readonly path: string; readonly value: Record<string, unknown> };

// ───────────────────────────────────────────────────────────
// JSON Patch Type (for diff library output)
// ───────────────────────────────────────────────────────────
type JsonPatch = {
  readonly op: 'add' | 'remove' | 'replace' | 'move' | 'copy' | 'test';
  readonly path: string;
  readonly value?: unknown;
  readonly from?: string;
};

// ───────────────────────────────────────────────────────────
// Stored Delta (v0.4.0)
// ───────────────────────────────────────────────────────────
type StoredDelta = {
  readonly worldId: WorldId;
  readonly parentId: WorldId;
  readonly patches: readonly CorePatch[];   // Core v2 Patch 타입
  readonly metadata: WorldMetadata;
  readonly nearestCheckpoint: WorldId;
  readonly schemaHash: string;
};

// ───────────────────────────────────────────────────────────
// Restore Context (Determinism)
// ───────────────────────────────────────────────────────────
const RESTORE_CONTEXT: HostContext = Object.freeze({
  now: 0,
  randomSeed: 'worldstore',
  env: {},
});

// ───────────────────────────────────────────────────────────
// Canonical Snapshot (Platform Namespaces 제거)
// ───────────────────────────────────────────────────────────
/**
 * Platform namespaces 제거
 *
 * Per WORLD-HASH-4a, WORLD-HASH-4b:
 * - $host: Host-owned state (excluded from hash)
 * - $mel: Compiler-owned guard state (excluded from hash)
 */
function toCanonicalSnapshot(snapshot: Snapshot): Snapshot {
  const { $host, $mel, ...rest } = snapshot.data;
  return { ...snapshot, data: rest };
}

// ───────────────────────────────────────────────────────────
// JSON Patch → Core Patch Conversion (v0.4.0)
// ───────────────────────────────────────────────────────────
function jsonPatchToCorePatches(jsonPatches: JsonPatch[]): CorePatch[] {
  return jsonPatches.map(jp => {
    switch (jp.op) {
      case 'add':
      case 'replace':
        return { op: 'set', path: jp.path, value: jp.value };
      case 'remove':
        return { op: 'unset', path: jp.path };
      default:
        throw new Error(`Unsupported JSON Patch op: ${jp.op}`);
    }
  });
}

// ───────────────────────────────────────────────────────────
// WorldStore Interface
// ───────────────────────────────────────────────────────────
interface WorldStore {
  store(world: World, snapshot: Snapshot): Promise<void>;
  storeCheckpoint(worldId: WorldId, snapshot: Snapshot, reason: CheckpointReason): Promise<void>;
  restore(worldId: WorldId): Promise<Snapshot>;
  tryRestore(worldId: WorldId): Promise<Snapshot | null>;
  getStorageState(worldId: WorldId): StorageState | undefined;
  getCompacted(worldId: WorldId): StoredCompacted | undefined;
  getDigest(worldId: WorldId): HistoryDigest | undefined;
  getHeads(): Set<WorldId>;
  executeMaintenanceCycle(cycle?: MaintenanceCycle): Promise<MaintenanceResult>;
  markSignificant(worldId: WorldId): Promise<void>;
  registerSignificanceProvider(provider: SignificanceProvider): void;
  getSignificanceProviders(): readonly SignificanceProvider[];
}

// ───────────────────────────────────────────────────────────
// HostExecutor Interface
// ───────────────────────────────────────────────────────────
interface HostExecutor {
  execute(
    key: ExecutionKey,
    baseSnapshot: Snapshot,
    intent: Intent,
    opts?: HostExecutionOptions
  ): Promise<HostExecutionResult>;
}

type HostExecutionResult = {
  readonly terminalSnapshot: Snapshot;
  readonly outcome: 'completed' | 'failed';
  readonly traceRef?: string;
  readonly error?: ErrorValue;
};

// ───────────────────────────────────────────────────────────
// SignificanceProvider Interface
// ───────────────────────────────────────────────────────────
interface SignificanceProvider {
  readonly name: string;
  score(world: World, context: MaintenanceContext): number;
  readonly weight?: number;
}

type MaintenanceContext = {
  readonly store: WorldStore;
  readonly index: WorldIndex;
  readonly accessHistory: AccessHistory;
  readonly extensions: Map<string, unknown>;
  readonly config: WorldStoreConfig;
};

// ───────────────────────────────────────────────────────────
// Index (including compactedIndex)
// ───────────────────────────────────────────────────────────
type WorldIndex = {
  children: Map<WorldId, WorldId[]>;
  parent: Map<WorldId, WorldId>;
  nearestCheckpoint: Map<WorldId, WorldId>;
  checkpointTimeline: SortedMap<number, WorldId>;
  compactedIndex: Map<WorldId, string>;
  byTime: SortedMap<number, WorldId>;
  storageState: Map<WorldId, StorageState>;
};
```

---

## 12. Cross-Reference Summary (v0.4.1)

| This FDR | Related Document | Relationship |
|----------|------------------|--------------|
| §3.6 StoredDelta.patches | Core SPEC v2.0.0 §FDR-012 | Core Patch 타입 정합 |
| §3.6.1 DELTA-GEN-5 | Core SPEC v2.0.0 | Core v2 연산자 사용 |
| §3.6.1 DELTA-GEN-6 | Core SPEC v2.0.0 Snapshot | worldId 필드 부재 대응 |
| §3.5.2 STORE-PLATFORM-1 | Host SPEC v2.0.2 HOST-DATA-1~6 | $host 제외 정합 |
| §3.5.2 STORE-PLATFORM-1 | World SPEC v2.0.3 WORLD-HASH-4a | $host hash 제외 정합 |
| §3.5.2 STORE-PLATFORM-1 | World SPEC v2.0.3 WORLD-HASH-4b | $mel hash 제외 정합 |
| §3.5.2 STORE-PLATFORM-1 | World SPEC v2.0.3 MEL-DATA-1~3 | $mel Compiler-owned 정합 |
| §3.6 Delta scope | World SPEC v2.0.3 snapshotHash input | Delta = hash input 범위 |
| HostExecutionResult | World SPEC v2.0.3 | outcome 필드 정합 |

---

*End of FDR-APP-INTEGRATION-001 v0.4.0*


---
