# App Layer Architecture Overview

> **Version:** 1.0.0  
> **Date:** 2026-01-19  
> **Status:** Normative  
> **Scope:** App FDR들의 종합 아키텍처 및 검증

---

## 1. Document Map

### 1.1 FDR Dependency Graph

```
                    ARCHITECTURE v2.0.0
                           │
                      ADR-001
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
    Core SPEC         Host SPEC         World SPEC
    v2.0.0            v2.0.2            v2.0.2
         │                 │                 │
         └─────────────────┼─────────────────┘
                           │
                    ┌──────┴──────┐
                    │             │
              FDR-APP-PUB    FDR-APP-RUNTIME
                001              001
                    │             │
                    └──────┬──────┘
                           │
                  FDR-APP-INTEGRATION
                        001
                           │
              ┌────────────┼────────────┐
              │            │            │
       FDR-APP-POLICY  FDR-APP-EXT  (Future)
            001           001       BRIDGE-001
```

### 1.2 FDR Summary Table

| FDR | Version | Scope | Core Concepts |
|-----|---------|-------|---------------|
| **PUB-001** | v0.3.0 | Execution Model | Tick, Publish Boundary, Scheduler |
| **RUNTIME-001** | v0.2.0 | Extensibility | Lifecycle, Hooks, Plugins |
| **INTEGRATION-001** | v0.4.1 | Host↔World | HostExecutor, WorldStore, Maintenance |
| **POLICY-001** | v0.2.3 | Governance | ExecutionKey, Authority, ApprovedScope |
| **EXT-001** | v0.4.0 | Memory | MemoryStore, Context Freezing |

`HostExecutor.abort?()` is an optional capability defined by the World contract; App may implement it as best-effort cancellation.

---

## 2. Component Architecture

### 2.1 App Internal Structure

```
┌─────────────────────────────────────────────────────────────────────┐
│                              App                                     │
│                       (Composition Root)                             │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                      Public API                              │    │
│  │  submitProposal() │ getSnapshot() │ subscribe() │ dispose() │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                │                                     │
│  ┌─────────────────────────────┼─────────────────────────────────┐  │
│  │                         Services                               │  │
│  │                                                                │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │  │
│  │  │ PolicyService│  │  HookRegistry │  │PluginManager │        │  │
│  │  │              │  │              │  │              │        │  │
│  │  │ • ExecutionKey│  │ • state:*    │  │ • install()  │        │  │
│  │  │ • Authority  │  │ • execution:*│  │ • uninstall()│        │  │
│  │  │ • Scope      │  │ • world:*    │  │ • getPlugin()│        │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘        │  │
│  │                                                                │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                │                                     │
│  ┌─────────────────────────────┼─────────────────────────────────┐  │
│  │                         Runtime                                │  │
│  │                                                                │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │  │
│  │  │ HostExecutor │  │  WorldStore  │  │MemoryProvider│        │  │
│  │  │              │  │              │  │   (Opt)      │        │  │
│  │  │ • execute()  │  │ • store()    │  │ • recall()   │        │  │
│  │  │ • abort()?   │  │ • restore()  │  │ • remember() │        │  │
│  │  │              │  │ • compact()  │  │              │        │  │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘        │  │
│  │         │                 │                 │                 │  │
│  └─────────┼─────────────────┼─────────────────┼─────────────────┘  │
│            │                 │                 │                    │
│  ┌─────────┼─────────────────┼─────────────────┼─────────────────┐  │
│  │         │           Adapters                │                 │  │
│  │         ▼                 ▼                 ▼                 │  │
│  │    ┌─────────┐      ┌──────────┐      ┌──────────┐           │  │
│  │    │  Host   │      │  Storage │      │MemoryStore│           │  │
│  │    │ (Lower) │      │ Backend  │      │ Backend  │           │  │
│  │    └─────────┘      └──────────┘      └──────────┘           │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### 2.2 Layer Boundaries

```
┌────────────────────────────────────────────────────────────────────┐
│                              User/UI                                │
└────────────────────────────────┬───────────────────────────────────┘
                                 │ Proposal, Subscribe
                                 ▼
