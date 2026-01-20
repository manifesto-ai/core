# FDR-APP-PUB-001: World-Bound App Runtime & Publish Boundary (App v2)

> **Version:** 0.3.0
> **Status:** Draft
> **Date:** 2026-01-19
> **Scope:** Manifesto App v2 — App↔World binding, publish boundary, scheduler injection, state/telemetry split
> **Depends on:** ARCHITECTURE v2, ADR-001, Host Contract v2.0.2, World Protocol v2.0.2, App v2 prep notes.

## Changelog

* **v0.1.0:** Publish boundary = mailbox tick, scheduler injection, state vs telemetry 분리(초안)
* **v0.2.0:** **App↔World 1:1 헌법 고정**, "tick = mailbox idle" 정의의 안전 조건을 명문화, App을 **World-bound Runtime Facade(외부 계약의 얼굴)**로 정의
* **v0.3.0:** **Tick 용어 계층화** — Host Tick과 Proposal Tick 분리, POLICY-001과의 정합성 확보, publish boundary를 Proposal Tick 기준으로 명확화

---

## 1. Executive Summary

Manifesto App v2는 "Results are World's; Process is App's"라는 헌법을 따라, App이 Host↔World 통합과 실행 관측(telemetry)을 소유한다.

이번 업데이트에서 App의 정체성을 다음처럼 **명확히 봉인**한다:

1. **App ↔ World는 1:1로 매핑**된다.

   * App 인스턴스는 하나의 World Protocol 인스턴스(및 그 WorldStore)를 대표하는 **World-bound Runtime**이다.

2. App은 **외부 계약(External Contract)의 유일한 얼굴(facade)** 이다.

   * UI/BE/Agent/System 등 외부 세계는 App을 통해서만 의도를 제출하고 상태를 구독한다.

3. **Tick은 두 계층으로 정의**된다 (v0.3.0 신규):

   * **Host Tick**: mailbox runner가 idle 상태로 돌아갈 때까지의 수렴 구간 (Host 내부 구현)
   * **Proposal Tick**: 한 Proposal의 실행 사이클 (startExecution → terminalSnapshot) — **Publish boundary의 기준**

4. **Publish boundary는 Proposal Tick 기준**이며, **App↔World 1:1 고정으로 인해 안전**해진다.

5. **Coalescing/스케줄링은 런타임 종속이므로 외부 주입** 가능해야 한다(웹 전용 primitive 고정 금지).

6. **State publish와 telemetry는 분리**된다(telemetry는 App 소유, World는 모름).

---

## 2. Context

### 2.1 Layer Constitution

* Core는 순수 계산, Host는 실행 수렴(mailbox/job), World는 결과 봉인/lineage, App은 조립/정책/관측을 담당한다.
* World는 Host 내부(TraceEvent, micro-steps)를 **알면 안 되고**, App이 Host의 TraceEvent를 telemetry로 변환한다.

### 2.2 Host Execution Model

* Host는 ExecutionKey별 mailbox 단일 러너(run-to-completion)를 강제한다.
* ExecutionKey는 Host에게 opaque이고, mapping 정책은 World/App이 결정한다.

### 2.3 Multi-runtime Requirement

App v2는 Web-only가 아니다(Agent runtime / BE / system process 등). 따라서 publish 스케줄링을 특정 런타임에 고정하면 portability를 해친다.

---

## 3. Problem

### 3.1 computed마다 publish는 비용/일관성 붕괴

computed DAG는 내부적으로 다수 노드 갱신을 유발할 수 있다. 이를 노드 단위로 외부에 전파하면:

* 구독자 폭발(렌더/이벤트 폭주)
* 중간 상태 노출("반쯤 계산된 스냅샷")
* 런타임별 타이밍 차이로 의미적 불일치 위험

### 3.2 "tick = mailbox idle"은 App↔World 1:N에서 위험

tick을 mailbox idle로 정의했을 때, 하나의 mailbox(ExecutionKey)가 **다른 World(서로 다른 baseWorld lineage)**의 실행을 섞어 처리할 수 있으면 publish 의미가 붕괴한다.
따라서 이 tick 정의가 안전하려면 **World 경계가 App에서 봉인**되어야 한다.

### 3.3 여러 Proposal이 같은 ExecutionKey를 공유할 때 (v0.3.0)

직렬화 정책(actorSerialPolicy, baseSerialPolicy 등)에서 **여러 Proposal이 같은 ExecutionKey로 매핑**될 수 있다.
이때 "mailbox idle"만을 tick으로 정의하면:

* Proposal A가 완료되어도 Proposal B가 즉시 큐에 있으면 mailbox는 idle이 아님
* Proposal A의 terminalSnapshot 직후 publish가 발생하지 않을 수 있음
* POLICY-001이 의도한 "Proposal 단위 publish 최소 1회" 보장이 깨짐

---

## 4. Decisions

### D0. App ↔ World 1:1 Binding

**Decision:** App 인스턴스는 정확히 하나의 World Protocol 인스턴스(및 WorldStore)를 대표해야 한다.

