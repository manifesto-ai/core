# ADR-006: Runtime Reframing — "App" 제거/리프레이밍, DX는 SDK로, 실행 통합은 Runtime으로

> **Status:** Proposed
> **Date:** 2026-02-10
> **Deciders:** Manifesto Architecture Team
> **Scope:** v3 Architecture (Core, Host, World, Compiler, Runtime, SDK)
> **Supersedes / Reframes:** ADR-001의 "App=composition root" 서술 일부, App 중심 DX 서술(부분)
> **Related:** ADR-005 (Snapshot Path DSL), World HASH rules (platform namespaces exclusion), Host Contract (Snapshot canonical)

---

## 1. Context

v2에서 "App"은 다음 세 역할이 한 덩어리로 묶여 있었다:

1) **Execution Integration (Host ↔ World 결합, 정책, 관측/telemetry, 스케줄링)**
2) **External Facade (act/subscribe/getState 등 외부 계약 표면)**
3) **DX Surface (상태 접근 표면, computed 접근, 네이밍, 프레임워크 친화 API)**

그 결과:

- Snapshot 경계 계약(`data`, `computed`, `system`, `meta`, `input`)이 DX 표면으로 그대로 새어 나와
  - `data` vs `state` 혼란,
  - `computed['computed.x']` 같은 내부 좌표계 노출,
  - getState/getSnapshot 명명 혼선이 누적되었다.
- 실행/수렴/발행(publish) 같은 "runtime semantics"와
  접근/표현 같은 "DX semantics"가 문서/코드에서 섞여
  의미론적 좌표계(semantic coordinate)가 흐려졌다.

v3에서는 "모든 단위는 Snapshot"이라는 헌법을 유지하되,
**실행 통합(aggression/integration)** 과 **DX 표면**을 물리적으로 분리해
다음 조건을 만족해야 한다:

- Core/Host/World/Compiler 계약 경계가 확장되어도 의미론적 좌표계가 흔들리지 않는다.
- Publish boundary와 실행 수렴 규칙이 DX 변화에 의해 오염되지 않는다.
- DX는 SDK에서 자유롭게 진화할 수 있다(프레임워크/언어별).

---

## 2. Decision

### D0. 용어 정의 (Normative)

- **Runtime:** Host↔World↔Compiler를 결합하여 "Proposal 실행→terminalSnapshot"을 수렴시키고,
  publish boundary/telemetry/policy를 소유하는 **실행 통합 주체**.
- **SDK:** 개발자 경험(DX)을 제공하는 **표현/접근/프레임워크 통합 레이어**.
  Runtime 위에서 동작하며, Snapshot 접근/선택/구독의 편의 API를 제공한다.
- **App:** v3에서는 **정식(노멀티브) 아키텍처 용어에서 제거**한다.
  필요 시 `@manifesto-ai/app`는 호환성 래퍼(compat wrapper) 또는 SDK의 별칭으로만 존재할 수 있다.

> 결과: "Results are World's; Process is Runtime's; DX is SDK's."

---

### D1. 패키지/레이어 책임 재배치 (Normative)

#### D1.1 Runtime이 소유하는 것 (MUST)

Runtime은 다음을 **직접 구현/소유**한다:

- **Host ↔ World integration**
  - World가 요구하는 executor 인터페이스를 Runtime이 구현한다.
  - Host 내부 실행 모델(ExecutionKey mailbox, job model)은 Runtime에서 흡수한다.
- **Execution policy**
  - ExecutionKey policy
  - approvedScope enforcement
  - retry/serial 정책(필요 시)
- **Proposal Tick 실행 파이프라인**
  - baseSnapshot restore, compute/apply loop orchestration, effect dispatch/fulfill
- **Publish boundary**
  - Proposal Tick 당 state publish 최소 1회, 최대 1회(terminalSnapshot)
- **Telemetry**
  - Host trace/micro-steps를 관측 가능한 이벤트로 변환/스트리밍("Process")
- **Scheduler injection**
  - publish scheduling/coalescing은 런타임 종속이므로 주입 가능해야 한다.

#### D1.2 SDK가 소유하는 것 (MUST)

SDK는 다음을 **직접 구현/소유**한다:

- 개발자용 public API 표면
  - framework integration(React/Vue/etc)
  - subscription helper, selector, memoization 등
- Snapshot 접근 표준(읽기 좌표계)
  - **ADR-005의 Snapshot Path DSL을 표준으로 채택**
- computed/state와 같은 DX projection/alias
  - `computed.` prefix 제거 같은 "표현 개선"은 SDK에서만 수행

#### D1.3 금지 규칙 (Semantic Pollution 방지)

- Runtime은 **DX projection/alias를 제공하지 않는다.**
  - 예: `snapshot.state` alias, computed alias(`computed.doubled`) 등은 Runtime 금지.
- SDK는 **실행/수렴/정책을 재정의하지 않는다.**
  - SDK는 Runtime 위에 얹혀 동작하며, 실행 의미론을 바꾸지 않는다.

---

### D2. Publish boundary 및 채널 분리 (Normative)

#### D2.1 Tick 정의 (재확인)

- **Host Tick:** Host mailbox runner의 수렴 구간(구현 세부사항)
- **Proposal Tick:** 하나의 Proposal 실행 사이클(시작 → terminalSnapshot)

#### D2.2 Publish boundary 규칙