┌────────────────────────────────────────────────────────────────────┐
│                              App                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                      World Protocol                          │  │
│  │  • Proposal lifecycle                                        │  │
│  │  • Authority evaluation                                      │  │
│  │  • World creation (WorldId = hash(schemaHash, snapshotHash)) │  │
│  │  • Lineage management                                        │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                 │                                   │
│                                 │ HostExecutor interface            │
│                                 ▼                                   │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                      Host Adapter                            │  │
│  │  • ExecutionKey routing (POLICY-001)                         │  │
│  │  • Context Freezing (EXT-001)                                │  │
│  │  • Trace mapping                                             │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────────────────────────────────┬───────────────────────────────────┘
                                 │
                                 │ Host Internal API
                                 ▼
┌────────────────────────────────────────────────────────────────────┐
│                              Host                                   │
│  • ExecutionKey Mailbox (run-to-completion)                        │
│  • Effect execution                                                 │
│  • TraceEvent emission                                              │
└────────────────────────────────┬───────────────────────────────────┘
                                 │
                                 │ compute(), apply()
                                 ▼
┌────────────────────────────────────────────────────────────────────┐
│                              Core                                   │
│  • Pure semantic computation                                        │
│  • Snapshot structure ownership                                     │
│  • Deterministic: same input → same output                          │
└────────────────────────────────────────────────────────────────────┘
```

---

## 3. Sequence Diagrams

### 3.1 Happy Path: Proposal → World

```
User          App           PolicyService    MemoryProvider    HostExecutor    WorldStore
 │             │                 │                 │                │              │
 │ submitProposal(P)             │                 │                │              │
 │────────────>│                 │                 │                │              │
 │             │                 │                 │                │              │
 │             │ deriveExecutionKey(P)             │                │              │
 │             │────────────────>│                 │                │              │
 │             │<────────────────│ executionKey    │                │              │
 │             │                 │                 │                │              │
 │             │ requestApproval(P)                │                │              │
 │             │────────────────>│                 │                │              │
 │             │                 │ evaluate()      │                │              │
 │             │<────────────────│ { approved, scope }              │              │
 │             │                 │                 │                │              │
 │             │ recall(query)   │                 │                │              │
 │             │────────────────────────────────>│                │              │
 │             │<────────────────────────────────│ memoryContext    │              │
 │             │                 │                 │                │              │
 │             │ restore(baseWorldId)              │                │              │
 │             │─────────────────────────────────────────────────────────────────>│
 │             │<─────────────────────────────────────────────────────────────────│
 │             │                 │                 │    baseSnapshot │              │
 │             │                 │                 │                │              │
 │             │ ┌───────────────────────────────┐ │                │              │
 │             │ │ Context Freezing              │ │                │              │
 │             │ │ frozenSnapshot = freeze(      │ │                │              │
 │             │ │   baseSnapshot, memoryContext)│ │                │              │
 │             │ └───────────────────────────────┘ │                │              │
 │             │                 │                 │                │              │
 │             │ execute(key, frozenSnapshot, intent, opts)        │              │
 │             │─────────────────────────────────────────────────>│              │
 │             │                 │                 │                │              │
 │             │                 │                 │    ┌───────────┴──────────┐  │
 │             │                 │                 │    │ Host Execution       │  │
 │             │                 │                 │    │ • compute()          │  │
 │             │                 │                 │    │ • apply()            │  │
 │             │                 │                 │    │ • effects            │  │
 │             │                 │                 │    │ → terminalSnapshot   │  │
 │             │                 │                 │    └───────────┬──────────┘  │
 │             │                 │                 │                │              │
 │             │<─────────────────────────────────────────────────│              │
 │             │                 │    { outcome, terminalSnapshot } │              │
 │             │                 │                 │                │              │
 │             │ validateResultScope(base, terminal, scope)        │              │
 │             │────────────────>│                 │                │              │
 │             │<────────────────│ { valid: true } │                │              │
 │             │                 │                 │                │              │
 │             │ ┌───────────────────────────────┐ │                │              │
 │             │ │ World Creation                │ │                │              │
 │             │ │ • deriveOutcome()             │ │                │              │
 │             │ │ • computeWorldId()            │ │                │              │
 │             │ │ • createWorld()               │ │                │              │
 │             │ └───────────────────────────────┘ │                │              │
 │             │                 │                 │                │              │
 │             │ store(world, delta)               │                │              │
 │             │─────────────────────────────────────────────────────────────────>│
 │             │                 │                 │                │              │
 │             │ remember(experience)              │                │              │
 │             │────────────────────────────────>│                │              │
 │             │                 │                 │                │              │
 │             │ emit('state:publish')             │                │              │
 │             │ emit('world:created')             │                │              │
 │             │                 │                 │                │              │
 │<────────────│ ProposalResult { world }          │                │              │
 │             │                 │                 │                │              │
