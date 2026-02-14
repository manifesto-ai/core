# ADR-006: Publish Boundary, Canonicalization, and Channel Separation Rules

> **Status:** Proposed
> **Date:** 2026-02-10
> **Revised:** 2026-02-11
> **Deciders:** Manifesto Architecture Team
> **Scope:** Global (Core, Host, World, App)
> **Related:** ADR-001 (Layer Separation), ADR-004 (App Package Internal Decomposition), ADR-007 (SDK/Runtime Split Kickoff Gate and Staged Locking), World HASH rules (platform namespace exclusion)

---

## Revision Notice

이 ADR은 원래 "Runtime Reframing — App 제거, DX는 SDK로, 실행 통합은 Runtime으로"라는
제목으로 제안되었다. 검토 결과, 두 종류의 내용이 혼재되어 있었다:

1. **즉시 적용 가능한 normative 규칙** — Publish boundary, Canonicalization, Channel separation
2. **v3 패키지 구조 결정** — Runtime/SDK 패키지 분할, "App" 제거

패키지 분할 결정은 다음 이유로 유보한다:

- **ADR-004 §7.4가 명시적으로 거부:** "Extract App Runtime as Separate Package — Rejected.
  ADR-001 explicitly decided 'Runtime is not a new layer but the name for App's execution
  environment responsibility.'"
- **ADR-004가 아직 Proposed:** 내부 분해(ADR-004)가 구현되지 않은 상태에서
  패키지 분할을 결정하는 것은 순서가 맞지 않음
- **Constitution §8.2:** "Future requirements not yet specified"는 invalid refactoring motivation

따라서 이 ADR의 scope를 **normative 규칙**으로 축소한다.
패키지 분할은 ADR-004 구현 완료 후, 내부 모듈화로 부족하다는 근거가 생기면
별도 ADR로 제안한다.

---

## 1. Context

v2에서 "App"은 다음 세 역할이 한 덩어리로 묶여 있었다:

1. **Execution Integration** (Host ↔ World 결합, 정책, 관측/telemetry, 스케줄링)
2. **External Facade** (act/subscribe/getState 등 외부 계약 표면)
3. **DX Surface** (상태 접근 표면, computed 접근, 네이밍, 프레임워크 친화 API)

이 결합으로 인해 다음 문제가 관측되었다:

- Publish boundary가 명시적으로 정의되지 않아, 구현에 따라 state publish 빈도가 달라질 수 있음
- State publish와 telemetry가 분리되지 않아, 관측 데이터가 World 결과에 영향을 줄 수 있음
- Semantic identity(World hash) 계산에서 platform namespace 포함 여부가 불명확하여,
  내부 슬롯 변화가 WorldId를 오염시킬 수 있음

이 ADR은 패키지 구조를 변경하지 않고, 위 문제를 해결하는 **normative 규칙**을 정의한다.

---

## 2. Decision

### D1. Publish Boundary 규칙 (Normative)

#### D1.1 Tick 정의 (재확인)

- **Host Tick:** Host mailbox runner의 수렴 구간 (구현 세부사항)
- **Proposal Tick:** 하나의 Proposal 실행 사이클 (시작 → terminalSnapshot)

#### D1.2 Publish 규칙

- **PUB-1 (MUST):** Proposal Tick 기준으로 state publish를 **최소 1회, 최대 1회** 발생시킨다.
- **PUB-2 (MUST):** publish 기준 snapshot은 **terminalSnapshot**이다.
- **PUB-3 (MUST NOT):** computed 노드 단위 / apply 호출 단위 publish는 금지한다.

> 근거: PUB-1~3은 ADR-004 INV-9("state:publish MUST fire at most once per proposal tick")와
> 일관되며, 이를 normative 수준으로 격상한다.

### D2. State vs Telemetry 분리 (Normative)

- **CHAN-1 (MUST):** "state publish"와 "telemetry"를 분리한다.
  - State publish: terminalSnapshot을 외부에 전달하는 채널
  - Telemetry: Host trace/micro-steps 등 process 관측 이벤트
- **CHAN-2 (MUST):** World 결과(봉인/lineage)는 telemetry에 의존하지 않는다.
  - Telemetry는 Process 관측이며, Results/History의 권위가 아니다.

> 근거: "Results are World's" (ADR-001). World의 봉인/lineage는 terminalSnapshot에만
> 의존해야 하며, telemetry 채널의 유무/형식 변화에 영향받지 않아야 한다.

### D3. Canonicalization 규칙 (Normative)

#### D3.1 Raw Snapshot vs Canonical Projection

- **RAW:** 실행/리플레이/디버깅을 위한 전체 Snapshot (모든 필드 포함)
- **CANONICAL:** World identity(해시), delta scope, lineage 등 "의미론적 동일성"에 쓰기 위한 **투영(projection)**

#### D3.2 사용 범위