* App은 **World-bound Runtime**이며, 외부 계약의 유일 façade다.
* App–World 1:1 고정은 tick/publish boundary를 안전하게 만든다(다른 World 혼입 차단).

**Consequence:** "다른 World로의 이동/동시 운용"은 **다른 App 인스턴스**(또는 상위 제품 레이어)로 모델링되어야 하며, 단일 App 내부에서 World를 섞는 것은 금지된다.

---

### D1. Tick Definition: Two-Level Hierarchy (v0.3.0 개정)

**Decision:** Tick은 두 계층으로 정의된다.

#### D1.1 Host Tick (Low-level, Implementation)

**Definition:** ExecutionKey mailbox runner가 유휴(idle) 상태로 돌아갈 때까지의 수렴 구간.

* Host는 ExecutionKey mailbox를 drain하며, effect 결과는 reinject job으로 다시 mailbox에 들어옴
* Host 내부 실행 모델의 자연 경계
* **직접 publish boundary로 사용되지 않음** (구현 세부사항)

#### D1.2 Proposal Tick (High-level, Authoritative)

**Definition:** 한 Proposal의 실행 사이클 — `startExecution()` 부터 `terminalSnapshot` 도달까지.

* World 거버넌스 관점의 의미적 경계
* **Publish boundary의 기준** (MUST)
* 같은 ExecutionKey를 공유하는 여러 Proposal이 있어도, 각 Proposal마다 별도의 Proposal Tick이 발생

**Rationale:**

| 계층 | 목적 | 결정 주체 |
|------|------|----------|
| Host Tick | 실행 수렴 경계 | Host 내부 |
| Proposal Tick | 거버넌스/publish 경계 | World/App |

**Cross-reference:** FDR-APP-POLICY-001 §2.7 EXK-TICK-1~3

---

### D2. Publish Boundary = "Per Proposal Tick" (v0.3.0 개정)

**Decision:** App은 외부 상태 publish를 **Proposal Tick 기준으로 최소 1회, 최대 1회** 발생시킨다.

* computed 노드 단위 publish는 금지한다.
* apply 호출이 Proposal Tick 내에 여러 번 발생할 수 있어도, publish는 terminalSnapshot으로 coalesce한다.
* **같은 ExecutionKey를 공유하는 여러 Proposal이 있어도, 각 Proposal의 terminalSnapshot 도달 시점에서 최소 1회 publish가 보장**된다.

**Implementation Note:**

```typescript
// Proposal 실행 완료 시 publish 보장
async function completeProposalExecution(
  proposal: Proposal,
  terminalSnapshot: Snapshot
): Promise<void> {
  // 같은 ExecutionKey에 다음 Proposal이 대기 중이어도
  // 현재 Proposal의 terminalSnapshot을 먼저 publish
  await publishSnapshot(terminalSnapshot);
  
  // 그 후에 다음 Proposal 처리
  processNextQueuedProposal(proposal.executionKey);
}
```

---

### D3. Scheduler/Coalescing Policy MUST be Injectable

**Decision:** App은 publish 스케줄링을 런타임 고정 primitive로 정의하지 않는다. 대신 외부 주입 가능한 `PublishScheduler` 인터페이스를 제공한다.

* 기본 제공: microtask 기반(이식성)
* 선택 제공: rAF(웹 UI 최적화), macrotask, manual flush(에이전트/시뮬레이터) 등

이 결정은 "App은 다양한 런타임에서 돌아가야 한다"는 v2 준비 문서의 요구와 정합한다.

---

### D4. Dual Channel: State vs Telemetry

**Decision:** App은 **State publish**와 **Telemetry**를 분리한다.

* Telemetry는 Host TraceEvent에서 파생되는 App-owned 이벤트 스트림이다.
* World는 telemetry를 알지 않으며, 결과(terminal)만 봉인한다.

---

## 5. Alternatives Considered

### A0. App↔World 1:N 허용

* **Pros:** 하나의 App으로 여러 World를 관리 가능
* **Cons:** tick/publish 의미 붕괴, World lineage 혼입 위험, ExecutionKey collision/semantic mixing 위험
* **Decision:** ❌ Rejected → **App↔World 1:1 헌법 고정**

### A1. publish per computed

* ❌ 비용 폭발/일관성 붕괴

### A2. publish per apply

* ⚠️ tick 내 apply 다발 시 폭발 가능 → tick boundary로 승격

### A3. terminal-only publish만 허용

* ✅ 배치/에이전트 런타임에 유용하지만, UI에선 UX 저하 가능 → mode로 제공

### A4. Host Tick(mailbox idle)만을 publish boundary로 사용 (v0.3.0)

* ⚠️ 직렬화 정책에서 여러 Proposal이 같은 ExecutionKey 공유 시 publish 누락 가능
* **Decision:** ❌ Rejected → **Proposal Tick을 publish boundary로 채택**

---

## 6. Consequences