```

### 3.2 Rejection Path

```
User          App           PolicyService    Authority
 │             │                 │               │
 │ submitProposal(P)             │               │
 │────────────>│                 │               │
 │             │                 │               │
 │             │ requestApproval(P)              │
 │             │────────────────>│               │
 │             │                 │ evaluate(P)   │
 │             │                 │──────────────>│
 │             │                 │<──────────────│
 │             │<────────────────│ { approved: false, reason }
 │             │                 │               │
 │             │ ┌──────────────────────────────┐│
 │             │ │ No execution                 ││
 │             │ │ No World creation            ││
 │             │ └──────────────────────────────┘│
 │             │                 │               │
 │             │ emit('proposal:rejected')       │
 │             │                 │               │
 │<────────────│ ProposalResult { status: 'rejected', reason }
 │             │                 │               │
```

### 3.3 Execution Failure → Failed World

```
User          App           HostExecutor         WorldStore
 │             │                 │                    │
 │ submitProposal(P)             │                    │
 │────────────>│                 │                    │
 │             │ (... approval passed ...)            │
 │             │                 │                    │
 │             │ execute(...)    │                    │
 │             │────────────────>│                    │
 │             │                 │ ┌────────────────┐ │
 │             │                 │ │ Execution fails│ │
 │             │                 │ │ • compute error│ │
 │             │                 │ │ • effect error │ │
 │             │                 │ └────────────────┘ │
 │             │<────────────────│                    │
 │             │ { outcome: 'failed', terminalSnapshot, error }
 │             │                 │                    │
 │             │ ┌────────────────────────────────────┐
 │             │ │ Failure도 World로 봉인!            │
 │             │ │ • deriveOutcome() → 'failed'       │
 │             │ │ • World.outcome = 'failed'         │
 │             │ │ • 역사에서 삭제 불가               │
 │             │ └────────────────────────────────────┘
 │             │                 │                    │
 │             │ store(failedWorld, delta)            │
 │             │──────────────────────────────────────>│
 │             │                 │                    │
 │<────────────│ ProposalResult { status: 'failed', world }
 │             │                 │                    │
```

### 3.4 Replay (Determinism Verification)

```
App           WorldStore         HostExecutor    MemoryStore
 │                 │                  │               │
 │ replayWorld(worldId)               │               │
 │                 │                  │               │
 │ restore(worldId)│                  │               │
 │────────────────>│                  │               │
 │<────────────────│                  │               │
 │    frozenSnapshot (includes memoryContext)         │
 │                 │                  │               │
 │ ┌──────────────────────────────────────────────────┐
 │ │ ❌ MemoryStore.recall() 호출 안 함!              │
 │ │ ✅ Snapshot에 박제된 memoryContext 사용          │
 │ └──────────────────────────────────────────────────┘
 │                 │                  │               │
 │ getMemoryContextForReplay(frozenSnapshot)          │
 │ → "사과는 빨갛다" (1월 1일 박제된 값)              │
 │                 │                  │               │
 │ execute(key, frozenSnapshot, intent)               │
 │──────────────────────────────────>│               │
 │                 │                  │               │
 │<──────────────────────────────────│               │
 │ terminalSnapshot (동일한 결과)    │               │
 │                 │                  │               │
 │ ┌──────────────────────────────────────────────────┐
 │ │ ✅ Determinism 보장                              │
 │ │ 1월 1일 실행 == 1월 3일 replay                  │
 │ │ (MemoryStore가 1월 2일에 변경되었어도)          │
 │ └──────────────────────────────────────────────────┘
 │                 │                  │               │