- **CAN-1 (MUST):** Canonicalization은 **오직**
  - WorldId/snapshotHash 계산
  - delta 생성/비교
  - lineage 관련 인덱싱
  에만 사용된다.
- **CAN-2 (MUST NOT):** Canonical snapshot을 Core.compute/Core.apply의 입력으로 사용하지 않는다.
  - 실행 의미론은 raw snapshot을 기준으로 수렴한다.

#### D3.3 Platform Namespace 제외 (오염 방지)

- **CAN-3 (MUST):** Semantic identity 계산에서 platform-owned namespaces는 제외한다.
  - 최소: `data.$host`, `data.$mel`
  - `data.$*` 전체를 platform namespace로 취급하는 것을 권장한다 (도메인에서 `$` 금지 전제).
- **CAN-4 (MUST):** `input`, `meta.*(timestamp/randomSeed 등)`, `computed`는
  semantic identity에 포함하지 않는다 (재파생 가능/비결정론/컨텍스트 오염 방지).

> 목적: runtime/compiler/host의 내부 슬롯 변화가 World identity를 바꾸는
> "의미론적 오염"을 구조적으로 차단한다.

---

## 3. Non-Goals

- 패키지 구조를 변경하지 않는다 (ADR-004 구현 후 별도 평가).
- "App"을 normative 용어에서 제거하지 않는다 (현 시점에서 불필요).
- Snapshot canonical shape를 변경하지 않는다.
- Core/Host/World 계약을 DX 때문에 바꾸지 않는다.
- Canonicalization을 실행 입력으로 사용하지 않는다.
- Snapshot 접근 좌표계(DSL)를 정의하지 않는다 (ADR-005 Withdrawn 참조).

---

## 4. Consequences

### Positive

- Publish boundary가 명확해져, 구현 간 일관성이 보장된다.
- State publish와 telemetry 분리로, World 봉인/lineage의 독립성이 구조적으로 보장된다.
- Platform namespace를 semantic identity에서 제외하여, 내부 슬롯 변화가 WorldId를 오염시키지 않는다.
- ADR-004의 INV-9를 normative 수준으로 격상하여, pipeline 구현뿐 아니라 전체 아키텍처에 적용한다.

### Negative / Trade-offs

- CAN-3/CAN-4의 "무엇을 제외하는가" 규칙이 확장될 때 명시적 업데이트가 필요하다.
- Telemetry 채널 설계가 아직 구체화되지 않아, CHAN-1의 구현 방식은 후속 작업에서 결정해야 한다.

---

## 5. Deferred Decision: Package-Level Runtime/SDK Split

> **Update (2026-02-14):** Split kickoff timing and gate policy in this section are partially superseded by [ADR-007](./007-sdk-runtime-split-kickoff). ADR-006 remains normative for PUB/CHAN/CAN rules.

다음 결정은 **명시적으로 유보**한다:

| 유보 항목 | 전제 조건 | 판단 시점 |
|-----------|-----------|-----------|
| Runtime 패키지 추출 | ADR-004 구현 완료 + 내부 모듈화 부족 근거 | ADR-004 구현 후 |
| SDK 패키지 추출 | DX 요구사항 구체화 + 프레임워크별 분리 필요성 근거 | v3 설계 시 |
| "App" normative 용어 제거 | Runtime/SDK 분할 결정 확정 | 상동 |

유보된 항목이 필요해질 경우, **ADR-007 정책에 따라 별도의 ADR**로 제안하며
최소 supersede 범위(ADR-004 §7.4, ADR-006 §5 착수 시점 조항)를 명시해야 한다.
ADR-001의 레이어 원칙은 유지한다.

---

## 6. Normative Rules Summary

| Rule | Category | Statement |
|------|----------|-----------|
| PUB-1 | Publish | Proposal Tick당 state publish 최소 1회, 최대 1회 |
| PUB-2 | Publish | Publish 기준은 terminalSnapshot |
| PUB-3 | Publish | Computed/apply 단위 publish 금지 |
| CHAN-1 | Channel | State publish와 telemetry 분리 |
| CHAN-2 | Channel | World 결과는 telemetry에 의존하지 않음 |
| CAN-1 | Canonicalization | Hash/delta/lineage에만 사용 |
| CAN-2 | Canonicalization | Canonical snapshot을 실행 입력으로 사용 금지 |
| CAN-3 | Canonicalization | Platform namespace (`data.$*`) semantic identity 제외 |
| CAN-4 | Canonicalization | `input`, `meta.*`, `computed` semantic identity 제외 |

---

## 7. Non-Normative Companion Evidence

ADR-006의 PUB/CHAN/CAN 규칙에 대한 구현/테스트 추적성은 아래 문서에서 관리한다:

- [ADR-006 Evidence Matrix](./006-evidence-matrix)
- [ADR-006 Split Readiness Pack](./006-split-readiness-pack)

이 문서는 **non-normative**이며, 본 ADR의 규칙 문구를 변경하거나 대체하지 않는다.

---

*End of ADR-006*