- **PUB-1 (MUST):** Runtime은 Proposal Tick 기준으로 state publish를 **최소 1회, 최대 1회** 발생시킨다.
- **PUB-2 (MUST):** publish 기준 snapshot은 **terminalSnapshot**이다.
- **PUB-3 (MUST NOT):** computed 노드 단위 / apply 호출 단위 publish는 금지한다.

#### D2.3 State vs Telemetry 분리

- **CHAN-1 (MUST):** Runtime은 "state publish"와 "telemetry"를 분리한다.
- **CHAN-2 (MUST):** World 결과(봉인/lineage)는 telemetry에 의존하지 않는다.
  - telemetry는 Process 관측이며, Results/History의 권위가 아니다.

---

### D3. Snapshot Access는 ADR-005로 위임 (Normative)

- **ACCESS-1 (MUST):** Runtime은 Snapshot 접근 문법/표현을 정의하지 않는다.
- **ACCESS-2 (MUST):** SDK는 Snapshot 접근 표준으로 **ADR-005 Snapshot Path DSL**을 채택한다.
- **ACCESS-3 (MUST):** Runtime/World/Core/Host 경계에서 Snapshot canonical shape(`data`, `computed`, `system`, `input`, `meta`)는 유지된다.

> 결과: 실행 의미론(ADR-006)과 접근 의미론(ADR-005)이 분리되어,
> DX 변화가 실행 계약을 오염시키지 않는다.

---

### D4. Semantic Pollution 없는 Canonicalization 규칙 (Normative)

v3에서 "의미론적 좌표계"는 다음 원칙으로 보호한다:

#### D4.1 Raw Snapshot vs Canonical Projection

- **RAW:** 실행/리플레이/디버깅을 위한 전체 Snapshot(모든 필드 포함)
- **CANONICAL:** World identity(해시), delta scope, lineage 등 "의미론적 동일성"에 쓰기 위한 **투영(projection)**

#### D4.2 Canonicalization 사용 범위

- **CAN-1 (MUST):** Canonicalization은 **오직**
  - WorldId/snapshotHash 계산
  - delta 생성/비교
  - lineage 관련 인덱싱
  에만 사용된다.
- **CAN-2 (MUST NOT):** Canonical snapshot을 Core.compute/Core.apply의 입력으로 사용하지 않는다.
  - 실행 의미론은 raw snapshot을 기준으로 수렴한다.

#### D4.3 Platform namespace 제외 (오염 방지)

- **CAN-3 (MUST):** semantic identity 계산에서 platform-owned namespaces는 제외한다.
  - 최소: `data.$host`, `data.$mel`
  - v3에서는 확장 가능성을 위해 `data.$*` 전체를 platform namespace로 취급하는 것을 권장한다(도메인에서 `$` 금지 전제).
- **CAN-4 (MUST):** `input`, `meta.*(timestamp/randomSeed 등)`, `computed`는 semantic identity에 포함하지 않는다(재파생 가능/비결정론/컨텍스트 오염 방지).

> 목적: runtime/compiler/host의 내부 슬롯 변화가 World identity를 바꾸는 "의미론적 오염"을 구조적으로 차단한다.

---

## 3. Architecture Sketch

### 3.1 Dependency Direction (v3)

SDK  ───────────────►  Runtime  ─────────►  World  ─────────►  (WorldStore)
│                         ├─────────────►  Host  ──────────►  Core
│                         └─────────────►  Compiler (MEL → schema/IR, lowering)

- SDK는 Runtime만 안다(호스트/월드 디테일 숨김).
- Runtime은 Host/World/Compiler를 결합한다(통합/흡수).
- World는 governance + persistence + lineage를 소유한다.

---

## 4. Consequences

### Positive

- 실행 의미론(수렴/발행/telemetry)이 DX와 분리되어 안정성이 높아진다.
- SDK는 프레임워크별/런타임별 DX를 독립적으로 진화시킬 수 있다.
- "Snapshot이 단위"라는 헌법을 유지하면서도 접근 혼선(경계 타입 누출)을 구조적으로 막는다.
- platform namespaces를 semantic identity에서 분리하여, 내부 슬롯 변화가 WorldId를 오염시키지 않는다.

### Negative / Trade-offs

- 패키지/개념 재정렬로 마이그레이션 비용이 발생한다.
- SDK/Runtime 분리로 초기 진입점이 2단("SDK로 들어가 Runtime을 만든다")처럼 보일 수 있어,
  문서/온보딩에서 "SDK가 유일한 DX entrypoint"임을 강하게 안내해야 한다.

---

## 5. Migration Notes (Non-normative)

- `@manifesto-ai/app`는 v3에서 deprecated:
  - 가능하면 SDK로 이동(호환 wrapper 제공 가능)
- 기존 `createApp` 성격의 API는 SDK로 이동:
  - SDK 내부에서 Runtime을 구성/생성하거나,
  - `createRuntime()` + `createClient()`(SDK)로 분리할 수 있다.
- Runtime 이벤트/훅 시스템이 필요하면 Runtime이 소유하고 SDK는 구독만 한다.

---

## 6. Non-Goals

- Snapshot canonical shape를 변경하지 않는다.
- Core/Host/World 계약을 DX 때문에 바꾸지 않는다.
- SDK가 실행 의미론(수렴/정책/봉인)을 소유하지 않는다.
- Canonicalization을 실행 입력으로 사용하지 않는다.

---

*End of ADR-006*