```

---

## 4. State Transition Diagrams

### 4.1 Proposal Lifecycle

```
                    ┌─────────────┐
                    │   (start)   │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
           ┌───────│  submitted  │───────┐
           │       └──────┬──────┘       │
           │              │              │
           │ immediate    │ route to     │
           │ rejection    │ Authority    │
           │              ▼              │
           │       ┌─────────────┐       │
           │       │  evaluating │       │
           │       └──────┬──────┘       │
           │              │              │
           │    ┌─────────┴─────────┐    │
           │    │                   │    │
           │    ▼                   ▼    │
           │ ┌────────┐      ┌──────────┐│
           └>│rejected│      │ approved ││
             └────────┘      └────┬─────┘│
                  │               │      │
                  │               ▼      │
                  │        ┌───────────┐ │
                  │        │ executing │ │
                  │        └─────┬─────┘ │
                  │              │       │
                  │    ┌─────────┴─────────┐
                  │    │                   │
                  │    ▼                   ▼
                  │ ┌──────────┐    ┌────────┐
                  │ │completed │    │ failed │
                  │ └────┬─────┘    └───┬────┘
                  │      │              │
                  │      │   World      │
                  │      │   Created    │
                  │      ▼              ▼
                  │    ┌─────────────────┐
                  └───>│     (end)       │
                       └─────────────────┘

States:
• submitted:  Proposal 제출됨
• evaluating: Authority 평가 중
• approved:   승인됨, 실행 대기
• executing:  Host 실행 중 (run-to-completion, 취소 불가)
• completed:  성공, World 생성됨 (outcome: 'completed')
• failed:     실패, World 생성됨 (outcome: 'failed')
• rejected:   거부됨, World 없음
```

### 4.2 App Lifecycle

```
                    ┌─────────────┐
                    │   (start)   │
                    └──────┬──────┘
                           │ new App(config)
                           ▼
                    ┌─────────────┐
                    │   created   │
                    └──────┬──────┘
                           │ app.initialize()
                           ▼
                    ┌─────────────┐
           ┌───────│ initializing│───────┐
           │       └──────┬──────┘       │
           │              │              │
           │ plugin       │ all plugins  │ plugin
           │ error        │ loaded       │ timeout
           │              ▼              │
           │       ┌─────────────┐       │
           │       │    ready    │◄──┐   │
           │       └──────┬──────┘   │   │
           │              │          │   │
           │              │ submit   │   │
           │              │ Proposal │   │
           │              ▼          │   │
           │       ┌─────────────┐   │   │
           │       │  executing  │───┘   │
           │       └──────┬──────┘       │
           │              │ complete     │
           │              │              │
           │              │ app.dispose()│
           │              ▼              │
           │       ┌─────────────┐       │
           └──────>│  disposing  │<──────┘
                   └──────┬──────┘
                          │ cleanup complete
                          ▼
                   ┌─────────────┐
                   │  disposed   │
                   └──────┬──────┘
                          │
                          ▼
                   ┌─────────────┐
                   │    (end)    │
                   └─────────────┘

Hooks Activation:
• created:      hooks 비활성
• initializing: hooks 비활성
• ready:        hooks 활성화 ✅
• executing:    hooks 활성화 ✅
• disposing:    hooks 드레인
• disposed:     hooks 비활성
```

### 4.3 World Storage Lifecycle

```
                    ┌─────────────┐
                    │   (start)   │
                    └──────┬──────┘
                           │ World created
                           ▼
                    ┌─────────────┐
           ┌───────│   active    │◄──────────────┐
           │       └──────┬──────┘               │
           │              │                      │
           │              │ Maintenance          │
           │              │ (Active Horizon 외)  │
           │              ▼                      │
           │       ┌─────────────┐               │
           │       │  compacted  │───────────────┤
           │       └──────┬──────┘   restore()   │
           │              │                      │
           │              │ Maintenance          │
           │              │ (retention 만료)     │
           │              ▼                      │
           │       ┌─────────────┐               │
           └──────>│  archived   │───────────────┘
                   └─────────────┘   restore()