1. **Tick 의미가 World 의미와 일치**

   * App↔World 1:1 고정 + Proposal Tick 기준으로 "terminalSnapshot 시점 publish"가 안전해짐.

2. **멀티 런타임 지원**

   * publish 스케줄러를 주입/교체 가능.

3. **운영 관측성과 UX의 분리**

   * 상태 전파는 안정적(적게), telemetry는 풍부하게(많이) 가능.

4. **직렬화 정책과의 정합성 (v0.3.0)**

   * 같은 ExecutionKey를 공유하는 여러 Proposal도 각각 publish boundary를 가짐.

---

## 7. Proposed Rules (for App v2 SPEC)

### App↔World Binding

* **APP-WORLD-1 (MUST):** App instance MUST be bound to exactly one World Protocol instance (and its WorldStore).
* **APP-WORLD-2 (MUST NOT):** App MUST NOT multiplex multiple World Protocol instances within a single runtime (no cross-world mixing).
* **APP-WORLD-3 (SHOULD):** App SHOULD model "multi-world" as multiple App instances or a higher-level product layer that composes multiple Apps.

### Tick Definition (v0.3.0 개정)

* **PUB-TICK-1 (NOTE):** Host Tick is defined as "mailbox runner converges to idle" — this is an implementation detail, not directly used for publish boundary.
* **PUB-TICK-2 (MUST):** Proposal Tick is defined as "one Proposal execution cycle (startExecution → terminalSnapshot)".
* **PUB-TICK-3 (MUST):** Proposal Tick is the authoritative boundary for publish decisions.

### Publish Boundary (v0.3.0 개정)

* **PUB-BOUNDARY-1 (MUST):** App MUST publish state updates at least once per Proposal Tick (at terminalSnapshot).
* **PUB-BOUNDARY-2 (MUST):** App MUST publish state updates at most once per Proposal Tick.
* **PUB-BOUNDARY-3 (MUST NOT):** App MUST NOT publish per computed-node evaluation.
* **PUB-BOUNDARY-4 (MUST NOT):** Multiple Proposals on same ExecutionKey MUST NOT merge into single publish boundary.

### Scheduler Injection

* **PUB-SCHED-1 (MUST):** App MUST allow injection of a `PublishScheduler`.
* **PUB-SCHED-2 (MUST NOT):** App MUST NOT require browser-only primitives for correctness.
* **PUB-SCHED-3 (SHOULD):** Default scheduler SHOULD be microtask-based for portability.

### Liveness

* **PUB-LIVENESS-1 (MUST):** App MUST monitor the number of re-injected jobs within a single Proposal Tick.
* **PUB-LIVENESS-2 (MUST):** App MUST define a MAX_REINJECTION_LIMIT. If the number of re-injected jobs within a single Proposal Tick exceeds this limit, App MUST abort the tick and terminate execution with a LivenessError.
* **PUB-LIVENESS-3 (SHOULD):** Upon a LivenessError, App SHOULD seal a terminal World representing a non-convergent execution, capturing the last Snapshot as an aborted (non-convergent) state for lineage and post-mortem analysis.

### Dual Channel

* **PUB-CH-1 (MUST):** App MUST separate State publish channel from Telemetry channel.

---

## 8. Interface Sketch (Informative)

```ts
export type PublishScheduler = {
  /** MUST coalesce multiple schedule() calls within same Proposal Tick */
  schedule(flush: () => void): void;
};

export type PublishMode = "each_tick" | "terminal_only";

export type PublishOptions = {
  mode?: PublishMode;          // default: "each_tick"
  scheduler?: PublishScheduler; // default: microtask scheduler
};

/**
 * Proposal Tick 정의 (v0.3.0)
 */
export type ProposalTick = {
  readonly proposalId: ProposalId;
  readonly executionKey: ExecutionKey;
  readonly startedAt: number;
  readonly completedAt: number;
  readonly terminalSnapshot: Snapshot;
};
```

---

## 9. Cross-Reference Summary (v0.3.0)

| This FDR | Related Document | Relationship |
|----------|------------------|--------------|
| D0 (App↔World 1:1) | POLICY-001 | 헌법 공유 |
| D1.2 (Proposal Tick) | POLICY-001 §2.7 EXK-TICK-1~3 | 동일 정의 |
| D2 (Publish Boundary) | POLICY-001 EXK-TICK-2 | 정합 |
| D2 (Publish Boundary) | RUNTIME-001 HOOK-8 | state:publish 발화 조건 |

---

## 10. Summary

v2에서 App의 정체성을 **World-bound Runtime Facade(외부 계약의 얼굴)**로 고정하고, App↔World를 1:1로 봉인함으로써:

* **Proposal Tick** = publish boundary가 의미적으로 안전해지고
* 직렬화 정책에서도 Proposal별 publish가 보장되며
* 멀티 런타임을 스케줄러 주입으로 흡수하고
* state publish vs telemetry를 분리해 비용 폭발 없이 반응성을 제공할 수 있다.

---

*End of FDR-APP-PUB-001 v0.3.0*