Storage Strategy:
• active:    Full Snapshot 즉시 가용
• compacted: Delta만 저장, restore 시 재계산
• archived:  Cold Storage, 높은 latency
```

### 4.4 ExecutionKey Mailbox

```
                    ┌─────────────┐
                    │   (start)   │
                    └──────┬──────┘
                           │ mailbox created
                           ▼
              ┌───────────────────────┐
              │                       │
              ▼                       │
       ┌─────────────┐                │
       │    idle     │────────────────┤
       └──────┬──────┘    Tick        │
              │           Boundary    │
              │ intent    (publish)   │
              │ submitted             │
              ▼                       │
       ┌─────────────┐                │
       │ processing  │────────────────┘
       └─────────────┘  terminalSnapshot
                        reached

Serialization:
• idle → processing: Intent 수락
• processing → idle: 완료, Tick 경계
• processing 중: 같은 key의 다른 intent는 대기 (queue)

Policy별 ExecutionKey:
• defaultPolicy:      unique key (병렬)
• actorSerialPolicy:  actorId key (Actor별 직렬)
• baseSerialPolicy:   baseWorld key (base별 직렬)
• globalSerialPolicy: global key (전역 직렬)
```

---

## 5. Data Flow Diagrams

### 5.1 Proposal → World Data Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│                           INPUT                                       │
│                                                                       │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐     │
│  │  Proposal  │  │ baseWorld  │  │  Authority │  │  Memory    │     │
│  │            │  │            │  │  Decision  │  │  Context   │     │
│  │ • actorId  │  │ • WorldId  │  │            │  │            │     │
│  │ • intent   │  │ • Snapshot │  │ • approved │  │ • recall() │     │
│  │ • baseWorld│  │            │  │ • scope    │  │            │     │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘     │
│        │               │               │               │             │
│        └───────────────┴───────┬───────┴───────────────┘             │
│                                │                                      │
└────────────────────────────────┼──────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        CONTEXT FREEZING                               │
│                                                                       │
│  frozenSnapshot = {                                                   │
│    ...baseSnapshot,                                                   │
│    input: {                                                           │
│      ...baseSnapshot.input,                                           │
│      memoryContext: structuredClone(recalledData)  // 값 복사!       │
│    }                                                                  │
│  }                                                                    │
│                                                                       │
└────────────────────────────────┼──────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│                          EXECUTION                                    │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                      Host Execution                            │  │
│  │                                                                │  │
│  │  frozenSnapshot ──► compute() ──► patches ──► apply()         │  │
│  │                          │                        │            │  │
│  │                          ▼                        ▼            │  │
│  │                     effects()              newSnapshot         │  │
│  │                          │                        │            │  │
│  │                          └────────► re-entry ◄────┘            │  │
│  │                                         │                      │  │
│  │                                         ▼                      │  │
│  │                              terminalSnapshot                  │  │
│  │                                                                │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                       │
└────────────────────────────────┼──────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│                           OUTPUT                                      │
│                                                                       │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐     │
│  │   World    │  │   Delta    │  │ Experience │  │  Events    │     │
│  │            │  │            │  │            │  │            │     │
│  │ • worldId  │  │ • patches  │  │ • remember │  │ • publish  │     │
│  │ • outcome  │  │ • from→to  │  │            │  │ • created  │     │
│  │ • lineage  │  │            │  │            │  │            │     │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘     │
│        │               │               │               │             │
│        ▼               ▼               ▼               ▼             │
│   WorldStore      WorldStore      MemoryStore      Hooks/UI          │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

### 5.2 Memory vs World: Mutable vs Immutable

```
┌────────────────────────────────────────────────────────────────────┐
│                    MUTABLE LAYER (External)                         │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                     MemoryStore                              │  │
│  │                                                              │  │
│  │  Jan 1: { apple: "red" }                                     │  │
│  │  Jan 2: { apple: "green" }  ◄── UPDATE                       │  │
│  │  Jan 3: { apple: "green" }                                   │  │
│  │                                                              │  │
│  │  • CRUD operations                                           │  │
│  │  • 변경 가능                                                 │  │
│  │  • World 외부                                                │  │
│  │                                                              │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              │                                      │
│                              │ recall() → 값 복사                   │
│                              ▼                                      │
└─────────────────────────────────────────────────────────────────────┘
                               │
        ═══════════════════════╪═══════════════════════════════════
                   Context Freezing Boundary (값 복사)
        ═══════════════════════╪═══════════════════════════════════
                               │
                               ▼
┌────────────────────────────────────────────────────────────────────┐
│                   IMMUTABLE LAYER (World)                           │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                     WorldStore                               │  │
│  │                                                              │  │
│  │  World-001 (Jan 1):                                          │  │
│  │    snapshot.input.memoryContext = { apple: "red" }  ◄── 박제 │  │
│  │                                                              │  │
│  │  World-002 (Jan 2):                                          │  │
│  │    snapshot.input.memoryContext = { apple: "green" }         │  │
│  │                                                              │  │
│  │  • Immutable (역사)                                          │  │
│  │  • 삭제/수정 불가                                            │  │
│  │  • Replay 시 박제된 값 사용 → Determinism 보장               │  │
│  │                                                              │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 6. Rule Dependencies

### 6.1 Critical Path Rules

```
ARCHITECTURE v2
    │
    ├─► "Results vs Process"
    │       │
    │       ├─► World owns Results (history)
    │       │       │
    │       │       └─► INTEGRATION-001: WorldStore
    │       │               • STORE-PERSIST-1: World 단위 저장
    │       │               • STORE-RESTORE-1: 재구성 보장
    │       │
    │       └─► App owns Process (execution)
    │               │
    │               └─► PUB-001: Tick, Publish
    │                       • PUB-TICK-1: 정의
    │                       • PUB-BOUNDARY-1: at most once
    │
    └─► "Does NOT Know"
            │
            ├─► Host does NOT know World
            │       │
            │       └─► INTEGRATION-001: HostExecutor
            │               • HEXEC-1: interface 분리
            │               • HEXEC-2: 양방향 의존 금지
            │
            └─► World does NOT know TraceEvent
                    │
                    └─► INTEGRATION-001: Trace Mapping
                            • App이 변환 담당

ADR-001
    │
    ├─► "approvedScope enforcement = App"
    │       │
    │       └─► POLICY-001: ApprovedScope
    │               • SCOPE-1: pre-validation
    │               • SCOPE-2: post-validation (선택)
    │
    └─► "ExecutionKey policy = App"
            │
            └─► POLICY-001: ExecutionKey
                    • EXK-1: derivation 책임
                    • EXK-TICK: proposal-tick 단위
```

### 6.2 Determinism Chain

```
Core Constitutional Rule: "Same input → Same output"
    │
    ├─► Core: Pure computation
    │       │
    │       └─► compute(snapshot, intent) = deterministic
    │
    ├─► Host: Deterministic execution
    │       │
    │       └─► Effect handlers must be reproducible
    │
    └─► App: Context Freezing
            │
            └─► EXT-001: Memory Integration
                    │
                    ├─► MEM-CONTEXT-1: 값 박제 (참조 금지)
                    │
                    ├─► MEM-CONTEXT-2: Replay 시 재조회 금지
                    │
                    └─► Determinism 보장
                            • 1월 1일 실행 == 1월 3일 replay
                            • Memory 변경과 무관
```

---

## 7. Validation Checklist

### 7.1 Critical Path

| # | 검증 항목 | FDR | Status |
|---|----------|-----|--------|
| 1 | Proposal → World 생성 흐름 | INTEGRATION | ✅ |
| 2 | Authority rejection → World 없음 | POLICY | ✅ |
| 3 | Execution failure → Failed World | INTEGRATION | ✅ |
| 4 | Tick boundary 정의 | PUB + POLICY | ✅ |
| 5 | state:publish 빈도 (at most once/tick) | PUB | ✅ |
| 6 | Context Freezing (Determinism) | EXT | ✅ |
| 7 | HostExecutionOptions 경계 준수 | EXT | ✅ |
| 8 | StoredMemoryRecord.id 보장 | EXT | ✅ |

### 7.2 Edge Cases

| # | 검증 항목 | FDR | Status | Notes |
|---|----------|-----|--------|-------|
| 1 | Memory recall 실패 | EXT | ✅ | MEM-INT-5: timeout + degrade |
| 2 | Post-scope violation | POLICY | ✅ | Failed World로 봉인 |
| 3 | Delta chain 성능 | INTEGRATION | ✅ | Active Horizon |
| 4 | Maintenance 블로킹 | INTEGRATION + EXT | ✅ | 별도 job queue |
| 5 | Epoch cancellation | - | ⚠️ | 미정의 (향후 검토) |

### 7.3 Type Safety

| # | 검증 항목 | FDR | Status |
|---|----------|-----|--------|
| 1 | MemoryRecordInput vs StoredMemoryRecord | EXT | ✅ |
| 2 | AppExecutionContext 분리 | EXT | ✅ |
| 3 | ExecutionPolicyConfig.executionKeyPolicy | POLICY | ✅ |
| 4 | HostExecutionResult.outcome 정합 | INTEGRATION + POLICY | ✅ |

---

## 8. Open Questions (향후 검토)

### 8.1 Epoch-based Cancellation

```
문제:
• Branch switch 시 진행 중인 Proposal은?
• run-to-completion이므로 취소 불가
• 완료된 World를 어떻게 처리?

옵션:
A) Orphaned World로 마킹
B) 원래 branch에 연결
C) Epoch 검증 후 폐기

→ 별도 ADR 필요
```

### 8.2 UI Bridge (FDR-APP-BRIDGE-001)

```
향후 정의 필요:
• React/Zustand 통합
• React Hook Form 연동
• Optimistic Update 패턴
• Subscription 관리
```

---

## 9. Conclusion

### 9.1 Architecture Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                        Manifesto App v2                          │
│                                                                  │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌──────────┐  │
│  │  PUB-001   │  │RUNTIME-001 │  │INTEGRATION │  │POLICY-001│  │
│  │            │  │            │  │   -001     │  │          │  │
│  │  Tick      │  │ Lifecycle  │  │            │  │ ExecKey  │  │
│  │  Publish   │  │ Hooks      │  │ HostExec   │  │ Authority│  │
│  │  Scheduler │  │ Plugins    │  │ WorldStore │  │ Scope    │  │
│  │            │  │            │  │ Maintenance│  │          │  │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘  └────┬─────┘  │
│        │               │               │              │         │
│        └───────────────┴───────────────┴──────────────┘         │
│                                │                                 │
│                         ┌──────┴──────┐                         │
│                         │   EXT-001   │                         │
│                         │             │                         │
│                         │ MemoryStore │                         │
│                         │ Context     │                         │
│                         │ Freezing    │                         │
│                         └─────────────┘                         │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 9.2 Key Achievements

| 목표 | 달성 방법 |
|------|----------|
| **Determinism** | Context Freezing (값 박제) |
| **Layer Separation** | HostExecutor interface, AppExecutionContext 분리 |
| **Type Safety** | Input/Output 타입 분리, 경계 타입 준수 |
| **Extensibility** | Hooks, Plugins, Policy injection |
| **Governance** | Authority routing, Scope enforcement |
| **Persistence** | Delta + Checkpoint, Active Horizon |

### 9.3 Next Steps

1. **Implementation**: FDR 기반 코드 구현
2. **Bridge FDR**: UI Framework 통합 규약
3. **Epoch ADR**: Branch/Cancellation 처리
4. **Testing**: Replay determinism 검증

---

*End of Architecture Overview*
